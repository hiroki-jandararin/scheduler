import { describe, expect, it } from "vitest";
import { parseSchedule } from "./parseSchedule";
import sample1 from "./__fixtures__/sample1-table.txt?raw";
import sample2 from "./__fixtures__/sample2-workday.txt?raw";
import sample3 from "./__fixtures__/sample3-durations.txt?raw";

/** "9:00" → 540 */
const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const block = (start: string, end: string, title: string, extra: object = {}) => ({
  title,
  start: t(start),
  end: t(end),
  ...extra,
});

const work = { kind: "work", fixed: false };
const rest = { kind: "break", fixed: false };
const fixed = { kind: "work", fixed: true };

describe("実際のAI出力", () => {
  it("サンプル①：表をコピーしたもの（タブ区切り・enダッシュ・所要時間の補足つき）", () => {
    const result = parseSchedule(sample1);

    expect(result.unparsedLines).toEqual([]);
    expect(result.blocks).toMatchObject([
      block("9:00", "10:30", "開発①", work),
      block("10:30", "10:45", "休憩", rest),
      block("10:45", "12:15", "開発②", work),
      block("12:15", "13:15", "ランニング", work),
      block("13:15", "14:15", "シャワー・昼食", rest),
      block("14:15", "15:45", "Notion × Discord連携①", work),
      block("15:45", "16:00", "休憩", rest),
      block("16:00", "17:00", "Notion × Discord連携②", work),
      block("17:00", "17:15", "休憩", rest),
      block("17:15", "18:15", "ポッドキャスト台本作成", work),
      block("18:15", "19:45", "Podcastブログ執筆", work),
      block("19:45", "20:45", "夕食", rest),
      block("20:45", "21:45", "『Webを支える技術』を読む", work),
    ]);
  });

  it("サンプル②：平日（仕事・通勤は固定、最後の就寝は1日の終わりの印）", () => {
    const result = parseSchedule(sample2);

    expect(result.unparsedLines).toEqual([]);
    expect(result.blocks).toMatchObject([
      block("6:45", "7:30", "起床・朝食・身支度", rest),
      block("7:30", "8:15", "Webを支える技術 読書", work),
      block("8:15", "9:00", "通勤", fixed),
      block("9:00", "12:00", "仕事", fixed),
      block("12:00", "13:00", "昼休み", rest),
      block("13:00", "18:00", "仕事", fixed),
      block("18:00", "18:45", "帰宅", fixed),
      block("18:45", "19:45", "夕食・休憩", rest),
      block("19:45", "20:15", "ピアノ", work),
      block("20:15", "21:45", "日程管理サービス開発", work),
      block("21:45", "22:00", "アブローラー", work),
      block("22:00", "23:30", "入浴・自由時間", rest),
    ]);
  });

  it("サンプル③：文章と所要時間（9時の買い物は固定、ほかは順に並べる）", () => {
    const result = parseSchedule(sample3);

    expect(result.unparsedLines).toEqual(["明日の予定。", "その他下記。"]);
    expect(result.blocks).toMatchObject([
      block("9:00", "9:30", "買い物", { ...fixed, durationGuessed: true }),
      block("9:30", "11:30", "開発", { ...work, durationGuessed: false }),
      block("11:30", "14:00", "Notion Discord連携", work),
      block("14:00", "15:30", "Webを支える技術よむ", work),
      block("15:30", "16:00", "アブローラー", { ...work, durationGuessed: true }),
      block("16:00", "17:30", "Podcast台本作成", work),
      block("17:30", "18:15", "ピアノ", work),
      block("18:15", "18:45", "掃除", work),
    ]);
  });
});
