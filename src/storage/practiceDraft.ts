// 練習ノートの「入力途中の内容(下書き)」を自動保存する処理です。
// 下書きはこの端末だけで使う一時的なデータなので、ブラウザの localStorage に保存します
// (バックアップの対象外。保存ボタンを押すと正式なノートとして IndexedDB に保存されます)。

import type { PracticeNoteInput } from '../types';
import { isDateOnly, isPracticeResult, parsePracticeCount } from '../utils/practice';

const PREFIX = 'bjj-practice-draft:';

/** 下書きの保存場所の名前。新規は「new:動画ID」(カレンダーから日付指定で開いたときは「new:動画ID:日付」)、編集は「edit:ノートID」 */
export const newDraftKey = (videoId: string | null, date: string | null = null) =>
  `new:${videoId ?? ''}${date ? `:${date}` : ''}`;

/** 新規の下書きの名前から、作成画面を開いたときの動画ID・日付を取り出します */
export function parseNewDraftKey(key: string): { videoId: string | null; date: string | null } {
  const [videoId = '', date = ''] = key.replace(/^new:/, '').split(':');
  return { videoId: videoId || null, date: date || null };
}
export const editDraftKey = (noteId: string) => `edit:${noteId}`;

export interface PracticeDraft {
  key: string;
  form: PracticeNoteInput;
  savedAt: string;
}

function parse(key: string, raw: string | null): PracticeDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { form?: Record<string, unknown>; savedAt?: unknown };
    const f = data.form;
    if (!f || typeof f !== 'object') return null;
    // 練習日を消した途中の状態でも、ほかの入力内容は失わないように復元します
    return {
      key,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
      form: {
        practiceDate: isDateOnly(f.practiceDate) ? f.practiceDate : '',
        videoId: typeof f.videoId === 'string' && f.videoId ? f.videoId : null,
        result: isPracticeResult(f.result) ? f.result : 'unrated',
        memo: typeof f.memo === 'string' ? f.memo : '',
        improvement: typeof f.improvement === 'string' ? f.improvement : '',
        practiceCount: parsePracticeCount(f.practiceCount),
      },
    };
  } catch {
    return null;
  }
}

// プライベートブラウズなどで localStorage が使えない場合も、アプリ自体は動くようにしています
export function loadDraft(key: string): PracticeDraft | null {
  try {
    return parse(key, localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}

/** 保存できたら true */
export function saveDraft(key: string, form: PracticeNoteInput): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ form, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 何もしません
  }
}

/** 新規作成中の下書きの一覧(新しい順) */
export function listNewDrafts(): PracticeDraft[] {
  const drafts: PracticeDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (!name?.startsWith(PREFIX + 'new:')) continue;
      const d = parse(name.slice(PREFIX.length), localStorage.getItem(name));
      if (d) drafts.push(d);
    }
  } catch {
    return [];
  }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
