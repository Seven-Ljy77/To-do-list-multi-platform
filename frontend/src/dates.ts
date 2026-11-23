export type DueTone = "overdue" | "today" | "soon" | "later" | "done";

export interface DueMeta {
  text: string;
  tone: DueTone;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntil(value: string): number {
  const target = parseDateOnly(value);
  const today = startOfToday();
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatShortDate(value: string): string {
  const date = parseDateOnly(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatLongDate(value: string): string {
  const date = parseDateOnly(value);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${weekday}`;
}

export function dueMeta(value: string, completed: boolean): DueMeta {
  if (completed) {
    return { text: formatShortDate(value), tone: "done" };
  }

  const days = daysUntil(value);
  if (days < 0) {
    // Overdue tasks still show the date, without an "逾期 N 天" label.
    return { text: formatShortDate(value), tone: "overdue" };
  }
  if (days === 0) {
    return { text: "今天", tone: "today" };
  }
  if (days === 1) {
    return { text: "明天", tone: "soon" };
  }
  if (days <= 7) {
    return { text: `${days} 天后`, tone: "soon" };
  }
  return { text: formatShortDate(value), tone: "later" };
}
