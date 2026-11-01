// URLの「#/...」部分でページを切り替える、シンプルな画面遷移の仕組みです。
// ブラウザの戻る操作(iPhoneの左端スワイプ)でも前の画面に戻れます。

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'settings' }
  | { name: 'categories'; kind: 'positions' | 'techniqueTypes' }
  | { name: 'tags' }
  | { name: 'backup'; restore: boolean }
  | { name: 'notes' }
  | { name: 'noteNew'; videoId: string | null; date: string | null }
  | { name: 'noteDetail'; id: string }
  | { name: 'noteEdit'; id: string }
  | { name: 'calendar'; date: string | null }
  | { name: 'eventNew'; date: string | null }
  | { name: 'eventEdit'; id: string }
  | { name: 'strength'; tab: StrengthTab; exerciseId: string | null }
  | { name: 'exerciseForm'; id: string | null }
  | { name: 'sVideoForm'; id: string | null; exerciseId: string | null }
  | { name: 'sVideoDetail'; id: string }
  | { name: 'planForm'; id: string | null; date: string | null }
  | { name: 'planDetail'; id: string }
  | { name: 'recordForm'; id: string | null; date: string | null; planId: string | null }
  | { name: 'recordDetail'; id: string }
  | { name: 'bodyEdit'; id: string };

/** 筋トレ画面の上部タブ。log: 記録 / body: 体重 / stats: 分析 / videos: 動画 / exercises: 種目 */
export type StrengthTab = 'log' | 'body' | 'stats' | 'videos' | 'exercises';

export function parseRoute(hash: string): Route {
  // 「#/notes/new?date=2026-11-14」のように、? 以降に追加の指定を付けられます
  const [path, queryString = ''] = hash.replace(/^#\/?/, '').split('?');
  const query = new URLSearchParams(queryString);
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  if (a === 'new') return { name: 'new' };
  if (a === 'videos' && b && c === 'edit') return { name: 'edit', id: b };
  if (a === 'videos' && b) return { name: 'detail', id: b };
  if (a === 'notes') {
    // #/notes/new または #/notes/new/動画ID(動画詳細から作成したとき)
    if (b === 'new') return { name: 'noteNew', videoId: c ?? null, date: query.get('date') };
    if (b && c === 'edit') return { name: 'noteEdit', id: b };
    if (b) return { name: 'noteDetail', id: b };
    return { name: 'notes' };
  }
  if (a === 'strength') return parseStrength(b, c, d, query);
  if (a === 'calendar') return { name: 'calendar', date: b ?? null };
  if (a === 'events') {
    if (b === 'new') return { name: 'eventNew', date: query.get('date') };
    if (b) return { name: 'eventEdit', id: b };
  }
  if (a === 'settings') {
    if (b === 'positions' || b === 'techniqueTypes') return { name: 'categories', kind: b };
    if (b === 'tags') return { name: 'tags' };
    if (b === 'backup' || b === 'restore') return { name: 'backup', restore: b === 'restore' };
    return { name: 'settings' };
  }
  return { name: 'list' };
}

function parseStrength(b: string | undefined, c: string | undefined, d: string | undefined, query: URLSearchParams): Route {
  const isNew = c === 'new';
  if (b === 'exercises' && c) return { name: 'exerciseForm', id: isNew ? null : c };
  if (b === 'videos' && c) {
    if (isNew) return { name: 'sVideoForm', id: null, exerciseId: query.get('exercise') };
    return d === 'edit' ? { name: 'sVideoForm', id: c, exerciseId: null } : { name: 'sVideoDetail', id: c };
  }
  if (b === 'plans' && c) {
    if (isNew) return { name: 'planForm', id: null, date: query.get('date') };
    return d === 'edit' ? { name: 'planForm', id: c, date: null } : { name: 'planDetail', id: c };
  }
  if (b === 'records' && c) {
    if (isNew) return { name: 'recordForm', id: null, date: query.get('date'), planId: query.get('plan') };
    return d === 'edit' ? { name: 'recordForm', id: c, date: null, planId: null } : { name: 'recordDetail', id: c };
  }
  if (b === 'body' && c) return { name: 'bodyEdit', id: c };
  const tab: StrengthTab = b === 'body' || b === 'stats' || b === 'videos' || b === 'exercises' ? b : 'log';
  return { name: 'strength', tab, exerciseId: query.get('exercise') };
}

/** 練習ノート作成画面のパス。動画詳細やカレンダーから、動画・練習日を指定して開けます */
export function newNotePath(videoId: string | null = null, date: string | null = null): string {
  const base = videoId ? `/notes/new/${encodeURIComponent(videoId)}` : '/notes/new';
  return date ? `${base}?date=${date}` : base;
}

// 履歴ごとに「アプリ内で何画面進んだか」を記録します。
// 0の画面で「戻る」を押したときは、アプリの外に出ないよう指定の画面に移動します。
const currentDepth = (): number => (history.state as { depth?: number } | null)?.depth ?? 0;

export function navigate(path: string, options: { replace?: boolean } = {}) {
  const hash = `#${path}`;
  if (options.replace) {
    history.replaceState({ depth: currentDepth() }, '', hash);
  } else {
    history.pushState({ depth: currentDepth() + 1 }, '', hash);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function goBack(fallback: string) {
  if (currentDepth() > 0) {
    history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
