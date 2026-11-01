// 練習ノートの画面で共通して使う部品(結果バッジ・関連動画の表示)です。

import type { ReactNode } from 'react';
import { categoryName, useAppData } from '../AppData';
import type { PracticeResult } from '../types';
import { practiceResultLabel } from '../utils/practice';
import { CheckCircleIcon, HelpCircleIcon, MinusCircleIcon, VideoIcon, XCircleIcon } from './Icons';
import { Thumbnail } from './Thumbnail';

export const RESULT_ICON: Record<PracticeResult, (p: { size?: number }) => ReactNode> = {
  success: CheckCircleIcon,
  partial: MinusCircleIcon,
  failure: XCircleIcon,
  unrated: HelpCircleIcon,
};

export function ResultBadge({ result }: { result: PracticeResult }) {
  return <span className={`result-badge result-${result}`}>{practiceResultLabel(result)}</span>;
}

/** 関連動画の技名と「ポジション / 技の種類」。動画が未選択・削除済みのときはその旨を返します */
export function useRelatedVideo(videoId: string | null) {
  const { videos, positions, techniqueTypes } = useAppData();
  const video = videoId ? videos.find((v) => v.id === videoId) : undefined;
  const meta = video
    ? [categoryName(positions, video.positionId), categoryName(techniqueTypes, video.techniqueTypeId)]
        .filter(Boolean)
        .join(' / ')
    : '';
  const status: 'none' | 'deleted' | 'ok' = !videoId ? 'none' : video ? 'ok' : 'deleted';
  return { video, meta, status };
}

interface RelatedVideoProps {
  videoId: string | null;
  /** 動画が未選択のときの表示 */
  emptyLabel?: string;
  /** 右端に表示する部品(再生ボタン・矢印など) */
  right?: ReactNode;
}

/** 関連動画のサムネイル・技名・分類を横並びで表示します */
export function RelatedVideo({ videoId, emptyLabel = '関連動画なし', right }: RelatedVideoProps) {
  const { video, meta, status } = useRelatedVideo(videoId);
  return (
    <div className="related-video">
      {video ? (
        <Thumbnail src={video.thumbnailUrl} videoUrl={video.url} className="thumb-related" />
      ) : (
        <div className="thumb thumb-related thumb-empty">
          <VideoIcon size={24} />
        </div>
      )}
      <div className="related-video-body">
        {status === 'ok' && video ? (
          <>
            <p className="related-video-title">{video.title}</p>
            {meta && <p className="related-video-meta">{meta}</p>}
          </>
        ) : (
          <p className="related-video-empty">{status === 'deleted' ? '関連動画は削除されました' : emptyLabel}</p>
        )}
      </div>
      {right}
    </div>
  );
}
