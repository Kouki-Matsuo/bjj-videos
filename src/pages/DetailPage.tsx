// 画面3: 動画詳細

import { useState } from 'react';
import { categoryName, useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { ExternalIcon, HeartIcon, PencilIcon, PlusIcon, TrashIcon, VideoIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { ResultBadge } from '../components/Practice';
import { Thumbnail } from '../components/Thumbnail';
import { navigate } from '../router';
import { repository } from '../storage/repository';
import { formatDateTime } from '../utils/format';
import { formatPracticeDate } from '../utils/practice';
import { isSafeExternalUrl } from '../utils/url';

export function DetailPage({ videoId }: { videoId: string }) {
  const { videos, positions, techniqueTypes, practiceNotes, loading, reload, showToast } = useAppData();
  const video = videos.find((v) => v.id === videoId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!video) {
    return (
      <div className="page">
        <PageHeader title="動画詳細" backTo="/" />
        {!loading && <p className="banner banner-error">動画が見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  // この動画に紐付いた練習ノート(練習日が新しい順に並んでいます)
  const practiceHistory = practiceNotes.filter((n) => n.videoId === video.id);

  const positionName = categoryName(positions, video.positionId);
  const typeName = categoryName(techniqueTypes, video.techniqueTypeId);
  const canOpen = isSafeExternalUrl(video.url);
  const editPath = `/videos/${encodeURIComponent(video.id)}/edit`;

  const toggleFavorite = async () => {
    try {
      await repository.setFavorite(video.id, !video.isFavorite);
      await reload();
    } catch {
      showToast('お気に入りの変更に失敗しました');
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await repository.deleteVideo(video.id);
      await reload();
      showToast('動画を削除しました');
      navigate('/', { replace: true });
    } catch (e) {
      setError(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // noopener / noreferrer: 開いた先のページからこのアプリを操作できないようにする安全対策です
  const linkProps = { href: video.url, target: '_blank', rel: 'noopener noreferrer' };

  return (
    <div className="page">
      <PageHeader
        title=""
        backTo="/"
        right={
          <button type="button" className="icon-btn" aria-label="編集" onClick={() => navigate(editPath)}>
            <PencilIcon size={22} />
          </button>
        }
      />

      {canOpen ? (
        <a {...linkProps} className="detail-thumb-link" aria-label="元動画を開く">
          <Thumbnail src={video.thumbnailUrl} videoUrl={video.url} className="thumb-detail" showPlay />
        </a>
      ) : (
        <Thumbnail src={video.thumbnailUrl} videoUrl={video.url} className="thumb-detail" />
      )}

      <div className="detail-title-row">
        <h1 className="detail-title">{video.title}</h1>
        <button
          type="button"
          className={`fav-btn ${video.isFavorite ? 'on' : ''}`}
          aria-label={video.isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
          aria-pressed={video.isFavorite}
          onClick={toggleFavorite}
        >
          <HeartIcon size={24} filled={video.isFavorite} />
        </button>
      </div>

      {(positionName || typeName) && (
        <div className="chip-row chip-row-lg">
          {positionName && <span className="chip chip-outline">{positionName}</span>}
          {typeName && <span className="chip chip-outline">{typeName}</span>}
        </div>
      )}
      {video.tags.length > 0 && (
        <div className="chip-row chip-row-lg">
          {video.tags.map((t) => (
            <span key={t} className="chip chip-tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      {canOpen ? (
        <a {...linkProps} className="btn btn-primary btn-block open-btn">
          <VideoIcon size={18} /> 動画を開く <ExternalIcon size={16} />
        </a>
      ) : (
        <p className="banner banner-error">このURLは開けません。編集からURLを確認してください。</p>
      )}

      <dl className="info-list">
        <div>
          <dt>ポジション</dt>
          <dd>{positionName ?? '未分類'}</dd>
        </div>
        <div>
          <dt>技の種類</dt>
          <dd>{typeName ?? '未分類'}</dd>
        </div>
        <div>
          <dt>登録日</dt>
          <dd>{formatDateTime(video.createdAt)}</dd>
        </div>
        <div>
          <dt>更新日</dt>
          <dd>{formatDateTime(video.updatedAt)}</dd>
        </div>
      </dl>

      <h2 className="section-title">メモ</h2>
      <div className="memo-box">{video.notes || <span className="muted">メモはありません</span>}</div>

      <div className="history-head">
        <h2 className="section-title">練習履歴</h2>
        {practiceHistory.length > 0 && <span className="count-chip">練習記録 {practiceHistory.length}件</span>}
      </div>
      {practiceHistory.length > 0 ? (
        <ol className="history-list">
          {practiceHistory.map((n, i) => (
            <li key={n.id}>
              <button
                type="button"
                className="history-item"
                onClick={() => navigate(`/notes/${encodeURIComponent(n.id)}`)}
              >
                <span className="history-num">{i + 1}</span>
                <span className="history-body">
                  <span className="history-date">{formatPracticeDate(n.practiceDate)}</span>
                  <ResultBadge result={n.result} />
                  {(n.memo || n.improvement) && <span className="history-memo">{n.memo || n.improvement}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="history-empty muted">この動画の練習記録はまだありません。</p>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-block history-add"
        onClick={() => navigate(`/notes/new/${encodeURIComponent(video.id)}`)}
      >
        <PlusIcon size={18} /> この動画で練習ノートを作成
      </button>

      {error && <p className="banner banner-error">{error}</p>}

      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
        <TrashIcon size={18} /> 削除
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="この動画を削除しますか?"
          message={
            <>
              <p>「{video.title}」を削除します。この操作は取り消せません。</p>
              {practiceHistory.length > 0 && (
                <p>この動画の練習ノート{practiceHistory.length}件は削除されずに残ります。</p>
              )}
            </>
          }
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
