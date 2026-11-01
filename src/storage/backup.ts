// バックアップ(JSON)の形式と、読み込んだファイルの検証処理です。
// 検証はデータベースに書き込む前に全て終わらせるので、不正なファイルで既存データが壊れることはありません。

import type { Category, PracticeNote, Video } from '../types';
import { isDateOnly, isPracticeResult, parsePracticeCount } from '../utils/practice';
import { isAllowedVideoUrl } from '../utils/url';

export const BACKUP_APP_ID = 'bjj-video-manager';
/** 1: 動画・分類 / 2: 練習ノートを追加(バージョン1のファイルも引き続き読み込めます) */
export const BACKUP_VERSION = 2;

export interface BackupData {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  positions: Category[];
  techniqueTypes: Category[];
  videos: Video[];
  practiceNotes: PracticeNote[];
}

/** replace: 既存データを置き換える / merge: 既存データに追加する */
export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  addedVideos: number;
  skippedVideos: number;
  addedCategories: number;
  addedNotes: number;
  skippedNotes: number;
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
  return {
    app: BACKUP_APP_ID,
    version: json.version,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : '',
    positions,
    techniqueTypes,
    videos,
    practiceNotes,
  };
}
