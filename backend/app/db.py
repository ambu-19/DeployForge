from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(Integer, unique=True)
    login: Mapped[str] = mapped_column(String(100))
    gh_token: Mapped[str] = mapped_column(String(255), default="")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    repo: Mapped[str] = mapped_column(String(200))
    branch: Mapped[str] = mapped_column(String(100), default="main")
    port: Mapped[int] = mapped_column(Integer, default=8080)
    health_path: Mapped[str] = mapped_column(String(200), default="/")
    webhook_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    framework: Mapped[str | None] = mapped_column(String(50), nullable=True)
    custom_dockerfile: Mapped[str | None] = mapped_column(Text, nullable=True)
    build_cmd: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_cmd: Mapped[str | None] = mapped_column(String(200), nullable=True)
    root_dir: Mapped[str] = mapped_column(String(200), default="")
    deployment_mode: Mapped[str] = mapped_column(String(20), default="local")
    public_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tunnel_status: Mapped[str] = mapped_column(String(20), default="disconnected")


class EnvVar(Base):
    __tablename__ = "env_vars"
    __table_args__ = (UniqueConstraint("project_id", "key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    key: Mapped[str] = mapped_column(String(100))
    value_enc: Mapped[str] = mapped_column(Text)


class Deployment(Base):
    __tablename__ = "deployments"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    # queued | building | deploying | live | superseded | failed
    status: Mapped[str] = mapped_column(String(20), default="queued")
    kind: Mapped[str] = mapped_column(String(20), default="push")  # push|manual|rollback|auto-rollback
    commit_sha: Mapped[str] = mapped_column(String(40), default="")
    message: Mapped[str] = mapped_column(String(300), default="")
    image: Mapped[str | None] = mapped_column(String(200), nullable=True)
    logs: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


def init_db():
    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        for col, col_type in [
            ("framework", "VARCHAR(50)"),
            ("custom_dockerfile", "TEXT"),
            ("build_cmd", "VARCHAR(200)"),
            ("start_cmd", "VARCHAR(200)"),
            ("root_dir", "VARCHAR(200) DEFAULT ''"),
            ("deployment_mode", "VARCHAR(20) DEFAULT 'local'"),
            ("public_url", "VARCHAR(255)"),
            ("tunnel_status", "VARCHAR(20) DEFAULT 'disconnected'"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE projects ADD COLUMN IF NOT EXISTS {col} {col_type};"))
                conn.commit()
            except Exception:
                pass


def get_db():
    with SessionLocal() as db:
        yield db
