import asyncio
import hashlib
import hmac
import json
import re
import time

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
from .routing import remove_route, write_platform_routes
from .security import encrypt, make_token, read_token

app = FastAPI(title="DeployForge")
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
        except Exception:
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
    return {"ok": True}


@app.get("/api/auth/login")
def login():
    if not settings.github_client_id:
        raise HTTPException(400, "GitHub OAuth not configured; set GITHUB_CLIENT_ID/SECRET or use demo login")
    return RedirectResponse(f"https://github.com/login/oauth/authorize?client_id={settings.github_client_id}&scope=repo,admin:repo_hook")


@app.get("/api/auth/callback")
def callback(code: str, db=Depends(get_db)):
    r = httpx.post("https://github.com/login/oauth/access_token", headers={"Accept": "application/json"},
                   data={"client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": code})
    token = r.json().get("access_token")
    if not token:
        raise HTTPException(400, "OAuth exchange failed")
    gh = httpx.get(f"{GH}/user", headers={"Authorization": f"Bearer {token}"}).json()
    user = db.query(User).filter_by(github_id=gh["id"]).first() or User(github_id=gh["id"], login=gh["login"])
    user.gh_token = token
    db.add(user)
    db.commit()
    return RedirectResponse(f"{settings.public_url}/#token={make_token(user.id)}")


@app.post("/api/auth/dev")
def dev_login(db=Depends(get_db)):
    if not settings.dev_login:
        raise HTTPException(403, "disabled")
    user = db.query(User).filter_by(github_id=0).first() or User(github_id=0, login="demo")
    db.add(user)
    db.commit()
    return {"token": make_token(user.id)}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return {"login": user.login, "github": bool(user.gh_token)}


@app.get("/api/github/repos")
def repos(user=Depends(current_user)):
    if not user.gh_token:
        return []
    r = httpx.get(f"{GH}/user/repos?sort=pushed&per_page=100", headers={"Authorization": f"Bearer {user.gh_token}"})
    return [{"full_name": x["full_name"], "default_branch": x["default_branch"]} for x in r.json()] if r.is_success else []


# ---------- projects ----------
def project_out(p: Project, db):
    live = db.query(Deployment).filter_by(project_id=p.id, status="live").order_by(Deployment.id.desc()).first()
    return {"id": p.id, "name": p.name, "slug": p.slug, "repo": p.repo, "branch": p.branch, "port": p.port,
            "health_path": p.health_path, "url": f"{settings.app_scheme}://{p.slug}.{settings.domain}{settings.url_suffix}",
            "live_deployment": live.id if live else None}


class ProjectIn(BaseModel):
    repo: str
    branch: str = "main"
    name: str | None = None
    port: int = 8080
    health_path: str = "/"


def new_deployment(db, p: Project, kind="manual", image=None, sha="", msg="") -> Deployment:
    d = Deployment(project_id=p.id, kind=kind, image=image, commit_sha=sha, message=msg)
    db.add(d)
    db.commit()
    rds.rpush("jobs", d.id)
    return d


@app.post("/api/projects")
def create_project(body: ProjectIn, user=Depends(current_user), db=Depends(get_db)):
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", body.repo):
        raise HTTPException(400, "repo must look like owner/name")
    name = body.name or body.repo.split("/")[1]
    slug = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")[:30] or "app"
    if slug in RESERVED or db.query(Project).filter_by(slug=slug).first():
        slug = f"{slug}-{int(time.time()) % 10000}"
    p = Project(owner_id=user.id, name=name, slug=slug, repo=body.repo, branch=body.branch,
                port=body.port, health_path=body.health_path)
    if user.gh_token and "localhost" not in settings.public_url:
        try:
            h = httpx.post(f"{GH}/repos/{body.repo}/hooks", headers={"Authorization": f"Bearer {user.gh_token}"}, json={
                "name": "web", "active": True, "events": ["push"],
                "config": {"url": f"{settings.public_url}/api/webhooks/github", "content_type": "json", "secret": settings.webhook_secret}})
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


@app.delete("/api/projects/{pid}", status_code=204)
def delete_project(pid: int, user=Depends(current_user), db=Depends(get_db)):
    p = own(db, user, pid)
    d = docker.from_env()
    for c in d.containers.list(all=True, filters={"label": f"df.project={p.slug}"}):
        c.remove(force=True)
    remove_route(p.slug)
    if p.webhook_id and user.gh_token:
        try:
            httpx.delete(f"{GH}/repos/{p.repo}/hooks/{p.webhook_id}", headers={"Authorization": f"Bearer {user.gh_token}"})
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


@app.get("/api/projects/{pid}/deployments")
def deployments(pid: int, user=Depends(current_user), db=Depends(get_db)):
    own(db, user, pid)
    rows = db.query(Deployment).filter_by(project_id=pid).order_by(Deployment.id.desc()).limit(50)
    return [{"id": d.id, "status": d.status, "kind": d.kind, "commit": d.commit_sha, "message": d.message,
             "created_at": d.created_at.isoformat(), "can_rollback": bool(d.image) and d.status in ("superseded", "live")} for d in rows]


@app.post("/api/deployments/{did}/rollback")
def rollback(did: int, user=Depends(current_user), db=Depends(get_db)):
    d = db.get(Deployment, did)
    if not d:
        raise HTTPException(404)
    p = own(db, user, d.project_id)
    if not d.image:
        raise HTTPException(400, "This release has no built image")
    return {"id": new_deployment(db, p, "rollback", d.image, d.commit_sha, f"Rollback to #{d.id}").id}


@app.get("/api/deployments/{did}/logs")
async def logs(did: int, user=Depends(current_user), db=Depends(get_db)):
    d = db.get(Deployment, did)
    if not d:
        raise HTTPException(404)
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
                status, stored = cur.status, cur.logs or ""
            if not lines and status in FINAL:
                if i == 0:  # redis expired: replay from DB
                    for ln in stored.splitlines():
                        yield f"data: {json.dumps(ln)}\n\n"
                yield "event: end\ndata: done\n\n"
                await ar.aclose()
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream")


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
        raise HTTPException(400, "invalid key")
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


# ---------- runtime stats ----------
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
    return {"running": True, "cpu": round(cpu, 1), "mem_mb": round(mem / 1048576, 1),
            "mem_limit_mb": round(s["memory_stats"].get("limit", 0) / 1048576),
            "logs": c.logs(tail=100).decode(errors="replace")}


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
        ids.append(new_deployment(db, p, "push", None, pl["after"][:7], (pl.get("head_commit") or {}).get("message", "")[:300]).id)
    return {"queued": ids}
