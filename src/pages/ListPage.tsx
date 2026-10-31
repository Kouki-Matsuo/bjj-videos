// 画面1: 動画一覧 / 画面6: 0件のときの空状態

import { useMemo, useState } from 'react';
import { categoryName, useAppData } from '../AppData';
import { Sheet } from '../components/Dialog';
import { FilterSheet } from '../components/FilterSheet';
import { CloseIcon, FilterIcon, PlusIcon, SearchIcon, VideoIcon } from '../components/Icons';
import { BottomNav, PageHeader } from '../components/Layout';
import { VideoCard } from '../components/VideoCard';
import { navigate } from '../router';
import { repository } from '../storage/repository';
import { EMPTY_FILTER, type Category } from '../types';
import { isFilterActive, matchesFilter } from '../utils/format';

type QuickPick = 'positionId' | 'techniqueTypeId' | null;

export function ListPage() {
  const { loading, loadError, videos, positions, techniqueTypes, filter, setFilter, reload, showToast } = useAppData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickPick, setQuickPick] = useState<QuickPick>(null);

  const results = useMemo(() => videos.filter((v) => matchesFilter(v, filter)), [videos, filter]);
  const active = isFilterActive(filter);
  // キーワード以外の絞り込みが設定されているか(フィルターアイコンの強調表示に使用)
  const extraActive = filter.favoritesOnly || filter.tags.length > 0;

  const toggleFavorite = async (id: string, value: boolean) => {
    try {
      await repository.setFavorite(id, value);
      await reload();
    } catch {
      showToast('お気に入りの変更に失敗しました');
    }
  };

  const positionLabel = categoryName(positions, filter.positionId);
  const typeLabel = categoryName(techniqueTypes, filter.techniqueTypeId);

  return (
    <div className="page has-nav">
      <PageHeader title="柔術動画" />

      {loadError && <p className="banner banner-error">{loadError}</p>}

      {!loading && videos.length === 0 && !loadError ? (
        <div className="empty-state">
          <div className="empty-icon">
            <VideoIcon size={36} />
          </div>
          <h2>動画がまだ登録されていません</h2>
          <p>
            「＋」ボタンから動画を登録して
            <br />
            自分だけの柔術ライブラリを作りましょう。
          </p>
          <button type="button" className="btn btn-primary btn-pill" onClick={() => navigate('/new')}>
            <PlusIcon size={18} /> 登録する
          </button>
        </div>
      ) : (
        <>
          <div className="search-box">
            <SearchIcon size={18} />
            <input
              type="search"
              placeholder="技名・タグ・メモを検索"
              aria-label="技名・タグ・メモを検索"
              value={filter.keyword}
              enterKeyHint="search"
              onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {filter.keyword && (
              <button
                type="button"
                className="icon-btn search-clear"
                aria-label="キーワードを消去"
                onClick={() => setFilter({ ...filter, keyword: '' })}
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>

          <div className="filter-bar">
            <button
              type="button"
              className={`pill ${!active ? 'active' : ''}`}
              onClick={() => setFilter(EMPTY_FILTER)}
            >
              すべて
            </button>
            <button
              type="button"
              className={`pill ${positionLabel ? 'active' : ''}`}
              onClick={() => setQuickPick('positionId')}
            >
              {positionLabel ?? 'ポジション'}
            </button>
            <button
              type="button"
              className={`pill ${typeLabel ? 'active' : ''}`}
              onClick={() => setQuickPick('techniqueTypeId')}
            >
              {typeLabel ?? '技の種類'}
            </button>
            <button
              type="button"
              className={`icon-btn filter-btn ${extraActive ? 'active' : ''}`}
              aria-label="検索・絞り込みを開く"
              onClick={() => setSheetOpen(true)}
            >
              <FilterIcon size={20} />
              {extraActive && <span className="dot" />}
            </button>
          </div>

          {active && (
            <div className="result-bar">
              <span>
                {results.length}件 / 全{videos.length}件
                {filter.favoritesOnly && '・お気に入りのみ'}
                {filter.tags.length > 0 && `・${filter.tags.map((t) => `#${t}`).join(' ')}`}
              </span>
              <button type="button" className="link-btn" onClick={() => setFilter(EMPTY_FILTER)}>
                条件を解除
              </button>
            </div>
          )}

          {active && results.length === 0 ? (
            <div className="no-results">
              <p>条件に一致する動画が見つかりませんでした。</p>
              <p className="hint">キーワードを変えるか、絞り込み条件を解除してください。</p>
              <button type="button" className="btn btn-secondary" onClick={() => setFilter(EMPTY_FILTER)}>
                絞り込みを解除
              </button>
            </div>
          ) : (
            <div className="video-list">
              {results.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  positionName={categoryName(positions, v.positionId)}
                  typeName={categoryName(techniqueTypes, v.techniqueTypeId)}
                  onOpen={() => navigate(`/videos/${encodeURIComponent(v.id)}`)}
                  onToggleFavorite={() => toggleFavorite(v.id, !v.isFavorite)}
                />
              ))}
            </div>
          )}

          <button type="button" className="fab" aria-label="動画を登録" onClick={() => navigate('/new')}>
            <PlusIcon size={26} />
          </button>
        </>
      )}

      <BottomNav active="list" />

      {sheetOpen && (
        <FilterSheet
          initial={filter}
          onClose={() => setSheetOpen(false)}
          onApply={(f) => {
            setFilter(f);
            setSheetOpen(false);
          }}
        />
      )}

      {quickPick && (
        <QuickPickSheet
          title={quickPick === 'positionId' ? 'ポジション' : '技の種類'}
          options={quickPick === 'positionId' ? positions : techniqueTypes}
          selected={filter[quickPick]}
          onSelect={(id) => {
            setFilter({ ...filter, [quickPick]: id });
            setQuickPick(null);
          }}
          onClose={() => setQuickPick(null)}
        />
      )}
    </div>
  );
}

/** 「ポジション」「技の種類」ボタンから開く、1項目だけ選ぶパネル */
function QuickPickSheet({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string;
  options: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={`${title}で絞り込み`} onClose={onClose}>
      <ul className="pick-list">
        {[{ id: '', name: 'すべて' }, ...options].map((o) => {
          const isSelected = (selected ?? '') === o.id;
          return (
            <li key={o.id || 'all'}>
              <button
                type="button"
                className={`pick-item ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(o.id || null)}
              >
                {o.name}
                {isSelected && <span className="check">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
