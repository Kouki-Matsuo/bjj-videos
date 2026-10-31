// 検索・絞り込みパネル(画面5)。「適用」を押すまで一覧には反映しません。

import { useState } from 'react';
import { useAppData } from '../AppData';
import { EMPTY_FILTER, type VideoFilter } from '../types';
import { Sheet } from './Dialog';
import { CloseIcon, SearchIcon } from './Icons';
import { Select, Switch } from './Layout';

interface Props {
  initial: VideoFilter;
  onApply: (f: VideoFilter) => void;
  onClose: () => void;
}

export function FilterSheet({ initial, onApply, onClose }: Props) {
  const { positions, techniqueTypes, allTags } = useAppData();
  const [draft, setDraft] = useState<VideoFilter>(initial);
  const update = (patch: Partial<VideoFilter>) => setDraft((d) => ({ ...d, ...patch }));
  const remainingTags = allTags.filter((t) => !draft.tags.includes(t));

  return (
    <Sheet
      title="検索・絞り込み"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setDraft(EMPTY_FILTER)}>
            リセット
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>
            適用
          </button>
        </>
      }
    >
      <div className="panel">
        <label className="panel-label" htmlFor="filter-keyword">
          <SearchIcon size={16} /> キーワードで検索
        </label>
        <input
          id="filter-keyword"
          type="search"
          className="input"
          placeholder="技名・タグ・メモ"
          value={draft.keyword}
          enterKeyHint="search"
          onChange={(e) => update({ keyword: e.target.value })}
        />
      </div>

      <label className="field-label" htmlFor="filter-position">
        ポジション
      </label>
      <Select
        id="filter-position"
        value={draft.positionId}
        onChange={(positionId) => update({ positionId })}
        emptyLabel="すべて"
        options={positions}
      />

      <label className="field-label" htmlFor="filter-type">
        技の種類
      </label>
      <Select
        id="filter-type"
        value={draft.techniqueTypeId}
        onChange={(techniqueTypeId) => update({ techniqueTypeId })}
        emptyLabel="すべて"
        options={techniqueTypes}
      />

      <div className="switch-row">
        <span>お気に入りのみ</span>
        <Switch
          label="お気に入りのみ"
          checked={draft.favoritesOnly}
          onChange={(favoritesOnly) => update({ favoritesOnly })}
        />
      </div>

      <label className="field-label" htmlFor="filter-tag">
        タグ
      </label>
      <Select
        id="filter-tag"
        value={null}
        onChange={(tag) => tag && update({ tags: [...draft.tags, tag] })}
        emptyLabel={remainingTags.length ? 'タグを選択' : allTags.length ? 'すべて選択済み' : 'タグがまだありません'}
        options={remainingTags.map((t) => ({ id: t, name: `#${t}` }))}
      />
      {draft.tags.length > 0 && (
        <div className="chip-row chip-row-lg">
          {draft.tags.map((t) => (
            <button
              key={t}
              type="button"
              className="chip chip-tag chip-removable"
              aria-label={`タグ「${t}」を外す`}
              onClick={() => update({ tags: draft.tags.filter((x) => x !== t) })}
            >
              #{t} <CloseIcon size={12} />
            </button>
          ))}
        </div>
      )}
      {draft.tags.length > 1 && <p className="hint">選んだタグをすべて含む動画を表示します。</p>}
    </Sheet>
  );
}
