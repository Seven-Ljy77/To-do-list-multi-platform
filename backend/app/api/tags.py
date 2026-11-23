from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_session
from app.models import Tag, Task
from app.schemas import TagCreate, TagOrderIn, TagOut, TagUpdate

router = APIRouter(
    prefix="/tags",
    tags=["tags"],
    dependencies=[Depends(get_current_session)],
)


def _get_tag(db: Session, tag_id: UUID) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="tag_not_found")
    return tag


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)) -> list[TagOut]:
    tags = db.scalars(select(Tag).order_by(Tag.position.asc(), Tag.created_at.asc())).all()

    count_rows = db.execute(
        select(
            Task.tag_id,
            func.count(Task.id),
            func.count(Task.id).filter(Task.is_completed.is_(False)),
        ).group_by(Task.tag_id)
    ).all()
    counts = {
        tag_id: (int(total), int(opened))
        for tag_id, total, opened in count_rows
    }

    result: list[TagOut] = []
    for tag in tags:
        total, opened = counts.get(tag.id, (0, 0))
        result.append(
            TagOut(
                id=tag.id,
                name=tag.name,
                color=tag.color,
                position=tag.position,
                open_count=opened,
                total_count=total,
            )
        )
    return result


@router.post("", response_model=TagOut, status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db)) -> TagOut:
    duplicate = db.scalar(
        select(Tag.id).where(func.lower(Tag.name) == body.name.lower())
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="tag_name_exists")

    position = (db.scalar(select(func.max(Tag.position))) or 0) + 1024
    tag = Tag(name=body.name, color=body.color, position=position)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagOut(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        position=tag.position,
        open_count=0,
        total_count=0,
    )


@router.put("/order", status_code=204)
def reorder_tags(body: TagOrderIn, db: Session = Depends(get_db)) -> None:
    if len(set(body.ids)) != len(body.ids):
        raise HTTPException(status_code=400, detail="duplicate_tag_ids")

    tags = db.scalars(select(Tag).where(Tag.id.in_(body.ids))).all() if body.ids else []
    if len(tags) != len(body.ids):
        raise HTTPException(status_code=404, detail="tag_not_found")

    by_id = {tag.id: tag for tag in tags}
    for index, tag_id in enumerate(body.ids):
        by_id[tag_id].position = index * 1024
    db.commit()


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: UUID, body: TagUpdate, db: Session = Depends(get_db)) -> TagOut:
    tag = _get_tag(db, tag_id)
    payload = body.model_dump(exclude_unset=True)

    if payload.get("name") is not None:
        duplicate = db.scalar(
            select(Tag.id).where(
                func.lower(Tag.name) == payload["name"].lower(),
                Tag.id != tag.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="tag_name_exists")
        tag.name = payload["name"]

    if payload.get("color") is not None:
        tag.color = payload["color"]

    db.commit()
    db.refresh(tag)
    return TagOut(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        position=tag.position,
        open_count=0,
        total_count=0,
    )


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: UUID, db: Session = Depends(get_db)) -> None:
    tag = _get_tag(db, tag_id)
    db.delete(tag)
    db.commit()
