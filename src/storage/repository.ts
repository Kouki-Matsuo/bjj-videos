// 「データをどう保存するか」の窓口です。
// 画面はこの DataRepository の関数だけを使います。将来クラウド保存に切り替えるときは、
// 同じ関数を持つ別の実装(例: cloudRepository.ts)を作り、下の `repository` を差し替えるだけで済みます。

import type { Category, CategoryKind, PracticeNote, PracticeNoteInput, Video, VideoInput } from '../types';
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
