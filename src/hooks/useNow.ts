import { useCallback, useEffect, useState } from "react";

/**
 * 今の時刻。interval ごとに更新する。
 * 操作の直後は refresh で更新し、古い時刻で表示しないようにする
 */
export function useNow(intervalMs = 30_000): { now: Date; refresh: () => void } {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);
  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh]);
  return { now, refresh };
}
