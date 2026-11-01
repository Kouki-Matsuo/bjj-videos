// 筋トレ(記録・分析・動画・種目のタブ切り替え)

import { useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { CloseIcon, DumbbellIcon, HeartIcon, PlusIcon, SearchIcon, VideoIcon } from '../../components/Icons';
import { BottomNav, PageHeader, Select } from '../../components/Layout';
import { StrengthTabs, StrengthVideoCard } from '../../components/Strength';
import { navigate, type StrengthTab } from '../../router';
import { repository } from '../../storage/repository';
import type { StrengthVideo } from '../../types';
import { formatPracticeDate, todayString } from '../../utils/practice';
import { BODY_PARTS, exerciseKindLabel, exerciseName } from '../../utils/strength';
import { PlanCard, RecordCard } from './StrengthCards';
import { BodyTab } from './BodyPages';
import { StrengthStats } from './StrengthStats';

export function StrengthPage({ tab, exerciseId }: { tab: StrengthTab; exerciseId: string | null }) {
  const { loadError } = useAppData();
  return (
    <div className="page has-nav">
      <PageHeader title="筋トレ" />
      {loadError && <p className="banner banner-error">{loadError}</p>}
      <StrengthTabs active={tab} />
      {tab === 'log' && <LogTab />}
      {tab === 'body' && <BodyTab />}
      {tab === 'stats' && <StrengthStats exerciseId={exerciseId} />}
      {tab === 'videos' && <VideosTab />}
      {tab === 'exercises' && <ExercisesTab />}
      <BottomNav active="strength" />
    </div>
  );
}

/** 記録タブ:予定と実績を日付の新しい順にまとめて表示します */
function LogTab() {
  const { strengthPlans, strengthRecords, loading } = useAppData();
  const days = useMemo(() => {
    const dates = Array.from(new Set([...strengthPlans.map((p) => p.date), ...strengthRecords.map((r) => r.date)]));
    return dates
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        plans: strengthPlans.filter((p) => p.date === date),
        records: strengthRecords.filter((r) => r.date === date),
      }));
  }, [strengthPlans, strengthRecords]);
  const today = todayString();

  return (
    <>
      <div className="action-row">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/strength/plans/new?date=${today}`)}>
          <PlusIcon size={18} /> 予定を登録
        </button>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/strength/records/new?date=${today}`)}>
          <PlusIcon size={18} /> 実績を記録
        </button>
      </div>

      {!loading && days.length === 0 ? (
        <div className="empty-state small">
          <div className="empty-icon">
            <DumbbellIcon size={34} />
          </div>
          <h2>筋トレの記録はまだありません</h2>
          <p>
            予定を立てるか、実施した内容を記録しましょう。
            <br />
            カレンダーの日付をダブルタップしても登録できます。
          </p>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.date} className="s-day">
            <h2 className="s-day-title">
              {formatPracticeDate(d.date)}
              {d.date === today && <span className="today-chip">今日</span>}
            </h2>
            <div className="s-day-list">
              {d.plans.map((p) => (
                <PlanCard key={p.id} plan={p} showDate={false} />
              ))}
              {d.records.map((r) => (
                <RecordCard key={r.id} record={r} showDate={false} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

const normalize = (s: string) => s.normalize('NFKC').toLowerCase();

/** 動画タブ:検索・種目/部位/お気に入りで絞り込み */
function VideosTab() {
  const { strengthVideos, exercises, reload, showToast, loading } = useAppData();
  const [keyword, setKeyword] = useState('');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const results = useMemo(() => {
    const words = normalize(keyword).split(/\s+/).filter(Boolean);
    return strengthVideos.filter((v: StrengthVideo) => {
      if (favoritesOnly && !v.isFavorite) return false;
      if (exerciseId && v.exerciseId !== exerciseId) return false;
      if (bodyPart && !v.bodyParts.includes(bodyPart)) return false;
      if (words.length) {
        const text = normalize([v.title, exerciseName(exercises, v.exerciseId), ...v.tags, ...v.bodyParts, v.notes].join('\n'));
        if (!words.every((w) => text.includes(w.replace(/^#/, '')))) return false;
      }
      return true;
    });
  }, [strengthVideos, exercises, keyword, exerciseId, bodyPart, favoritesOnly]);
  const filtered = keyword.trim() !== '' || exerciseId !== null || bodyPart !== null || favoritesOnly;

  const toggleFavorite = async (v: StrengthVideo) => {
    try {
      await repository.setStrengthVideoFavorite(v.id, !v.isFavorite);
      await reload();
    } catch {
      showToast('お気に入りの変更に失敗しました');
    }
  };

  const clear = () => {
    setKeyword('');
    setExerciseId(null);
    setBodyPart(null);
    setFavoritesOnly(false);
  };

  if (!loading && strengthVideos.length === 0) {
    return (
      <div className="empty-state small">
        <div className="empty-icon">
          <VideoIcon size={34} />
        </div>
        <h2>筋トレ動画がまだ登録されていません</h2>
        <p>フォームの参考になる動画を登録しておきましょう。</p>
        <button type="button" className="btn btn-primary btn-pill" onClick={() => navigate('/strength/videos/new')}>
          <PlusIcon size={18} /> 動画を登録
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="search-box">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="タイトル・種目・タグ・メモを検索"
          aria-label="筋トレ動画を検索"
          value={keyword}
          enterKeyHint="search"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {keyword && (
          <button type="button" className="icon-btn search-clear" aria-label="キーワードを消去" onClick={() => setKeyword('')}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <div className="filter-grid">
        <Select value={exerciseId} onChange={setExerciseId} emptyLabel="すべての種目" options={exercises} />
        <Select
          value={bodyPart}
          onChange={setBodyPart}
          emptyLabel="すべての部位"
          options={BODY_PARTS.map((p) => ({ id: p, name: p }))}
        />
        <button
          type="button"
          className={`icon-btn fav-filter ${favoritesOnly ? 'on' : ''}`}
          aria-label="お気に入りのみ表示"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <HeartIcon size={20} filled={favoritesOnly} />
        </button>
      </div>
      {filtered && (
        <div className="result-bar">
          <span>
            {results.length}件 / 全{strengthVideos.length}件
          </span>
          <button type="button" className="link-btn" onClick={clear}>
            条件を解除
          </button>
        </div>
      )}
      {results.length === 0 ? (
        <div className="no-results">
          <p>条件に一致する動画が見つかりませんでした。</p>
        </div>
      ) : (
        <div className="video-list">
          {results.map((v) => (
            <StrengthVideoCard key={v.id} video={v} exercises={exercises} onToggleFavorite={() => toggleFavorite(v)} />
          ))}
        </div>
      )}
      <button type="button" className="fab" aria-label="筋トレ動画を登録" onClick={() => navigate('/strength/videos/new')}>
        <PlusIcon size={26} />
      </button>
    </>
  );
}

/** 種目タブ:種目の一覧(タップで編集) */
function ExercisesTab() {
  const { exercises, strengthVideos, strengthRecords } = useAppData();
  const count = (id: string) => ({
    videos: strengthVideos.filter((v) => v.exerciseId === id).length,
    records: strengthRecords.filter((r) => r.entries.some((e) => e.exerciseId === id)).length,
  });
  return (
    <>
      <ul className="group exercise-list">
        {exercises.map((e) => {
          const c = count(e.id);
          return (
            <li key={e.id}>
              <button
                type="button"
                className="setting-row"
                onClick={() => navigate(`/strength/exercises/${encodeURIComponent(e.id)}`)}
              >
                <span className="setting-text">
                  <span className="setting-title">{e.name}</span>
                  <span className="setting-sub">
                    {exerciseKindLabel(e.kind)}
                    {e.bodyParts.length > 0 && `・${e.bodyParts.join('・')}`}
                    {`・動画${c.videos}件・実績${c.records}回`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {exercises.length === 0 && <p className="day-empty">種目がありません。「種目を追加」から登録してください。</p>}
      <button
        type="button"
        className="btn btn-secondary btn-block add-exercise"
        onClick={() => navigate('/strength/exercises/new')}
      >
        <PlusIcon size={18} /> 種目を追加
      </button>
    </>
  );
}
