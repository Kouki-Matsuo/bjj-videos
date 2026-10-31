// 一覧に並ぶ動画カード。タップで詳細へ、ハートでお気に入りを切り替えます。

import type { Video } from '../types';
import { formatDate } from '../utils/format';
import { HeartIcon } from './Icons';
import { Thumbnail } from './Thumbnail';

interface Props {
  video: Video;
  positionName: string | null;
  typeName: string | null;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

export function VideoCard({ video, positionName, typeName, onOpen, onToggleFavorite }: Props) {
  return (
    <article className="video-card">
      {/* カード全体を押せるボタンにして、ハートだけは別のボタンにしています */}
      <button type="button" className="video-card-main" onClick={onOpen} aria-label={`${video.title}の詳細を開く`}>
        <Thumbnail src={video.thumbnailUrl} videoUrl={video.url} className="thumb-card" />
        <div className="video-card-body">
          <h3 className="video-card-title">{video.title}</h3>
          {(positionName || typeName) && (
            <div className="chip-row">
              {positionName && <span className="chip chip-outline">{positionName}</span>}
              {typeName && <span className="chip chip-outline">{typeName}</span>}
            </div>
          )}
          {video.tags.length > 0 && (
            <div className="chip-row">
              {video.tags.slice(0, 4).map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
              {video.tags.length > 4 && <span className="chip chip-tag">+{video.tags.length - 4}</span>}
            </div>
          )}
          <time className="video-card-date" dateTime={video.createdAt}>
            {formatDate(video.createdAt)}
          </time>
        </div>
      </button>
      <button
        type="button"
        className={`fav-btn ${video.isFavorite ? 'on' : ''}`}
        aria-label={video.isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
        aria-pressed={video.isFavorite}
        onClick={onToggleFavorite}
      >
        <HeartIcon size={20} filled={video.isFavorite} />
      </button>
    </article>
  );
}
