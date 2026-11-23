from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: UUID
    username: str


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)
    device_name: str = Field(default="", max_length=80)


class LoginOut(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=200)


class SessionOut(BaseModel):
    id: UUID
    device_name: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    current: bool = False


class TagBrief(ORMModel):
    id: UUID
    name: str
    color: str
    position: int


class TagOut(TagBrief):
    open_count: int = 0
    total_count: int = 0


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    color: str = Field(default="#4F46E5", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value


class TagOrderIn(BaseModel):
    ids: list[UUID]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    detail: str = Field(default="", max_length=20000)
    due_date: date | None = None
    tag_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title cannot be blank")
        return value


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    detail: str | None = Field(default=None, max_length=20000)
    due_date: date | None = None
    is_completed: bool | None = None
    tag_id: UUID | None = None
    version: int = Field(ge=1)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("title cannot be blank")
        return value


class TaskMoveIn(BaseModel):
    tag_id: UUID | None
    prev_id: UUID | None = None
    next_id: UUID | None = None


class TaskOut(ORMModel):
    id: UUID
    title: str
    detail: str
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    tag: TagBrief | None
    position: int
    version: int
    created_at: datetime
    updated_at: datetime
