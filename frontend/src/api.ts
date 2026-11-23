import type { LoginResponse, Tag, Task, User } from "./types";

const buildTimeUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const android = /Android/i.test(navigator.userAgent);

export const API_BASE_URL = (
  buildTimeUrl || (android ? "http://192.168.1.12:8000" : "http://127.0.0.1:8000")
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 15_000;

let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiToken(value: string | null): void {
  token = value;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("network_error");
    this.name = "NetworkError";
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super("request_timeout");
    this.name = "RequestTimeoutError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, "auth_required");
    this.name = "UnauthorizedError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token && auth ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError();
    }
    throw new NetworkError();
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    if (auth) {
      unauthorizedHandler?.();
    }
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    let detail = response.statusText || "request_failed";
    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // Keep the status text.
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health", { auth: false }),

  login: (username: string, password: string, deviceName: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      auth: false,
      body: { username, password, device_name: deviceName },
    }),

  me: () => request<User>("/api/auth/me"),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/api/auth/password", {
      method: "POST",
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    }),

  listTags: () => request<Tag[]>("/api/tags"),

  createTag: (name: string, color: string) =>
    request<Tag>("/api/tags", {
      method: "POST",
      body: { name, color },
    }),

  updateTag: (id: string, patch: { name?: string; color?: string }) =>
    request<Tag>(`/api/tags/${id}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteTag: (id: string) =>
    request<void>(`/api/tags/${id}`, { method: "DELETE" }),

  listTasks: () => request<Task[]>("/api/tasks"),

  createTask: (input: {
    title: string;
    detail?: string;
    due_date?: string | null;
    tag_id?: string | null;
  }) =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: input,
    }),

  updateTask: (
    id: string,
    patch: {
      title?: string;
      detail?: string;
      due_date?: string | null;
      is_completed?: boolean;
      tag_id?: string | null;
      version: number;
    },
  ) =>
    request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteTask: (id: string) =>
    request<void>(`/api/tasks/${id}`, { method: "DELETE" }),

  moveTask: (
    id: string,
    input: {
      tag_id: string | null;
      prev_id: string | null;
      next_id: string | null;
    },
  ) =>
    request<Task>(`/api/tasks/${id}/move`, {
      method: "POST",
      body: input,
    }),
};
