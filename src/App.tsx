import { useState } from "react";
import { DayView } from "./components/DayView";
import { ImportView, type Target } from "./components/ImportView";
import { useNow } from "./hooks/useNow";
import { loadDay, saveDay } from "./lib/storage";
import { addDays, dateKey } from "./lib/time";
import type { Day } from "./schedule/types";

/** 起動したときに開く日。今日の予定がなければ、前の晩に貼った明日の予定を探す */
function initialDay(): Day | null {
  const today = new Date();
  return loadDay(dateKey(today)) ?? loadDay(dateKey(addDays(today, 1)));
}

export default function App() {
  const { now, refresh } = useNow();
  const [day, setDay] = useState<Day | null>(initialDay);
  const [importTarget, setImportTarget] = useState<Target | null>(() =>
    day === null ? (now.getHours() >= 17 ? "tomorrow" : "today") : null,
  );

  const updateDay = (next: Day) => {
    setDay(next);
    saveDay(next);
    refresh();
  };

  const openImport = (target: Target | null) => {
    setImportTarget(target);
    refresh();
  };

  if (importTarget !== null || day === null) {
    return (
      <ImportView
        // 対象の日を変えて開き直したときは、貼り付け欄を空にする
        key={importTarget ?? "today"}
        now={now}
        initialTarget={importTarget ?? "today"}
        loadExisting={(date) => (date === day?.date ? day : loadDay(date))}
        onConfirm={(next) => {
          updateDay(next);
          openImport(null);
        }}
        onCancel={day ? () => openImport(null) : undefined}
      />
    );
  }

  return (
    <DayView
      day={day}
      now={now}
      isToday={day.date === dateKey(now)}
      onChange={updateDay}
      onImport={openImport}
    />
  );
}
