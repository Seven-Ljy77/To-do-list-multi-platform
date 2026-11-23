import { useState, type FormEvent } from "react";
import { errorMessage } from "../errors";
import type { Tag } from "../types";
import { Modal } from "./Modal";

export const TAG_COLORS = [
  "#4F46E5",
  "#0F766E",
  "#B45309",
  "#BE123C",
  "#7C3AED",
  "#0369A1",
  "#4D7C0F",
  "#57534E",
];

interface TagEditorProps {
  tag?: Tag;
  onClose: () => void;
  onSave: (name: string, color: string) => Promise<void>;
}

export function TagEditor({ tag, onClose, onSave }: TagEditorProps) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim(), color);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={tag ? "编辑标签" : "新建标签"} onClose={onClose} width={400}>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>名称</span>
          <input
            autoFocus
            value={name}
            maxLength={30}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：工作"
          />
        </label>

        <div className="field">
          <span>颜色</span>
          <div className="color-picker">
            {TAG_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={`color-swatch ${color === value ? "selected" : ""}`}
                style={{ backgroundColor: value }}
                aria-label={`选择颜色 ${value}`}
                aria-pressed={color === value}
                onClick={() => setColor(value)}
              >
                {color === value && <span className="swatch-check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
