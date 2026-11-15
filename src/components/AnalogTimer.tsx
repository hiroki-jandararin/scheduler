import { useEffect, useState } from "react";
import { CENTER, RADIUS, preciseMinutesOfDay, sectorPath, timerState } from "../lib/timer";

type Props = {
  /** 0:00 からの分数 */
  start: number;
  end: number;
  /** 読み上げ用のラベル（例：残り23分） */
  label: string;
};

const TICKS = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

/**
 * 残り時間の分だけ扇形が減っていくアナログタイマー。1周はそのブロックの所要時間。
 * 予定を超えたら色を変え、超えた分の扇形を描く。針がなめらかに動くよう、ここだけ1秒ごとに描き直す
 */
export function AnalogTimer({ start, end, label }: Props) {
  // 1秒ごとの更新は描き直しのきっかけにだけ使い、時刻は描くたびに読む。
  // 時刻を状態に持つと、親が描き直されたときに最大1秒前の時刻で描いてしまう
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { fraction, over } = timerState(start, end, preciseMinutesOfDay(new Date()));

  return (
    <svg className={over ? "analog-timer is-over" : "analog-timer"} viewBox="0 0 100 100" role="img" aria-label={label}>
      <circle className="timer-face" cx={CENTER} cy={CENTER} r={RADIUS} />
      {fraction >= 1 ? (
        <circle className="timer-sector" cx={CENTER} cy={CENTER} r={RADIUS} />
      ) : (
        <path className="timer-sector" d={sectorPath(fraction)} />
      )}
      {TICKS.map((angle) => (
        <line
          key={angle}
          className="timer-tick"
          x1={CENTER + (RADIUS - 6) * Math.sin(angle)}
          y1={CENTER - (RADIUS - 6) * Math.cos(angle)}
          x2={CENTER + RADIUS * Math.sin(angle)}
          y2={CENTER - RADIUS * Math.cos(angle)}
        />
      ))}
      <circle className="timer-hub" cx={CENTER} cy={CENTER} r={4} />
    </svg>
  );
}
