import { useState } from "react";
import { API_BASE_URL } from "../api";
import { LogOutIcon } from "./Icons";

interface OfflineScreenProps {
  message?: string;
  onRetry: () => Promise<void>;
  onLogout: () => void;
}

export function OfflineScreen({ message, onRetry, onLogout }: OfflineScreenProps) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="center-card">
        <div className="offline-glyph">
          <span />
          <span />
          <span />
        </div>
        <h1>获取数据失败</h1>
        <p className="center-message">{message ?? "请检查网络连接，然后再试一次。"}</p>
        <p className="server-hint">
          服务器：<code>{API_BASE_URL}</code>
        </p>
        <div className="center-actions">
          <button type="button" className="btn btn-primary" onClick={retry} disabled={busy}>
            {busy ? "重试中…" : "重试"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            <LogOutIcon size={16} />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
