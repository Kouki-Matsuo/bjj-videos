// タグの管理。タグは動画登録時に自由入力で作成され、ここでは名称変更と削除ができます。

import { useMemo, useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog, PromptDialog } from '../components/Dialog';
import { PencilIcon, TrashIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { repository } from '../storage/repository';

type Modal = { type: 'rename' | 'delete'; tag: string } | null;

export function TagManagePage() {
  const { allTags, videos, reload, showToast } = useAppData();
  const [modal, setModal] = useState<Modal>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    videos.forEach((v) => v.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return m;
  }, [videos]);

  return (
    <div className="page">
      <PageHeader title="タグの管理" backTo="/settings" />
      <p className="hint page-hint">タグは動画の登録・編集画面で自由に追加できます。</p>

      {allTags.length === 0 ? (
        <p className="no-results">タグはまだありません。</p>
      ) : (
        <ul className="group category-list">
          {allTags.map((t) => (
            <li key={t} className="category-row">
              <span className="category-name tag-name">
                #{t}
                <span className="count">{counts.get(t)}件</span>
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`タグ「${t}」の名前を変更`}
                onClick={() => setModal({ type: 'rename', tag: t })}
              >
                <PencilIcon size={18} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`タグ「${t}」を削除`}
                onClick={() => setModal({ type: 'delete', tag: t })}
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {modal?.type === 'rename' && (
        <PromptDialog
          title="タグ名を変更"
          label="新しいタグ名(同じ名前のタグがある場合はまとめられます)"
          initialValue={modal.tag}
          confirmLabel="保存"
          onCancel={() => setModal(null)}
          onSubmit={async (name) => {
            try {
              await repository.renameTag(modal.tag, name.replace(/^#+/, ''));
              await reload();
              showToast('タグ名を変更しました');
              setModal(null);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : '保存に失敗しました。';
            }
          }}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmDialog
          title={`タグ「${modal.tag}」を削除しますか?`}
          message={`${counts.get(modal.tag) ?? 0}件の動画からこのタグを外します。動画自体は削除されません。`}
          confirmLabel="削除する"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            try {
              await repository.deleteTag(modal.tag);
              await reload();
              showToast('タグを削除しました');
            } catch {
              showToast('削除に失敗しました');
            }
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
