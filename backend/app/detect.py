"""Intelligent framework detection and Dockerfile generator for DeployForge.
Supports Universal Auto-Deployment for modern web frontends, backends, and microservices.
"""
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DOCKERIGNORE = """.git
.gitignore
node_modules
dist
build
.venv
venv
__pycache__
*.pyc
.env
.env.local
.DS_Store
target
vendor
"""

REACT_VITE_DOCKERFILE = """# Multi-stage Dockerfile for React + Vite SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""

REACT_CRA_DOCKERFILE = """# Multi-stage Dockerfile for Create React App SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""

VUE_DOCKERFILE = """# Multi-stage Dockerfile for Vue.js SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""

ANGULAR_DOCKERFILE = """# Multi-stage Dockerfile for Angular SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --configuration=production

FROM nginx:alpine
# Copy compiled output (supporting dist/, dist/<app>/ or dist/<app>/browser/)
COPY --from=build /app/dist /tmp/dist
RUN cp -r /tmp/dist/* /usr/share/nginx/html/ 2>/dev/null || cp -r /tmp/dist/*/* /usr/share/nginx/html/ 2>/dev/null || true
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""

SVELTE_DOCKERFILE = """# Multi-stage Dockerfile for Svelte SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    error_page 500 502 503 504 /50x.html; \\
    location = /50x.html { \\
        root /usr/share/nginx/html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""

NEXTJS_DOCKERFILE = """FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
"""

NUXT_DOCKERFILE = """FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
"""

NODE_BACKEND_DOCKERFILE = """FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --if-present
ENV NODE_ENV=production
EXPOSE {port}
CMD {cmd}
"""

PYTHON_DOCKERFILE = """FROM python:3.12-slim
WORKDIR /app
COPY requirements*.txt pyproject.toml* ./
RUN pip install --no-cache-dir gunicorn "uvicorn[standard]" && {install}
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE {port}
CMD {cmd}
"""

JAVA_DOCKERFILE = """FROM {build_image} AS build
WORKDIR /app
COPY . .
RUN {build_cmd} && cp $(ls {jar_glob} | grep -v -e plain -e original -e sources | head -1) /app.jar

FROM eclipse-temurin:21-jre
COPY --from=build /app.jar /app.jar
EXPOSE {port}
CMD ["sh", "-c", "java -Dserver.port=$PORT -jar /app.jar"]
"""

GO_DOCKERFILE = """FROM golang:1.22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server .

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=build /app/server /app/server
ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
"""

PHP_LARAVEL_DOCKERFILE = """FROM php:8.2-apache
WORKDIR /var/www/html
RUN apt-get update && apt-get install -y libpng-dev libonig-dev libxml2-dev zip unzip git curl && \\
    docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd && \\
    a2enmod rewrite
RUN sed -ri -e 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!/var/www/html/public!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction --ignore-platform-reqs || true
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache || true
EXPOSE 80
CMD ["apache2-foreground"]
"""

PHP_VANILLA_DOCKERFILE = """FROM php:8.2-apache
WORKDIR /var/www/html
RUN a2enmod rewrite
COPY . /var/www/html/
EXPOSE 80
CMD ["apache2-foreground"]
"""

STATIC_HTML_DOCKERFILE = """FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN echo 'server { \\
    listen 80; \\
    server_name localhost; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"""


def _compose_yaml(service_name: str, port: int) -> str:
    return f"""version: '3.8'
services:
  {service_name}:
    build: .
    ports:
      - "{port}:{port}"
    environment:
      - PORT={port}
    restart: unless-stopped
"""


class DetectionResult(tuple):
    """Tuple subclass (kind, dockerfile) for full backward compatibility, with rich PaaS metadata."""

    def __new__(
        cls,
        kind: str,
        dockerfile: str,
        framework: str = "",
        language: str = "",
        package_manager: str = "npm",
        build_command: str = "",
        start_command: str = "",
        recommended_port: int = 8080,
        health_path: str = "/",
        dockerignore: str = "",
        docker_compose: str = "",
        details: str = "",
        root_dir: str = "",
        apps: Optional[List[Dict[str, Any]]] = None,
        env_vars: Optional[List[str]] = None,
    ):
        instance = super().__new__(cls, (kind, dockerfile))
        instance.kind = kind
        instance.dockerfile = dockerfile
        instance.framework = framework or kind
        instance.language = language
        instance.package_manager = package_manager
        instance.build_command = build_command
        instance.start_command = start_command
        instance.recommended_port = recommended_port
        instance.health_path = health_path
        instance.dockerignore = dockerignore or DEFAULT_DOCKERIGNORE
        instance.docker_compose = docker_compose
        instance.details = details
        instance.root_dir = root_dir
        instance.apps = apps or []
        instance.env_vars = env_vars or []
        return instance

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "framework": self.framework,
            "language": self.language,
            "package_manager": self.package_manager,
            "build_command": self.build_command,
            "start_command": self.start_command,
            "recommended_port": self.recommended_port,
            "health_path": self.health_path,
            "dockerfile": self.dockerfile,
            "dockerignore": self.dockerignore,
            "docker_compose": self.docker_compose,
            "details": self.details,
            "root_dir": self.root_dir,
            "monorepo": len(self.apps) > 1 or (len(self.apps) == 1 and self.apps[0].get("path") != "."),
            "apps": self.apps,
            "env_vars": self.env_vars,
        }


def extract_env_keys(p: Path) -> List[str]:
    """Parse environment variable names from .env.example or similar sample files."""
    keys: List[str] = []
    for candidate in [".env.example", ".env.sample", ".env.template", ".env.defaults", ".env.local.example"]:
        ef = p / candidate
        if ef.is_file():
            try:
                for line in ef.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k = line.split("=", 1)[0].strip()
                        if k and k not in keys:
                            keys.append(k)
            except Exception:
                pass
    return keys


def _detect_node(p: Path) -> DetectionResult:
    pkg_file = p / "package.json"
    pkg = {}
    if pkg_file.exists():
        try:
            pkg = json.loads(pkg_file.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            pkg = {}

    scripts = pkg.get("scripts", {})
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    env_vars = extract_env_keys(p)

    # 1. Angular
    is_angular = "@angular/core" in deps or (p / "angular.json").exists()
    if is_angular:
        return DetectionResult(
            kind="node",
            dockerfile=ANGULAR_DOCKERFILE,
            framework="Angular",
            language="TypeScript",
            package_manager="npm",
            build_command="npm run build --configuration=production",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Detected Angular framework with angular.json / @angular/core. Multi-stage build producing static assets served by Nginx on port 80.",
            env_vars=env_vars,
        )

    # 2. Next.js
    is_next = "next" in deps or (p / "next.config.js").exists() or (p / "next.config.mjs").exists() or (p / "next.config.ts").exists()
    if is_next:
        return DetectionResult(
            kind="node",
            dockerfile=NEXTJS_DOCKERFILE,
            framework="Next.js",
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="npm start",
            recommended_port=3000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 3000),
            details="Detected Next.js full-stack framework. Configured for production standalone/SSR build on port 3000.",
            env_vars=env_vars,
        )

    # 3. Nuxt.js
    is_nuxt = "nuxt" in deps or (p / "nuxt.config.js").exists() or (p / "nuxt.config.ts").exists()
    if is_nuxt:
        return DetectionResult(
            kind="node",
            dockerfile=NUXT_DOCKERFILE,
            framework="Nuxt.js",
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="node .output/server/index.mjs",
            recommended_port=3000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 3000),
            details="Detected Nuxt.js framework. Built with Nitro server on port 3000.",
            env_vars=env_vars,
        )

    # 4. Vite (React or Vue or Svelte)
    is_vite = (
        "vite" in deps
        or "@vitejs/plugin-react" in deps
        or "@vitejs/plugin-vue" in deps
        or (p / "vite.config.js").exists()
        or (p / "vite.config.ts").exists()
        or (p / "vite.config.mjs").exists()
        or (p / "vite.config.cjs").exists()
        or any("vite" in str(v) for v in scripts.values())
    )

    if is_vite:
        if "vue" in deps or "@vitejs/plugin-vue" in deps:
            fw = "Vue.js (Vite)"
            df = VUE_DOCKERFILE
        elif "svelte" in deps or "@sveltejs/vite-plugin-svelte" in deps:
            fw = "Svelte (Vite)"
            df = SVELTE_DOCKERFILE
        else:
            fw = "React + Vite"
            df = REACT_VITE_DOCKERFILE

        return DetectionResult(
            kind="node",
            dockerfile=df,
            framework=fw,
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details=f"Detected {fw} application. Multi-stage build deploying production dist to Nginx with SPA routing fallback on port 80.",
            env_vars=env_vars,
        )

    # 5. Create React App (react-scripts)
    if "react-scripts" in deps:
        return DetectionResult(
            kind="node",
            dockerfile=REACT_CRA_DOCKERFILE,
            framework="React (Create React App)",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Detected React Create React App project. Multi-stage build copying build/ directory to Nginx with SPA routing on port 80.",
            env_vars=env_vars,
        )

    # 6. Svelte / SvelteKit (without explicit Vite match)
    if "svelte" in deps or "@sveltejs/kit" in deps:
        return DetectionResult(
            kind="node",
            dockerfile=SVELTE_DOCKERFILE,
            framework="Svelte",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Detected Svelte web project. Static production assets served by Nginx on port 80.",
            env_vars=env_vars,
        )

    # 7. Vue CLI (without Vite)
    if "vue" in deps or "@vue/cli-service" in deps:
        return DetectionResult(
            kind="node",
            dockerfile=VUE_DOCKERFILE,
            framework="Vue.js",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Detected Vue.js SPA. Static build served via Nginx on port 80.",
            env_vars=env_vars,
        )

    # 8. Node.js Backend (Express, Nest, Fastify, vanilla)
    framework_name = "Node.js Server"
    port = 8080
    build_cmd = "npm run build --if-present"

    if "@nestjs/core" in deps:
        framework_name = "NestJS"
        port = 3000
    elif "express" in deps:
        framework_name = "Express.js"
        port = 8080
    elif "fastify" in deps:
        framework_name = "Fastify"
        port = 8080

    if "start:prod" in scripts and "@nestjs/core" in deps:
        cmd_str = '["npm", "run", "start:prod"]'
        start_cmd = "npm run start:prod"
    elif "start" in scripts:
        cmd_str = '["npm", "start"]'
        start_cmd = "npm start"
    else:
        entry_candidates = [
            pkg.get("main"),
            "server.js",
            "app.js",
            "index.js",
            "src/index.js",
            "src/server.js",
            "src/app.js",
            "bin/www",
        ]
        chosen = None
        for cand in entry_candidates:
            if cand and (p / cand).exists():
                chosen = cand
                break
        if chosen:
            cmd_str = json.dumps(["node", chosen])
            start_cmd = f"node {chosen}"
        else:
            cmd_str = '["npm", "start"]'
            start_cmd = "npm start"

    df = NODE_BACKEND_DOCKERFILE.format(cmd=cmd_str, port=port)
    return DetectionResult(
        kind="node",
        dockerfile=df,
        framework=framework_name,
        language="JavaScript / TypeScript",
        package_manager="npm",
        build_command=build_cmd,
        start_command=start_cmd,
        recommended_port=port,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("api", port),
        details=f"Detected {framework_name} application. Start command: {start_cmd} on port {port}.",
        env_vars=env_vars,
    )


def _detect_python(p: Path) -> DetectionResult:
    req_file = p / "requirements.txt"
    req_text = req_file.read_text(encoding="utf-8", errors="ignore").lower() if req_file.exists() else ""
    pyproject_file = p / "pyproject.toml"
    pyproject_text = pyproject_file.read_text(encoding="utf-8", errors="ignore").lower() if pyproject_file.exists() else ""
    pipfile = p / "Pipfile"
    pipfile_text = pipfile.read_text(encoding="utf-8", errors="ignore").lower() if pipfile.exists() else ""
    combined_meta = f"{req_text}\n{pyproject_text}\n{pipfile_text}"
    env_vars = extract_env_keys(p)

    install = "pip install --no-cache-dir -r requirements.txt" if req_file.exists() else "pip install --no-cache-dir ."

    # Check Procfile first
    proc_cmd = None
    proc = p / "Procfile"
    if proc.exists():
        for line in proc.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("web:"):
                proc_cmd = line[4:].strip()
                break

    if proc_cmd:
        framework = "Python"
        port = 8000
        cmd = proc_cmd
        start_cmd = proc_cmd
    elif "fastapi" in combined_meta:
        framework = "FastAPI"
        port = 8000
        mod = "app.main:app" if (p / "app" / "main.py").exists() else "main:app"
        start_cmd = f"uvicorn {mod} --host 0.0.0.0 --port $PORT"
        cmd = f'["sh", "-c", "uvicorn {mod} --host 0.0.0.0 --port ${{PORT:-8000}}"]'
    elif "django" in combined_meta or (p / "manage.py").exists():
        framework = "Django"
        port = 8000
        wsgi_candidates = list(p.glob("*/wsgi.py"))
        wsgi_app = f"{wsgi_candidates[0].parent.name}.wsgi:application" if wsgi_candidates else "core.wsgi:application"
        start_cmd = f"gunicorn --bind 0.0.0.0:$PORT {wsgi_app}"
        cmd = f'["sh", "-c", "python manage.py migrate --noinput && gunicorn --bind 0.0.0.0:${{PORT:-8000}} {wsgi_app}"]'
    elif "flask" in combined_meta:
        framework = "Flask"
        port = 5000
        mod = "app:app" if (p / "app.py").exists() else "main:app"
        start_cmd = f"gunicorn -b 0.0.0.0:$PORT {mod}"
        cmd = f'["sh", "-c", "gunicorn -b 0.0.0.0:${{PORT:-5000}} {mod}"]'
    else:
        framework = "Python"
        port = 8000
        entry = "app.py" if (p / "app.py").exists() else ("main.py" if (p / "main.py").exists() else "app.py")
        start_cmd = f"python {entry}"
        cmd = f'["python", "{entry}"]'

    df = PYTHON_DOCKERFILE.format(install=install, cmd=cmd, port=port)
    return DetectionResult(
        kind="python",
        dockerfile=df,
        framework=framework,
        language="Python 3.12",
        package_manager="pip",
        build_command=install,
        start_command=start_cmd,
        recommended_port=port,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("api", port),
        details=f"Detected {framework} application using Python 3.12. Start command: {start_cmd} on port {port}.",
        env_vars=env_vars,
    )


def _detect_java(p: Path) -> DetectionResult:
    env_vars = extract_env_keys(p)
    if (p / "pom.xml").exists():
        df = JAVA_DOCKERFILE.format(
            build_image="maven:3.9-eclipse-temurin-21",
            build_cmd="mvn -q -B package -DskipTests",
            jar_glob="target/*.jar",
            port=8080,
        )
        return DetectionResult(
            kind="java",
            dockerfile=df,
            framework="Java Spring Boot (Maven)",
            language="Java 21",
            package_manager="Maven",
            build_command="mvn clean package -DskipTests",
            start_command="java -jar /app.jar",
            recommended_port=8080,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("app", 8080),
            details="Detected Maven Spring Boot application. Multi-stage build with Eclipse Temurin JRE 21 on port 8080.",
            env_vars=env_vars,
        )
    df = JAVA_DOCKERFILE.format(
        build_image="gradle:8-jdk21",
        build_cmd="gradle -q bootJar -x test --no-daemon",
        jar_glob="build/libs/*.jar",
        port=8080,
    )
    return DetectionResult(
        kind="java",
        dockerfile=df,
        framework="Java Spring Boot (Gradle)",
        language="Java 21",
        package_manager="Gradle",
        build_command="gradle bootJar -x test",
        start_command="java -jar /app.jar",
        recommended_port=8080,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("app", 8080),
        details="Detected Gradle Spring Boot application. Multi-stage build with Eclipse Temurin JRE 21 on port 8080.",
        env_vars=env_vars,
    )


def _detect_go(p: Path) -> DetectionResult:
    env_vars = extract_env_keys(p)
    return DetectionResult(
        kind="go",
        dockerfile=GO_DOCKERFILE,
        framework="Go Application",
        language="Go 1.22",
        package_manager="go modules",
        build_command="go build -o /app/server .",
        start_command="/app/server",
        recommended_port=8080,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("app", 8080),
        details="Detected Go application with go.mod. Multi-stage build with Alpine runtime on port 8080.",
        env_vars=env_vars,
    )


def _detect_php(p: Path) -> DetectionResult:
    composer_file = p / "composer.json"
    comp_text = composer_file.read_text(encoding="utf-8", errors="ignore").lower() if composer_file.exists() else ""
    is_laravel = (p / "artisan").exists() or "laravel/framework" in comp_text
    env_vars = extract_env_keys(p)

    if is_laravel:
        return DetectionResult(
            kind="php",
            dockerfile=PHP_LARAVEL_DOCKERFILE,
            framework="PHP (Laravel)",
            language="PHP 8.2",
            package_manager="Composer",
            build_command="composer install --no-dev --optimize-autoloader",
            start_command="apache2-foreground",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Detected Laravel application. Apache 2 runtime with mod_rewrite pointing to public/ directory on port 80.",
            env_vars=env_vars,
        )
    return DetectionResult(
        kind="php",
        dockerfile=PHP_VANILLA_DOCKERFILE,
        framework="PHP Application",
        language="PHP 8.2",
        package_manager="Composer",
        build_command="composer install --no-dev",
        start_command="apache2-foreground",
        recommended_port=80,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("web", 80),
        details="Detected PHP application. Apache 2 runtime with mod_rewrite on port 80.",
        env_vars=env_vars,
    )


def _detect_static(p: Path) -> DetectionResult:
    env_vars = extract_env_keys(p)
    return DetectionResult(
        kind="static",
        dockerfile=STATIC_HTML_DOCKERFILE,
        framework="Static HTML/CSS/JS",
        language="HTML / CSS / JavaScript",
        package_manager="none",
        build_command="none",
        start_command="nginx -g 'daemon off;'",
        recommended_port=80,
        health_path="/",
        dockerignore=DEFAULT_DOCKERIGNORE,
        docker_compose=_compose_yaml("web", 80),
        details="Detected static web project. Served through high-performance Nginx Alpine on port 80.",
        env_vars=env_vars,
    )


def detect_single_dir(path: Path) -> Optional[DetectionResult]:
    """Inspect a single directory for project markers. Returns None if no markers found."""
    p = Path(path)

    # 1. Custom Dockerfile present in directory
    if (p / "Dockerfile").exists():
        df_content = (p / "Dockerfile").read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"EXPOSE\s+(\d+)", df_content, re.IGNORECASE)
        port = int(m.group(1)) if m else 8080
        return DetectionResult(
            kind="dockerfile",
            dockerfile=df_content,
            framework="Custom Dockerfile",
            language="Docker",
            package_manager="custom",
            build_command="docker build",
            start_command="Container default entrypoint",
            recommended_port=port,
            health_path="/",
            dockerignore=(p / ".dockerignore").read_text(encoding="utf-8", errors="ignore") if (p / ".dockerignore").exists() else DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("app", port),
            details=f"Using repository's custom Dockerfile with detected port {port}.",
            env_vars=extract_env_keys(p),
        )

    # 2. Node.js (React/Vite, CRA, Next.js, Vue, Angular, Svelte, Nuxt, Express, Nest)
    if (p / "package.json").exists():
        return _detect_node(p)

    # 3. Python (FastAPI, Flask, Django, etc.)
    if (p / "requirements.txt").exists() or (p / "pyproject.toml").exists() or (p / "Pipfile").exists():
        return _detect_python(p)

    # 4. Java (Maven or Gradle)
    if (p / "pom.xml").exists() or (p / "build.gradle").exists() or (p / "build.gradle.kts").exists():
        return _detect_java(p)

    # 5. Go (Go modules)
    if (p / "go.mod").exists():
        return _detect_go(p)

    # 6. PHP / Laravel
    if (p / "composer.json").exists() or (p / "artisan").exists():
        return _detect_php(p)

    # 7. Static HTML
    if (p / "index.html").exists():
        return _detect_static(p)

    return None


IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", ".venv", "venv",
    "__pycache__", ".next", ".nuxt", "target", "vendor", ".idea",
    ".vscode", "coverage", ".cache"
}


def scan_repository(root_path: Path, max_depth: int = 4) -> List[Dict[str, Any]]:
    """Recursively scan repository directory for deployable applications up to max_depth."""
    root = Path(root_path).resolve()
    detected_apps: List[Dict[str, Any]] = []

    for dirpath, dirnames, _ in os.walk(root):
        cur_path = Path(dirpath).resolve()
        # Filter out ignored directories in-place so os.walk does not recurse into them
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]

        try:
            rel = cur_path.relative_to(root)
            depth = len(rel.parts)
        except Exception:
            depth = 0

        if depth > max_depth:
            dirnames.clear()
            continue

        res = detect_single_dir(cur_path)
        if res:
            rel_str = "." if cur_path == root else str(rel).replace("\\", "/")
            app_name = cur_path.name if cur_path != root else "root"
            detected_apps.append({
                "name": app_name,
                "path": rel_str,
                "framework": res.framework,
                "language": res.language,
                "package_manager": res.package_manager,
                "recommended_port": res.recommended_port,
                "health_path": res.health_path,
                "build_command": res.build_command,
                "start_command": res.start_command,
                "dockerfile": res.dockerfile,
                "dockerignore": res.dockerignore,
                "docker_compose": res.docker_compose,
                "details": res.details,
                "env_vars": res.env_vars,
            })

    return detected_apps


def detect(path) -> DetectionResult:
    """Return DetectionResult for path. If path is a repository with nested apps, aggregates them."""
    p = Path(path).resolve()

    # If single dir detection succeeds directly on p
    direct = detect_single_dir(p)

    # Run recursive scan to see if there are nested apps or monorepo services
    apps = scan_repository(p)

    if direct:
        # p is itself a deployable project
        return DetectionResult(
            kind=direct.kind,
            dockerfile=direct.dockerfile,
            framework=direct.framework,
            language=direct.language,
            package_manager=direct.package_manager,
            build_command=direct.build_command,
            start_command=direct.start_command,
            recommended_port=direct.recommended_port,
            health_path=direct.health_path,
            dockerignore=direct.dockerignore,
            docker_compose=direct.docker_compose,
            details=direct.details,
            root_dir=".",
            apps=apps,
            env_vars=direct.env_vars,
        )

    # If root dir wasn't directly deployable, but sub-apps were discovered
    if apps:
        primary = apps[0]
        return DetectionResult(
            kind="nested",
            dockerfile=primary["dockerfile"],
            framework=primary["framework"],
            language=primary["language"],
            package_manager=primary["package_manager"],
            build_command=primary["build_command"],
            start_command=primary["start_command"],
            recommended_port=primary["recommended_port"],
            health_path=primary["health_path"],
            dockerignore=primary["dockerignore"],
            docker_compose=primary["docker_compose"],
            details=f"Discovered nested application in '{primary['path']}': {primary['details']}",
            root_dir=primary["path"],
            apps=apps,
            env_vars=primary.get("env_vars", []),
        )

    raise ValueError(
        "Could not detect project type. DeployForge supports: React+Vite, Node.js, Next.js, Vue, Angular, Svelte, Nuxt, "
        "Python (FastAPI, Flask, Django), Java (Maven, Gradle), Go, PHP/Laravel, Static HTML, or a custom Dockerfile."
    )


def get_template(template_id: str) -> DetectionResult:
    """Return pre-configured DetectionResult for a template ID."""
    if template_id == "react-vite":
        return DetectionResult(
            kind="node",
            dockerfile=REACT_VITE_DOCKERFILE,
            framework="React + Vite",
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="React + Vite SPA served via Nginx Alpine with SPA fallback routing on port 80.",
        )
    elif template_id == "react-cra":
        return DetectionResult(
            kind="node",
            dockerfile=REACT_CRA_DOCKERFILE,
            framework="React (Create React App)",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="React Create React App SPA served via Nginx Alpine on port 80.",
        )
    elif template_id == "vue-vite":
        return DetectionResult(
            kind="node",
            dockerfile=VUE_DOCKERFILE,
            framework="Vue.js (Vite)",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Vue.js Vite SPA served via Nginx Alpine on port 80.",
        )
    elif template_id == "angular":
        return DetectionResult(
            kind="node",
            dockerfile=ANGULAR_DOCKERFILE,
            framework="Angular",
            language="TypeScript",
            package_manager="npm",
            build_command="npm run build --configuration=production",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Angular production build served via Nginx Alpine on port 80.",
        )
    elif template_id == "svelte":
        return DetectionResult(
            kind="node",
            dockerfile=SVELTE_DOCKERFILE,
            framework="Svelte",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="nginx -g 'daemon off;'",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Svelte static production build served via Nginx Alpine on port 80.",
        )
    elif template_id == "nodejs":
        return DetectionResult(
            kind="node",
            dockerfile=NODE_BACKEND_DOCKERFILE.format(cmd='["npm", "start"]', port=8080),
            framework="Node.js Server",
            language="JavaScript / TypeScript",
            package_manager="npm",
            build_command="npm run build --if-present",
            start_command="npm start",
            recommended_port=8080,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("api", 8080),
            details="Node.js server with npm start on port 8080.",
        )
    elif template_id == "nextjs":
        return DetectionResult(
            kind="node",
            dockerfile=NEXTJS_DOCKERFILE,
            framework="Next.js",
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="npm start",
            recommended_port=3000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 3000),
            details="Next.js production runtime on port 3000.",
        )
    elif template_id == "nuxt":
        return DetectionResult(
            kind="node",
            dockerfile=NUXT_DOCKERFILE,
            framework="Nuxt.js",
            language="TypeScript / JavaScript",
            package_manager="npm",
            build_command="npm run build",
            start_command="node .output/server/index.mjs",
            recommended_port=3000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 3000),
            details="Nuxt.js production runtime with Nitro on port 3000.",
        )
    elif template_id == "python-fastapi":
        return DetectionResult(
            kind="python",
            dockerfile=PYTHON_DOCKERFILE.format(
                install="pip install --no-cache-dir -r requirements.txt",
                cmd='["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]',
                port=8000,
            ),
            framework="FastAPI",
            language="Python 3.12",
            package_manager="pip",
            build_command="pip install -r requirements.txt",
            start_command="uvicorn app.main:app --host 0.0.0.0 --port 8000",
            recommended_port=8000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("api", 8000),
            details="FastAPI high-performance ASGI server on port 8000.",
        )
    elif template_id == "python-flask":
        return DetectionResult(
            kind="python",
            dockerfile=PYTHON_DOCKERFILE.format(
                install="pip install --no-cache-dir -r requirements.txt",
                cmd='["sh", "-c", "gunicorn -b 0.0.0.0:${PORT:-5000} app:app"]',
                port=5000,
            ),
            framework="Flask",
            language="Python 3.12",
            package_manager="pip",
            build_command="pip install -r requirements.txt",
            start_command="gunicorn -b 0.0.0.0:5000 app:app",
            recommended_port=5000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 5000),
            details="Flask WSGI application served with Gunicorn on port 5000.",
        )
    elif template_id == "python-django":
        return DetectionResult(
            kind="python",
            dockerfile=PYTHON_DOCKERFILE.format(
                install="pip install --no-cache-dir -r requirements.txt",
                cmd='["sh", "-c", "python manage.py migrate --noinput && gunicorn --bind 0.0.0.0:${PORT:-8000} core.wsgi:application"]',
                port=8000,
            ),
            framework="Django",
            language="Python 3.12",
            package_manager="pip",
            build_command="pip install -r requirements.txt",
            start_command="gunicorn --bind 0.0.0.0:8000 core.wsgi:application",
            recommended_port=8000,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 8000),
            details="Django application with automatic migrations and Gunicorn on port 8000.",
        )
    elif template_id == "go":
        return DetectionResult(
            kind="go",
            dockerfile=GO_DOCKERFILE,
            framework="Go Application",
            language="Go 1.22",
            package_manager="go modules",
            build_command="go build -o /app/server .",
            start_command="/app/server",
            recommended_port=8080,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("app", 8080),
            details="Go application with Alpine runtime on port 8080.",
        )
    elif template_id == "php-laravel":
        return DetectionResult(
            kind="php",
            dockerfile=PHP_LARAVEL_DOCKERFILE,
            framework="PHP (Laravel)",
            language="PHP 8.2",
            package_manager="Composer",
            build_command="composer install --no-dev --optimize-autoloader",
            start_command="apache2-foreground",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="Laravel application with Apache 2 runtime on port 80.",
        )
    elif template_id == "php-apache":
        return DetectionResult(
            kind="php",
            dockerfile=PHP_VANILLA_DOCKERFILE,
            framework="PHP Application",
            language="PHP 8.2",
            package_manager="Composer",
            build_command="composer install --no-dev",
            start_command="apache2-foreground",
            recommended_port=80,
            health_path="/",
            dockerignore=DEFAULT_DOCKERIGNORE,
            docker_compose=_compose_yaml("web", 80),
            details="PHP application with Apache 2 runtime on port 80.",
        )
    elif template_id == "java-maven":
        return _detect_java(Path("/fake_pom"))
    elif template_id == "static-html":
        return _detect_static(Path("."))
    else:
        return get_template("react-vite")
