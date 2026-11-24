import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { errorMessage } from "../errors";
import type { Tag, Task } from "../types";

export interface TaskPatch {
  title: string;
  detail: string;
  due_date: string | null;
  tag_id: string | null;
}

interface TaskEditorProps {
  task: Task;
  tags: Tag[];
  onSave: (patch: TaskPatch) => Promise<void>;
  onCancel: () => void;
}

export function TaskEditor({ task, tags, onSave, onCancel }: TaskEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [detail, setDetail] = useState(task.detail);
  const [dueDate, setDueDate] = useState<string | null>(task.due_date);
  const [tagId, setTagId] = useState<string | null>(task.tag?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        detail,
        due_date: dueDate,
        tag_id: tagId,
      });
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="task-editor" onKeyDown={handleKeyDown}>
      <label className="field">
        <span>标题</span>
        <input
          ref={titleRef}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="任务名称"
        />
      </label>

      <label className="field">
        <span>详细内容</span>
        <textarea
          value={detail}
          rows={3}
          maxLength={20000}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="补充说明、链接、步骤……"
        />
      </label>

      <div className="editor-grid">
        <label className="field">
          <span>日期</span>
          <div className="date-input-wrap">
            <input
              type="date"
              value={dueDate ?? ""}
              onChange={(event) => setDueDate(event.target.value || null)}
            />
            {dueDate && (
              <button
                type="button"
                className="text-btn"
                onClick={() => setDueDate(null)}
              >
                清除
              </button>
            )}
          </div>
        </label>

        <label className="field">
          <span>标签</span>
          <select
            value={tagId ?? ""}
            onChange={(event) => setTagId(event.target.value || null)}
          >
            <option value="">未分类</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="editor-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={busy || !title.trim()}
        >
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
