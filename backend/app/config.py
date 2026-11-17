import os


class Settings:
    database_url = os.getenv("DATABASE_URL", "postgresql+psycopg://forge:forge@postgres:5432/forge")
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    secret_key = os.getenv("SECRET_KEY", "change-me")
    github_client_id = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
    domain = os.getenv("DOMAIN", "localhost")
    public_url = os.getenv("PUBLIC_URL", "http://localhost")
    app_scheme = os.getenv("APP_SCHEME", "http")
    webhook_secret = os.getenv("WEBHOOK_SECRET", "dev-webhook-secret")
    network = os.getenv("DOCKER_NETWORK", "deployforge")
    routes_dir = os.getenv("ROUTES_DIR", "/dynamic")
    url_suffix = f":{os.getenv('APP_PORT')}" if os.getenv("APP_PORT") else ""
    dev_login = os.getenv("DEV_LOGIN", "1") == "1"


settings = Settings()
