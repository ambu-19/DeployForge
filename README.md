# 🔨 DeployForge — a mini PaaS

Connect a GitHub repo → auto-detect (Node/Python/Java) → build image → blue-green deploy to `<app>.<domain>` →
health-checked, monitored, one-click rollback.

## Run it (local, 3 commands)
```bash
cp .env.example .env
docker compose up -d --build
open http://localhost        # click "Demo login"
```
Apps appear at `http://<slug>.localhost` (browsers resolve `*.localhost` automatically). Grafana: `http://grafana.localhost` (admin / admin).

**Try it:** push `examples/hello-node` to a public GitHub repo, then "New project" → `you/hello-node`. Add env var `GREETING`, hit *Deploy now*, see it change with zero downtime; break `/` (return 500) and push to watch the health check keep the old version live.

## GitHub OAuth + webhooks (real login, push-to-deploy)
1. Create an OAuth App: callback `http://<your-domain>/api/auth/callback`.
2. Set `GITHUB_CLIENT_ID/SECRET`, `PUBLIC_URL` (must be publicly reachable, e.g. your VM or an ngrok URL), `DEV_LOGIN=0`.
3. Creating a project registers a `push` webhook automatically → `POST /api/webhooks/github` (HMAC-verified).

## How it works
| Piece | Where |
|---|---|
| API, OAuth, webhooks, env/secrets (Fernet-encrypted), SSE logs, stats | `backend/app/main.py` |
| Queue consumer: clone → detect → build (Docker SDK) → start green → health check → switch → drain → remove blue | `backend/app/worker.py` |
| Dockerfile generation | `backend/app/detect.py` |
| Zero-downtime switch = atomic rewrite of a Traefik file-provider route | `backend/app/routing.py` |
| Rollback = redeploy a stored image through the same pipeline (no rebuild) | `POST /api/deployments/{id}/rollback` |
| Health-check gate + auto-rollback | `deploy()` keeps old version if green fails; `monitor()` redeploys previous image after 3 failed checks |
| Metrics | cAdvisor + Traefik + API `/metrics` → Prometheus → Grafana dashboard |

## Deploy to a VM with Terraform (DigitalOcean)
```bash
cd infra/terraform
terraform init && terraform apply -var do_token=... -var ssh_key_fingerprint=... -var repo_url=https://github.com/you/deployforge -var domain=yourdomain.dev
```
Creates droplet + firewall + `@`/`*` DNS records and boots the stack via cloud-init.

## CI/CD (GitHub Actions)
`ci.yml`: ruff, pytest, frontend build, `docker compose build`. `cd.yml`: on green main, SSH to the VM, pull, rebuild. Secrets: `VM_HOST`, `VM_USER`, `VM_SSH_KEY`.
To dogfood: register this repo as a DeployForge project for the `frontend` (give it a Dockerfile, port 80).

## Dev
`cd backend && pip install -r requirements-dev.txt && pytest` · `cd frontend && npm i && npm run dev`

## Known limits / next steps
HTTPS (add Traefik ACME resolver; wildcard needs DNS-01), single worker, no build caching across clones, Docker socket is trusted (run user code only on a dedicated VM), no per-project resource plans.

## Team split
Frontend `frontend/` · API+auth `backend/app/main.py` · Engine `worker.py/detect.py/routing.py` · Infra `docker-compose.yml, infra/terraform` · Monitoring/CI `infra/prometheus, infra/grafana, .github, backend/tests`
