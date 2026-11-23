import os

os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://todo_app:todo_app_dev_2026@127.0.0.1:5432/todo_test"
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.auth import login_limiter
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean(database):
    login_limiter.reset()
    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE TABLE user_sessions, tasks, tags, users "
                "RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def user(clean):
    db = SessionLocal()
    created = User(username="me", password_hash=hash_password("todo123456"))
    db.add(created)
    db.commit()
    db.refresh(created)
    db.close()
    return created


@pytest.fixture
def auth(client, user):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "me",
            "password": "todo123456",
            "device_name": "pytest",
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}
