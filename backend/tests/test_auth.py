def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_me_and_logout(client, user):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "me",
            "password": "todo123456",
            "device_name": "pytest",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["username"] == "me"
    token = payload["token"]

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == "me"

    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 204

    after = client.get("/api/auth/me", headers=headers)
    assert after.status_code == 401


def test_login_wrong_password(client, user):
    response = client.post(
        "/api/auth/login",
        json={"username": "me", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"


def test_tasks_require_auth(client):
    response = client.get("/api/tasks")
    assert response.status_code == 401
    assert response.json()["detail"] == "auth_required"


def test_change_password_revokes_sessions(client, user, auth):
    response = client.post(
        "/api/auth/password",
        headers=auth,
        json={
            "current_password": "todo123456",
            "new_password": "new-todo-password",
        },
    )
    assert response.status_code == 204

    old_token = client.get("/api/auth/me", headers=auth)
    assert old_token.status_code == 401

    old_login = client.post(
        "/api/auth/login",
        json={"username": "me", "password": "todo123456"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"username": "me", "password": "new-todo-password"},
    )
    assert new_login.status_code == 200


def test_login_rate_limit(client, user):
    for _ in range(5):
        response = client.post(
            "/api/auth/login",
            json={"username": "me", "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/auth/login",
        json={"username": "me", "password": "wrong-password"},
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "too_many_attempts"
