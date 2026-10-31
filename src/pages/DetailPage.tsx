// 画面3: 動画詳細

import { useState } from 'react';
import { categoryName, useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { ExternalIcon, HeartIcon, PencilIcon, TrashIcon, VideoIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { Thumbnail } from '../components/Thumbnail';
import { navigate } from '../router';
import { repository } from '../storage/repository';
import { formatDateTime } from '../utils/format';
import { isSafeExternalUrl } from '../utils/url';

export function DetailPage({ videoId }: { videoId: string }) {
  const { videos, positions, techniqueTypes, loading, reload, showToast } = useAppData();
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

      {error && <p className="banner banner-error">{error}</p>}

      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
        <TrashIcon size={18} /> 削除
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="この動画を削除しますか?"
          message={`「${video.title}」を削除します。この操作は取り消せません。`}
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
