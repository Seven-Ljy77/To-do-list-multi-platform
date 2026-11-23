from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.deps import get_current_session
from app.models import Tag, Task
from app.schemas import TaskCreate, TaskMoveIn, TaskOut, TaskUpdate
from app.security import utcnow

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    dependencies=[Depends(get_current_session)],
)


def _load_task(db: Session, task_id: UUID) -> Task:
    task = db.scalar(
        select(Task)
        .options(joinedload(Task.tag))
        .where(Task.id == task_id)
        .execution_options(populate_existing=True)
    )
    if task is None:
        raise HTTPException(status_code=404, detail="task_not_found")
    return task


def _ensure_tag(db: Session, tag_id: UUID) -> None:
    if db.get(Tag, tag_id) is None:
        raise HTTPException(status_code=404, detail="tag_not_found")


def _max_position(db: Session) -> int:
    return int(db.scalar(select(func.max(Task.position))) or 0)


def _renumber(db: Session) -> None:
    tasks = db.scalars(
        select(Task).order_by(Task.position.asc(), Task.created_at.asc())
    ).all()
    for index, task in enumerate(tasks, start=1):
        task.position = index * 1024
    db.flush()


@router.get("", response_model=list[TaskOut])
def list_tasks(
    tag_id: UUID | None = Query(default=None),
    untagged: bool = Query(default=False),
    completed: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Task]:
    if tag_id is not None and untagged:
        raise HTTPException(status_code=400, detail="tag_id_and_untagged_conflict")

    stmt = select(Task).options(joinedload(Task.tag))
    if tag_id is not None:
        stmt = stmt.where(Task.tag_id == tag_id)
    elif untagged:
        stmt = stmt.where(Task.tag_id.is_(None))
    if completed is not None:
        stmt = stmt.where(Task.is_completed.is_(completed))

    # Incomplete tasks keep the user's manual order; completed tasks sink to
    # the bottom, most recently completed first.
    stmt = stmt.order_by(
        Task.is_completed.asc(),
        Task.completed_at.desc().nulls_last(),
        Task.position.asc(),
        Task.created_at.asc(),
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)) -> Task:
    if body.tag_id is not None:
        _ensure_tag(db, body.tag_id)

    task = Task(
        title=body.title,
        detail=body.detail,
        due_date=body.due_date,
        tag_id=body.tag_id,
        position=_max_position(db) + 1024,
    )
    db.add(task)
    db.commit()
    return _load_task(db, task.id)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, db: Session = Depends(get_db)) -> Task:
    return _load_task(db, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID, body: TaskUpdate, db: Session = Depends(get_db)
) -> Task:
    task = _load_task(db, task_id)
    if task.version != body.version:
        raise HTTPException(status_code=409, detail="version_conflict")

    data = body.model_dump(exclude_unset=True)
    data.pop("version", None)

    if data.get("tag_id") is not None:
        _ensure_tag(db, data["tag_id"])

    if "is_completed" in data and data["is_completed"] is not None:
        next_completed = bool(data["is_completed"])
        if next_completed != task.is_completed:
            task.completed_at = utcnow() if next_completed else None
            task.is_completed = next_completed

    if data.get("title") is not None:
        task.title = data["title"]
    if data.get("detail") is not None:
        task.detail = data["detail"]
    if "due_date" in data:
        task.due_date = data["due_date"]
    if "tag_id" in data:
        task.tag_id = data["tag_id"]

    task.version += 1
    db.commit()
    return _load_task(db, task.id)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: UUID, db: Session = Depends(get_db)) -> None:
    task = _load_task(db, task_id)
    db.delete(task)
    db.commit()


@router.post("/{task_id}/move", response_model=TaskOut)
def move_task(
    task_id: UUID, body: TaskMoveIn, db: Session = Depends(get_db)
) -> Task:
    task = _load_task(db, task_id)
    if task.is_completed:
        raise HTTPException(status_code=409, detail="completed_task_cannot_move")

    if body.tag_id is not None:
        _ensure_tag(db, body.tag_id)

    prev_task = db.get(Task, body.prev_id) if body.prev_id else None
    next_task = db.get(Task, body.next_id) if body.next_id else None

    for neighbor in (prev_task, next_task):
        if neighbor is not None and neighbor.id == task.id:
            raise HTTPException(status_code=400, detail="invalid_neighbor")
        if neighbor is not None and neighbor.is_completed:
            raise HTTPException(status_code=400, detail="invalid_neighbor")

    if prev_task is not None and next_task is not None:
        if prev_task.position >= next_task.position:
            raise HTTPException(status_code=400, detail="invalid_neighbor_order")

        if next_task.position - prev_task.position > 1:
            new_position = (prev_task.position + next_task.position) // 2
        else:
            _renumber(db)
            db.refresh(prev_task)
            db.refresh(next_task)
            new_position = (prev_task.position + next_task.position) // 2
    elif prev_task is not None:
        new_position = prev_task.position + 1024
    elif next_task is not None:
        new_position = next_task.position - 1024
        if new_position <= 0:
            _renumber(db)
            db.refresh(next_task)
            new_position = max(1, next_task.position // 2)
    else:
        new_position = _max_position(db) + 1024

    task.tag_id = body.tag_id
    task.position = new_position
    task.version += 1
    db.commit()
    return _load_task(db, task.id)
