import { useState, type FormEvent } from "react";
import { API_BASE_URL, ApiError, NetworkError, api } from "../api";
import { deviceName } from "../auth-store";
import { CheckIcon } from "./Icons";
import type { User } from "../types";

interface LoginScreenProps {
  message?: string | null;
  onLoggedIn: (token: string, user: User) => Promise<void>;
}

export function LoginScreen({ message, onLoggedIn }: LoginScreenProps) {
  const [username, setUsername] = useState("me");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setBusy(true);
    setError(null);
    try {
      const result = await api.login(username.trim(), password, deviceName);
      await onLoggedIn(result.token, result.user);
    } catch (loginError) {
      if (loginError instanceof NetworkError) {
        setError("无法连接服务器，请检查网络连接");
      } else if (loginError instanceof ApiError) {
        if (loginError.status === 429) {
          setError("尝试次数过多，请稍后再试");
        } else if (loginError.status === 401) {
          setError("用户名或密码错误");
        } else {
          setError(loginError.detail || "登录失败，请重试");
        }
      } else {
        setError("登录失败，请重试");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="brand-lockup">
          <span className="brand-mark brand-mark-large">
            <CheckIcon size={26} />
          </span>
          <span className="brand-word">Todo</span>
        </div>
        <h1>
          把要做的事，
          <br />
          放在看得见的地方。
        </h1>
        <p>标签归拢，日期提醒，拖一下就排好顺序。只属于你一个人的清单。</p>
        <div className="login-quote">
          <span className="quote-line" />
          <span>少一点忘记，多一点完成。</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <p className="eyebrow">欢迎回来</p>
            <h2>登录你的清单</h2>
          </div>

          {message && <p className="notice">{message}</p>}

          <label className="field">
            <span>用户名</span>
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="me"
            />
          </label>

          <label className="field">
            <span>密码</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="输入密码"
              />
              <button
                type="button"
                className="text-btn"
                onClick={() => setShowPassword((value) => !value)}
                tabIndex={-1}
              >
                {showPassword ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? "登录中…" : "登录"}
          </button>

          <p className="server-hint">
            服务器：<code>{API_BASE_URL}</code>
          </p>
        </form>
      </section>
    </div>
  );
}
