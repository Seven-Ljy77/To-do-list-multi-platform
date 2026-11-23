import { useState, type FormEvent } from "react";
import { api } from "../api";
import { errorMessage } from "../errors";
import { Modal } from "./Modal";

interface PasswordDialogProps {
  onClose: () => void;
  onChanged: () => void;
}

export function PasswordDialog({ onClose, onChanged }: PasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError("新密码至少 10 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      onChanged();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="修改密码" onClose={onClose} width={420}>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>当前密码</span>
          <input
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>新密码</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="至少 10 位"
          />
        </label>
        <label className="field">
          <span>确认新密码</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}
        <p className="form-hint">修改后所有设备都需要重新登录。</p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !currentPassword || !newPassword || !confirmPassword}
          >
            {busy ? "修改中…" : "修改密码"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
