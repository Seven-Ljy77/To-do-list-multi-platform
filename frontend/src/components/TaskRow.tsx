import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dueMeta, formatLongDate } from "../dates";
import type { Tag, Task } from "../types";
import { TaskEditor, type TaskPatch } from "./TaskEditor";
import {
  CalendarIcon,
  CheckIcon,
  ChevronIcon,
  GripIcon,
  PencilIcon,
  TagIcon,
  TrashIcon,
} from "./Icons";

export interface TaskRowProps {
  task: Task;
  tags: Tag[];
  expanded: boolean;
  editing: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: TaskPatch) => Promise<void>;
  onToggleComplete: () => void;
  onDelete: () => void;
}

interface DragHandleProps {
  attributes: Record<string, any>;
  listeners?: Record<string, any>;
}

interface ViewProps extends TaskRowProps {
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: DragHandleProps | null;
}

function TaskRowView({
  task,
  tags,
  expanded,
  editing,
  setNodeRef,
  style,
  isDragging,
  dragHandleProps,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleComplete,
  onDelete,
}: ViewProps) {
  const suppressClick = useRef(false);
  const ignoreRowClickUntil = useRef(0);
  const due = task.due_date ? dueMeta(task.due_date, task.is_completed) : null;

  useEffect(() => {
    if (isDragging) {
      suppressClick.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      suppressClick.current = false;
    }, 160);
    return () => window.clearTimeout(timer);
  }, [isDragging]);

  function isInteractive(target: EventTarget | null): boolean {
    return Boolean(
      (target as HTMLElement | null)?.closest(
        "button, input, textarea, select, a, [data-no-expand]",
      ),
    );
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (isInteractive(event.target)) return;
    // The second click of a double-click must not collapse the row again.
    if (event.detail > 1) return;
    if (
      editing ||
      suppressClick.current ||
      Date.now() < ignoreRowClickUntil.current
    ) {
      return;
    }
    onToggleExpand();
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (
      editing ||
      Date.now() < ignoreRowClickUntil.current ||
      isInteractive(event.target)
    ) {
      return;
    }
    onStartEdit();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "task-row",
        task.is_completed ? "completed" : "",
        expanded ? "expanded" : "",
        editing ? "editing" : "",
        isDragging ? "dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`task-main ${
          dragHandleProps && !task.is_completed && !editing ? "draggable" : ""
        }`}
        {...(dragHandleProps?.attributes ?? {})}
        {...(dragHandleProps?.listeners ?? {})}
      >
        <button
          type="button"
          className={`check ${task.is_completed ? "checked" : ""}`}
          role="checkbox"
          aria-checked={task.is_completed}
          aria-label={task.is_completed ? "标记为未完成" : "标记为已完成"}
          data-no-expand
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            ignoreRowClickUntil.current = Date.now() + 400;
            onToggleComplete();
          }}
        >
          {task.is_completed && <CheckIcon size={13} />}
        </button>

        {dragHandleProps && !task.is_completed ? (
          <span className="drag-handle" aria-hidden="true">
            <GripIcon size={16} />
          </span>
        ) : (
          <span className="drag-handle drag-handle-placeholder" aria-hidden="true" />
        )}

        <div className="task-text">
          <div className="task-title-line">
            <span className="task-title">{task.title}</span>
            {due && (
              <span className={`date-badge tone-${due.tone}`}>
                <CalendarIcon size={12} />
                {due.text}
              </span>
            )}
            {task.tag && (
              <span className="tag-chip">
                <span
                  className="tag-dot tag-dot-small"
                  style={{ backgroundColor: task.tag.color }}
                />
                {task.tag.name}
              </span>
            )}
          </div>
          {!expanded && task.detail && <p className="task-snippet">{task.detail}</p>}
        </div>

        <span className={`chevron ${expanded ? "open" : ""}`}>
          <ChevronIcon size={16} />
        </span>
      </div>

      {expanded && !editing && (
        <div className="task-expanded" data-no-expand>
          <p className="task-detail">{task.detail || "暂无详细内容"}</p>
          <div className="task-meta">
            {task.due_date && (
              <span>
                <CalendarIcon size={14} />
                {formatLongDate(task.due_date)}
              </span>
            )}
            <span>
              <TagIcon size={14} />
              {task.tag?.name ?? "未分类"}
            </span>
            {task.is_completed && <span className="muted">已完成</span>}
          </div>
          <div className="task-actions">
            <button
              type="button"
              className="text-action"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
            >
              <PencilIcon size={14} />
              编辑
            </button>
            <button
              type="button"
              className="text-action danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <TrashIcon size={14} />
              删除
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="task-edit-wrap" onClick={(event) => event.stopPropagation()}>
          <TaskEditor
            task={task}
            tags={tags}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        </div>
      )}
    </div>
  );
}

export function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: props.task.id,
      disabled: props.task.is_completed || props.editing,
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TaskRowView
      {...props}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={props.editing ? null : { attributes, listeners }}
    />
  );
}

export function CompletedTaskRow(props: TaskRowProps) {
  return <TaskRowView {...props} dragHandleProps={null} />;
}
