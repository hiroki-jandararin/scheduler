import type { BlockKind } from "../parser/parseSchedule";

export type BlockStatus = "pending" | "active" | "done" | "skipped";

/** 時刻はすべて、その日の 0:00 からの分数。日付をまたぐと 1440 を超える */
export type Block = {
  id: string;
  title: string;
  kind: BlockKind;
  fixed: boolean;
  plannedStart: number;
  plannedEnd: number;
  status: BlockStatus;
  actualStart?: number;
  actualEnd?: number;
};

/** 1日分の予定と記録 */
export type Day = {
  /** "YYYY-MM-DD" */
  date: string;
  blocks: Block[];
  /** 最初に取り込んだ予定。貼り直しても変えない（当初の予定との比較用） */
  originalPlan: Block[];
};
