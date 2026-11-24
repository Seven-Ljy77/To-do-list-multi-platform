def make_tag(client, auth, name="Work", color="#4F46E5"):
    response = client.post(
        "/api/tags",
        headers=auth,
        json={"name": name, "color": color},
    )
    assert response.status_code == 201, response.text
    return response.json()


def make_task(client, auth, title, **fields):
    response = client.post(
        "/api/tasks",
        headers=auth,
        json={"title": title, **fields},
    )
    assert response.status_code == 201, response.text
    return response.json()


def complete_task(client, auth, task):
    response = client.patch(
        f"/api/tasks/{task['id']}",
        headers=auth,
        json={"is_completed": True, "version": task["version"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_tag_crud_counts_and_delete_detaches_tasks(client, auth):
    tag = make_tag(client, auth, "Work")
    tagged_open = make_task(client, auth, "tagged open", tag_id=tag["id"])
    tagged_done = make_task(client, auth, "tagged done", tag_id=tag["id"])
    complete_task(client, auth, tagged_done)
    untagged = make_task(client, auth, "untagged")

    tags = client.get("/api/tags", headers=auth).json()
    assert len(tags) == 1
    assert tags[0]["open_count"] == 1
    assert tags[0]["total_count"] == 2

    updated = client.patch(
        f"/api/tags/{tag['id']}",
        headers=auth,
        json={"name": "Work 2", "color": "#10B981"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Work 2"
    assert updated.json()["color"] == "#10B981"

    duplicate = client.post(
        "/api/tags",
        headers=auth,
        json={"name": "work 2", "color": "#000000"},
    )
    assert duplicate.status_code == 409

    deleted = client.delete(f"/api/tags/{tag['id']}", headers=auth)
    assert deleted.status_code == 204

    detached = client.get(f"/api/tasks/{tagged_open['id']}", headers=auth).json()
    assert detached["tag"] is None

    untagged_list = client.get("/api/tasks?untagged=true", headers=auth).json()
    ids = {task["id"] for task in untagged_list}
    assert ids == {tagged_open["id"], tagged_done["id"], untagged["id"]}


def test_task_crud_version_conflict_and_completed_order(client, auth):
    tag = make_tag(client, auth, "Life")
    first = make_task(
        client,
        auth,
        "first",
        detail="some detail",
        due_date="2026-12-01",
        tag_id=tag["id"],
    )
    second = make_task(client, auth, "second")

    updated = client.patch(
        f"/api/tasks/{first['id']}",
        headers=auth,
        json={
            "title": "first updated",
            "detail": "new detail",
            "due_date": "2026-12-02",
            "version": first["version"],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "first updated"
    assert body["detail"] == "new detail"
    assert body["due_date"] == "2026-12-02"
    assert body["version"] == first["version"] + 1

    stale = client.patch(
        f"/api/tasks/{first['id']}",
        headers=auth,
        json={"title": "stale", "version": first["version"]},
    )
    assert stale.status_code == 409

    completed = complete_task(client, auth, second)
    assert completed["completed_at"] is not None

    listed = client.get("/api/tasks", headers=auth).json()
    assert [task["title"] for task in listed] == ["first updated", "second"]

    reopened = client.patch(
        f"/api/tasks/{second['id']}",
        headers=auth,
        json={"is_completed": False, "version": completed["version"]},
    )
    assert reopened.status_code == 200
    assert reopened.json()["completed_at"] is None

    deleted = client.delete(f"/api/tasks/{first['id']}", headers=auth)
    assert deleted.status_code == 204
    assert client.get(f"/api/tasks/{first['id']}", headers=auth).status_code == 404


def test_move_between_tasks_and_to_tag(client, auth):
    tag = make_tag(client, auth, "Work")
    t1 = make_task(client, auth, "one")
    t2 = make_task(client, auth, "two")
    t3 = make_task(client, auth, "three")

    moved = client.post(
        f"/api/tasks/{t3['id']}/move",
        headers=auth,
        json={"tag_id": None, "prev_id": None, "next_id": t1["id"]},
    )
    assert moved.status_code == 200, moved.text

    listed = client.get("/api/tasks", headers=auth).json()
    assert [task["title"] for task in listed] == ["three", "one", "two"]

    moved = client.post(
        f"/api/tasks/{t2['id']}/move",
        headers=auth,
        json={"tag_id": None, "prev_id": t3["id"], "next_id": t1["id"]},
    )
    assert moved.status_code == 200, moved.text

    listed = client.get("/api/tasks", headers=auth).json()
    assert [task["title"] for task in listed] == ["three", "two", "one"]

    tagged = client.post(
        f"/api/tasks/{t2['id']}/move",
        headers=auth,
        json={"tag_id": tag["id"], "prev_id": None, "next_id": None},
    )
    assert tagged.status_code == 200, tagged.text
    assert tagged.json()["tag"]["id"] == tag["id"]

    tagged_list = client.get(f"/api/tasks?tag_id={tag['id']}", headers=auth).json()
    assert [task["id"] for task in tagged_list] == [t2["id"]]


def test_completed_task_cannot_move(client, auth):
    task = make_task(client, auth, "done")
    completed = complete_task(client, auth, task)

    response = client.post(
        f"/api/tasks/{task['id']}/move",
        headers=auth,
        json={"tag_id": None, "prev_id": None, "next_id": None},
    )
    assert response.status_code == 409
    assert completed["is_completed"] is True


def test_completed_tasks_sort_most_recent_first(client, auth):
    first = make_task(client, auth, "first")
    second = make_task(client, auth, "second")
    complete_task(client, auth, first)
    complete_task(client, auth, second)

    listed = client.get("/api/tasks", headers=auth).json()
    assert [task["title"] for task in listed] == ["second", "first"]
    assert all(task["is_completed"] for task in listed)
