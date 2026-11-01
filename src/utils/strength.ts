// 筋トレ機能で使う表示名・初期データ・集計(グラフ・自己ベスト・予定との比較)の処理です。

import type {
  Exercise,
  ExerciseKind,
  PlanItem,
  PlanStatus,
  RecordEntry,
  SetRecord,
  StrengthRecord,
} from '../types';

export const EXERCISE_KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'weight', label: 'ウェイト' },
  { value: 'bodyweight', label: '自重' },
  { value: 'time', label: '時間' },
];

export const isExerciseKind = (v: unknown): v is ExerciseKind => EXERCISE_KINDS.some((k) => k.value === v);
export const exerciseKindLabel = (k: ExerciseKind) => EXERCISE_KINDS.find((x) => x.value === k)?.label ?? '';

/** 鍛える部位の選択肢 */
export const BODY_PARTS = ['胸', '背中', '肩', '腕', '脚', '体幹', '全身'];

export const PLAN_STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'planned', label: '予定' },
  { value: 'done', label: '完了' },
  { value: 'skipped', label: '未実施' },
];

export const isPlanStatus = (v: unknown): v is PlanStatus => PLAN_STATUSES.some((s) => s.value === v);
export const planStatusLabel = (s: PlanStatus) => PLAN_STATUSES.find((x) => x.value === s)?.label ?? '';

/** 初期種目(初回だけ登録します。あとから自由に編集・削除できます) */
export const DEFAULT_EXERCISES: { name: string; kind: ExerciseKind; bodyParts: string[] }[] = [
  { name: 'スクワット', kind: 'weight', bodyParts: ['脚'] },
  { name: 'デッドリフト', kind: 'weight', bodyParts: ['背中', '脚'] },
  { name: 'ベンチプレス', kind: 'weight', bodyParts: ['胸', '腕'] },
  { name: '懸垂', kind: 'bodyweight', bodyParts: ['背中', '腕'] },
  { name: 'ラットプルダウン', kind: 'weight', bodyParts: ['背中'] },
  { name: 'ショルダープレス', kind: 'weight', bodyParts: ['肩'] },
  { name: '腕立て伏せ', kind: 'bodyweight', bodyParts: ['胸', '腕'] },
  { name: 'プランク', kind: 'time', bodyParts: ['体幹'] },
];

/** 入力欄の文字列を数値に変換します(空欄・不正値・0以下は null) */
export function parsePositive(v: unknown, max = 9999): number | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.normalize('NFKC').trim() : '';
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

/** 0以上の数値(重量の0kgなどを許可する場合) */
export function parseNonNegative(v: unknown, max = 9999): number | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.normalize('NFKC').trim() : '';
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** 90秒 → 1分30秒 */
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}分${s ? `${s}秒` : ''}` : `${s}秒`;
}

/** 1セット分の表示(例:60kg×10回 / 自重×12回 / 1分) */
export function formatSet(set: SetRecord, kind: ExerciseKind | undefined): string {
  if (kind === 'time') {
    const t = set.seconds ? formatSeconds(set.seconds) : '—';
    return set.weight ? `${num(set.weight)}kg・${t}` : t;
  }
  const w = set.weight ? `${num(set.weight)}kg` : kind === 'bodyweight' ? '自重' : '—kg';
  return `${w}×${set.reps ?? '—'}回`;
}

/** 予定の目標の表示(例:60kg × 10回 × 3セット) */
export function formatTarget(item: PlanItem, kind: ExerciseKind | undefined): string {
  const parts: string[] = [];
  if (item.targetWeight) parts.push(`${num(item.targetWeight)}kg`);
  else if (kind === 'bodyweight') parts.push('自重');
  if (item.targetReps) parts.push(kind === 'time' ? formatSeconds(item.targetReps) : `${item.targetReps}回`);
  if (item.targetSets) parts.push(`${item.targetSets}セット`);
  return parts.join(' × ') || '目標なし';
}

/** 種目名を引く(削除された種目は「削除された種目」) */
export function exerciseName(exercises: Exercise[], id: string | null): string {
  if (!id) return '種目なし';
  return exercises.find((e) => e.id === id)?.name ?? '削除された種目';
}

// ---------- 集計 ----------

/** 1種目分の集計値 */
export interface EntryStats {
  /** 最大重量(kg) */
  maxWeight: number;
  /** 1セットの最大回数(時間制は最長秒数) */
  maxReps: number;
  /** 総負荷量 = 各セットの 重量×回数 の合計(重量×回数×セット数) */
  volume: number;
  /** 総回数(時間制は合計秒数) */
  totalReps: number;
  sets: number;
}

export function entryStats(entry: RecordEntry, kind: ExerciseKind | undefined): EntryStats {
  const stats: EntryStats = { maxWeight: 0, maxReps: 0, volume: 0, totalReps: 0, sets: 0 };
  for (const s of entry.sets) {
    const amount = (kind === 'time' ? s.seconds : s.reps) ?? 0;
    if (!amount && !s.weight) continue;
    stats.sets++;
    stats.maxWeight = Math.max(stats.maxWeight, s.weight ?? 0);
    stats.maxReps = Math.max(stats.maxReps, amount);
    stats.totalReps += amount;
    if (kind !== 'time') stats.volume += (s.weight ?? 0) * (s.reps ?? 0);
  }
  return stats;
}

/** 種目の記録を日付ごとにまとめます(同じ日に複数回記録していれば合算) */
export function exerciseHistory(
  records: StrengthRecord[],
  exerciseId: string,
  kind: ExerciseKind | undefined,
): { date: string; stats: EntryStats }[] {
  const byDate = new Map<string, EntryStats>();
  for (const r of records) {
    for (const e of r.entries) {
      if (e.exerciseId !== exerciseId) continue;
      const s = entryStats(e, kind);
      if (!s.sets) continue;
      const prev = byDate.get(r.date);
      byDate.set(
        r.date,
        prev
          ? {
              maxWeight: Math.max(prev.maxWeight, s.maxWeight),
              maxReps: Math.max(prev.maxReps, s.maxReps),
              volume: prev.volume + s.volume,
              totalReps: prev.totalReps + s.totalReps,
              sets: prev.sets + s.sets,
            }
          : s,
      );
    }
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, stats]) => ({ date, stats }));
}

/** 予定(目標)と実績を比べて、目標を達成したか判定します */
export function compareWithTarget(
  item: PlanItem,
  entry: RecordEntry | undefined,
  kind: ExerciseKind | undefined,
): 'achieved' | 'missed' | 'notDone' {
  if (!entry) return 'notDone';
  const done = entry.sets.filter((s) => (kind === 'time' ? s.seconds : s.reps));
  if (!done.length) return 'notDone';
  // 目標を満たしたセットが目標セット数以上あれば「達成」
  const okSets = done.filter(
    (s) =>
      (!item.targetWeight || (s.weight ?? 0) >= item.targetWeight) &&
      (!item.targetReps || ((kind === 'time' ? s.seconds : s.reps) ?? 0) >= item.targetReps),
  ).length;
  return okSets >= (item.targetSets ?? 1) ? 'achieved' : 'missed';
}

/** 予定の目標から、実績入力の初期値(セットの行)を作ります */
export function setsFromTarget(item: PlanItem, kind: ExerciseKind | undefined): SetRecord[] {
  const count = Math.min(item.targetSets ?? 1, 20);
  return Array.from({ length: Math.max(count, 1) }, () => ({
    weight: item.targetWeight,
    reps: kind === 'time' ? null : item.targetReps,
    seconds: kind === 'time' ? item.targetReps : null,
  }));
}
