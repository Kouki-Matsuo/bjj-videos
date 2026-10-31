// 日付の表示形式と、検索・絞り込みの判定処理です。

import type { Video, VideoFilter } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 2025/10/27 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 2025/10/27 14:32 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 全角・半角や大文字・小文字の違いを無視して比較するための変換 */
const normalize = (s: string) => s.normalize('NFKC').toLowerCase();

/** 動画が検索・絞り込み条件にすべて当てはまるか(複数条件はすべて満たすものだけ表示) */
export function matchesFilter(video: Video, filter: VideoFilter): boolean {
  if (filter.favoritesOnly && !video.isFavorite) return false;
  if (filter.positionId && video.positionId !== filter.positionId) return false;
  if (filter.techniqueTypeId && video.techniqueTypeId !== filter.techniqueTypeId) return false;
  if (filter.tags.length && !filter.tags.every((t) => video.tags.includes(t))) return false;
  // キーワードはスペース区切りで複数入力でき、すべての語が技名・タグ・メモのどこかに含まれれば一致
  const words = normalize(filter.keyword).split(/\s+/).filter(Boolean);
  if (words.length) {
    const haystack = normalize([video.title, ...video.tags, video.notes].join('\n'));
    if (!words.every((w) => haystack.includes(w.replace(/^#/, '')))) return false;
  }
  return true;
}

export function isFilterActive(filter: VideoFilter): boolean {
  return (
    filter.keyword.trim() !== '' ||
    filter.positionId !== null ||
    filter.techniqueTypeId !== null ||
    filter.favoritesOnly ||
    filter.tags.length > 0
  );
}
