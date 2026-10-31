// サムネイル画像。画像がない・読み込めないときは代替表示(SNS名とアイコン)にします。

import { useEffect, useState } from 'react';
import { autoThumbnailUrl, detectPlatform } from '../utils/url';
import { PlayIcon, VideoIcon } from './Icons';

interface Props {
  src: string | null;
  videoUrl: string;
  className?: string;
  showPlay?: boolean;
}

const PLATFORM_LABEL = { youtube: 'YouTube', instagram: 'Instagram' } as const;

export function Thumbnail({ src, videoUrl, className = '', showPlay = false }: Props) {
  // 画像URLが保存されていなくても、YouTubeならURLから自動でサムネイルを表示します
  const imageUrl = src ?? autoThumbnailUrl(videoUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  const platform = detectPlatform(videoUrl);
  const showImage = imageUrl && !failed;

  return (
    <div className={`thumb ${className}`}>
      {showImage ? (
        <img src={imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <div className={`thumb-fallback ${platform ?? ''}`}>
          <VideoIcon size={showPlay ? 40 : 26} />
          <span>{platform ? PLATFORM_LABEL[platform] : '動画'}</span>
        </div>
      )}
      {showPlay && showImage && (
        <span className="thumb-play">
          <PlayIcon size={22} />
        </span>
      )}
    </div>
  );
}
