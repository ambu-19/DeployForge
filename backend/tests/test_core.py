import json

from app.detect import detect
from app.security import decrypt, encrypt, make_token, read_token
from app.tunnel import extract_url_from_logs, get_container_name


def test_detect_node(tmp_path):
    (tmp_path / "package.json").write_text(json.dumps({"scripts": {"start": "node s.js"}}))
    kind, df = detect(tmp_path)
    assert kind == "node" and 'CMD ["npm", "start"]' in df


def test_detect_python_fastapi(tmp_path):
    (tmp_path / "requirements.txt").write_text("fastapi\nuvicorn\n")
    (tmp_path / "main.py").write_text("")
    kind, df = detect(tmp_path)
    assert kind == "python" and "uvicorn main:app" in df


def test_detect_java_maven(tmp_path):
    (tmp_path / "pom.xml").write_text("<project/>")
    kind, df = detect(tmp_path)
    assert kind == "java" and "mvn" in df


def test_detect_unknown(tmp_path):
    try:
        detect(tmp_path)
        assert False
    except ValueError:
        pass


def test_crypto_and_jwt():
    assert decrypt(encrypt("s3cret")) == "s3cret"
    assert read_token(make_token(42)) == 42


def test_detect_react_vite(tmp_path):
    (tmp_path / "package.json").write_text(
        json.dumps({
            "name": "akshara-dasoha-tracker",
            "scripts": {"dev": "vite", "build": "vite build"},
            "dependencies": {"react": "^18.3.1", "react-dom": "^18.3.1"},
            "devDependencies": {"@vitejs/plugin-react": "^4.3.1", "vite": "^5.3.1"},
        })
    )
    res = detect(tmp_path)
    assert res.framework == "React + Vite"
    assert res.recommended_port == 80
    assert "FROM nginx:alpine" in res.dockerfile
    assert "try_files $uri $uri/ /index.html;" in res.dockerfile
    assert "COPY --from=build /app/dist /usr/share/nginx/html" in res.dockerfile


def test_detect_nextjs(tmp_path):
    (tmp_path / "package.json").write_text(
        json.dumps({
            "name": "my-next-app",
            "dependencies": {"next": "^14.0.0", "react": "^18.0.0"},
        })
    )
    res = detect(tmp_path)
    assert res.framework == "Next.js"
    assert res.recommended_port == 3000
    assert "npm run build" in res.dockerfile
    assert 'CMD ["npm", "start"]' in res.dockerfile


def test_detect_static_html(tmp_path):
    (tmp_path / "index.html").write_text("<h1>Hello World</h1>")
    res = detect(tmp_path)
    assert res.framework == "Static HTML/CSS/JS"
    assert res.recommended_port == 80
    assert "FROM nginx:alpine" in res.dockerfile


def test_detect_go(tmp_path):
    (tmp_path / "go.mod").write_text("module example.com/myapp\n\ngo 1.22\n")
    res = detect(tmp_path)
    assert res.framework == "Go Application"
    assert res.recommended_port == 8080
    assert "golang:1.22-alpine" in res.dockerfile
    assert "/app/server" in res.dockerfile


def test_detect_php_laravel(tmp_path):
    (tmp_path / "artisan").write_text("#!/usr/bin/env php\n")
    (tmp_path / "composer.json").write_text(json.dumps({"require": {"laravel/framework": "^10.0"}}))
    res = detect(tmp_path)
    assert res.framework == "PHP (Laravel)"
    assert res.recommended_port == 80
    assert "php:8.2-apache" in res.dockerfile
    assert "a2enmod rewrite" in res.dockerfile


def test_detect_angular(tmp_path):
    (tmp_path / "angular.json").write_text(json.dumps({"projects": {"app": {}}}))
    (tmp_path / "package.json").write_text(json.dumps({"dependencies": {"@angular/core": "^17.0.0"}}))
    res = detect(tmp_path)
    assert res.framework == "Angular"
    assert res.recommended_port == 80
    assert "FROM nginx:alpine" in res.dockerfile


def test_detect_monorepo(tmp_path):
    # Simulate Hospital_support_request_system_SDP structure
    client_dir = tmp_path / "hospital_support_app" / "client"
    client_dir.mkdir(parents=True)
    (client_dir / "package.json").write_text(
        json.dumps({
            "name": "hospital-client",
            "dependencies": {"react": "^18.0.0"},
            "devDependencies": {"vite": "^5.0.0"},
        })
    )
    (client_dir / "vite.config.js").write_text("export default {}")

    server_dir = tmp_path / "hospital_support_app" / "server"
    server_dir.mkdir(parents=True)
    (server_dir / "requirements.txt").write_text("fastapi>=0.100.0\nuvicorn>=0.23.0\npymongo\n")
    (server_dir / "main.py").write_text("from fastapi import FastAPI\napp = FastAPI()\n")

    res = detect(tmp_path)
    assert len(res.apps) == 2
    paths = [a["path"].replace("\\", "/") for a in res.apps]
    assert "hospital_support_app/client" in paths
    assert "hospital_support_app/server" in paths

    client_app = next(a for a in res.apps if "client" in a["path"])
    server_app = next(a for a in res.apps if "server" in a["path"])

    assert client_app["framework"] == "React + Vite"
    assert client_app["recommended_port"] == 80
    assert server_app["framework"] == "FastAPI"
    assert server_app["recommended_port"] == 8000


def test_tunnel_container_name():
    assert get_container_name("my-app") == "df-tunnel-my-app"


def test_tunnel_url_extraction():
    sample_logs = (
        "2026-11-19T15:29:16Z INF +--------------------------------------------------------------------------------------------+\n"
        "2026-11-19T15:29:16Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |\n"
        "2026-11-19T15:29:16Z INF |  https://announces-greg-celebs-daisy.trycloudflare.com                                     |\n"
        "2026-11-19T15:29:16Z INF +--------------------------------------------------------------------------------------------+\n"
    )
    url = extract_url_from_logs(sample_logs)
    assert url == "https://announces-greg-celebs-daisy.trycloudflare.com"

    no_url_logs = "Starting tunnel...\nWaiting for connection..."
    assert extract_url_from_logs(no_url_logs) is None


