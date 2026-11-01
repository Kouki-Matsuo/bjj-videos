// 練習ノートの詳細(確認・編集・削除・関連動画への移動)

import { useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { ChevronRightIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { RelatedVideo, ResultBadge, useRelatedVideo } from '../components/Practice';
import { goBack, navigate } from '../router';
import { clearDraft, editDraftKey } from '../storage/practiceDraft';
import { repository } from '../storage/repository';
import { formatDateTime } from '../utils/format';
import { formatPracticeDate } from '../utils/practice';

export function PracticeNoteDetailPage({ noteId }: { noteId: string }) {
  const { practiceNotes, loading, reload, showToast } = useAppData();
  const note = practiceNotes.find((n) => n.id === noteId);
  const { status } = useRelatedVideo(note?.videoId ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!note) {
    return (
      <div className="page">
        <PageHeader title="練習ノート" backTo="/notes" />
        {!loading && <p className="banner banner-error">練習ノートが見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  const editPath = `/notes/${encodeURIComponent(note.id)}/edit`;

  const remove = async () => {
    setDeleting(true);
    try {
      await repository.deletePracticeNote(note.id);
      clearDraft(editDraftKey(note.id));
      await reload();
      showToast('練習ノートを削除しました');
      goBack('/notes');
    } catch (e) {
      setError(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="練習ノート"
        backTo="/notes"
        right={
          <button type="button" className="icon-btn" aria-label="編集" onClick={() => navigate(editPath)}>
            <PencilIcon size={22} />
          </button>
        }
      />

      <div className="note-detail-head">
        <h1 className="detail-title">{formatPracticeDate(note.practiceDate, true)}</h1>
        <ResultBadge result={note.result} />
      </div>

      <h2 className="section-title">関連する技術動画</h2>
      {status === 'ok' && note.videoId ? (
        <button
          type="button"
          className="related-card related-card-main"
          onClick={() => navigate(`/videos/${encodeURIComponent(note.videoId!)}`)}
        >
          <RelatedVideo
            videoId={note.videoId}
            right={
              <span className="setting-chevron">
                <ChevronRightIcon size={18} />
              </span>
            }
          />
        </button>
      ) : (
        <div className="related-card">
          <RelatedVideo videoId={note.videoId} />
        </div>
      )}

      <h2 className="section-title">今日の練習メモ</h2>
      <div className="memo-box">{note.memo || <span className="muted">メモはありません</span>}</div>

      <h2 className="section-title">改善点・次回意識すること</h2>
      <div className="memo-box">{note.improvement || <span className="muted">記録はありません</span>}</div>

      <dl className="info-list">
        <div>
          <dt>練習回数</dt>
          <dd>{note.practiceCount ? `${note.practiceCount}回` : '未入力'}</dd>
        </div>
        <div>
          <dt>作成日</dt>
          <dd>{formatDateTime(note.createdAt)}</dd>
        </div>
        <div>
          <dt>更新日</dt>
          <dd>{formatDateTime(note.updatedAt)}</dd>
        </div>
      </dl>

      {error && <p className="banner banner-error">{error}</p>}

      <div className="form-footer">
        <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={18} /> 削除
        </button>
        <button type="button" className="btn btn-primary" onClick={() => navigate(editPath)}>
          <PencilIcon size={18} /> 編集
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="この練習ノートを削除しますか?"
          message={`${formatPracticeDate(note.practiceDate, true)}の練習ノートを削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          danger
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
