// IndexedDB(ブラウザ内のデータベース)を開く処理と、初期データの登録です。
// 画面のコードからはこのファイルを直接使わず、repository.ts を通して使います。

import type { Category } from '../types';
import { createId } from '../utils/id';

const DB_NAME = 'bjj-video-manager';
// 1: 動画・分類 / 2: 練習ノートを追加 / 3: カレンダー予定を追加
const DB_VERSION = 3;

export const STORES = {
  videos: 'videos',
  positions: 'positions',
  techniqueTypes: 'techniqueTypes',
  practiceNotes: 'practiceNotes',
  events: 'events',
} as const;

const DEFAULT_POSITIONS = [
  'クローズドガード',
  'ハーフガード',
  'マウント',
  'バック',
  'オープンガード',
  'サイドコントロール',
  'タートル',
  '立ち技',
  'その他',
];

const DEFAULT_TECHNIQUE_TYPES = [
  'サブミッション',
  'スイープ',
  'パスガード',
  'エスケープ',
  'テイクダウン',
  'ポジション移行',
  'ポジションキープ・コントロール',
  'その他',
];

function toCategories(names: string[]): Category[] {
  return names.map((name, i) => ({ id: createId(), name, sortOrder: i, isDefault: true }));
}

/**
 * ブラウザに「このサイトのデータは自動で消さないでほしい」と依頼します。
 * 認められるかはブラウザ次第なので、失敗してもアプリの動作には影響させません。
 */
function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => undefined);
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('このブラウザはデータ保存(IndexedDB)に対応していません。'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // 初回(またはバージョンアップ時)だけ呼ばれます。ここで保存先と初期分類を作ります。
    // 既存の保存先には手を付けず、足りない保存先だけを追加するので、登録済みのデータはそのまま残ります。
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        const videos = db.createObjectStore(STORES.videos, { keyPath: 'id' });
        videos.createIndex('createdAt', 'createdAt');
        const positions = db.createObjectStore(STORES.positions, { keyPath: 'id' });
        const types = db.createObjectStore(STORES.techniqueTypes, { keyPath: 'id' });
        toCategories(DEFAULT_POSITIONS).forEach((c) => positions.put(c));
        toCategories(DEFAULT_TECHNIQUE_TYPES).forEach((c) => types.put(c));
      }
      if (event.oldVersion < 2) {
        const notes = db.createObjectStore(STORES.practiceNotes, { keyPath: 'id' });
        notes.createIndex('videoId', 'videoId');
      }
      if (event.oldVersion < 3) {
        const events = db.createObjectStore(STORES.events, { keyPath: 'id' });
        events.createIndex('startDate', 'startDate');
      }
    };
    req.onsuccess = () => {
      requestPersistentStorage();
      // 別のタブで新しい版のアプリが開かれたら接続を閉じ、データベースの更新を妨げないようにします
      req.result.onversionchange = () => {
        req.result.close();
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('データベースを開けませんでした。'));
    };
  });
  return dbPromise;
}

/** IDBRequest を Promise に変換する小さな補助関数 */
export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** トランザクション(まとめて行う書き込み)が完了するまで待ちます。失敗時は全て取り消されます */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保存に失敗しました。'));
    tx.onabort = () => reject(tx.error ?? new Error('保存が中断されました。'));
  });
}
