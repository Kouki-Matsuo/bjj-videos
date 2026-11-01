// DataRepository の IndexedDB 版の実装です。

import type { Category, CategoryKind, PracticeNote, PracticeNoteInput, Video, VideoInput } from '../types';
import { createId } from '../utils/id';
import { isDateOnly, parsePracticeCount, sortPracticeNotes } from '../utils/practice';
import { BACKUP_APP_ID, BACKUP_VERSION, type BackupData, type ImportResult } from './backup';
import { openDb, requestToPromise, STORES, transactionDone } from './db';
import type { DataRepository } from './repository';

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
}

async function getOne<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(id) as IDBRequest<T | undefined>);
}

/** 複数のデータをまとめて保存します(途中で失敗したら全て取り消し) */
async function putAll(storeName: string, items: unknown[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  items.forEach((item) => store.put(item));
  await transactionDone(tx);
}

const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function normalizeInput(input: VideoInput): VideoInput {
  return {
    ...input,
    url: input.url.trim(),
    title: input.title.trim(),
    notes: input.notes.trim(),
    tags: Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean))),
  };
}

function normalizeNoteInput(input: PracticeNoteInput): PracticeNoteInput {
  if (!isDateOnly(input.practiceDate)) throw new Error('練習日が正しくありません。');
  return {
    practiceDate: input.practiceDate,
    videoId: input.videoId || null,
    result: input.result,
    memo: input.memo.trim(),
    improvement: input.improvement.trim(),
    practiceCount: parsePracticeCount(input.practiceCount),
  };
}

async function listCategories(kind: CategoryKind): Promise<Category[]> {
  return (await getAll<Category>(STORES[kind])).sort(byOrder);
}

/** 動画のタグを書き換える共通処理(名称変更・削除で使用) */
async function updateTags(transform: (tags: string[]) => string[] | null): Promise<void> {
  const videos = await getAll<Video>(STORES.videos);
  const changed: Video[] = [];
  for (const v of videos) {
    const next = transform(v.tags);
    if (next) changed.push({ ...v, tags: Array.from(new Set(next)) });
  }
  await putAll(STORES.videos, changed);
}

export const indexedDbRepository: DataRepository = {
  async listVideos() {
    const videos = await getAll<Video>(STORES.videos);
    return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getVideo(id) {
    return getOne<Video>(STORES.videos, id);
  },

  async createVideo(input) {
    const now = new Date().toISOString();
    const video: Video = { ...normalizeInput(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.videos, [video]);
    return video;
  },

  async updateVideo(id, input) {
    const current = await getOne<Video>(STORES.videos, id);
    if (!current) throw new Error('編集対象の動画が見つかりません。削除された可能性があります。');
    const video: Video = { ...current, ...normalizeInput(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.videos, [video]);
    return video;
  },

  async setFavorite(id, isFavorite) {
    const current = await getOne<Video>(STORES.videos, id);
    if (!current) throw new Error('動画が見つかりません。');
    // お気に入りの切り替えは「内容の編集」ではないので更新日時は変えません
    await putAll(STORES.videos, [{ ...current, isFavorite }]);
  },

  async deleteVideo(id) {
    const db = await openDb();
    const tx = db.transaction(STORES.videos, 'readwrite');
    tx.objectStore(STORES.videos).delete(id);
    await transactionDone(tx);
  },

  async listPracticeNotes() {
    return sortPracticeNotes(await getAll<PracticeNote>(STORES.practiceNotes));
  },

  async createPracticeNote(input) {
    const now = new Date().toISOString();
    const note: PracticeNote = { ...normalizeNoteInput(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.practiceNotes, [note]);
    return note;
  },

  async updatePracticeNote(id, input) {
    const current = await getOne<PracticeNote>(STORES.practiceNotes, id);
    if (!current) throw new Error('編集対象の練習ノートが見つかりません。削除された可能性があります。');
    const note: PracticeNote = { ...current, ...normalizeNoteInput(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.practiceNotes, [note]);
    return note;
  },

  async deletePracticeNote(id) {
    const db = await openDb();
    const tx = db.transaction(STORES.practiceNotes, 'readwrite');
    tx.objectStore(STORES.practiceNotes).delete(id);
    await transactionDone(tx);
  },

  listCategories,

  async addCategory(kind, name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('名前を入力してください。');
    const list = await listCategories(kind);
    if (list.some((c) => sameName(c.name, trimmed))) throw new Error('同じ名前の分類がすでにあります。');
    const category: Category = {
      id: createId(),
      name: trimmed,
      sortOrder: list.length ? Math.max(...list.map((c) => c.sortOrder)) + 1 : 0,
      isDefault: false,
    };
    await putAll(STORES[kind], [category]);
    return category;
  },

  async renameCategory(kind, id, name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('名前を入力してください。');
    const list = await listCategories(kind);
    const target = list.find((c) => c.id === id);
    if (!target) throw new Error('分類が見つかりません。');
    if (list.some((c) => c.id !== id && sameName(c.name, trimmed)))
      throw new Error('同じ名前の分類がすでにあります。');
    // 動画はIDで分類とつながっているので、名前を変えても動画側の変更は不要です
    await putAll(STORES[kind], [{ ...target, name: trimmed }]);
  },

  async deleteCategory(kind, id, replacementId) {
    if (replacementId === id) throw new Error('削除する分類と同じ分類には移動できません。');
    const field = kind === 'positions' ? 'positionId' : 'techniqueTypeId';
    const videos = await getAll<Video>(STORES.videos);
    const db = await openDb();
    // 動画の付け替えと分類の削除を1つのトランザクションで行い、中途半端な状態を防ぎます
    const tx = db.transaction([STORES.videos, STORES[kind]], 'readwrite');
    const videoStore = tx.objectStore(STORES.videos);
    videos
      .filter((v) => v[field] === id)
      .forEach((v) => videoStore.put({ ...v, [field]: replacementId }));
    tx.objectStore(STORES[kind]).delete(id);
    await transactionDone(tx);
  },

  async reorderCategories(kind, ids) {
    const list = await listCategories(kind);
    const map = new Map(list.map((c) => [c.id, c]));
    const updated = ids.flatMap((id, i) => {
      const c = map.get(id);
      return c ? [{ ...c, sortOrder: i }] : [];
    });
    await putAll(STORES[kind], updated);
  },

  async renameTag(from, to) {
    const next = to.trim();
    if (!next) throw new Error('タグ名を入力してください。');
    await updateTags((tags) => (tags.includes(from) ? tags.map((t) => (t === from ? next : t)) : null));
  },

  async deleteTag(tag) {
    await updateTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : null));
  },

  async exportAll() {
    const [videos, positions, techniqueTypes, practiceNotes] = await Promise.all([
      getAll<Video>(STORES.videos),
      listCategories('positions'),
      listCategories('techniqueTypes'),
      getAll<PracticeNote>(STORES.practiceNotes),
    ]);
    return {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      positions,
      techniqueTypes,
      videos,
      practiceNotes: sortPracticeNotes(practiceNotes),
    } satisfies BackupData;
  },

  async importBackup(data, mode) {
    const db = await openDb();
    const allStores = [STORES.videos, STORES.positions, STORES.techniqueTypes, STORES.practiceNotes];

    if (mode === 'replace') {
      // 削除と書き込みを1つのトランザクションで行うので、失敗したら元のデータのまま残ります
      const tx = db.transaction(allStores, 'readwrite');
      allStores.forEach((s) => tx.objectStore(s).clear());
      data.positions.forEach((c) => tx.objectStore(STORES.positions).put(c));
      data.techniqueTypes.forEach((c) => tx.objectStore(STORES.techniqueTypes).put(c));
      data.videos.forEach((v) => tx.objectStore(STORES.videos).put(v));
      data.practiceNotes.forEach((n) => tx.objectStore(STORES.practiceNotes).put(n));
      await transactionDone(tx);
      return {
        addedVideos: data.videos.length,
        skippedVideos: 0,
        addedCategories: data.positions.length + data.techniqueTypes.length,
        addedNotes: data.practiceNotes.length,
        skippedNotes: 0,
      };
    }

    // 追加モード: 先に既存データを読み、書き込み内容を全て決めてから1回で保存します
    const [videos, positions, types, notes] = await Promise.all([
      getAll<Video>(STORES.videos),
      listCategories('positions'),
      listCategories('techniqueTypes'),
      getAll<PracticeNote>(STORES.practiceNotes),
    ]);
    const result: ImportResult = {
      addedVideos: 0,
      skippedVideos: 0,
      addedCategories: 0,
      addedNotes: 0,
      skippedNotes: 0,
    };

    // ファイル内の分類IDを、既存の分類ID(同じIDか同じ名前)または新規分類に対応付けます
    const mergeCategories = (existing: Category[], incoming: Category[]) => {
      const idMap = new Map<string, string>();
      const toAdd: Category[] = [];
      let nextOrder = existing.length ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;
      for (const c of [...incoming].sort(byOrder)) {
        const match =
          existing.find((e) => e.id === c.id) ??
          [...existing, ...toAdd].find((e) => sameName(e.name, c.name));
        if (match) {
          idMap.set(c.id, match.id);
        } else {
          toAdd.push({ ...c, sortOrder: nextOrder++, isDefault: false });
          idMap.set(c.id, c.id);
        }
      }
      result.addedCategories += toAdd.length;
      return { idMap, toAdd };
    };
    const pos = mergeCategories(positions, data.positions);
    const typ = mergeCategories(types, data.techniqueTypes);

    const existingIds = new Set(videos.map((v) => v.id));
    const newVideos = data.videos.flatMap((v) => {
      if (existingIds.has(v.id)) {
        result.skippedVideos++;
        return [];
      }
      result.addedVideos++;
      return [
        {
          ...v,
          positionId: v.positionId ? pos.idMap.get(v.positionId) ?? null : null,
          techniqueTypeId: v.techniqueTypeId ? typ.idMap.get(v.techniqueTypeId) ?? null : null,
        },
      ];
    });

    // 練習ノートも同じIDのものはスキップします(動画のIDは変わらないので紐付けはそのまま保たれます)
    const existingNoteIds = new Set(notes.map((n) => n.id));
    const newNotes = data.practiceNotes.filter((n) => {
      if (existingNoteIds.has(n.id)) {
        result.skippedNotes++;
        return false;
      }
      result.addedNotes++;
      return true;
    });

    const tx = db.transaction(allStores, 'readwrite');
    pos.toAdd.forEach((c) => tx.objectStore(STORES.positions).put(c));
    typ.toAdd.forEach((c) => tx.objectStore(STORES.techniqueTypes).put(c));
    newVideos.forEach((v) => tx.objectStore(STORES.videos).put(v));
    newNotes.forEach((n) => tx.objectStore(STORES.practiceNotes).put(n));
    await transactionDone(tx);
    return result;
  },
};
