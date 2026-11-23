import { ApiError, NetworkError, RequestTimeoutError } from "./api";

const FRIENDLY: Record<string, string> = {
  invalid_credentials: "用户名或密码错误",
  too_many_attempts: "尝试次数过多，请稍后再试",
  auth_required: "登录已过期，请重新登录",
  version_conflict: "任务已在另一处修改，已为你刷新",
  tag_name_exists: "标签名已存在",
  tag_not_found: "标签不存在",
  task_not_found: "任务不存在",
  completed_task_cannot_move: "已完成的任务不能拖动排序",
  invalid_neighbor: "不能拖到这个位置",
  invalid_neighbor_order: "不能拖到这个位置",
  tag_id_and_untagged_conflict: "筛选条件冲突",
  current_password_incorrect: "当前密码不正确",
  new_password_same_as_old: "新密码不能和旧密码相同",
};

export function errorMessage(error: unknown): string {
  if (error instanceof RequestTimeoutError) {
    return "请求超时，请检查网络连接";
  }
  if (error instanceof NetworkError) {
    return "获取数据失败，请检查网络连接";
  }
  if (error instanceof ApiError) {
    return FRIENDLY[error.detail] ?? error.detail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "操作失败，请重试";
}
