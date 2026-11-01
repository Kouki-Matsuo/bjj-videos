// 練習ノートで使う表示名・日付の扱いです。

import type { PracticeNote, PracticeResult } from '../types';

export const PRACTICE_RESULTS: { value: PracticeResult; label: string }[] = [
  { value: 'success', label: '成功' },
  { value: 'partial', label: '一部成功' },
  { value: 'failure', label: '失敗' },
  { value: 'unrated', label: '未評価' },
];

export const isPracticeResult = (v: unknown): v is PracticeResult =>
  PRACTICE_RESULTS.some((r) => r.value === v);

export const practiceResultLabel = (r: PracticeResult) =>
  PRACTICE_RESULTS.find((x) => x.value === r)?.label ?? '未評価';

const pad = (n: number) => String(n).padStart(2, '0');

/** 今日の日付(端末の時刻で YYYY-MM-DD) */
export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD として正しい日付か */
export function isDateOnly(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 11月1日(日)。今年以外の日付は 2025年11月1日(土) のように年も表示します */
export function formatPracticeDate(s: string, alwaysYear = false): string {
  if (!isDateOnly(s)) return s;
  const [y, m, d] = s.split('-').map(Number);
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const year = alwaysYear || y !== new Date().getFullYear() ? `${y}年` : '';
  return `${year}${m}月${d}日(${w})`;
}

/** 練習日が新しい順(同じ日なら後から作成したものが上) */
export function sortPracticeNotes(notes: PracticeNote[]): PracticeNote[] {
  return [...notes].sort(
    (a, b) => b.practiceDate.localeCompare(a.practiceDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** 練習回数の入力値を数値に変換します(空欄・0以下・不正値は null) */
export function parsePracticeCount(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 9999 ? n : null;
}
