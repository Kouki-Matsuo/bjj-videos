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

/**
 * カレンダー予定の種類。practice: 練習 / match: 試合 / other: その他
 * strength(筋トレ)・seminar(セミナー)・visit(出稽古)は以前の版で選べた種類で、登録済みの予定を表示するために残しています
 */
export type EventType = 'practice' | 'match' | 'strength' | 'other' | 'seminar' | 'visit';

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

// ===================== 筋トレ =====================

/** 種目の種類。weight: ウェイト / bodyweight: 自重 / time: 時間 */
export type ExerciseKind = 'weight' | 'bodyweight' | 'time';

/** 筋トレ種目(スクワットなど) */
export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** 鍛える部位(「胸」「脚」など) */
  bodyParts: string[];
  sortOrder: number;
  /** 初期データとして登録された種目かどうか */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExerciseInput = Pick<Exercise, 'name' | 'kind' | 'bodyParts'>;

/** 筋トレの参考動画(柔術の動画とは別に管理します) */
export interface StrengthVideo {
  id: string;
  url: string;
  title: string;
  /** 関連する種目のID(未設定なら null)。1つの種目に複数の動画を紐付けられます */
  exerciseId: string | null;
  bodyParts: string[];
  tags: string[];
  notes: string;
  isFavorite: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StrengthVideoInput = Omit<StrengthVideo, 'id' | 'createdAt' | 'updatedAt'>;

/** 筋トレ予定の状態。planned: 予定 / done: 完了 / skipped: 未実施 */
export type PlanStatus = 'planned' | 'done' | 'skipped';

/** 予定の中の1種目分の目標 */
export interface PlanItem {
  id: string;
  exerciseId: string;
  /** 目標重量(kg) */
  targetWeight: number | null;
  /** 目標回数(時間制の種目では目標秒数) */
  targetReps: number | null;
  targetSets: number | null;
  /** 参考にする筋トレ動画のID */
  videoIds: string[];
}

/** 筋トレ予定(1日に複数の種目を登録できます) */
export interface StrengthPlan {
  id: string;
  /** 予定日(YYYY-MM-DD) */
  date: string;
  items: PlanItem[];
  status: PlanStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export type StrengthPlanInput = Omit<StrengthPlan, 'id' | 'createdAt' | 'updatedAt'>;

/** 1セット分の記録 */
export interface SetRecord {
  /** 重量(kg)。自重なら加重した重さ(なしは null) */
  weight: number | null;
  /** 回数(時間制の種目では null) */
  reps: number | null;
  /** 秒数(時間制の種目のみ) */
  seconds: number | null;
}

/** 実績の中の1種目分 */
export interface RecordEntry {
  id: string;
  exerciseId: string;
  sets: SetRecord[];
}

/** 筋トレ実績(実施日を基準に管理します) */
export interface StrengthRecord {
  id: string;
  /** 実施日(YYYY-MM-DD) */
  date: string;
  /** 予定から入力した場合はその予定のID */
  planId: string | null;
  entries: RecordEntry[];
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export type StrengthRecordInput = Omit<StrengthRecord, 'id' | 'createdAt' | 'updatedAt'>;
