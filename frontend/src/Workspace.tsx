import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { api, NetworkError, UnauthorizedError } from "./api";
import { dueMeta } from "./dates";
import { errorMessage } from "./errors";
import type { Tag, Task, User, View } from "./types";
import type { TaskPatch } from "./components/TaskEditor";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CalendarIcon, PlusIcon } from "./components/Icons";
import { PasswordDialog } from "./components/PasswordDialog";
import { Sidebar } from "./components/Sidebar";
import { TagEditor } from "./components/TagEditor";
import { TaskList } from "./components/TaskList";

interface WorkspaceProps {
  user: User;
  onLogout: () => Promise<void> | void;
  onPasswordChanged: () => Promise<void> | void;
}

type ConfirmState =
  | { kind: "task"; task: Task }
  | { kind: "tag"; tag: Tag }
  | { kind: "logout" }
  | null;

type TagEditorState = { tag?: Tag } | null;

export function Workspace({ user, onLogout, onPasswordChanged }: WorkspaceProps) {
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: api.listTasks });
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const tasks = tasksQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  const [view, setView] = useState<View>({ kind: "all" });
  const [hideCompleted, setHideCompleted] = useState(
    () => localStorage.getItem("todo:hideCompleted") === "1",
  );
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagEditor, setTagEditor] = useState<TagEditorState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const toastTimer = useRef<number | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["tags"] }),
    ]);
  }

  async function perform<T>(
    action: () => Promise<T>,
    success?: string,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    try {
      const value = await action();
      await refresh();
      if (success) showToast(success);
      return { ok: true, value };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        showToast(errorMessage(error));
      }
      return { ok: false };
    }
  }

  const viewTasks = useMemo(() => {
    let list = tasks;
    if (view.kind === "untagged") {
      list = list.filter((task) => !task.tag);
    } else if (view.kind === "tag") {
      list = list.filter((task) => task.tag?.id === view.tagId);
    }
    return list;
  }, [tasks, view]);

  const filteredTasks = useMemo(
    () => (hideCompleted ? viewTasks.filter((task) => !task.is_completed) : viewTasks),
    [viewTasks, hideCompleted],
  );

  const incompleteVisible = filteredTasks.filter((task) => !task.is_completed);
  const completedVisible = filteredTasks.filter((task) => task.is_completed);
  const hiddenCompleted = hideCompleted && viewTasks.some((task) => task.is_completed);

  const activeTag =
    view.kind === "tag" ? tags.find((tag) => tag.id === view.tagId) : undefined;
  const viewTitle =
    view.kind === "all"
      ? "全部任务"
      : view.kind === "untagged"
        ? "未分类"
        : (activeTag?.name ?? "标签");

  useEffect(() => {
    if (
      view.kind === "tag" &&
      tagsQuery.isSuccess &&
      !tags.some((tag) => tag.id === view.tagId)
    ) {
      setView({ kind: "all" });
    }
  }, [tags, tagsQuery.isSuccess, view]);

  function selectView(next: View) {
    setView(next);
    setExpandedId(null);
    setEditingId(null);
  }

  function toggleHideCompleted() {
    setHideCompleted((value) => {
      const next = !value;
      localStorage.setItem("todo:hideCompleted", next ? "1" : "0");
      return next;
    });
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;

    setAdding(true);
    const tagId = view.kind === "tag" ? view.tagId : null;
    const result = await perform(() => api.createTask({ title, tag_id: tagId }));
    setAdding(false);
    if (result.ok) {
      setNewTitle("");
      addInputRef.current?.focus();
    }
  }

  async function handleToggleComplete(task: Task) {
    await perform(() =>
      api.updateTask(task.id, {
        is_completed: !task.is_completed,
        version: task.version,
      }),
    );
  }

  async function handleSaveTask(task: Task, patch: TaskPatch) {
    try {
      await api.updateTask(task.id, { ...patch, version: task.version });
      await refresh();
      setEditingId(null);
      setExpandedId(task.id);
    } catch (error) {
      await refresh();
      throw error;
    }
  }

  async function handleSaveTag(name: string, color: string) {
    if (tagEditor?.tag) {
      await api.updateTag(tagEditor.tag.id, { name, color });
    } else {
      await api.createTag(name, color);
    }
    await refresh();
    setTagEditor(null);
    showToast("标签已保存");
  }

  async function handleConfirmDelete() {
    if (!confirm) return;

    if (confirm.kind === "logout") {
      await onLogout();
      setConfirm(null);
      return;
    }

    if (confirm.kind === "task") {
      const result = await perform(
        () => api.deleteTask(confirm.task.id),
        "任务已删除",
      );
      if (result.ok) {
        if (expandedId === confirm.task.id) setExpandedId(null);
        setConfirm(null);
      }
      return;
    }

    const result = await perform(() => api.deleteTag(confirm.tag.id), "标签已删除");
    if (result.ok) {
      if (view.kind === "tag" && view.tagId === confirm.tag.id) {
        setView({ kind: "all" });
      }
      setConfirm(null);
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  };

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === String(event.active.id));
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((item) => item.id === String(active.id));
    if (!task || task.is_completed) return;

    const overId = String(over.id);

    if (overId.startsWith("tag:")) {
      const targetTagId = overId === "tag:untagged" ? null : overId.slice(4);
      if ((task.tag?.id ?? null) === targetTagId) return;
      const targetName =
        targetTagId === null
          ? "未分类"
          : (tags.find((tag) => tag.id === targetTagId)?.name ?? "标签");
      await perform(
        () =>
          api.moveTask(task.id, {
            tag_id: targetTagId,
            prev_id: null,
            next_id: null,
          }),
        `已移动到「${targetName}」`,
      );
      return;
    }

    if (overId === task.id) return;

    const overTask = tasks.find((item) => item.id === overId);
    if (overTask?.is_completed) return;

    const remaining = incompleteVisible.filter((item) => item.id !== task.id);
    const overIndex = remaining.findIndex((item) => item.id === overId);

    if (overIndex === -1) {
      const previous = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      await perform(
        () =>
          api.moveTask(task.id, {
            tag_id: task.tag?.id ?? null,
            prev_id: previous?.id ?? null,
            next_id: null,
          }),
        "顺序已更新",
      );
      return;
    }

    const oldIndex = incompleteVisible.findIndex((item) => item.id === task.id);
    const targetIndex = incompleteVisible.findIndex((item) => item.id === overId);
    if (oldIndex === targetIndex) return;

    const reordered = arrayMove(incompleteVisible, oldIndex, targetIndex);
    const newIndex = reordered.findIndex((item) => item.id === task.id);
    const previous = newIndex > 0 ? reordered[newIndex - 1] : null;
    const next = newIndex < reordered.length - 1 ? reordered[newIndex + 1] : null;

    await perform(
      () =>
        api.moveTask(task.id, {
          tag_id: task.tag?.id ?? null,
          prev_id: previous?.id ?? null,
          next_id: next?.id ?? null,
        }),
      "顺序已更新",
    );
  }

  const loading = tasksQuery.isPending || tagsQuery.isPending;
  const initialError =
    (tasksQuery.isError || tagsQuery.isError) && tasks.length === 0;
  const backgroundError =
    (tasksQuery.isError || tagsQuery.isError) && tasks.length > 0;

  const emptyMessage =
    hiddenCompleted && incompleteVisible.length === 0
      ? "没有未完成的任务"
      : view.kind === "all"
        ? "还没有任务"
        : "这个分类下还没有任务";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="app-shell">
        <Sidebar
          user={user}
          tags={tags}
          tasks={tasks}
          view={view}
          dragging={activeTask !== null}
          onSelectView={selectView}
          onCreateTag={() => setTagEditor({})}
          onEditTag={(tag) => setTagEditor({ tag })}
          onDeleteTag={(tag) => setConfirm({ kind: "tag", tag })}
          onLogout={() => setConfirm({ kind: "logout" })}
          onOpenSettings={() => setPasswordOpen(true)}
        />

        <main className="main">
          <header className="main-head">
            <div>
              <p className="eyebrow">个人清单</p>
              <h1>{viewTitle}</h1>
              <p className="head-meta">
                {incompleteVisible.length} 项未完成
                {viewTasks.length - incompleteVisible.length > 0 &&
                  ` · ${viewTasks.length - incompleteVisible.length} 项已完成`}
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={toggleHideCompleted}
            >
              {hideCompleted ? "显示已完成" : "隐藏已完成"}
            </button>
          </header>

          <div className="quick-add-block">
            <form className="quick-add" onSubmit={(event) => void handleAdd(event)}>
              <PlusIcon size={18} />
              <input
                ref={addInputRef}
                value={newTitle}
                maxLength={200}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="添加任务，按回车保存"
                aria-label="新任务标题"
              />
              <button
                type="submit"
                className="quick-add-btn"
                disabled={!newTitle.trim() || adding}
              >
                {adding ? "添加中…" : "添加"}
              </button>
            </form>
            <p className="quick-add-hint">
              {view.kind === "tag" && activeTag
                ? `新任务会自动归入「${activeTag.name}」`
                : "新任务会添加到「未分类」"}
            </p>
          </div>

          {backgroundError && (
            <div className="offline-banner">
              <span>获取数据失败，请检查网络连接</span>
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  void tasksQuery.refetch();
                  void tagsQuery.refetch();
                }}
              >
                重试
              </button>
            </div>
          )}

          {loading ? (
            <div className="task-skeleton" aria-label="加载中">
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          ) : initialError ? (
            <div className="inline-error">
              <h3>获取数据失败，请检查网络连接</h3>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void tasksQuery.refetch();
                  void tagsQuery.refetch();
                }}
              >
                重试
              </button>
            </div>
          ) : (
            <TaskList
              tasks={filteredTasks}
              tags={tags}
              expandedId={expandedId}
              editingId={editingId}
              emptyMessage={emptyMessage}
              onToggleExpand={(id) =>
                setExpandedId((current) => (current === id ? null : id))
              }
              onStartEdit={(id) => {
                setExpandedId(id);
                setEditingId(id);
              }}
              onCancelEdit={() => setEditingId(null)}
              onSave={handleSaveTask}
              onToggleComplete={(task) => void handleToggleComplete(task)}
              onDelete={(task) => setConfirm({ kind: "task", task })}
            />
          )}

          {toast && <div className="toast">{toast}</div>}
        </main>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="task-row drag-overlay">
            <div className="task-main">
              <span className="check" />
              <div className="task-text">
                <div className="task-title-line">
                  <span className="task-title">{activeTask.title}</span>
                  {activeTask.due_date && (
                    <span
                      className={`date-badge tone-${dueMeta(activeTask.due_date, false).tone}`}
                    >
                      <CalendarIcon size={12} />
                      {dueMeta(activeTask.due_date, false).text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      {tagEditor && (
        <TagEditor
          tag={tagEditor.tag}
          onClose={() => setTagEditor(null)}
          onSave={handleSaveTag}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "task"
              ? "删除任务"
              : confirm.kind === "tag"
                ? "删除标签"
                : "退出登录"
          }
          message={
            confirm.kind === "task"
              ? `确定删除「${confirm.task.title}」吗？此操作不可撤销。`
              : confirm.kind === "tag"
                ? `确定删除「${confirm.tag.name}」吗？标签下的任务会变成未分类，任务本身不会被删除。`
                : "退出后需要重新输入密码才能继续使用，任务和标签不会丢失。"
          }
          confirmLabel={confirm.kind === "logout" ? "退出登录" : "删除"}
          danger={confirm.kind !== "logout"}
          onClose={() => setConfirm(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {passwordOpen && (
        <PasswordDialog
          onClose={() => setPasswordOpen(false)}
          onChanged={() => {
            setPasswordOpen(false);
            void onPasswordChanged();
          }}
        />
      )}
    </DndContext>
  );
}
