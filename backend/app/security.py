import base64
import hashlib
import time

import jwt
from cryptography.fernet import Fernet

from .config import settings

_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()


def make_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": int(time.time()) + 7 * 86400}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def read_token(token: str) -> int:
    return int(jwt.decode(token, settings.secret_key, algorithms=["HS256"])["sub"])
