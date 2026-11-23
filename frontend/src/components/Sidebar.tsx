import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Tag, Task, User, View } from "../types";
import {
  InboxIcon,
  LayersIcon,
  LockIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "./Icons";

interface SidebarProps {
  user: User;
  tags: Tag[];
  tasks: Task[];
  view: View;
  dragging: boolean;
  onSelectView: (view: View) => void;
  onCreateTag: () => void;
  onEditTag: (tag: Tag) => void;
  onDeleteTag: (tag: Tag) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

function DropRow({
  id,
  tagId,
  className,
  children,
}: {
  id: string;
  tagId: string | null;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "tag", tagId },
  });

  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "drop-over" : ""}`}>
      {children}
    </div>
  );
}

export function Sidebar({
  user,
  tags,
  tasks,
  view,
  dragging,
  onSelectView,
  onCreateTag,
  onEditTag,
  onDeleteTag,
  onLogout,
  onOpenSettings,
}: SidebarProps) {
  const allOpen = tasks.filter((task) => !task.is_completed).length;
  const untaggedOpen = tasks.filter(
    (task) => !task.is_completed && !task.tag,
  ).length;

  return (
    <aside className={`sidebar ${dragging ? "is-dragging" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <span className="brand-check">✓</span>
        </span>
        <div>
          <div className="brand-word">Todo</div>
          <div className="brand-sub">个人清单</div>
        </div>
      </div>

      <nav className="nav" aria-label="任务视图">
        <button
          type="button"
          className={`nav-row nav-button ${view.kind === "all" ? "active" : ""}`}
          onClick={() => onSelectView({ kind: "all" })}
        >
          <LayersIcon size={17} />
          <span className="nav-label">全部</span>
          <span className="nav-count">{allOpen}</span>
        </button>

        <DropRow
          id="tag:untagged"
          tagId={null}
          className={`nav-row drop-row ${view.kind === "untagged" ? "active" : ""}`}
        >
          <button
            type="button"
            className="nav-main"
            onClick={() => onSelectView({ kind: "untagged" })}
          >
            <InboxIcon size={17} />
            <span className="nav-label">未分类</span>
            <span className="nav-count">{untaggedOpen}</span>
          </button>
        </DropRow>

        <div className="nav-section-head">
          <span>标签</span>
          <button
            type="button"
            className="icon-btn icon-btn-small"
            onClick={onCreateTag}
            title="新建标签"
            aria-label="新建标签"
          >
            <PlusIcon size={16} />
          </button>
        </div>

        <div className="tag-list">
          {tags.map((tag) => {
            const active = view.kind === "tag" && view.tagId === tag.id;
            return (
              <DropRow
                key={tag.id}
                id={`tag:${tag.id}`}
                tagId={tag.id}
                className={`nav-row tag-row ${active ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="nav-main"
                  onClick={() => onSelectView({ kind: "tag", tagId: tag.id })}
                >
                  <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                  <span className="nav-label">{tag.name}</span>
                  <span className="nav-count">{tag.open_count}</span>
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn-small"
                    title="编辑标签"
                    aria-label={`编辑标签 ${tag.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditTag(tag);
                    }}
                  >
                    <PencilIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-small"
                    title="删除标签"
                    aria-label={`删除标签 ${tag.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteTag(tag);
                    }}
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              </DropRow>
            );
          })}
          {tags.length === 0 && <p className="sidebar-empty">还没有标签</p>}
          <button
            type="button"
            className="nav-button mobile-add-tag"
            onClick={onCreateTag}
          >
            <PlusIcon size={15} />
            <span>标签</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-foot">
        <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
        <div className="user-meta">
          <span>{user.username}</span>
          <small>本地账号</small>
        </div>
        <button
          type="button"
          className="icon-btn"
          title="修改密码"
          aria-label="修改密码"
          onClick={onOpenSettings}
        >
          <LockIcon size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="退出登录"
          aria-label="退出登录"
          onClick={onLogout}
        >
          <LogOutIcon size={16} />
        </button>
      </div>
    </aside>
  );
}
