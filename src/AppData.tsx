// アプリ全体で共有するデータ(動画・分類・絞り込み条件)と、短いお知らせ表示(トースト)です。
// 画面はここから最新データを受け取り、変更後は reload() で読み込み直します。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repository } from './storage/repository';
import {
  EMPTY_FILTER,
  type BodyRecord,
  type CalendarEvent,
  type Category,
  type Exercise,
  type PracticeNote,
  type StrengthPlan,
  type StrengthRecord,
  type StrengthVideo,
  type Video,
  type VideoFilter,
} from './types';

interface AppDataValue {
  loading: boolean;
  loadError: string | null;
  videos: Video[];
  positions: Category[];
  techniqueTypes: Category[];
  /** 練習ノート(練習日が新しい順) */
  practiceNotes: PracticeNote[];
  /** カレンダー予定(開始日の順) */
  events: CalendarEvent[];
  /** 筋トレ:種目(並び順)・動画・予定・実績(日付の新しい順) */
  exercises: Exercise[];
  strengthVideos: StrengthVideo[];
  strengthPlans: StrengthPlan[];
  strengthRecords: StrengthRecord[];
  /** 体重記録(新しい順) */
  bodyRecords: BodyRecord[];
  /** 全動画で使われているタグ(使用回数の多い順) */
  allTags: string[];
  reload: () => Promise<void>;
  filter: VideoFilter;
  setFilter: (f: VideoFilter) => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [positions, setPositions] = useState<Category[]>([]);
  const [techniqueTypes, setTechniqueTypes] = useState<Category[]>([]);
  const [practiceNotes, setPracticeNotes] = useState<PracticeNote[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [strength, setStrength] = useState<{
    exercises: Exercise[];
    strengthVideos: StrengthVideo[];
    strengthPlans: StrengthPlan[];
    strengthRecords: StrengthRecord[];
    bodyRecords: BodyRecord[];
  }>({ exercises: [], strengthVideos: [], strengthPlans: [], strengthRecords: [], bodyRecords: [] });
  const [filter, setFilter] = useState<VideoFilter>(EMPTY_FILTER);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const reload = useCallback(async () => {
    try {
      const [v, p, t, n, e, ex, sv, sp, sr, br] = await Promise.all([
        repository.listVideos(),
        repository.listCategories('positions'),
        repository.listCategories('techniqueTypes'),
        repository.listPracticeNotes(),
        repository.listEvents(),
        repository.listExercises(),
        repository.listStrengthVideos(),
        repository.listStrengthPlans(),
        repository.listStrengthRecords(),
        repository.listBodyRecords(),
      ]);
      setVideos(v);
      setPositions(p);
      setTechniqueTypes(t);
      setPracticeNotes(n);
      setEvents(e);
      setStrength({ exercises: ex, strengthVideos: sv, strengthPlans: sp, strengthRecords: sr, bodyRecords: br });
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    videos.forEach((v) => v.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).map(([t]) => t);
  }, [videos]);

  const value = useMemo(
    () => ({
      loading,
      loadError,
      videos,
      positions,
      techniqueTypes,
      practiceNotes,
      events,
      ...strength,
      allTags,
      reload,
      filter,
      setFilter,
      toast,
      showToast,
    }),
    [loading, loadError, videos, positions, techniqueTypes, practiceNotes, events, strength, allTags, reload, filter, toast, showToast],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('AppDataProvider の中で使ってください');
  return ctx;
}

/** 分類IDから名前を引くための小さな補助関数 */
export function categoryName(list: Category[], id: string | null): string | null {
  if (!id) return null;
  return list.find((c) => c.id === id)?.name ?? null;
}
