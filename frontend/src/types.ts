export interface User {
  id: string;
  username: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  position: number;
  open_count: number;
  total_count: number;
}

export interface TagBrief {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  tag: TagBrief | null;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

export type View =
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tag"; tagId: string };
