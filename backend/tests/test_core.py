import json

from app.detect import detect
from app.security import decrypt, encrypt, make_token, read_token


def test_detect_node(tmp_path):
    (tmp_path / "package.json").write_text(json.dumps({"scripts": {"start": "node s.js"}}))
    kind, df = detect(tmp_path)
    assert kind == "node" and 'CMD ["npm","start"]' in df


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
