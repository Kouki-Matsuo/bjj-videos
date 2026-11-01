// カレンダーと予定で使う日付計算・表示名です。日付は端末の時刻の YYYY-MM-DD 文字列で扱います。

import type { CalendarEvent, EventType } from '../types';
import { isDateOnly } from './practice';

/** 予定の登録時に選べる種類 */
export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'practice', label: '練習' },
  { value: 'match', label: '試合' },
  { value: 'strength', label: '筋トレ' },
  { value: 'other', label: 'その他' },
];

/** 以前の版で選べた種類。新しくは選べませんが、登録済みの予定やバックアップはそのまま表示・復元できます */
const LEGACY_EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'seminar', label: 'セミナー' },
  { value: 'visit', label: '出稽古' },
];

export const ALL_EVENT_TYPES = [...EVENT_TYPES, ...LEGACY_EVENT_TYPES];

export const isEventType = (v: unknown): v is EventType => ALL_EVENT_TYPES.some((t) => t.value === v);

export const eventTypeLabel = (t: EventType) => ALL_EVENT_TYPES.find((x) => x.value === t)?.label ?? 'その他';

/** 1つの予定に設定できる最長の日数(誤入力で極端に長い予定になるのを防ぎます) */
export const MAX_EVENT_DAYS = 366;

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** 2つの日付の差(日数) */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export const isTimeString = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** 予定の最終日(1日だけの予定なら開始日) */
export const eventEndDate = (e: Pick<CalendarEvent, 'startDate' | 'endDate'>) => e.endDate ?? e.startDate;

/** 予定がその日を含むか */
export const eventCoversDate = (e: CalendarEvent, date: string) => e.startDate <= date && date <= eventEndDate(e);

/** 予定がある日ごとに、予定の種類をまとめます(複数日の予定は期間中の全日に入れます) */
export function eventTypesByDate(events: CalendarEvent[], from: string, to: string): Map<string, Set<EventType>> {
  const map = new Map<string, Set<EventType>>();
  for (const e of events) {
    const start = e.startDate > from ? e.startDate : from;
    const end = eventEndDate(e) < to ? eventEndDate(e) : to;
    for (let d = start, i = 0; d <= end && i <= MAX_EVENT_DAYS; d = addDays(d, 1), i++) {
      if (!map.has(d)) map.set(d, new Set());
      map.get(d)!.add(e.type);
    }
  }
  return map;
}

/** その日の予定を、時刻なし(終日)→開始時刻の早い順に並べます */
export function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.startDate.localeCompare(b.startDate) ||
      a.title.localeCompare(b.title, 'ja'),
  );
}

/** 「11/14〜11/16」「9:00〜12:00」のような期間・時刻の表示 */
export function formatEventPeriod(e: CalendarEvent): string {
  const md = (s: string) => {
    const d = parseDate(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const time = (t: string) => t.replace(/^0(\d)/, '$1');
  const days = e.endDate && e.endDate !== e.startDate ? `${md(e.startDate)}〜${md(e.endDate)}` : '';
  const times =
    e.startTime || e.endTime ? `${e.startTime ? time(e.startTime) : ''}〜${e.endTime ? time(e.endTime) : ''}` : '';
  return [days, times].filter(Boolean).join(' ') || '終日';
}

/** 月表示用:その月の日付を、日曜始まりの週ごとに並べます(月外は null) */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 予定の入力内容が正しいか確認し、問題があれば日本語のメッセージを返します */
export function validateEventDates(input: {
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
}): string | null {
  if (!isDateOnly(input.startDate)) return '開始日を選択してください。';
  if (input.endDate !== null) {
    if (!isDateOnly(input.endDate)) return '終了日が正しくありません。';
    if (input.endDate < input.startDate) return '終了日は開始日以降の日付にしてください。';
    if (daysBetween(input.startDate, input.endDate) >= MAX_EVENT_DAYS) return '予定の期間は1年以内にしてください。';
  }
  if (input.startTime !== null && !isTimeString(input.startTime)) return '開始時刻が正しくありません。';
  if (input.endTime !== null && !isTimeString(input.endTime)) return '終了時刻が正しくありません。';
  const sameDay = input.endDate === null || input.endDate === input.startDate;
  if (sameDay && input.startTime && input.endTime && input.endTime < input.startTime)
    return '終了時刻は開始時刻より後にしてください。';
  return null;
}
