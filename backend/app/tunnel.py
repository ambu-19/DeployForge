"""Cloudflare Quick Tunnel integration for DeployForge.
Provides free, instant public HTTPS access to deployed applications without requiring
a domain, credit card, or Cloudflare account.
"""
import logging
import re
import time
from typing import Optional, Tuple

import docker
from docker.errors import NotFound

from .config import settings

logger = logging.getLogger("deployforge.tunnel")
CONTAINER_PREFIX = "df-tunnel-"
URL_REGEX = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")


def get_container_name(slug: str) -> str:
    return f"{CONTAINER_PREFIX}{slug}"


def extract_url_from_logs(logs_text: str) -> Optional[str]:
    match = URL_REGEX.search(logs_text)
    return match.group(0) if match else None


def get_tunnel_status(slug: str) -> dict:
    """Inspect the tunnel container status and public URL for a project slug."""
    cname = get_container_name(slug)
    try:
        client = docker.from_env()
        c = client.containers.get(cname)
        if c.status == "running":
            logs = c.logs(tail=100).decode("utf-8", errors="replace")
            url = extract_url_from_logs(logs)
            return {
                "status": "connected" if url else "starting",
                "public_url": url,
                "container_id": c.id[:12],
            }
        return {
            "status": "disconnected",
            "public_url": None,
            "container_id": c.id[:12],
        }
    except NotFound:
        return {
            "status": "disconnected",
            "public_url": None,
            "container_id": None,
        }
    except Exception as e:
        logger.error(f"Error checking tunnel status for {slug}: {e}")
        return {
            "status": "error",
            "public_url": None,
            "container_id": None,
        }


def stop_tunnel(slug: str) -> bool:
    """Stop and remove the tunnel container for a project slug."""
    cname = get_container_name(slug)
    try:
        client = docker.from_env()
        c = client.containers.get(cname)
        c.stop(timeout=3)
        c.remove(force=True)
        return True
    except NotFound:
        return False
    except Exception as e:
        logger.warning(f"Failed to stop tunnel container {cname}: {e}")
        try:
            client = docker.from_env()
            c = client.containers.get(cname)
            c.remove(force=True)
            return True
        except Exception:
            return False


def start_tunnel(slug: str, domain: Optional[str] = None, timeout: float = 15.0) -> Tuple[Optional[str], str]:
    """Start a Cloudflare Quick Tunnel container proxying to Traefik for the given slug.
    Returns (public_url, status).
    """
    dom = domain or settings.domain
    cname = get_container_name(slug)
    stop_tunnel(slug)

    cmd = [
        "tunnel",
        "--protocol", "http2",
        "--no-autoupdate",
        "--url", "http://traefik:80",
        "--http-host-header", f"{slug}.{dom}",
    ]

    client = docker.from_env()
    try:
        container = client.containers.run(
            "cloudflare/cloudflared:latest",
            command=cmd,
            name=cname,
            network=settings.network,
            detach=True,
            restart_policy={"Name": "unless-stopped"},
            labels={
                "df.tunnel": slug,
                "df.type": "tunnel",
            },
        )
    except Exception as e:
        logger.error(f"Failed to run cloudflared container {cname}: {e}")
        return None, "error"

    start_time = time.time()
    while time.time() - start_time < timeout:
        time.sleep(0.5)
        try:
            container.reload()
            if container.status not in ("running", "created"):
                logger.error(f"Tunnel container {cname} exited with status {container.status}")
                return None, "error"
            logs = container.logs(tail=80).decode("utf-8", errors="replace")
            url = extract_url_from_logs(logs)
            if url:
                return url, "connected"
        except Exception as e:
            logger.warning(f"Error while polling tunnel logs for {cname}: {e}")

    # Fallback check
    try:
        logs = container.logs(tail=120).decode("utf-8", errors="replace")
        url = extract_url_from_logs(logs)
        if url:
            return url, "connected"
    except Exception:
        pass

    return None, "error"


def restart_tunnel(slug: str, domain: Optional[str] = None, timeout: float = 15.0) -> Tuple[Optional[str], str]:
    """Restart tunnel and extract new public URL."""
    stop_tunnel(slug)
    return start_tunnel(slug, domain=domain, timeout=timeout)
