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
from .detect import detect
from .routing import write_route
from .security import decrypt

dock = docker.from_env()
rds = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def container_name(slug: str, dep_id: int) -> str:
    return f"df-{slug}-{dep_id}"


def healthy(name: str, port: int, path: str) -> bool:
    try:
        return httpx.get(f"http://{name}:{port}{path}", timeout=3).status_code < 500
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
        log(f"▶ Cloning {proj.repo}@{proj.branch}")
        run(["git", "clone", "--depth", "1", "--branch", proj.branch, url, src], log, mask=tok)
        dep.commit_sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=src, text=True).strip()
        dep.message = subprocess.check_output(["git", "log", "-1", "--pretty=%s"], cwd=src, text=True).strip()[:300]
        dockerfile = "Dockerfile"
        if os.path.exists(os.path.join(src, "Dockerfile")):
            log("▶ Using the repository's own Dockerfile")
        else:
            kind, text = detect(src)
            log(f"▶ Detected {kind} project, generated Dockerfile:\n{text}")
            dockerfile = "Dockerfile.deployforge"
            with open(os.path.join(src, dockerfile), "w") as f:
                f.write(text)
        ignore = os.path.join(src, ".dockerignore")
        if not os.path.exists(ignore):
            with open(ignore, "w") as f:
                f.write(".git\nnode_modules\n__pycache__\n.venv\n")
        tag = f"df/{proj.slug}:{dep.id}"
        log(f"▶ Building image {tag}")
        for chunk in dock.api.build(path=src, dockerfile=dockerfile, tag=tag, rm=True, decode=True):
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
    log(f"▶ Starting green container {name}")
    c = dock.containers.run(
        dep.image, name=name, detach=True, environment=env, network=settings.network,
        labels={"df.project": proj.slug, "df.deployment": str(dep.id)},
        restart_policy={"Name": "unless-stopped"}, mem_limit="512m", nano_cpus=int(0.5e9),
    )
    ok, deadline = 0, time.time() + 60
    while time.time() < deadline and ok < 3:
        c.reload()
        if c.status != "running":
            break
        ok = ok + 1 if healthy(name, proj.port, proj.health_path) else 0
        time.sleep(2)
    if ok < 3:
        tail = c.logs(tail=30).decode(errors="replace")
        c.remove(force=True)
        raise RuntimeError(f"health check failed on {proj.health_path}; old version stays live.\n--- container logs ---\n{tail}")
    log("✔ Health checks passed, switching traffic")
    write_route(proj.slug, name, proj.port)  # atomic traffic switch
    time.sleep(3)  # drain in-flight requests
    for old in dock.containers.list(all=True, filters={"label": f"df.project={proj.slug}"}):
        if old.name != name:
            old.remove(force=True)
    for prev in db.query(Deployment).filter(Deployment.project_id == proj.id, Deployment.status == "live", Deployment.id != dep.id):
        prev.status = "superseded"
    dep.status = "live"
    log(f"✔ Live at {settings.app_scheme}://{proj.slug}.{settings.domain}{settings.url_suffix}")


def process(dep_id: int):
    with SessionLocal() as db:
        dep = db.get(Deployment, dep_id)
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
                    if healthy(container_name(proj.slug, dep.id), proj.port, proj.health_path):
                        fails[dep.id] = 0
                        continue
                    fails[dep.id] = fails.get(dep.id, 0) + 1
                    if fails[dep.id] < 3:
                        continue
                    prev = (db.query(Deployment).filter(Deployment.project_id == proj.id, Deployment.status == "superseded",
                                                        Deployment.image.isnot(None)).order_by(Deployment.id.desc()).first())
                    if not prev:
                        continue
                    dep.status = "failed"
                    new = Deployment(project_id=proj.id, kind="auto-rollback", image=prev.image, commit_sha=prev.commit_sha,
                                     message=f"Auto-rollback from #{dep.id} (health check failing)")
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
    print("worker ready")
    while True:
        item = rds.blpop("jobs", timeout=5)
        if item:
            try:
                process(int(item[1]))
            except Exception as e:  # noqa: BLE001
                print("job error:", e)


if __name__ == "__main__":
    main()
