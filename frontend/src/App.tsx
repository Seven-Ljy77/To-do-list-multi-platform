import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  setApiToken,
  setUnauthorizedHandler,
  UnauthorizedError,
} from "./api";
import { clearToken, loadToken, saveToken } from "./auth-store";
import { LoginScreen } from "./components/LoginScreen";
import { OfflineScreen } from "./components/OfflineScreen";
import { Workspace } from "./Workspace";
import type { User } from "./types";

type AuthState =
  | { status: "booting" }
  | { status: "anon" }
  | { status: "offline" }
  | { status: "ready"; user: User };

function BootScreen() {
  return (
    <div className="center-page">
      <div className="boot-mark">
        <span>✓</span>
      </div>
      <p className="boot-text">正在打开你的清单…</p>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthState>({ status: "booting" });
  const [message, setMessage] = useState<string | null>(null);

  const boot = useCallback(async () => {
    setAuth({ status: "booting" });

    let stored: string | null = null;
    try {
      stored = await loadToken();
    } catch {
      stored = null;
    }

    if (!stored) {
      setApiToken(null);
      setAuth({ status: "anon" });
      return;
    }

    setApiToken(stored);
    try {
      const user = await api.me();
      setAuth({ status: "ready", user });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await clearToken();
        setApiToken(null);
        setMessage("登录已过期，请重新登录");
        setAuth({ status: "anon" });
      } else {
        setAuth({ status: "offline" });
      }
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearToken();
      setApiToken(null);
      queryClient.clear();
      setMessage("登录已过期，请重新登录");
      setAuth({ status: "anon" });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  async function handleLoggedIn(token: string, user: User) {
    await saveToken(token);
    setApiToken(token);
    setMessage(null);
    setAuth({ status: "ready", user });
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // The local token is cleared either way.
    }
    await clearToken();
    setApiToken(null);
    queryClient.clear();
    setMessage(null);
    setAuth({ status: "anon" });
  }

  async function handlePasswordChanged() {
    await clearToken();
    setApiToken(null);
    queryClient.clear();
    setMessage("密码已修改，请重新登录");
    setAuth({ status: "anon" });
  }

  if (auth.status === "booting") {
    return <BootScreen />;
  }

  if (auth.status === "offline") {
    return (
      <OfflineScreen
        message="获取数据失败，请检查网络连接"
        onRetry={boot}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (auth.status === "anon") {
    return <LoginScreen message={message} onLoggedIn={handleLoggedIn} />;
  }

  return (
    <Workspace
      user={auth.user}
      onLogout={handleLogout}
      onPasswordChanged={handlePasswordChanged}
    />
  );
}
