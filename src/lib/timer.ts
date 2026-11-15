/** SVG の viewBox は 0 0 100 100。文字盤の中心と半径 */
export const CENTER = 50;
export const RADIUS = 46;

/**
 * タイマーの状態。残っている間は残りの割合、予定を超えたら超えた分の割合（上限 1）を返す。
 * 時刻はすべて 0:00 からの分数（秒は小数）
 */
export function timerState(start: number, end: number, now: number): { fraction: number; over: boolean } {
  const total = end - start;
  if (total <= 0) return { fraction: 0, over: false };
  const remaining = end - now;
  if (remaining >= 0) return { fraction: remaining / total, over: false };
  return { fraction: Math.min(1, -remaining / total), over: true };
}

/** 12時の位置から時計回りに、割合の分だけの扇形を描くパス。1 以上は円で描くので呼ばない */
export function sectorPath(fraction: number): string {
  if (fraction <= 0) return "";
  const angle = -Math.PI / 2 + 2 * Math.PI * fraction;
  const x = round(CENTER + RADIUS * Math.cos(angle));
  const y = round(CENTER + RADIUS * Math.sin(angle));
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x} ${y} Z`;
}

/** その日の 0:00 からの分数。秒は小数にする */
export function preciseMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
