"""Build + deploy engine. Consumes deployment ids from Redis, uses the Docker SDK."""
import os
import shutil
import subprocess
import tempfile
import threading
import time
from datetime import datetime

import docker
import httpx
import redis

from .config import settings
from .db import Deployment, EnvVar, Project, SessionLocal, User, init_db
from .detect import DEFAULT_DOCKERIGNORE, detect
from .routing import write_route
from .security import decrypt
from .tunnel import start_tunnel, stop_tunnel

dock = docker.from_env()
rds = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def container_name(slug: str, dep_id: int) -> str:
    return f"df-{slug}-{dep_id}"


def healthy(name: str, port: int, path: str) -> bool:
    try:
        r = httpx.get(f"http://{name}:{port}{path}", timeout=3)
        return r.status_code < 500
    except Exception:
        return False


def run(cmd, log, cwd=None, mask=""):
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in proc.stdout:
        log(line.rstrip().replace(mask, "***") if mask else line.rstrip())
    if proc.wait() != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd[:2])}")


def build(db, dep, proj, log):
    dep.status = "building"
    db.commit()
    tmp = tempfile.mkdtemp()
    try:
        owner = db.get(User, proj.owner_id)
        tok = owner.gh_token if owner else ""
        url = f"https://x-access-token:{tok}@github.com/{proj.repo}.git" if tok else f"https://github.com/{proj.repo}.git"
        src = os.path.join(tmp, "src")
        log(f"▶ [1/5] Cloning repository {proj.repo}@{proj.branch}")
        run(["git", "clone", "--depth", "1", "--branch", proj.branch, url, src], log, mask=tok)
        dep.commit_sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=src, text=True).strip()
        dep.message = subprocess.check_output(["git", "log", "-1", "--pretty=%s"], cwd=src, text=True).strip()[:300]
        
        log("▶ [2/5] Analyzing workspace and project structure")
        root_dir = (getattr(proj, "root_dir", "") or "").strip("/\\")
        target_dir = os.path.join(src, root_dir) if root_dir else src

        if not os.path.isdir(target_dir):
            log(f"⚠ Warning: Configured root_dir '{root_dir}' not found. Falling back to repository root.")
            target_dir = src
            root_dir = ""

        # Auto-discover nested subproject if root_dir is empty and root is not directly deployable
        if not root_dir:
            from .detect import detect_single_dir, scan_repository
            direct = detect_single_dir(target_dir)
            if not direct:
                apps = scan_repository(target_dir)
                if apps:
                    target_rel = apps[0]["path"]
                    if target_rel != ".":
                        log(f"▶ Auto-discovered application subdirectory: {target_rel}")
                        target_dir = os.path.join(src, target_rel)
                        proj.root_dir = target_rel
                        db.commit()

        dockerfile = "Dockerfile"
        ignore_content = DEFAULT_DOCKERIGNORE

        if proj.custom_dockerfile and proj.custom_dockerfile.strip():
            log(f"▶ Using user-configured Dockerfile for {proj.name}")
            dockerfile = "Dockerfile.deployforge"
            with open(os.path.join(target_dir, dockerfile), "w", encoding="utf-8") as f:
                f.write(proj.custom_dockerfile.strip())
        elif os.path.exists(os.path.join(target_dir, "Dockerfile")):
            log(f"▶ Using existing Dockerfile found in application folder ({root_dir or '.'})")
            dockerfile = "Dockerfile"
        else:
            res = detect(target_dir)
            kind, text = res[0], res[1]
            fw_name = getattr(res, "framework", kind)
            log(f"▶ Detected {fw_name} project in '{root_dir or '.'}'. Generating production Dockerfile:\n{text}")
            dockerfile = "Dockerfile.deployforge"
            with open(os.path.join(target_dir, dockerfile), "w", encoding="utf-8") as f:
                f.write(text)
            
            # Auto-adjust port if project was on default 8080 and detection requires another port (e.g. 80 for React/Vite/Nginx)
            det_port = getattr(res, "recommended_port", None)
            if det_port and proj.port == 8080 and det_port != 8080:
                log(f"▶ Auto-calibrating container port to {det_port} for {fw_name}")
                proj.port = det_port
                db.commit()
            if not proj.framework and fw_name:
                proj.framework = fw_name
                db.commit()
            if getattr(res, "dockerignore", None):
                ignore_content = res.dockerignore

        ignore = os.path.join(target_dir, ".dockerignore")
        if not os.path.exists(ignore):
            with open(ignore, "w", encoding="utf-8") as f:
                f.write(ignore_content)

        tag = f"df/{proj.slug}:{dep.id}"
        log(f"▶ [3/5] Building Docker image {tag} from context '{root_dir or '.'}'")
        for chunk in dock.api.build(path=target_dir, dockerfile=dockerfile, tag=tag, rm=True, decode=True):
            if "error" in chunk:
                raise RuntimeError(chunk["error"].strip())
            if chunk.get("stream", "").strip():
                log(chunk["stream"].rstrip())
        dep.image = tag
        db.commit()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def deploy(db, dep, proj, log):
    dep.status = "deploying"
    db.commit()
    env = {e.key: decrypt(e.value_enc) for e in db.query(EnvVar).filter_by(project_id=proj.id)}
    env["PORT"] = str(proj.port)
    name = container_name(proj.slug, dep.id)
    try:
        dock.containers.get(name).remove(force=True)
    except docker.errors.NotFound:
        pass
    log(f"▶ [4/5] Starting container {name} (port {proj.port})")
    c = dock.containers.run(
        dep.image, name=name, detach=True, environment=env, network=settings.network,
        labels={"df.project": proj.slug, "df.deployment": str(dep.id)},
        restart_policy={"Name": "unless-stopped"}, mem_limit="512m", nano_cpus=int(0.5e9),
    )
    log(f"▶ [5/5] Performing health checks on {proj.health_path} (port {proj.port})...")
    ok, deadline = 0, time.time() + 60
    while time.time() < deadline and ok < 3:
        c.reload()
        if c.status != "running":
            break
        if healthy(name, proj.port, proj.health_path):
            ok += 1
            log(f"  ✔ Health probe {ok}/3 succeeded")
        else:
            ok = 0
        time.sleep(2)
    if ok < 3:
        c.reload()
        st = c.status
        exit_code = c.attrs.get("State", {}).get("ExitCode", "unknown")
        tail = c.logs(tail=40).decode(errors="replace")
        c.remove(force=True)
        diag = (
            f"Health check failed on {proj.health_path} (status: {st}, exit code: {exit_code}).\n"
            f"Diagnostic tips:\n"
            f" - Verify your application listens on 0.0.0.0 (not 127.0.0.1) and matches PORT {proj.port}.\n"
            f" - Check required environment variables and database credentials.\n"
            f"Previous live release remains active.\n"
            f"--- Container logs ---\n{tail}"
        )
        raise RuntimeError(diag)
    log("✔ Health checks passed! Performing zero-downtime blue-green routing switch")
    write_route(proj.slug, name, proj.port)
    time.sleep(2)  # drain in-flight requests
    for old in dock.containers.list(all=True, filters={"label": f"df.project={proj.slug}"}):
        if old.name != name:
            old.remove(force=True)
    for prev in db.query(Deployment).filter(Deployment.project_id == proj.id, Deployment.status == "live", Deployment.id != dep.id):
        prev.status = "superseded"
    dep.status = "live"
    live_url = f"{settings.app_scheme}://{proj.slug}.{settings.domain}{settings.url_suffix}"
    log(f"✔ Successfully live at {live_url}")
    if getattr(proj, "deployment_mode", "local") == "public":
        log("▶ Initializing Cloudflare Quick Tunnel for public HTTPS access...")
        try:
            pub_url, status = start_tunnel(proj.slug)
            if pub_url and status == "connected":
                proj.public_url = pub_url
                proj.tunnel_status = "connected"
                db.commit()
                log(f"✔ Public HTTPS URL active: {pub_url}")
            else:
                proj.tunnel_status = "error"
                db.commit()
                log("⚠ Cloudflare tunnel initialization delayed. You can retry from project settings.")
        except Exception as e:
            proj.tunnel_status = "error"
            db.commit()
            log(f"⚠ Could not start Cloudflare tunnel: {e}")
    else:
        # Local mode: if a tunnel was previously running, stop it
        stop_tunnel(proj.slug)
        proj.tunnel_status = "disconnected"
        db.commit()


def process(dep_id: int):
    with SessionLocal() as db:
        dep = db.get(Deployment, dep_id)
        if not dep:
            return
        proj = db.get(Project, dep.project_id)
        if not proj:
            return
        key = f"logs:{dep_id}"
        log = lambda m: rds.rpush(key, m)  # noqa: E731
        try:
            if not dep.image:
                build(db, dep, proj, log)
            deploy(db, dep, proj, log)
        except Exception as e:  # noqa: BLE001
            log(f"✗ {e}")
            dep.status = "failed"
        dep.finished_at = datetime.utcnow()
        dep.logs = "\n".join(rds.lrange(key, 0, -1))
        rds.expire(key, 3600)
        db.commit()


def monitor():
    """Auto-rollback: 3 consecutive failed health checks on a live release -> redeploy previous image."""
    fails: dict[int, int] = {}
    while True:
        time.sleep(10)
        try:
            with SessionLocal() as db:
                for dep in db.query(Deployment).filter_by(status="live").all():
                    proj = db.get(Project, dep.project_id)
                    if not proj:
                        continue
                    if healthy(container_name(proj.slug, dep.id), proj.port, proj.health_path):
                        fails[dep.id] = 0
                        continue
                    fails[dep.id] = fails.get(dep.id, 0) + 1
                    if fails[dep.id] < 3:
                        continue
                    prev = (
                        db.query(Deployment)
                        .filter(Deployment.project_id == proj.id, Deployment.status == "superseded", Deployment.image.isnot(None))
                        .order_by(Deployment.id.desc())
                        .first()
                    )
                    if not prev:
                        continue
                    dep.status = "failed"
                    new = Deployment(
                        project_id=proj.id,
                        kind="auto-rollback",
                        image=prev.image,
                        commit_sha=prev.commit_sha,
                        message=f"Auto-rollback from #{dep.id} (health check failing)",
                    )
                    db.add(new)
                    db.commit()
                    rds.rpush("jobs", new.id)
                    fails.pop(dep.id, None)
        except Exception as e:  # noqa: BLE001
            print("monitor error:", e)


def main():
    for _ in range(30):
        try:
            init_db()
            break
        except Exception:
            time.sleep(2)
    threading.Thread(target=monitor, daemon=True).start()
    print("DeployForge worker ready")
    while True:
        item = rds.blpop("jobs", timeout=5)
        if item:
            try:
                process(int(item[1]))
            except Exception as e:  # noqa: BLE001
                print("job error:", e)


if __name__ == "__main__":
    main()
