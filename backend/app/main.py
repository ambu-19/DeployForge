import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import docker
import httpx
import redis
import redis.asyncio as aredis
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from prometheus_client import make_asgi_app
from prometheus_client.core import REGISTRY, GaugeMetricFamily
from pydantic import BaseModel
from sqlalchemy import func

from .config import settings
from .db import Deployment, EnvVar, Project, SessionLocal, User, get_db, init_db
from .detect import DEFAULT_DOCKERIGNORE, detect, get_template
from .routing import remove_route, write_platform_routes
from .security import encrypt, make_token, read_token

app = FastAPI(title="DeployForge - Mini PaaS")
rds = redis.Redis.from_url(settings.redis_url, decode_responses=True)
FINAL = ("live", "failed", "superseded")
RESERVED = {"api", "grafana", "www", "traefik", "prometheus"}
GH = "https://api.github.com"


@app.on_event("startup")
def startup():
    try:
        write_platform_routes()
    except OSError as e:
        print("could not write platform routes:", e)
    for _ in range(30):
        try:
            init_db()
            return
        except Exception as e:
            print("waiting for db...", e)
            time.sleep(2)


class DeploymentsCollector:
    def collect(self):
        g = GaugeMetricFamily("deployforge_deployments", "Deployments by status", labels=["status"])
        try:
            with SessionLocal() as db:
                for status, n in db.query(Deployment.status, func.count()).group_by(Deployment.status):
                    g.add_metric([status], n)
        except Exception:
            pass
        yield g


REGISTRY.register(DeploymentsCollector())
app.mount("/metrics", make_asgi_app())


# ---------- auth ----------
def current_user(request: Request, db=Depends(get_db)) -> User:
    t = request.headers.get("authorization", "").removeprefix("Bearer ") or request.query_params.get("token", "")
    try:
        user = db.get(User, read_token(t))
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def own(db, user: User, pid: int) -> Project:
    p = db.get(Project, pid)
    if not p or p.owner_id != user.id:
        raise HTTPException(404, "Project not found")
    return p


@app.get("/api/health")
def health():
    return {"ok": True, "version": "1.0.0", "status": "operational"}


@app.get("/api/auth/status")
def auth_status():
    return {
        "github_configured": bool(settings.github_client_id and settings.github_client_secret),
        "dev_login_enabled": settings.dev_login,
        "public_url": settings.public_url,
        "domain": settings.domain,
        "app_port": os.getenv("APP_PORT", "8080"),
    }


@app.get("/api/auth/login")
def login():
    if not settings.github_client_id:
        raise HTTPException(
            400,
            "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env, or use Demo Login.",
        )
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?client_id={settings.github_client_id}&scope=repo,admin:repo_hook"
    )


@app.get("/api/auth/callback")
def callback(code: str, db=Depends(get_db)):
    r = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
        },
        timeout=15,
    )
    token = r.json().get("access_token")
    if not token:
        raise HTTPException(400, "OAuth token exchange failed with GitHub")
    gh = httpx.get(f"{GH}/user", headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
    user = db.query(User).filter_by(github_id=gh["id"]).first() or User(github_id=gh["id"], login=gh["login"])
    user.gh_token = token
    db.add(user)
    db.commit()
    return RedirectResponse(f"{settings.public_url}/#token={make_token(user.id)}")


@app.post("/api/auth/dev")
def dev_login(db=Depends(get_db)):
    if not settings.dev_login:
        raise HTTPException(403, "Demo login is disabled in configuration")
    user = db.query(User).filter_by(github_id=0).first() or User(github_id=0, login="demo")
    db.add(user)
    db.commit()
    return {"token": make_token(user.id), "user": {"login": user.login, "github": False}}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return {
        "id": user.id,
        "login": user.login,
        "github": bool(user.gh_token),
    }


@app.get("/api/github/repos")
def repos(user=Depends(current_user)):
    if not user.gh_token:
        # Return empty list or sample if demo user
        return []
    try:
        r = httpx.get(
            f"{GH}/user/repos?sort=pushed&per_page=100",
            headers={"Authorization": f"Bearer {user.gh_token}"},
            timeout=15,
        )
        if r.is_success:
            return [
                {
                    "full_name": x["full_name"],
                    "name": x.get("name", x["full_name"].split("/")[-1]),
                    "description": x.get("description") or "",
                    "default_branch": x.get("default_branch", "main"),
                    "private": x.get("private", False),
                    "updated_at": x.get("pushed_at") or x.get("updated_at"),
                    "stars": x.get("stargazers_count", 0),
                    "html_url": x.get("html_url", f"https://github.com/{x['full_name']}"),
                }
                for x in r.json()
            ]
    except Exception as e:
        print("GitHub repos fetch error:", e)
    return []


# ---------- projects ----------
def project_out(p: Project, db):
    live = db.query(Deployment).filter_by(project_id=p.id, status="live").order_by(Deployment.id.desc()).first()
    latest = db.query(Deployment).filter_by(project_id=p.id).order_by(Deployment.id.desc()).first()
    
    is_running = False
    try:
        cs = docker.from_env().containers.list(filters={"label": f"df.project={p.slug}"})
        is_running = bool(cs and cs[0].status == "running")
    except Exception:
        pass

    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "repo": p.repo,
        "branch": p.branch,
        "root_dir": getattr(p, "root_dir", "") or "",
        "port": p.port,
        "health_path": p.health_path,
        "framework": p.framework or "Node.js",
        "custom_dockerfile": p.custom_dockerfile,
        "build_cmd": p.build_cmd,
        "start_cmd": p.start_cmd,
        "url": f"{settings.app_scheme}://{p.slug}.{settings.domain}{settings.url_suffix}",
        "live_deployment": live.id if live else None,
        "latest_status": latest.status if latest else "none",
        "is_running": is_running,
        "created_at": latest.created_at.isoformat() if latest else None,
    }


class ProjectIn(BaseModel):
    repo: str
    branch: str = "main"
    name: str | None = None
    port: int = 8080
    health_path: str = "/"
    framework: str | None = None
    custom_dockerfile: str | None = None
    build_cmd: str | None = None
    start_cmd: str | None = None
    root_dir: str | None = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    branch: str | None = None
    port: int | None = None
    health_path: str | None = None
    framework: str | None = None
    custom_dockerfile: str | None = None
    build_cmd: str | None = None
    start_cmd: str | None = None
    root_dir: str | None = None


def new_deployment(db, p: Project, kind="manual", image=None, sha="", msg="") -> Deployment:
    d = Deployment(project_id=p.id, kind=kind, image=image, commit_sha=sha, message=msg)
    db.add(d)
    db.commit()
    rds.rpush("jobs", d.id)
    return d


@app.post("/api/projects")
def create_project(body: ProjectIn, user=Depends(current_user), db=Depends(get_db)):
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", body.repo):
        raise HTTPException(400, "Repository must be in 'owner/repo' format")
    name = body.name or body.repo.split("/")[1]
    slug = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")[:30] or "app"
    if slug in RESERVED or db.query(Project).filter_by(slug=slug).first():
        slug = f"{slug}-{int(time.time()) % 10000}"

    p = Project(
        owner_id=user.id,
        name=name,
        slug=slug,
        repo=body.repo,
        branch=body.branch,
        port=body.port,
        health_path=body.health_path,
        framework=body.framework,
        custom_dockerfile=body.custom_dockerfile,
        build_cmd=body.build_cmd,
        start_cmd=body.start_cmd,
        root_dir=(body.root_dir or "").strip("/\\"),
    )

    if user.gh_token and "localhost" not in settings.public_url:
        try:
            h = httpx.post(
                f"{GH}/repos/{body.repo}/hooks",
                headers={"Authorization": f"Bearer {user.gh_token}"},
                json={
                    "name": "web",
                    "active": True,
                    "events": ["push"],
                    "config": {
                        "url": f"{settings.public_url}/api/webhooks/github",
                        "content_type": "json",
                        "secret": settings.webhook_secret,
                    },
                },
                timeout=10,
            )
            if h.is_success:
                p.webhook_id = h.json()["id"]
        except Exception:
            pass

    db.add(p)
    db.commit()
    new_deployment(db, p, msg="Initial deploy")
    return project_out(p, db)


@app.get("/api/projects")
def list_projects(user=Depends(current_user), db=Depends(get_db)):
    return [project_out(p, db) for p in db.query(Project).filter_by(owner_id=user.id).order_by(Project.id.desc())]


@app.get("/api/projects/{pid}")
def get_project(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    return project_out(p, db)


@app.patch("/api/projects/{pid}")
def update_project(pid: int, body: ProjectUpdate, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    if body.name is not None:
        p.name = body.name
    if body.branch is not None:
        p.branch = body.branch
    if body.port is not None:
        p.port = body.port
    if body.health_path is not None:
        p.health_path = body.health_path
    if body.framework is not None:
        p.framework = body.framework
    if body.custom_dockerfile is not None:
        p.custom_dockerfile = body.custom_dockerfile
    if body.build_cmd is not None:
        p.build_cmd = body.build_cmd
    if body.start_cmd is not None:
        p.start_cmd = body.start_cmd
    if body.root_dir is not None:
        p.root_dir = body.root_dir.strip("/\\")
    db.commit()
    return project_out(p, db)


@app.delete("/api/projects/{pid}", status_code=204)
def delete_project(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    d = docker.from_env()
    for c in d.containers.list(all=True, filters={"label": f"df.project={p.slug}"}):
        c.remove(force=True)
    remove_route(p.slug)
    if p.webhook_id and user.gh_token:
        try:
            httpx.delete(
                f"{GH}/repos/{p.repo}/hooks/{p.webhook_id}",
                headers={"Authorization": f"Bearer {user.gh_token}"},
                timeout=10,
            )
        except Exception:
            pass
    db.query(EnvVar).filter_by(project_id=p.id).delete()
    db.query(Deployment).filter_by(project_id=p.id).delete()
    db.delete(p)
    db.commit()


@app.post("/api/projects/{pid}/deploy")
def deploy_now(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    return {"id": new_deployment(db, p, msg="Manual deploy").id}


@app.post("/api/projects/{pid}/restart")
def restart_project(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    d = docker.from_env()
    cs = d.containers.list(all=True, filters={"label": f"df.project={p.slug}"})
    if not cs:
        # Trigger redeploy
        return {"id": new_deployment(db, p, msg="Restart / redeploy").id, "restarted": False}
    for c in cs:
        c.restart()
    return {"restarted": True}


@app.post("/api/projects/{pid}/stop")
def stop_project(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    d = docker.from_env()
    for c in d.containers.list(filters={"label": f"df.project={p.slug}"}):
        c.stop()
    return {"stopped": True}


@app.get("/api/projects/{pid}/deployments")
def deployments(pid: int, user=Depends(current_user), db=Depends(get_db)):
    own(db, user, pid)
    rows = db.query(Deployment).filter_by(project_id=pid).order_by(Deployment.id.desc()).limit(50)
    return [
        {
            "id": d.id,
            "status": d.status,
            "kind": d.kind,
            "commit": d.commit_sha,
            "message": d.message,
            "created_at": d.created_at.isoformat(),
            "finished_at": d.finished_at.isoformat() if d.finished_at else None,
            "can_rollback": bool(d.image) and d.status in ("superseded", "live"),
        }
        for d in rows
    ]


@app.post("/api/deployments/{did}/rollback")
def rollback(did: int, user=Depends(current_user), db=Depends(get_db)):
    d = db.get(Deployment, did)
    if not d:
        raise HTTPException(404, "Deployment not found")
    p = own(db, user, d.project_id)
    if not d.image:
        raise HTTPException(400, "This release has no built image")
    return {"id": new_deployment(db, p, "rollback", d.image, d.commit_sha, f"Rollback to #{d.id}").id}


@app.get("/api/deployments/{did}/logs")
async def logs(did: int, user=Depends(current_user), db=Depends(get_db)):
    d = db.get(Deployment, did)
    if not d:
        raise HTTPException(404, "Deployment not found")
    own(db, user, d.project_id)

    async def gen():
        ar = aredis.Redis.from_url(settings.redis_url, decode_responses=True)
        i = 0
        while True:
            lines = await ar.lrange(f"logs:{did}", i, -1)
            for ln in lines:
                yield f"data: {json.dumps(ln)}\n\n"
            i += len(lines)
            with SessionLocal() as s:
                cur = s.get(Deployment, did)
                status, stored = (cur.status, cur.logs or "") if cur else ("failed", "")
            if not lines and status in FINAL:
                if i == 0:  # replay from stored DB logs if Redis expired
                    for ln in stored.splitlines():
                        yield f"data: {json.dumps(ln)}\n\n"
                yield "event: end\ndata: done\n\n"
                await ar.aclose()
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------- detection and dockerfile studio ----------
class DetectRequest(BaseModel):
    repo: str | None = None
    branch: str = "main"
    root_dir: str | None = None
    template: str | None = None


MANIFEST_FILENAMES = {
    "package.json", "vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs",
    "next.config.js", "next.config.mjs", "next.config.ts", "angular.json",
    "nuxt.config.js", "nuxt.config.ts", "svelte.config.js",
    "requirements.txt", "pyproject.toml", "Pipfile", "Procfile",
    "pom.xml", "build.gradle", "build.gradle.kts",
    "go.mod", "composer.json", "artisan", "Dockerfile", "index.html",
    ".env.example", ".env.sample", ".dockerignore",
}


def safe_github_get(url: str, headers: dict, timeout: int = 12, retries: int = 3):
    """Resilient GitHub API request with automatic retry for transient network/DNS failures."""
    last_err = None
    for attempt in range(retries):
        try:
            return httpx.get(url, headers=headers, timeout=timeout)
        except Exception as e:
            last_err = e
            time.sleep(0.4)
    raise last_err


@app.post("/api/detect")
def detect_repo(body: DetectRequest, user=Depends(current_user)):
    if body.template:
        return get_template(body.template).to_dict()

    if not body.repo:
        return get_template("react-vite").to_dict()

    headers = {"Accept": "application/vnd.github.v3+json"}
    if user.gh_token:
        headers["Authorization"] = f"Bearer {user.gh_token}"

    tmp = tempfile.mkdtemp()
    p = Path(tmp)
    try:
        # 1. GitHub Git Trees API for recursive repository inspection in one request
        r = safe_github_get(
            f"{GH}/repos/{body.repo}/git/trees/{body.branch}?recursive=1",
            headers=headers,
            timeout=12,
        )
        tree_items = r.json().get("tree", []) if r.is_success and isinstance(r.json(), dict) else []

        manifest_items = []
        if tree_items:
            for item in tree_items:
                path_str = item.get("path", "")
                parts = path_str.split("/")
                filename = parts[-1]
                if len(parts) <= 5 and filename in MANIFEST_FILENAMES:
                    if not any(ign in parts for ign in [".git", "node_modules", "dist", "build", ".venv", "__pycache__"]):
                        manifest_items.append(item)

        # Download manifest files into local tmp mirror using GitHub API blob endpoint (unthrottled & resilient)
        for item in manifest_items[:35]:
            rel_path = item.get("path", "")
            blob_url = item.get("url")
            content_str = None
            if blob_url:
                try:
                    br = safe_github_get(blob_url, headers=headers, timeout=8)
                    if br.is_success:
                        bjson = br.json()
                        if bjson.get("encoding") == "base64" and "content" in bjson:
                            content_str = base64.b64decode(bjson["content"]).decode("utf-8", errors="ignore")
                except Exception:
                    pass

            if content_str is None:
                try:
                    c_url = f"{GH}/repos/{body.repo}/contents/{rel_path}?ref={body.branch}"
                    cr = safe_github_get(c_url, headers=headers, timeout=8)
                    if cr.is_success:
                        cjson = cr.json()
                        if isinstance(cjson, dict) and cjson.get("encoding") == "base64":
                            content_str = base64.b64decode(cjson["content"]).decode("utf-8", errors="ignore")
                        elif isinstance(cr.text, str):
                            content_str = cr.text
                except Exception:
                    pass

            if content_str is not None:
                target_file = p / rel_path
                target_file.parent.mkdir(parents=True, exist_ok=True)
                target_file.write_text(content_str, encoding="utf-8")

        req_root = (body.root_dir or "").strip("/\\")
        from .detect import detect, scan_repository
        all_apps = scan_repository(p)

        if req_root and (p / req_root).is_dir():
            res = detect(p / req_root)
            out = res.to_dict()
            out["apps"] = all_apps
            out["root_dir"] = req_root
            out["monorepo"] = len(all_apps) > 1 or (len(all_apps) == 1 and all_apps[0]["path"] != ".")
            return out

        res = detect(p)
        out = res.to_dict()
        out["apps"] = all_apps
        out["monorepo"] = len(all_apps) > 1 or (len(all_apps) == 1 and all_apps[0]["path"] != ".")
        if all_apps and out.get("root_dir") in ("", "."):
            if len(all_apps) > 0 and all_apps[0]["path"] != ".":
                out["root_dir"] = all_apps[0]["path"]
        return out

    except Exception as e:
        print("detection fallback error:", e)
        fallback = get_template("react-vite").to_dict()
        fallback["details"] = f"Auto-configured fallback (stack inspection notice: {e})"
        return fallback
    finally:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


@app.get("/api/templates")
def list_templates():
    return [
        {"id": "react-vite", "name": "React + Vite (Nginx SPA)", "language": "TypeScript / JavaScript", "port": 80},
        {"id": "react-cra", "name": "React (Create React App)", "language": "JavaScript / TypeScript", "port": 80},
        {"id": "vue-vite", "name": "Vue.js (Vite)", "language": "JavaScript / TypeScript", "port": 80},
        {"id": "angular", "name": "Angular SPA", "language": "TypeScript", "port": 80},
        {"id": "svelte", "name": "Svelte SPA", "language": "JavaScript / TypeScript", "port": 80},
        {"id": "nodejs", "name": "Node.js Server (Express / Nest / API)", "language": "JavaScript / TypeScript", "port": 8080},
        {"id": "nextjs", "name": "Next.js Application", "language": "TypeScript / JavaScript", "port": 3000},
        {"id": "nuxt", "name": "Nuxt.js Application", "language": "TypeScript / JavaScript", "port": 3000},
        {"id": "python-fastapi", "name": "Python FastAPI", "language": "Python 3.12", "port": 8000},
        {"id": "python-flask", "name": "Python Flask", "language": "Python 3.12", "port": 5000},
        {"id": "python-django", "name": "Python Django", "language": "Python 3.12", "port": 8000},
        {"id": "go", "name": "Go Application", "language": "Go 1.22", "port": 8080},
        {"id": "php-laravel", "name": "PHP / Laravel", "language": "PHP 8.2", "port": 80},
        {"id": "php-apache", "name": "PHP Application (Apache)", "language": "PHP 8.2", "port": 80},
        {"id": "java-maven", "name": "Java Spring Boot (Maven)", "language": "Java 21", "port": 8080},
        {"id": "java-gradle", "name": "Java Spring Boot (Gradle)", "language": "Java 21", "port": 8080},
        {"id": "static-html", "name": "Static HTML / CSS / JS", "language": "HTML/Web", "port": 80},
    ]


class ValidateRequest(BaseModel):
    dockerfile: str


@app.post("/api/validate-dockerfile")
def validate_dockerfile(body: ValidateRequest):
    df = body.dockerfile.strip()
    errors = []
    warnings = []
    if not df:
        errors.append("Dockerfile cannot be empty")
        return {"valid": False, "errors": errors, "warnings": warnings}

    if not re.search(r"^\s*FROM\s+", df, re.MULTILINE | re.IGNORECASE):
        errors.append("Missing mandatory 'FROM <image>' instruction")

    if not re.search(r"^\s*(CMD|ENTRYPOINT)\s+", df, re.MULTILINE | re.IGNORECASE):
        warnings.append("No CMD or ENTRYPOINT found. Container will use base image default command.")

    if not re.search(r"^\s*EXPOSE\s+\d+", df, re.MULTILINE | re.IGNORECASE):
        warnings.append("No EXPOSE instruction found. Consider exposing your application port.")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}


# ---------- env vars ----------
class EnvIn(BaseModel):
    key: str
    value: str


@app.get("/api/projects/{pid}/env")
def get_env(pid: int, user=Depends(current_user), db=Depends(get_db)):
    own(db, user, pid)
    return [{"key": e.key, "value": "••••••••"} for e in db.query(EnvVar).filter_by(project_id=pid)]


@app.put("/api/projects/{pid}/env")
def put_env(pid: int, body: EnvIn, user=Depends(current_user), db=Depends(get_db)):
    own(db, user, pid)
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", body.key) or body.key == "PORT":
        raise HTTPException(400, "Invalid environment variable key name")
    e = db.query(EnvVar).filter_by(project_id=pid, key=body.key).first() or EnvVar(project_id=pid, key=body.key)
    e.value_enc = encrypt(body.value)
    db.add(e)
    db.commit()
    return {"ok": True}


@app.delete("/api/projects/{pid}/env/{key}", status_code=204)
def del_env(pid: int, key: str, user=Depends(current_user), db=Depends(get_db)):
    own(db, user, pid)
    db.query(EnvVar).filter_by(project_id=pid, key=key).delete()
    db.commit()


# ---------- runtime stats and platform overview ----------
@app.get("/api/projects/{pid}/stats")
def stats(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    cs = docker.from_env().containers.list(filters={"label": f"df.project={p.slug}"})
    if not cs:
        return {"running": False, "cpu": 0, "mem_mb": 0, "mem_limit_mb": 0, "logs": ""}
    c = cs[0]
    s = c.stats(stream=False)
    cpu_d = s["cpu_stats"]["cpu_usage"]["total_usage"] - s["precpu_stats"]["cpu_usage"]["total_usage"]
    sys_d = s["cpu_stats"].get("system_cpu_usage", 0) - s["precpu_stats"].get("system_cpu_usage", 0)
    cpu = cpu_d / sys_d * (s["cpu_stats"].get("online_cpus") or 1) * 100 if sys_d > 0 else 0
    mem = s["memory_stats"].get("usage", 0) - s["memory_stats"].get("stats", {}).get("inactive_file", 0)
    return {
        "running": True,
        "cpu": round(cpu, 1),
        "mem_mb": round(mem / 1048576, 1),
        "mem_limit_mb": round(s["memory_stats"].get("limit", 0) / 1048576),
        "logs": c.logs(tail=100).decode(errors="replace"),
    }


@app.get("/api/overview")
def platform_overview(user=Depends(current_user), db=Depends(get_db)):
    projs = db.query(Project).filter_by(owner_id=user.id).all()
    proj_ids = [p.id for p in projs]

    total_projects = len(projs)
    
    d = docker.from_env()
    running_apps = 0
    for p in projs:
        cs = d.containers.list(filters={"label": f"df.project={p.slug}"})
        if cs and cs[0].status == "running":
            running_apps += 1

    deps = db.query(Deployment).filter(Deployment.project_id.in_(proj_ids)).order_by(Deployment.id.desc()).limit(10).all() if proj_ids else []
    
    successful = db.query(func.count(Deployment.id)).filter(Deployment.project_id.in_(proj_ids), Deployment.status.in_(["live", "superseded"])).scalar() if proj_ids else 0
    failed = db.query(func.count(Deployment.id)).filter(Deployment.project_id.in_(proj_ids), Deployment.status == "failed").scalar() if proj_ids else 0
    total_deps = successful + failed

    proj_map = {p.id: p.name for p in projs}

    recent_activity = [
        {
            "id": dep.id,
            "project_name": proj_map.get(dep.project_id, f"Project #{dep.project_id}"),
            "status": dep.status,
            "kind": dep.kind,
            "commit": dep.commit_sha,
            "message": dep.message,
            "created_at": dep.created_at.isoformat(),
        }
        for dep in deps
    ]

    return {
        "total_projects": total_projects,
        "running_apps": running_apps,
        "successful_deployments": successful,
        "failed_deployments": failed,
        "total_deployments": total_deps,
        "success_rate": round((successful / total_deps * 100), 1) if total_deps > 0 else 100.0,
        "recent_activity": recent_activity,
        "domain": settings.domain,
        "public_url": settings.public_url,
    }


@app.get("/api/monitoring")
def monitoring_data(user=Depends(current_user), db=Depends(get_db)):
    projs = db.query(Project).filter_by(owner_id=user.id).all()
    d = docker.from_env()

    containers = []
    total_cpu = 0.0
    total_mem = 0.0

    for p in projs:
        cs = d.containers.list(all=True, filters={"label": f"df.project={p.slug}"})
        if cs:
            c = cs[0]
            cpu = 0.0
            mem = 0.0
            if c.status == "running":
                try:
                    s = c.stats(stream=False)
                    cpu_d = s["cpu_stats"]["cpu_usage"]["total_usage"] - s["precpu_stats"]["cpu_usage"]["total_usage"]
                    sys_d = s["cpu_stats"].get("system_cpu_usage", 0) - s["precpu_stats"].get("system_cpu_usage", 0)
                    cpu = round(cpu_d / sys_d * (s["cpu_stats"].get("online_cpus") or 1) * 100, 1) if sys_d > 0 else 0
                    mem = round((s["memory_stats"].get("usage", 0) - s["memory_stats"].get("stats", {}).get("inactive_file", 0)) / 1048576, 1)
                except Exception:
                    pass
            total_cpu += cpu
            total_mem += mem
            containers.append({
                "project_id": p.id,
                "project_name": p.name,
                "container_id": c.short_id,
                "name": c.name,
                "status": c.status,
                "cpu": cpu,
                "mem_mb": mem,
                "port": p.port,
                "health_path": p.health_path,
                "url": f"{settings.app_scheme}://{p.slug}.{settings.domain}{settings.url_suffix}",
            })

    # Prometheus check
    prom_healthy = False
    try:
        pr = httpx.get("http://prometheus:9090/-/healthy", timeout=2)
        prom_healthy = pr.status_code == 200
    except Exception:
        prom_healthy = False

    return {
        "prometheus_healthy": prom_healthy,
        "grafana_url": f"http://grafana.{settings.domain}{settings.url_suffix}",
        "total_cpu": round(total_cpu, 1),
        "total_mem_mb": round(total_mem, 1),
        "containers": containers,
    }


# ---------- GitHub webhook ----------
@app.post("/api/webhooks/github")
async def webhook(request: Request, db=Depends(get_db)):
    body = await request.body()
    want = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, request.headers.get("x-hub-signature-256", "")):
        return JSONResponse({"detail": "bad signature"}, status_code=401)
    event = request.headers.get("x-github-event")
    if event == "ping":
        return {"pong": True}
    if event != "push":
        return {"ignored": event}
    pl = json.loads(body)
    branch = pl["ref"].removeprefix("refs/heads/")
    ids = []
    for p in db.query(Project).filter_by(repo=pl["repository"]["full_name"], branch=branch):
        ids.append(
            new_deployment(
                db,
                p,
                "push",
                None,
                pl["after"][:7],
                (pl.get("head_commit") or {}).get("message", "")[:300],
            ).id
        )
    return {"queued": ids}
