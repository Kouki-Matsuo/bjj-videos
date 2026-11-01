// バックアップ(JSON)の形式と、読み込んだファイルの検証処理です。
// 検証はデータベースに書き込む前に全て終わらせるので、不正なファイルで既存データが壊れることはありません。

import type {
  CalendarEvent,
  Category,
  Exercise,
  PlanItem,
  PracticeNote,
  RecordEntry,
  StrengthPlan,
  StrengthRecord,
  StrengthVideo,
  Video,
} from '../types';
import { isExerciseKind, isPlanStatus, parseNonNegative, parsePositive } from '../utils/strength';
import { isEventType, isTimeString, validateEventDates } from '../utils/calendar';
import { isDateOnly, isPracticeResult, parsePracticeCount } from '../utils/practice';
import { isAllowedVideoUrl } from '../utils/url';

export const BACKUP_APP_ID = 'bjj-video-manager';
/**
 * 1: 動画・分類 / 2: 練習ノートを追加 / 3: カレンダー予定を追加 / 4: 筋トレを追加
 * (古いバージョンのファイルも引き続き読み込めます)
 */
export const BACKUP_VERSION = 4;

export interface BackupData {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  positions: Category[];
  techniqueTypes: Category[];
  videos: Video[];
  practiceNotes: PracticeNote[];
  events: CalendarEvent[];
  /** 筋トレ種目。筋トレ機能より前のファイルでは null */
  exercises: Exercise[] | null;
  strengthVideos: StrengthVideo[];
  strengthPlans: StrengthPlan[];
  strengthRecords: StrengthRecord[];
}

/** replace: 既存データを置き換える / merge: 既存データに追加する */
export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  addedVideos: number;
  skippedVideos: number;
  addedCategories: number;
  addedNotes: number;
  skippedNotes: number;
  addedEvents: number;
  skippedEvents: number;
  /** 筋トレの動画・予定・実績 */
  addedStrength: number;
  skippedStrength: number;
}

export class BackupValidationError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isDateString = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v));

function validateCategories(value: unknown, label: string): Category[] {
  if (!Array.isArray(value)) throw new BackupValidationError(`${label}の一覧が見つかりません。`);
  const ids = new Set<string>();
  return value.map((item, i) => {
    const where = `${label}の${i + 1}件目`;
    if (!isObject(item)) throw new BackupValidationError(`${where}の形式が正しくありません。`);
    const { id, name, sortOrder, isDefault } = item;
    if (typeof id !== 'string' || id === '') throw new BackupValidationError(`${where}のIDが正しくありません。`);
    if (ids.has(id)) throw new BackupValidationError(`${where}のIDが重複しています。`);
    ids.add(id);
    if (typeof name !== 'string' || name.trim() === '')
      throw new BackupValidationError(`${where}の名前が正しくありません。`);
    return {
      id,
      name: name.trim(),
      sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : i,
      isDefault: isDefault === true,
    };
  });
}

function validateVideos(value: unknown, positionIds: Set<string>, typeIds: Set<string>): Video[] {
  if (!Array.isArray(value)) throw new BackupValidationError('動画の一覧が見つかりません。');
  const ids = new Set<string>();
  return value.map((item, i) => {
    const where = `動画の${i + 1}件目`;
    if (!isObject(item)) throw new BackupValidationError(`${where}の形式が正しくありません。`);
    const v = item;
    if (typeof v.id !== 'string' || v.id === '') throw new BackupValidationError(`${where}のIDが正しくありません。`);
    if (ids.has(v.id)) throw new BackupValidationError(`${where}のIDが重複しています。`);
    ids.add(v.id);
    if (typeof v.url !== 'string' || !isAllowedVideoUrl(v.url))
      throw new BackupValidationError(`${where}の動画URLが正しくありません。`);
    if (typeof v.title !== 'string' || v.title.trim() === '')
      throw new BackupValidationError(`${where}の技名が空です。`);
    if (!isDateString(v.createdAt) || !isDateString(v.updatedAt))
      throw new BackupValidationError(`${where}の日時が正しくありません。`);
    if (v.tags !== undefined && !(Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string')))
      throw new BackupValidationError(`${where}のタグが正しくありません。`);
    const positionId = typeof v.positionId === 'string' ? v.positionId : null;
    const techniqueTypeId = typeof v.techniqueTypeId === 'string' ? v.techniqueTypeId : null;
    if (positionId && !positionIds.has(positionId))
      throw new BackupValidationError(`${where}のポジションがファイル内の分類に存在しません。`);
    if (techniqueTypeId && !typeIds.has(techniqueTypeId))
      throw new BackupValidationError(`${where}の技の種類がファイル内の分類に存在しません。`);
    const thumbnailUrl =
      typeof v.thumbnailUrl === 'string' && /^https?:\/\//i.test(v.thumbnailUrl) ? v.thumbnailUrl : null;
    return {
      id: v.id,
      url: v.url,
      title: v.title.trim(),
      positionId,
      techniqueTypeId,
      tags: Array.from(new Set(((v.tags as string[] | undefined) ?? []).map((t) => t.trim()).filter(Boolean))),
      notes: typeof v.notes === 'string' ? v.notes : '',
      isFavorite: v.isFavorite === true,
      thumbnailUrl,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  });
}

function validatePracticeNotes(value: unknown): PracticeNote[] {
  // バージョン1のファイルには練習ノートがないので、空として扱います
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BackupValidationError('練習ノートの一覧の形式が正しくありません。');
  const ids = new Set<string>();
  return value.map((item, i) => {
    const where = `練習ノートの${i + 1}件目`;
    if (!isObject(item)) throw new BackupValidationError(`${where}の形式が正しくありません。`);
    const n = item;
    if (typeof n.id !== 'string' || n.id === '') throw new BackupValidationError(`${where}のIDが正しくありません。`);
    if (ids.has(n.id)) throw new BackupValidationError(`${where}のIDが重複しています。`);
    ids.add(n.id);
    if (!isDateOnly(n.practiceDate)) throw new BackupValidationError(`${where}の練習日が正しくありません。`);
    if (n.videoId !== undefined && n.videoId !== null && typeof n.videoId !== 'string')
      throw new BackupValidationError(`${where}の関連動画が正しくありません。`);
    if (!isPracticeResult(n.result)) throw new BackupValidationError(`${where}の練習結果が正しくありません。`);
    if (!isDateString(n.createdAt) || !isDateString(n.updatedAt))
      throw new BackupValidationError(`${where}の日時が正しくありません。`);
    // 関連動画が削除済み(ファイル内に存在しない)でも、ノートはそのまま読み込みます
    return {
      id: n.id,
      practiceDate: n.practiceDate,
      videoId: typeof n.videoId === 'string' && n.videoId !== '' ? n.videoId : null,
      result: n.result,
      memo: typeof n.memo === 'string' ? n.memo : '',
      improvement: typeof n.improvement === 'string' ? n.improvement : '',
      practiceCount: parsePracticeCount(n.practiceCount),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  });
}

function validateEvents(value: unknown): CalendarEvent[] {
  // バージョン2以前のファイルには予定がないので、空として扱います
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BackupValidationError('予定の一覧の形式が正しくありません。');
  const ids = new Set<string>();
  const optionalText = (v: unknown) => (typeof v === 'string' ? v : '');
  return value.map((item, i) => {
    const where = `予定の${i + 1}件目`;
    if (!isObject(item)) throw new BackupValidationError(`${where}の形式が正しくありません。`);
    const e = item;
    if (typeof e.id !== 'string' || e.id === '') throw new BackupValidationError(`${where}のIDが正しくありません。`);
    if (ids.has(e.id)) throw new BackupValidationError(`${where}のIDが重複しています。`);
    ids.add(e.id);
    if (typeof e.title !== 'string' || e.title.trim() === '')
      throw new BackupValidationError(`${where}のタイトルが空です。`);
    if (!isEventType(e.type)) throw new BackupValidationError(`${where}の種類が正しくありません。`);
    const dates = {
      startDate: typeof e.startDate === 'string' ? e.startDate : '',
      endDate: typeof e.endDate === 'string' && e.endDate !== '' ? e.endDate : null,
      startTime: isTimeString(e.startTime) ? e.startTime : null,
      endTime: isTimeString(e.endTime) ? e.endTime : null,
    };
    const dateError = validateEventDates(dates);
    if (dateError) throw new BackupValidationError(`${where}:${dateError}`);
    if (!isDateString(e.createdAt) || !isDateString(e.updatedAt))
      throw new BackupValidationError(`${where}の日時が正しくありません。`);
    return {
      id: e.id,
      title: e.title.trim(),
      type: e.type,
      ...dates,
      endDate: dates.endDate === dates.startDate ? null : dates.endDate,
      location: optionalText(e.location),
      description: optionalText(e.description),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  });
}

// ---------- 筋トレ ----------

const stringList = (v: unknown) =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))) : [];

/** 配列の各要素に id があり、重複していないか確認します */
function checkIds(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new BackupValidationError(`${label}の一覧の形式が正しくありません。`);
  const ids = new Set<string>();
  return value.map((item, i) => {
    const where = `${label}の${i + 1}件目`;
    if (!isObject(item)) throw new BackupValidationError(`${where}の形式が正しくありません。`);
    if (typeof item.id !== 'string' || item.id === '') throw new BackupValidationError(`${where}のIDが正しくありません。`);
    if (ids.has(item.id)) throw new BackupValidationError(`${where}のIDが重複しています。`);
    ids.add(item.id);
    if (!isDateString(item.createdAt) || !isDateString(item.updatedAt))
      throw new BackupValidationError(`${where}の日時が正しくありません。`);
    return item;
  });
}

function validateExercises(value: unknown): Exercise[] | null {
  if (value === undefined) return null;
  const names = new Set<string>();
  return checkIds(value, '筋トレ種目').map((e, i) => {
    const where = `筋トレ種目の${i + 1}件目`;
    if (typeof e.name !== 'string' || !e.name.trim()) throw new BackupValidationError(`${where}の種目名が空です。`);
    const key = e.name.trim().toLowerCase();
    if (names.has(key)) throw new BackupValidationError(`${where}の種目名が重複しています。`);
    names.add(key);
    if (!isExerciseKind(e.kind)) throw new BackupValidationError(`${where}の種類が正しくありません。`);
    return {
      id: e.id as string,
      name: e.name.trim(),
      kind: e.kind,
      bodyParts: stringList(e.bodyParts),
      sortOrder: typeof e.sortOrder === 'number' && Number.isFinite(e.sortOrder) ? e.sortOrder : i,
      isDefault: e.isDefault === true,
      createdAt: e.createdAt as string,
      updatedAt: e.updatedAt as string,
    };
  });
}

function validateStrengthVideos(value: unknown, exerciseIds: Set<string> | null): StrengthVideo[] {
  if (value === undefined) return [];
  return checkIds(value, '筋トレ動画').map((v, i) => {
    const where = `筋トレ動画の${i + 1}件目`;
    if (typeof v.url !== 'string' || !isAllowedVideoUrl(v.url))
      throw new BackupValidationError(`${where}の動画URLが正しくありません。`);
    if (typeof v.title !== 'string' || !v.title.trim()) throw new BackupValidationError(`${where}のタイトルが空です。`);
    const exerciseId = typeof v.exerciseId === 'string' && v.exerciseId ? v.exerciseId : null;
    if (exerciseId && exerciseIds && !exerciseIds.has(exerciseId))
      throw new BackupValidationError(`${where}の種目がファイル内の種目に存在しません。`);
    return {
      id: v.id as string,
      url: v.url,
      title: v.title.trim(),
      exerciseId,
      bodyParts: stringList(v.bodyParts),
      tags: stringList(v.tags),
      notes: typeof v.notes === 'string' ? v.notes : '',
      isFavorite: v.isFavorite === true,
      thumbnailUrl:
        typeof v.thumbnailUrl === 'string' && /^https?:\/\//i.test(v.thumbnailUrl) ? v.thumbnailUrl : null,
      createdAt: v.createdAt as string,
      updatedAt: v.updatedAt as string,
    };
  });
}

function validatePlanItems(value: unknown, where: string): PlanItem[] {
  if (!Array.isArray(value) || !value.length) throw new BackupValidationError(`${where}の種目が正しくありません。`);
  return value.map((item, i) => {
    if (!isObject(item) || typeof item.exerciseId !== 'string' || !item.exerciseId)
      throw new BackupValidationError(`${where}の${i + 1}種目目が正しくありません。`);
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `${i}`,
      exerciseId: item.exerciseId,
      targetWeight: parseNonNegative(item.targetWeight),
      targetReps: parsePositive(item.targetReps, 99999),
      targetSets: parsePositive(item.targetSets, 100),
      videoIds: stringList(item.videoIds),
    };
  });
}

function validateEntries(value: unknown, where: string): RecordEntry[] {
  if (!Array.isArray(value) || !value.length) throw new BackupValidationError(`${where}の種目が正しくありません。`);
  return value.map((entry, i) => {
    if (!isObject(entry) || typeof entry.exerciseId !== 'string' || !entry.exerciseId || !Array.isArray(entry.sets))
      throw new BackupValidationError(`${where}の${i + 1}種目目が正しくありません。`);
    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : `${i}`,
      exerciseId: entry.exerciseId,
      sets: entry.sets.map((s, j) => {
        if (!isObject(s)) throw new BackupValidationError(`${where}の${i + 1}種目目の${j + 1}セット目が正しくありません。`);
        return {
          weight: parseNonNegative(s.weight),
          reps: parsePositive(s.reps, 99999),
          seconds: parsePositive(s.seconds, 99999),
        };
      }),
    };
  });
}

function validateStrengthPlans(value: unknown): StrengthPlan[] {
  if (value === undefined) return [];
  return checkIds(value, '筋トレ予定').map((p, i) => {
    const where = `筋トレ予定の${i + 1}件目`;
    if (!isDateOnly(p.date)) throw new BackupValidationError(`${where}の予定日が正しくありません。`);
    if (!isPlanStatus(p.status)) throw new BackupValidationError(`${where}の状態が正しくありません。`);
    return {
      id: p.id as string,
      date: p.date,
      items: validatePlanItems(p.items, where),
      status: p.status,
      memo: typeof p.memo === 'string' ? p.memo : '',
      createdAt: p.createdAt as string,
      updatedAt: p.updatedAt as string,
    };
  });
}

function validateStrengthRecords(value: unknown): StrengthRecord[] {
  if (value === undefined) return [];
  const planIds = new Set<string>();
  return checkIds(value, '筋トレ実績').map((r, i) => {
    const where = `筋トレ実績の${i + 1}件目`;
    if (!isDateOnly(r.date)) throw new BackupValidationError(`${where}の実施日が正しくありません。`);
    const planId = typeof r.planId === 'string' && r.planId ? r.planId : null;
    if (planId && planIds.has(planId)) throw new BackupValidationError(`${where}:同じ予定に実績が重複しています。`);
    if (planId) planIds.add(planId);
    return {
      id: r.id as string,
      date: r.date,
      planId,
      entries: validateEntries(r.entries, where),
      memo: typeof r.memo === 'string' ? r.memo : '',
      createdAt: r.createdAt as string,
      updatedAt: r.updatedAt as string,
    };
  });
}

/** JSON文字列を解析・検証し、問題なければ BackupData を返します。問題があれば日本語のエラーを投げます */
export function parseBackup(text: string): BackupData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupValidationError('JSONファイルとして読み込めませんでした。');
  }
  if (!isObject(json) || json.app !== BACKUP_APP_ID)
    throw new BackupValidationError('このアプリのバックアップファイルではありません。');
  if (typeof json.version !== 'number' || json.version > BACKUP_VERSION)
    throw new BackupValidationError('対応していないバージョンのバックアップファイルです。');
  const positions = validateCategories(json.positions, 'ポジション');
  const techniqueTypes = validateCategories(json.techniqueTypes, '技の種類');
  const videos = validateVideos(
    json.videos,
    new Set(positions.map((c) => c.id)),
    new Set(techniqueTypes.map((c) => c.id)),
  );
  const practiceNotes = validatePracticeNotes(json.practiceNotes);
  const events = validateEvents(json.events);
  const exercises = validateExercises(json.exercises);
  const strengthVideos = validateStrengthVideos(
    json.strengthVideos,
    exercises ? new Set(exercises.map((e) => e.id)) : null,
  );
  const strengthPlans = validateStrengthPlans(json.strengthPlans);
  const strengthRecords = validateStrengthRecords(json.strengthRecords);
  return {
    app: BACKUP_APP_ID,
    version: json.version,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : '',
    positions,
    techniqueTypes,
    videos,
    practiceNotes,
    events,
    exercises,
    strengthVideos,
    strengthPlans,
    strengthRecords,
  };
}
