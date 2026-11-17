"""Detect project type and generate a Dockerfile."""
import json
from pathlib import Path

NODE = """FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --if-present
ENV NODE_ENV=production
CMD {cmd}
"""

PYTHON = """FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir gunicorn "uvicorn[standard]" && {install}
CMD {cmd}
"""

JAVA = """FROM {build_image} AS build
WORKDIR /app
COPY . .
RUN {build_cmd} && cp $(ls {jar_glob} | grep -v -e plain -e original -e sources | head -1) /app.jar

FROM eclipse-temurin:21-jre
COPY --from=build /app.jar /app.jar
CMD ["sh", "-c", "java -Dserver.port=$PORT -jar /app.jar"]
"""


def _node(p: Path) -> str:
    pkg = json.loads((p / "package.json").read_text())
    if "start" in pkg.get("scripts", {}):
        cmd = '["npm","start"]'
    else:
        cmd = json.dumps(["node", pkg.get("main", "index.js")])
    return NODE.format(cmd=cmd)


def _python(p: Path) -> str:
    req = (p / "requirements.txt").read_text().lower() if (p / "requirements.txt").exists() else ""
    install = "pip install --no-cache-dir -r requirements.txt" if req else "pip install --no-cache-dir ."
    cmd = None
    proc = p / "Procfile"
    if proc.exists():
        for line in proc.read_text().splitlines():
            if line.startswith("web:"):
                cmd = line[4:].strip()
    if not cmd:
        if "fastapi" in req:
            mod = "app.main:app" if (p / "app" / "main.py").exists() else "main:app"
            cmd = f"uvicorn {mod} --host 0.0.0.0 --port $PORT"
        elif "flask" in req:
            mod = "app:app" if (p / "app.py").exists() else "main:app"
            cmd = f"gunicorn -b 0.0.0.0:$PORT {mod}"
        else:
            cmd = "python app.py" if (p / "app.py").exists() else "python main.py"
    return PYTHON.format(install=install, cmd=cmd)


def _java(p: Path) -> str:
    if (p / "pom.xml").exists():
        return JAVA.format(build_image="maven:3.9-eclipse-temurin-21", build_cmd="mvn -q -B package -DskipTests", jar_glob="target/*.jar")
    return JAVA.format(build_image="gradle:8-jdk21", build_cmd="gradle -q bootJar -x test --no-daemon", jar_glob="build/libs/*.jar")


def detect(path) -> tuple[str, str]:
    """Return (kind, dockerfile_text). Raises ValueError if unknown."""
    p = Path(path)
    if (p / "package.json").exists():
        return "node", _node(p)
    if (p / "requirements.txt").exists() or (p / "pyproject.toml").exists():
        return "python", _python(p)
    if (p / "pom.xml").exists() or (p / "build.gradle").exists() or (p / "build.gradle.kts").exists():
        return "java", _java(p)
    raise ValueError("Could not detect project type (need package.json, requirements.txt/pyproject.toml, or pom.xml/build.gradle) or add a Dockerfile")
