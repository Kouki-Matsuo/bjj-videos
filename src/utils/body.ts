// 体重・体脂肪率の集計(日・週・月)と、筋トレ記録との相関分析の計算です。
// 同じ日に複数の記録がある場合は、その日の平均値を1日分の値として使います。

import type { BodyRecord, BodyRecordInput, Exercise, StrengthRecord } from '../types';
import { addDays, isTimeString, parseDate, toDateString } from './calendar';
import { isDateOnly } from './practice';
import { entryStats } from './strength';

export const isValidWeight = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 20 && v <= 300;
export const isValidBodyFat = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 70;

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function normalizeBodyInput(input: BodyRecordInput): BodyRecordInput {
  if (!isDateOnly(input.date)) throw new Error('日付を選択してください。');
  if (!isValidWeight(input.weight)) throw new Error('体重は20〜300kgの範囲で入力してください。');
  if (input.bodyFat !== null && !isValidBodyFat(input.bodyFat))
    throw new Error('体脂肪率は1〜70%の範囲で入力してください。');
  return {
    date: input.date,
    time: input.time && isTimeString(input.time) ? input.time : null,
    weight: round(input.weight, 2),
    bodyFat: input.bodyFat === null ? null : round(input.bodyFat, 2),
    memo: input.memo.trim(),
  };
}

// ---------- 日・週・月ごとの値 ----------

export interface DailyBody {
  date: string;
  weight: number;
  /** その日に体脂肪率の記録がなければ null */
  bodyFat: number | null;
  /** その日の記録数 */
  count: number;
}

const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;

/** 日ごとの平均値(古い順) */
export function dailyBody(records: BodyRecord[]): DailyBody[] {
  const byDate = new Map<string, BodyRecord[]>();
  records.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const fats = list.map((r) => r.bodyFat).filter((f): f is number => f !== null);
      return {
        date,
        weight: round(avg(list.map((r) => r.weight)), 2),
        bodyFat: fats.length ? round(avg(fats), 2) : null,
        count: list.length,
      };
    });
}

export type Period = 'day' | 'week' | 'month';

/** その日を含む週の月曜日 */
export function weekStart(date: string): string {
  const d = parseDate(date);
  return addDays(date, -((d.getDay() + 6) % 7));
}

export const monthKey = (date: string) => date.slice(0, 7);

const keyOf = (date: string, period: Period) =>
  period === 'day' ? date : period === 'week' ? weekStart(date) : monthKey(date);

/** グラフの横軸の表示(11/2・11/2週・11月) */
export function periodLabel(key: string, period: Period): string {
  if (period === 'month') return `${Number(key.slice(5, 7))}月`;
  const d = parseDate(key);
  return `${d.getMonth() + 1}/${d.getDate()}${period === 'week' ? '週' : ''}`;
}

/** 日・週・月ごとの平均値(古い順)。週・月は、その期間に記録した日の平均です */
export function aggregateBody(
  days: DailyBody[],
  period: Period,
  field: 'weight' | 'bodyFat',
): { key: string; value: number }[] {
  const groups = new Map<string, number[]>();
  for (const d of days) {
    const v = d[field];
    if (v === null) continue;
    const k = keyOf(d.date, period);
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({ key, value: round(avg(list), 2) }));
}

/** 直近7日間(記録した日)の移動平均。日々の変動をならした長期的な傾向として使います */
export function movingAverage(points: { key: string; value: number }[], days = 7): (number | null)[] {
  return points.map((p, i) => {
    const from = addDays(p.key, -(days - 1));
    const window = points.slice(0, i + 1).filter((x) => x.key >= from);
    return window.length >= 3 ? round(avg(window.map((x) => x.value)), 2) : null;
  });
}

// ---------- 相関分析 ----------

/** ピアソンの相関係数。データが少ない・値がすべて同じ場合は null */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = avg(xs);
  const my = avg(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** 相関を計算する最低限のデータ数。これ未満は「データ不足」と表示します */
export const MIN_PAIRS = 5;

export interface Correlation {
  id: string;
  title: string;
  /** 散布図などで使う点(x: トレーニング側、y: 体の変化) */
  pairs: { x: number; y: number; label: string }[];
  r: number | null;
  status: 'ok' | 'insufficient' | 'flat';
  text: string;
}

function strengthWord(r: number): string {
  const a = Math.abs(r);
  if (a < 0.2) return 'ほとんど関係は見られません';
  const level = a < 0.4 ? '弱い' : a < 0.7 ? '中程度の' : '強い';
  return `${level}${r > 0 ? '正' : '負'}の相関があります`;
}

/** この件数未満は、相関を表示しても「参考程度」と注意書きを付けます */
const FEW_PAIRS = 10;

function describe(
  id: string,
  title: string,
  pairs: Correlation['pairs'],
  xWord: string,
  yWord: string,
  /** トレーニング側の値が0以外の件数がこれ未満なら「データ不足」(ほとんど行っていない種目の偶然の一致を避けます) */
  minActive = 0,
): Correlation {
  const active = pairs.filter((p) => p.x > 0).length;
  if (pairs.length < MIN_PAIRS || active < minActive) {
    return {
      id,
      title,
      pairs,
      r: null,
      status: 'insufficient',
      text:
        pairs.length < MIN_PAIRS
          ? `データ不足です(${pairs.length}件/${MIN_PAIRS}件以上必要)。記録が増えると表示されます。`
          : `データ不足です(実施した期間が${active}件と少ないため)。記録が増えると表示されます。`,
    };
  }
  const r = pearson(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y),
  );
  if (r === null) {
    return { id, title, pairs, r, status: 'flat', text: '値の変化がないため、相関を計算できません。' };
  }
  const tendency =
    Math.abs(r) < 0.2
      ? `${xWord}と${yWord}の変化の間に、はっきりした傾向は見られません。`
      : `${xWord}が多い時期ほど、${yWord}が${r > 0 ? '増える' : '減る'}方向に変化している傾向が見られます。`;
  const caution = pairs.length < FEW_PAIRS ? 'データ数が少ないため、偶然の可能性もあり参考程度です。' : '';
  return {
    id,
    title,
    pairs,
    r,
    status: 'ok',
    text: `${tendency}${strengthWord(r)}(r = ${r.toFixed(2)}、${pairs.length}件)。${caution}`,
  };
}

const prevMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return toDateString(new Date(y, m - 2, 1)).slice(0, 7);
};

export interface MonthlyRow {
  month: string;
  /** 筋トレをした日数 */
  sessions: number;
  /** 総負荷量(重量×回数の合計, kg) */
  volume: number;
  weight: number | null;
  bodyFat: number | null;
  /** 前月平均からの変化 */
  weightChange: number | null;
  bodyFatChange: number | null;
}

/** 月ごとの筋トレ回数・総負荷量・体重/体脂肪率(平均)と前月からの変化 */
export function monthlyRows(days: DailyBody[], records: StrengthRecord[], exercises: Exercise[]): MonthlyRow[] {
  const kindOf = new Map(exercises.map((e) => [e.id, e.kind]));
  const weight = new Map(aggregateBody(days, 'month', 'weight').map((p) => [p.key, p.value]));
  const fat = new Map(aggregateBody(days, 'month', 'bodyFat').map((p) => [p.key, p.value]));
  const sessions = new Map<string, Set<string>>();
  const volume = new Map<string, number>();
  for (const r of records) {
    const m = monthKey(r.date);
    sessions.set(m, (sessions.get(m) ?? new Set()).add(r.date));
    const v = r.entries.reduce((sum, e) => sum + entryStats(e, kindOf.get(e.exerciseId)).volume, 0);
    volume.set(m, (volume.get(m) ?? 0) + v);
  }
  const months = Array.from(new Set([...weight.keys(), ...sessions.keys()])).sort();
  if (!months.length) return [];
  // 最初の月から最後の月まで、記録のない月も含めて並べます
  const all: string[] = [];
  for (let m = months[0]; m <= months[months.length - 1]; m = toDateString(new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 1)).slice(0, 7))
    all.push(m);
  return all.map((month) => {
    const w = weight.get(month) ?? null;
    const f = fat.get(month) ?? null;
    const pw = weight.get(prevMonth(month));
    const pf = fat.get(prevMonth(month));
    return {
      month,
      sessions: sessions.get(month)?.size ?? 0,
      volume: Math.round(volume.get(month) ?? 0),
      weight: w,
      bodyFat: f,
      weightChange: w !== null && pw !== undefined ? round(w - pw, 2) : null,
      bodyFatChange: f !== null && pf !== undefined ? round(f - pf, 2) : null,
    };
  });
}

const monthLabel = (m: string) => `${Number(m.slice(0, 4))}/${Number(m.slice(5))}`;

/** 筋トレ記録と体重記録の相関をまとめて計算します */
export function analyzeCorrelations(
  days: DailyBody[],
  records: StrengthRecord[],
  exercises: Exercise[],
): { rows: MonthlyRow[]; results: Correlation[]; perExercise: Correlation[] } {
  const rows = monthlyRows(days, records, exercises);
  const withWeight = rows.filter((r) => r.weightChange !== null);
  const withFat = rows.filter((r) => r.bodyFatChange !== null);

  const results: Correlation[] = [
    describe(
      'sessions-weight',
      '月間筋トレ回数と体重変化',
      withWeight.map((r) => ({ x: r.sessions, y: r.weightChange!, label: monthLabel(r.month) })),
      '筋トレ回数',
      '体重',
    ),
    describe(
      'sessions-fat',
      '月間筋トレ回数と体脂肪率変化',
      withFat.map((r) => ({ x: r.sessions, y: r.bodyFatChange!, label: monthLabel(r.month) })),
      '筋トレ回数',
      '体脂肪率',
    ),
    describe(
      'volume-weight',
      '月間総負荷量と体重変化',
      withWeight.map((r) => ({ x: r.volume, y: r.weightChange!, label: monthLabel(r.month) })),
      '総負荷量',
      '体重',
    ),
  ];

  // トレーニング頻度(週ごとの回数)と体脂肪率変化(前週平均からの変化)
  const weekFat = new Map(aggregateBody(days, 'week', 'bodyFat').map((p) => [p.key, p.value]));
  const weekSessions = new Map<string, Set<string>>();
  records.forEach((r) => {
    const w = weekStart(r.date);
    weekSessions.set(w, (weekSessions.get(w) ?? new Set()).add(r.date));
  });
  const weekPairs = [...weekFat.keys()]
    .sort()
    .flatMap((w) => {
      const prev = weekFat.get(addDays(w, -7));
      if (prev === undefined) return [];
      return [{ x: weekSessions.get(w)?.size ?? 0, y: round(weekFat.get(w)! - prev, 2), label: periodLabel(w, 'week') }];
    });
  results.push(describe('freq-fat', '週ごとのトレーニング頻度と体脂肪率変化', weekPairs, 'トレーニング頻度', '体脂肪率'));

  // 種目別の実施頻度(月に何日行ったか)と体重変化
  const perExercise = exercises
    .filter((e) => records.some((r) => r.entries.some((x) => x.exerciseId === e.id)))
    .map((e) => {
      const pairs = withWeight.map((row) => ({
        x: new Set(
          records.filter((r) => monthKey(r.date) === row.month && r.entries.some((x) => x.exerciseId === e.id)).map((r) => r.date),
        ).size,
        y: row.weightChange!,
        label: monthLabel(row.month),
      }));
      return describe(`exercise-${e.id}`, `${e.name}の実施頻度と体重変化`, pairs, `${e.name}の実施回数`, '体重', 3);
    });

  return { rows, results, perExercise };
}
