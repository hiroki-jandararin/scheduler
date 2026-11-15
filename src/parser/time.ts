const HALF_DAY = 12 * 60;
const DAY = 24 * 60;

/**
 * 時刻1つ分。9:00 / 9時 / 9時半 / 13時15分 / 午後1時 / 1:00pm
 * 「1.5時間」「2時間」を時刻と読み違えないよう、直前の数字・小数点と直後の「間」を除く
 */
const TIME = String.raw`(?:午前|午後)?\s*(?<![\d.])\d{1,2}(?::\d{2}|時(?!間)(?:\d{1,2}分|半)?)(?:\s*[ap]m\b)?`;
const TIME_PARTS = /(午前|午後)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{1,2})分|(半))?)(?:\s*([ap]m))?/i;
/** 範囲指定と解釈されないよう、"-" は末尾に置く */
export const SEP_CHARS = "‐–—−~〜～ー-";
const SEP = String.raw`\s*(?:[${SEP_CHARS}]|から|to\b)\s*`;
export const RANGE = new RegExp(`(${TIME})${SEP}(${TIME})`, "i");
export const START_ONLY = new RegExp(`^(${TIME})(?:${SEP})?`, "i");

export type Meridiem = "am" | "pm" | null;

/**
 * 時刻の文字列を分数にする。午前・午後の指定がない時刻は、
 * 同じ範囲の開始側の指定を引き継ぐ（「午後1時から2時」の2時は午後）
 */
export function parseTime(text: string, inherited: Meridiem = null): { minutes: number; meridiem: Meridiem } {
  const [, jpMeridiem, h, colonMinute, jpMinute, half, enMeridiem] = text.match(TIME_PARTS)!;
  const own: Meridiem = jpMeridiem === "午後" || enMeridiem?.toLowerCase() === "pm" ? "pm"
    : jpMeridiem === "午前" || enMeridiem?.toLowerCase() === "am" ? "am"
    : null;
  const meridiem = own ?? inherited;

  let hour = Number(h);
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const minute = Number(colonMinute ?? jpMinute ?? (half ? 30 : 0));
  return { minutes: hour * 60 + minute, meridiem };
}

/**
 * base より前に来た時刻を、12時間表記なら午後、それでも足りなければ翌日とみなして後ろへ寄せる。
 * 12:00 以降の時刻は24時間表記とみなし、動かさない
 */
export function moveForward(time: number, base: number): number {
  if (time >= base || time >= HALF_DAY) return time;
  return time + HALF_DAY >= base ? time + HALF_DAY : time + DAY;
}
