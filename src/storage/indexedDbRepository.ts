// DataRepository の IndexedDB 版の実装です。

import type {
  BodyRecord,
  BodyRecordInput,
  CalendarEvent,
  CalendarEventInput,
  Category,
  CategoryKind,
  Exercise,
  ExerciseInput,
  PracticeNote,
  PracticeNoteInput,
  StrengthPlan,
  StrengthPlanInput,
  StrengthRecord,
  StrengthRecordInput,
  StrengthVideo,
  StrengthVideoInput,
  Video,
  VideoInput,
} from '../types';
import { normalizeBodyInput } from '../utils/body';
import { eventTypeLabel, validateEventDates } from '../utils/calendar';
import { createId } from '../utils/id';
import { isDateOnly, parsePracticeCount, sortPracticeNotes } from '../utils/practice';
import { BACKUP_APP_ID, BACKUP_VERSION, type BackupData, type ImportResult } from './backup';
import { isDateOnly as isDate } from '../utils/practice';
import { isExerciseKind, isPlanStatus, parseNonNegative, parsePositive } from '../utils/strength';
import { defaultExercises, openDb, requestToPromise, STORES, transactionDone } from './db';
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

function normalizeEventInput(input: CalendarEventInput): CalendarEventInput {
  const normalized: CalendarEventInput = {
    ...input,
    // タイトルが空欄なら種類名(例:「練習」)を使います
    title: input.title.trim() || eventTypeLabel(input.type),
    endDate: input.endDate && input.endDate !== input.startDate ? input.endDate : null,
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    location: input.location.trim(),
    description: input.description.trim(),
  };
  const error = validateEventDates(normalized);
  if (error) throw new Error(error);
  return normalized;
}

const byStartDate = (a: CalendarEvent, b: CalendarEvent) =>
  a.startDate.localeCompare(b.startDate) || (a.startTime ?? '').localeCompare(b.startTime ?? '');

// ---------- 筋トレの入力内容の整理 ----------

const cleanList = (list: string[]) => Array.from(new Set(list.map((t) => t.trim()).filter(Boolean)));

function normalizeExercise(input: ExerciseInput): ExerciseInput {
  const name = input.name.trim();
  if (!name) throw new Error('種目名を入力してください。');
  if (!isExerciseKind(input.kind)) throw new Error('種目の種類を選択してください。');
  return { name: name.slice(0, 40), kind: input.kind, bodyParts: cleanList(input.bodyParts) };
}

function normalizeStrengthVideo(input: StrengthVideoInput): StrengthVideoInput {
  return {
    ...input,
    url: input.url.trim(),
    title: input.title.trim(),
    notes: input.notes.trim(),
    bodyParts: cleanList(input.bodyParts),
    tags: cleanList(input.tags),
  };
}

function normalizePlan(input: StrengthPlanInput): StrengthPlanInput {
  if (!isDate(input.date)) throw new Error('予定日を選択してください。');
  if (!isPlanStatus(input.status)) throw new Error('予定の状態が正しくありません。');
  const items = input.items
    .filter((i) => i.exerciseId)
    .map((i) => ({
      id: i.id || createId(),
      exerciseId: i.exerciseId,
      targetWeight: parseNonNegative(i.targetWeight),
      targetReps: parsePositive(i.targetReps, 99999),
      targetSets: parsePositive(i.targetSets, 100),
      videoIds: Array.from(new Set(i.videoIds)),
    }));
  if (!items.length) throw new Error('種目を1つ以上選択してください。');
  return { date: input.date, items, status: input.status, memo: input.memo.trim() };
}

function normalizeRecord(input: StrengthRecordInput): StrengthRecordInput {
  if (!isDate(input.date)) throw new Error('実施日を選択してください。');
  const entries = input.entries
    .filter((e) => e.exerciseId)
    .map((e) => ({
      id: e.id || createId(),
      exerciseId: e.exerciseId,
      sets: e.sets
        .map((s) => ({
          weight: parseNonNegative(s.weight),
          reps: parsePositive(s.reps, 99999),
          seconds: parsePositive(s.seconds, 99999),
        }))
        // 何も入力していないセットは保存しません
        .filter((s) => s.reps || s.seconds || s.weight),
    }))
    .filter((e) => e.sets.length);
  if (!entries.length) throw new Error('種目と、1セット以上の記録(回数・重量・時間)を入力してください。');
  return { date: input.date, planId: input.planId || null, entries, memo: input.memo.trim() };
}

const byDateDesc = <T extends { date: string; createdAt: string }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

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

  async listEvents() {
    return (await getAll<CalendarEvent>(STORES.events)).sort(byStartDate);
  },

  async createEvent(input) {
    const now = new Date().toISOString();
    const event: CalendarEvent = { ...normalizeEventInput(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.events, [event]);
    return event;
  },

  async updateEvent(id, input) {
    const current = await getOne<CalendarEvent>(STORES.events, id);
    if (!current) throw new Error('編集対象の予定が見つかりません。削除された可能性があります。');
    const event: CalendarEvent = { ...current, ...normalizeEventInput(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.events, [event]);
    return event;
  },

  async deleteEvent(id) {
    const db = await openDb();
    const tx = db.transaction(STORES.events, 'readwrite');
    tx.objectStore(STORES.events).delete(id);
    await transactionDone(tx);
  },

  // ---------- 筋トレ種目 ----------
  async listExercises() {
    return (await getAll<Exercise>(STORES.exercises)).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async createExercise(input) {
    const data = normalizeExercise(input);
    const list = await getAll<Exercise>(STORES.exercises);
    if (list.some((e) => sameName(e.name, data.name))) throw new Error('同じ名前の種目がすでにあります。');
    const now = new Date().toISOString();
    const exercise: Exercise = {
      ...data,
      id: createId(),
      sortOrder: list.length ? Math.max(...list.map((e) => e.sortOrder)) + 1 : 0,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };
    await putAll(STORES.exercises, [exercise]);
    return exercise;
  },

  async updateExercise(id, input) {
    const data = normalizeExercise(input);
    const list = await getAll<Exercise>(STORES.exercises);
    const current = list.find((e) => e.id === id);
    if (!current) throw new Error('種目が見つかりません。');
    if (list.some((e) => e.id !== id && sameName(e.name, data.name))) throw new Error('同じ名前の種目がすでにあります。');
    // 予定・実績・動画は種目IDでつながっているので、名前を変えても記録はそのままです
    const exercise: Exercise = { ...current, ...data, updatedAt: new Date().toISOString() };
    await putAll(STORES.exercises, [exercise]);
    return exercise;
  },

  async deleteExercise(id) {
    const videos = await getAll<StrengthVideo>(STORES.strengthVideos);
    const db = await openDb();
    const tx = db.transaction([STORES.exercises, STORES.strengthVideos], 'readwrite');
    videos
      .filter((v) => v.exerciseId === id)
      .forEach((v) => tx.objectStore(STORES.strengthVideos).put({ ...v, exerciseId: null }));
    tx.objectStore(STORES.exercises).delete(id);
    await transactionDone(tx);
  },

  // ---------- 筋トレ動画 ----------
  async listStrengthVideos() {
    return (await getAll<StrengthVideo>(STORES.strengthVideos)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createStrengthVideo(input) {
    const now = new Date().toISOString();
    const video: StrengthVideo = { ...normalizeStrengthVideo(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.strengthVideos, [video]);
    return video;
  },

  async updateStrengthVideo(id, input) {
    const current = await getOne<StrengthVideo>(STORES.strengthVideos, id);
    if (!current) throw new Error('編集対象の動画が見つかりません。削除された可能性があります。');
    const video: StrengthVideo = { ...current, ...normalizeStrengthVideo(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.strengthVideos, [video]);
    return video;
  },

  async setStrengthVideoFavorite(id, isFavorite) {
    const current = await getOne<StrengthVideo>(STORES.strengthVideos, id);
    if (!current) throw new Error('動画が見つかりません。');
    await putAll(STORES.strengthVideos, [{ ...current, isFavorite }]);
  },

  async deleteStrengthVideo(id) {
    const plans = await getAll<StrengthPlan>(STORES.strengthPlans);
    const db = await openDb();
    const tx = db.transaction([STORES.strengthVideos, STORES.strengthPlans], 'readwrite');
    plans
      .filter((p) => p.items.some((i) => i.videoIds.includes(id)))
      .forEach((p) =>
        tx.objectStore(STORES.strengthPlans).put({
          ...p,
          items: p.items.map((i) => ({ ...i, videoIds: i.videoIds.filter((v) => v !== id) })),
        }),
      );
    tx.objectStore(STORES.strengthVideos).delete(id);
    await transactionDone(tx);
  },

  // ---------- 筋トレ予定 ----------
  async listStrengthPlans() {
    return (await getAll<StrengthPlan>(STORES.strengthPlans)).sort(byDateDesc);
  },

  async createStrengthPlan(input) {
    const now = new Date().toISOString();
    const plan: StrengthPlan = { ...normalizePlan(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.strengthPlans, [plan]);
    return plan;
  },

  async updateStrengthPlan(id, input) {
    const current = await getOne<StrengthPlan>(STORES.strengthPlans, id);
    if (!current) throw new Error('編集対象の予定が見つかりません。削除された可能性があります。');
    const plan: StrengthPlan = { ...current, ...normalizePlan(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.strengthPlans, [plan]);
    return plan;
  },

  async setPlanStatus(id, status) {
    const current = await getOne<StrengthPlan>(STORES.strengthPlans, id);
    if (!current) throw new Error('予定が見つかりません。');
    if (!isPlanStatus(status)) throw new Error('予定の状態が正しくありません。');
    await putAll(STORES.strengthPlans, [{ ...current, status, updatedAt: new Date().toISOString() }]);
  },

  async deleteStrengthPlan(id) {
    const records = await getAll<StrengthRecord>(STORES.strengthRecords);
    const db = await openDb();
    const tx = db.transaction([STORES.strengthPlans, STORES.strengthRecords], 'readwrite');
    records
      .filter((r) => r.planId === id)
      .forEach((r) => tx.objectStore(STORES.strengthRecords).put({ ...r, planId: null }));
    tx.objectStore(STORES.strengthPlans).delete(id);
    await transactionDone(tx);
  },

  // ---------- 筋トレ実績 ----------
  async listStrengthRecords() {
    return (await getAll<StrengthRecord>(STORES.strengthRecords)).sort(byDateDesc);
  },

  async createStrengthRecord(input) {
    const data = normalizeRecord(input);
    const now = new Date().toISOString();
    const record: StrengthRecord = { ...data, id: createId(), createdAt: now, updatedAt: now };
    const records = await getAll<StrengthRecord>(STORES.strengthRecords);
    const plan = data.planId ? await getOne<StrengthPlan>(STORES.strengthPlans, data.planId) : undefined;
    if (data.planId && !plan) record.planId = null;
    if (plan && records.some((r) => r.planId === plan.id))
      throw new Error('この予定の実績はすでに登録されています。実績の編集から変更してください。');
    // 実績の保存と予定の「完了」への変更を1つのトランザクションで行います
    const db = await openDb();
    const tx = db.transaction([STORES.strengthRecords, STORES.strengthPlans], 'readwrite');
    tx.objectStore(STORES.strengthRecords).put(record);
    if (plan) tx.objectStore(STORES.strengthPlans).put({ ...plan, status: 'done', updatedAt: now });
    await transactionDone(tx);
    return record;
  },

  async updateStrengthRecord(id, input) {
    const current = await getOne<StrengthRecord>(STORES.strengthRecords, id);
    if (!current) throw new Error('編集対象の実績が見つかりません。削除された可能性があります。');
    // 予定とのつながりは作成時のまま変えません
    const record: StrengthRecord = {
      ...current,
      ...normalizeRecord({ ...input, planId: current.planId }),
      updatedAt: new Date().toISOString(),
    };
    await putAll(STORES.strengthRecords, [record]);
    return record;
  },

  async deleteStrengthRecord(id) {
    const current = await getOne<StrengthRecord>(STORES.strengthRecords, id);
    if (!current) return;
    const plan = current.planId ? await getOne<StrengthPlan>(STORES.strengthPlans, current.planId) : undefined;
    const db = await openDb();
    const tx = db.transaction([STORES.strengthRecords, STORES.strengthPlans], 'readwrite');
    tx.objectStore(STORES.strengthRecords).delete(id);
    if (plan && plan.status === 'done')
      tx.objectStore(STORES.strengthPlans).put({ ...plan, status: 'planned', updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  },

  // ---------- 体重 ----------
  async listBodyRecords() {
    return (await getAll<BodyRecord>(STORES.bodyRecords)).sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt.localeCompare(a.createdAt),
    );
  },

  async createBodyRecord(input: BodyRecordInput) {
    const now = new Date().toISOString();
    const record: BodyRecord = { ...normalizeBodyInput(input), id: createId(), createdAt: now, updatedAt: now };
    await putAll(STORES.bodyRecords, [record]);
    return record;
  },

  async updateBodyRecord(id, input) {
    const current = await getOne<BodyRecord>(STORES.bodyRecords, id);
    if (!current) throw new Error('編集対象の記録が見つかりません。削除された可能性があります。');
    const record: BodyRecord = { ...current, ...normalizeBodyInput(input), updatedAt: new Date().toISOString() };
    await putAll(STORES.bodyRecords, [record]);
    return record;
  },

  async deleteBodyRecord(id) {
    const db = await openDb();
    const tx = db.transaction(STORES.bodyRecords, 'readwrite');
    tx.objectStore(STORES.bodyRecords).delete(id);
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
    const [videos, positions, techniqueTypes, practiceNotes, events] = await Promise.all([
      getAll<Video>(STORES.videos),
      listCategories('positions'),
      listCategories('techniqueTypes'),
      getAll<PracticeNote>(STORES.practiceNotes),
      getAll<CalendarEvent>(STORES.events),
    ]);
    const [exercises, strengthVideos, strengthPlans, strengthRecords, bodyRecords] = await Promise.all([
      this.listExercises(),
      this.listStrengthVideos(),
      this.listStrengthPlans(),
      this.listStrengthRecords(),
      this.listBodyRecords(),
    ]);
    return {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      positions,
      techniqueTypes,
      videos,
      practiceNotes: sortPracticeNotes(practiceNotes),
      events: events.sort(byStartDate),
      exercises,
      strengthVideos,
      strengthPlans,
      strengthRecords,
      bodyRecords,
    } satisfies BackupData;
  },

  async importBackup(data, mode) {
    const db = await openDb();
    const allStores = [
      STORES.videos,
      STORES.positions,
      STORES.techniqueTypes,
      STORES.practiceNotes,
      STORES.events,
      STORES.exercises,
      STORES.strengthVideos,
      STORES.strengthPlans,
      STORES.strengthRecords,
      STORES.bodyRecords,
    ];
    const strengthCount =
      data.strengthVideos.length + data.strengthPlans.length + data.strengthRecords.length + data.bodyRecords.length;

    if (mode === 'replace') {
      // 削除と書き込みを1つのトランザクションで行うので、失敗したら元のデータのまま残ります
      const tx = db.transaction(allStores, 'readwrite');
      allStores.forEach((s) => tx.objectStore(s).clear());
      data.positions.forEach((c) => tx.objectStore(STORES.positions).put(c));
      data.techniqueTypes.forEach((c) => tx.objectStore(STORES.techniqueTypes).put(c));
      data.videos.forEach((v) => tx.objectStore(STORES.videos).put(v));
      data.practiceNotes.forEach((n) => tx.objectStore(STORES.practiceNotes).put(n));
      data.events.forEach((e) => tx.objectStore(STORES.events).put(e));
      // 筋トレ機能より前のファイルには種目がないので、初期種目を入れ直します
      (data.exercises ?? defaultExercises()).forEach((e) => tx.objectStore(STORES.exercises).put(e));
      data.strengthVideos.forEach((v) => tx.objectStore(STORES.strengthVideos).put(v));
      data.strengthPlans.forEach((p) => tx.objectStore(STORES.strengthPlans).put(p));
      data.strengthRecords.forEach((r) => tx.objectStore(STORES.strengthRecords).put(r));
      data.bodyRecords.forEach((r) => tx.objectStore(STORES.bodyRecords).put(r));
      await transactionDone(tx);
      return {
        addedVideos: data.videos.length,
        skippedVideos: 0,
        addedCategories: data.positions.length + data.techniqueTypes.length,
        addedNotes: data.practiceNotes.length,
        skippedNotes: 0,
        addedEvents: data.events.length,
        skippedEvents: 0,
        addedStrength: strengthCount,
        skippedStrength: 0,
      };
    }

    // 追加モード: 先に既存データを読み、書き込み内容を全て決めてから1回で保存します
    const [videos, positions, types, notes, events] = await Promise.all([
      getAll<Video>(STORES.videos),
      listCategories('positions'),
      listCategories('techniqueTypes'),
      getAll<PracticeNote>(STORES.practiceNotes),
      getAll<CalendarEvent>(STORES.events),
    ]);
    const [exercises, sVideos, sPlans, sRecords, bodyRecords] = await Promise.all([
      this.listExercises(),
      this.listStrengthVideos(),
      this.listStrengthPlans(),
      this.listStrengthRecords(),
      this.listBodyRecords(),
    ]);
    const result: ImportResult = {
      addedVideos: 0,
      skippedVideos: 0,
      addedCategories: 0,
      addedNotes: 0,
      skippedNotes: 0,
      addedEvents: 0,
      skippedEvents: 0,
      addedStrength: 0,
      skippedStrength: 0,
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

    const existingEventIds = new Set(events.map((e) => e.id));
    const newEvents = data.events.filter((e) => {
      if (existingEventIds.has(e.id)) {
        result.skippedEvents++;
        return false;
      }
      result.addedEvents++;
      return true;
    });

    // 筋トレ種目は、同じIDか同じ名前の既存種目にまとめます
    const exerciseMap = new Map<string, string>();
    const exercisesToAdd: Exercise[] = [];
    let nextExerciseOrder = exercises.length ? Math.max(...exercises.map((e) => e.sortOrder)) + 1 : 0;
    for (const e of data.exercises ?? []) {
      const match =
        exercises.find((x) => x.id === e.id) ?? [...exercises, ...exercisesToAdd].find((x) => sameName(x.name, e.name));
      if (match) {
        exerciseMap.set(e.id, match.id);
      } else {
        exercisesToAdd.push({ ...e, sortOrder: nextExerciseOrder++, isDefault: false });
        exerciseMap.set(e.id, e.id);
      }
    }
    result.addedCategories += exercisesToAdd.length;
    const mapExercise = (id: string) => exerciseMap.get(id) ?? id;

    // 同じIDのデータはスキップします
    const skipExisting = <T extends { id: string }>(incoming: T[], existing: { id: string }[]) => {
      const ids = new Set(existing.map((x) => x.id));
      return incoming.filter((x) => {
        if (ids.has(x.id)) {
          result.skippedStrength++;
          return false;
        }
        result.addedStrength++;
        return true;
      });
    };
    const newSVideos = skipExisting(data.strengthVideos, sVideos).map((v) => ({
      ...v,
      exerciseId: v.exerciseId ? mapExercise(v.exerciseId) : null,
    }));
    const newSPlans = skipExisting(data.strengthPlans, sPlans).map((p) => ({
      ...p,
      items: p.items.map((i) => ({ ...i, exerciseId: mapExercise(i.exerciseId) })),
    }));
    // すでに実績がある予定に、別の実績が重複して紐付かないようにします
    const plansWithRecord = new Set(sRecords.map((r) => r.planId).filter(Boolean));
    const newSRecords = skipExisting(data.strengthRecords, sRecords).map((r) => ({
      ...r,
      planId: r.planId && !plansWithRecord.has(r.planId) ? r.planId : null,
      entries: r.entries.map((e) => ({ ...e, exerciseId: mapExercise(e.exerciseId) })),
    }));

    const newBodyRecords = skipExisting(data.bodyRecords, bodyRecords);

    const tx = db.transaction(allStores, 'readwrite');
    newBodyRecords.forEach((r) => tx.objectStore(STORES.bodyRecords).put(r));
    exercisesToAdd.forEach((e) => tx.objectStore(STORES.exercises).put(e));
    newSVideos.forEach((v) => tx.objectStore(STORES.strengthVideos).put(v));
    newSPlans.forEach((p) => tx.objectStore(STORES.strengthPlans).put(p));
    newSRecords.forEach((r) => tx.objectStore(STORES.strengthRecords).put(r));
    pos.toAdd.forEach((c) => tx.objectStore(STORES.positions).put(c));
    typ.toAdd.forEach((c) => tx.objectStore(STORES.techniqueTypes).put(c));
    newVideos.forEach((v) => tx.objectStore(STORES.videos).put(v));
    newNotes.forEach((n) => tx.objectStore(STORES.practiceNotes).put(n));
    newEvents.forEach((e) => tx.objectStore(STORES.events).put(e));
    await transactionDone(tx);
    return result;
  },
};
