// 画面7: 分類管理(ポジション・技の種類)
// 追加・名称変更・削除・並べ替え(左の≡をドラッグ)ができます。

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog, Dialog, PromptDialog } from '../components/Dialog';
import { GripIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { PageHeader, Select } from '../components/Layout';
import { repository } from '../storage/repository';
import type { Category, CategoryKind } from '../types';

const LABEL: Record<CategoryKind, string> = { positions: 'ポジション', techniqueTypes: '技の種類' };

type Modal =
  | { type: 'add' }
  | { type: 'rename'; category: Category }
  | { type: 'delete'; category: Category; count: number }
  | null;

export function CategoryManagePage({ kind }: { kind: CategoryKind }) {
  const { positions, techniqueTypes, videos, reload, showToast } = useAppData();
  const source = kind === 'positions' ? positions : techniqueTypes;
  const label = LABEL[kind];
  const field = kind === 'positions' ? 'positionId' : 'techniqueTypeId';

  const [items, setItems] = useState<Category[]>(source);
  const [modal, setModal] = useState<Modal>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const drag = useRef<{ id: string; startY: number; rowH: number } | null>(null);

  // 保存後に読み込み直したデータを画面に反映します(ドラッグ中は除く)
  useEffect(() => {
    if (!drag.current) setItems(source);
  }, [source]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    videos.forEach((v) => v[field] && m.set(v[field]!, (m.get(v[field]!) ?? 0) + 1));
    return m;
  }, [videos, field]);

  const run = async (action: () => Promise<void>, message: string): Promise<string | null> => {
    try {
      await action();
      await reload();
      showToast(message);
      setModal(null);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : '保存に失敗しました。';
    }
  };

  // ---- 並べ替え(ドラッグ) ----
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    const row = e.currentTarget.closest('li');
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, startY: e.clientY, rowH: row.getBoundingClientRect().height };
    setDraggingId(id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((e.clientY - d.startY) / d.rowH);
    if (steps === 0) return;
    setItems((prev) => {
      const from = prev.findIndex((c) => c.id === d.id);
      const to = Math.max(0, Math.min(prev.length - 1, from + steps));
      if (from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    d.startY += steps * d.rowH;
  };
  const onPointerUp = async () => {
    if (!drag.current) return;
    drag.current = null;
    setDraggingId(null);
    const changed = items.some((c, i) => c.id !== source[i]?.id);
    if (changed) {
      const err = await run(() => repository.reorderCategories(kind, items.map((c) => c.id)), '並び順を保存しました');
      if (err) {
        showToast(err);
        setItems(source);
      }
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={`${label}の管理`}
        backTo="/settings"
        right={
          <button type="button" className="icon-btn" aria-label={`${label}を追加`} onClick={() => setModal({ type: 'add' })}>
            <PlusIcon size={24} />
          </button>
        }
      />
      <p className="hint page-hint">≡ をドラッグすると並び順を変更できます。</p>

      {items.length === 0 ? (
        <p className="no-results">分類がありません。右上の「+」から追加してください。</p>
      ) : (
        <ul className="group category-list">
          {items.map((c) => (
            <li key={c.id} className={`category-row ${draggingId === c.id ? 'dragging' : ''}`}>
              <button
                type="button"
                className="icon-btn grip"
                aria-label={`${c.name}の並び順を変更`}
                onPointerDown={(e) => onPointerDown(e, c.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <GripIcon size={18} />
              </button>
              <span className="category-name">
                {c.name}
                {counts.get(c.id) ? <span className="count">{counts.get(c.id)}件</span> : null}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${c.name}の名前を変更`}
                onClick={() => setModal({ type: 'rename', category: c })}
              >
                <PencilIcon size={18} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${c.name}を削除`}
                onClick={() => setModal({ type: 'delete', category: c, count: counts.get(c.id) ?? 0 })}
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {modal?.type === 'add' && (
        <PromptDialog
          title={`${label}を追加`}
          label="名前"
          placeholder={kind === 'positions' ? '例:デラヒーバガード' : '例:カウンター'}
          confirmLabel="追加"
          onCancel={() => setModal(null)}
          onSubmit={(name) => run(() => repository.addCategory(kind, name).then(() => undefined), `「${name}」を追加しました`)}
        />
      )}

      {modal?.type === 'rename' && (
        <PromptDialog
          title="名前を変更"
          label="新しい名前"
          initialValue={modal.category.name}
          confirmLabel="保存"
          onCancel={() => setModal(null)}
          onSubmit={(name) =>
            run(() => repository.renameCategory(kind, modal.category.id, name), '名前を変更しました')
          }
        />
      )}

      {modal?.type === 'delete' && modal.count === 0 && (
        <ConfirmDialog
          title={`「${modal.category.name}」を削除しますか?`}
          message="この分類を使っている動画はありません。"
          confirmLabel="削除する"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            const err = await run(() => repository.deleteCategory(kind, modal.category.id, null), '削除しました');
            if (err) showToast(err);
          }}
        />
      )}

      {modal?.type === 'delete' && modal.count > 0 && (
        <DeleteWithVideosDialog
          category={modal.category}
          count={modal.count}
          others={source.filter((c) => c.id !== modal.category.id)}
          onCancel={() => setModal(null)}
          onConfirm={(replacementId) =>
            run(() => repository.deleteCategory(kind, modal.category.id, replacementId), '削除しました')
          }
        />
      )}
    </div>
  );
}

/** 関連動画がある分類を削除するときの確認画面。未分類にするか、別の分類へ移すかを選びます */
function DeleteWithVideosDialog({
  category,
  count,
  others,
  onCancel,
  onConfirm,
}: {
  category: Category;
  count: number;
  others: Category[];
  onCancel: () => void;
  onConfirm: (replacementId: string | null) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<'none' | 'move'>('none');
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mode === 'move' && !target) {
      setError('移動先の分類を選んでください。');
      return;
    }
    setBusy(true);
    const err = await onConfirm(mode === 'move' ? target : null);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog
      title={`「${category.name}」を削除しますか?`}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button type="button" className="btn btn-danger" onClick={submit} disabled={busy}>
            削除する
          </button>
        </>
      }
    >
      <p>この分類は {count}件の動画で使われています。動画をどうしますか?</p>
      <div className="radio-group">
        <label className="radio">
          <input type="radio" name="del-mode" checked={mode === 'none'} onChange={() => setMode('none')} />
          未分類にする
        </label>
        <label className="radio">
          <input
            type="radio"
            name="del-mode"
            checked={mode === 'move'}
            disabled={others.length === 0}
            onChange={() => setMode('move')}
          />
          別の分類に変更する
        </label>
      </div>
      {mode === 'move' && (
        <Select
          value={target}
          onChange={(v) => {
            setTarget(v);
            setError(null);
          }}
          emptyLabel="移動先を選択"
          options={others}
        />
      )}
      {error && <p className="field-error">{error}</p>}
    </Dialog>
  );
}
