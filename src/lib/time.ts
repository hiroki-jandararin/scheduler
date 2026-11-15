const DAY = 24 * 60;

/** 540 → "9:00"。翌日の時刻は "翌1:00" */
export function formatTime(minutes: number): string {
  const prefix = minutes >= DAY ? "翌" : "";
  const inDay = minutes % DAY;
  return `${prefix}${Math.floor(inDay / 60)}:${pad(inDay % 60)}`;
}

/** 90 → "1時間30分" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** <input type="time"> の値（"09:00"）にする */
export function toInputValue(minutes: number): string {
  const inDay = minutes % DAY;
  return `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`;
}

/** <input type="time"> の値を分数に戻す。空なら null */
export function fromInputValue(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** ローカル時刻での "YYYY-MM-DD" */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-11-16" → "11月16日（月）" */
export function formatDateLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${month}月${day}日（${weekday}）`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
