"""Traefik file-provider routes. Atomic rewrite == blue-green traffic switch."""
import json
import os

from .config import settings


def _path(slug: str) -> str:
    return os.path.join(settings.routes_dir, f"{slug}.yml")


def write_route(slug: str, container: str, port: int):
    os.makedirs(settings.routes_dir, exist_ok=True)
    name = f"df-{slug}"
    cfg = {"http": {
        "routers": {name: {"rule": f"Host(`{slug}.{settings.domain}`)", "entryPoints": ["web"], "service": name}},
        "services": {name: {"loadBalancer": {"servers": [{"url": f"http://{container}:{port}"}]}}},
    }}
    tmp = _path(slug) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cfg, f)  # JSON is valid YAML
    os.replace(tmp, _path(slug))


def remove_route(slug: str):
    try:
        os.remove(_path(slug))
    except FileNotFoundError:
        pass


def write_platform_routes():
    """Routes for the platform itself (UI, API, Grafana), so Traefik needs no Docker socket."""
    os.makedirs(settings.routes_dir, exist_ok=True)
    host = f"Host(`{settings.domain}`)"
    cfg = {"http": {
        "routers": {
            "df-api": {"rule": f"{host} && (PathPrefix(`/api`) || PathPrefix(`/metrics`))", "priority": 100, "entryPoints": ["web"], "service": "df-api"},
            "df-ui": {"rule": host, "priority": 1, "entryPoints": ["web"], "service": "df-ui"},
            "df-grafana": {"rule": f"Host(`grafana.{settings.domain}`)", "entryPoints": ["web"], "service": "df-grafana"},
        },
        "services": {
            "df-api": {"loadBalancer": {"servers": [{"url": "http://backend:8000"}]}},
            "df-ui": {"loadBalancer": {"servers": [{"url": "http://frontend:80"}]}},
            "df-grafana": {"loadBalancer": {"servers": [{"url": "http://grafana:3000"}]}},
        },
    }}
    tmp = os.path.join(settings.routes_dir, "_platform.yml.tmp")
    with open(tmp, "w") as f:
        json.dump(cfg, f)
    os.replace(tmp, os.path.join(settings.routes_dir, "_platform.yml"))
