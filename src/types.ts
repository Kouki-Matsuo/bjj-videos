// アプリ全体で使うデータの「型」(どんな項目を持つか)の定義です。

/** 動画1件分のデータ */
export interface Video {
  id: string;
  url: string;
  /** 技名 */
  title: string;
  /** ポジション分類のID(未設定なら null) */
  positionId: string | null;
  /** 技の種類のID(未設定なら null) */
  techniqueTypeId: string | null;
  tags: string[];
  notes: string;
  isFavorite: boolean;
  /** サムネイル画像のURL(未設定なら null) */
  thumbnailUrl: string | null;
  /** ISO形式の日時文字列 */
  createdAt: string;
  updatedAt: string;
}

/** ポジション・技の種類の分類 */
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  /** 初期データとして登録された分類かどうか */
  isDefault: boolean;
}

/** 分類の種類。IndexedDBの保存先(ストア名)と同じ名前にしています */
export type CategoryKind = 'positions' | 'techniqueTypes';

/** 登録・編集フォームから渡す入力内容(id や日時は保存処理側で付けます) */
export type VideoInput = Omit<Video, 'id' | 'createdAt' | 'updatedAt'>;

/** 一覧の検索・絞り込み条件 */
export interface VideoFilter {
  keyword: string;
  positionId: string | null;
  techniqueTypeId: string | null;
  favoritesOnly: boolean;
  tags: string[];
}

export const EMPTY_FILTER: VideoFilter = {
  keyword: '',
  positionId: null,
  techniqueTypeId: null,
  favoritesOnly: false,
  tags: [],
};

/** 練習結果。success: 成功 / partial: 一部成功 / failure: 失敗 / unrated: 未評価 */
export type PracticeResult = 'success' | 'partial' | 'failure' | 'unrated';

/** 練習ノート1件分のデータ */
export interface PracticeNote {
  id: string;
  /** 練習日(YYYY-MM-DD) */
  practiceDate: string;
  /** 関連動画のID(未選択なら null)。動画が削除されてもノートは残ります */
  videoId: string | null;
  result: PracticeResult;
  /** 練習メモ */
  memo: string;
  /** 改善点・次回意識すること */
  improvement: string;
  /** 練習回数(未入力なら null) */
  practiceCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export type PracticeNoteInput = Omit<PracticeNote, 'id' | 'createdAt' | 'updatedAt'>;

/** カレンダー予定の種類。practice: 練習 / match: 試合 / seminar: セミナー / visit: 出稽古 / other: その他 */
export type EventType = 'practice' | 'match' | 'seminar' | 'visit' | 'other';

/** カレンダーの予定1件分のデータ(練習の「予定」。実際の練習記録は PracticeNote) */
export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  /** 開始日(YYYY-MM-DD) */
  startDate: string;
  /** 終了日(YYYY-MM-DD)。1日だけの予定なら null */
  endDate: string | null;
  /** 開始時刻(HH:MM)。終日なら null */
  startTime: string | null;
  endTime: string | null;
  location: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
