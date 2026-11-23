import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Tag, Task } from "../types";
import type { TaskPatch } from "./TaskEditor";
import { CompletedTaskRow, SortableTaskRow, type TaskRowProps } from "./TaskRow";
import { CheckIcon } from "./Icons";

interface TaskListProps {
  tasks: Task[];
  tags: Tag[];
  expandedId: string | null;
  editingId: string | null;
  emptyMessage?: string;
  onToggleExpand: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (task: Task, patch: TaskPatch) => Promise<void>;
  onToggleComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskList({
  tasks,
  tags,
  expandedId,
  editingId,
  emptyMessage,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggleComplete,
  onDelete,
}: TaskListProps) {
  const incomplete = tasks.filter((task) => !task.is_completed);
  const completed = tasks.filter((task) => task.is_completed);

  function rowProps(task: Task): TaskRowProps {
    return {
      task,
      tags,
      expanded: expandedId === task.id,
      editing: editingId === task.id,
      onToggleExpand: () => onToggleExpand(task.id),
      onStartEdit: () => onStartEdit(task.id),
      onCancelEdit,
      onSave: (patch) => onSave(task, patch),
      onToggleComplete: () => onToggleComplete(task),
      onDelete: () => onDelete(task),
    };
  }

  if (incomplete.length === 0 && completed.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-mark">
          <CheckIcon size={26} />
        </div>
        <h3>{emptyMessage ?? "还没有任务"}</h3>
        <p>在上面的输入框里写下第一件要做的事，回车即可保存。</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {incomplete.length > 0 && (
        <SortableContext
          items={incomplete.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="task-group">
            {incomplete.map((task) => (
              <SortableTaskRow key={task.id} {...rowProps(task)} />
            ))}
          </div>
        </SortableContext>
      )}

      {completed.length > 0 && (
        <>
          <div className="completed-divider">
            <span />
            <em>已完成 {completed.length}</em>
            <span />
          </div>
          <div className="task-group completed-group">
            {completed.map((task) => (
              <CompletedTaskRow key={task.id} {...rowProps(task)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
