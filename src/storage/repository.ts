// 「データをどう保存するか」の窓口です。
// 画面はこの DataRepository の関数だけを使います。将来クラウド保存に切り替えるときは、
// 同じ関数を持つ別の実装(例: cloudRepository.ts)を作り、下の `repository` を差し替えるだけで済みます。

import type {
  CalendarEvent,
  CalendarEventInput,
  Category,
  CategoryKind,
  Exercise,
  ExerciseInput,
  PlanStatus,
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
import type { BackupData, ImportMode, ImportResult } from './backup';
import { indexedDbRepository } from './indexedDbRepository';

export interface DataRepository {
  listVideos(): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  createVideo(input: VideoInput): Promise<Video>;
  updateVideo(id: string, input: VideoInput): Promise<Video>;
  setFavorite(id: string, isFavorite: boolean): Promise<void>;
  /** 動画を削除します。紐付いた練習ノートは削除せずに残します */
  deleteVideo(id: string): Promise<void>;

  /** 練習ノートの一覧(練習日が新しい順) */
  listPracticeNotes(): Promise<PracticeNote[]>;
  createPracticeNote(input: PracticeNoteInput): Promise<PracticeNote>;
  updatePracticeNote(id: string, input: PracticeNoteInput): Promise<PracticeNote>;
  deletePracticeNote(id: string): Promise<void>;

  /** カレンダー予定の一覧(開始日の順) */
  listEvents(): Promise<CalendarEvent[]>;
  createEvent(input: CalendarEventInput): Promise<CalendarEvent>;
  updateEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;

  // ----- 筋トレ -----
  /** 筋トレ種目の一覧(並び順) */
  listExercises(): Promise<Exercise[]>;
  createExercise(input: ExerciseInput): Promise<Exercise>;
  updateExercise(id: string, input: ExerciseInput): Promise<Exercise>;
  /** 種目を削除します。紐付いた動画は「種目なし」になり、予定・実績は「削除された種目」として残ります */
  deleteExercise(id: string): Promise<void>;

  listStrengthVideos(): Promise<StrengthVideo[]>;
  createStrengthVideo(input: StrengthVideoInput): Promise<StrengthVideo>;
  updateStrengthVideo(id: string, input: StrengthVideoInput): Promise<StrengthVideo>;
  setStrengthVideoFavorite(id: string, isFavorite: boolean): Promise<void>;
  /** 動画を削除し、予定に紐付けていた分も外します */
  deleteStrengthVideo(id: string): Promise<void>;

  listStrengthPlans(): Promise<StrengthPlan[]>;
  createStrengthPlan(input: StrengthPlanInput): Promise<StrengthPlan>;
  updateStrengthPlan(id: string, input: StrengthPlanInput): Promise<StrengthPlan>;
  setPlanStatus(id: string, status: PlanStatus): Promise<void>;
  /** 予定を削除します。この予定から入力した実績は残ります */
  deleteStrengthPlan(id: string): Promise<void>;

  listStrengthRecords(): Promise<StrengthRecord[]>;
  /** 実績を保存します。予定から入力した場合は、その予定を「完了」にします(1つの予定に実績は1件まで) */
  createStrengthRecord(input: StrengthRecordInput): Promise<StrengthRecord>;
  updateStrengthRecord(id: string, input: StrengthRecordInput): Promise<StrengthRecord>;
  /** 実績を削除します。予定から入力した実績なら、その予定を「予定」に戻します */
  deleteStrengthRecord(id: string): Promise<void>;

  listCategories(kind: CategoryKind): Promise<Category[]>;
  addCategory(kind: CategoryKind, name: string): Promise<Category>;
  renameCategory(kind: CategoryKind, id: string, name: string): Promise<void>;
  /** 分類を削除します。関連する動画は replacementId(null なら未分類)に付け替えます */
  deleteCategory(kind: CategoryKind, id: string, replacementId: string | null): Promise<void>;
  /** ids の並び順で sortOrder を振り直します */
  reorderCategories(kind: CategoryKind, ids: string[]): Promise<void>;

  /** タグ名を全動画で一括変更します */
  renameTag(from: string, to: string): Promise<void>;
  /** タグを全動画から外します */
  deleteTag(tag: string): Promise<void>;

  exportAll(): Promise<BackupData>;
  importBackup(data: BackupData, mode: ImportMode): Promise<ImportResult>;
}

export const repository: DataRepository = indexedDbRepository;
