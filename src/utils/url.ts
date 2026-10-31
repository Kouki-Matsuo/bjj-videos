// 動画URLのチェックと、サムネイルURLの組み立てです。

export type Platform = 'youtube' | 'instagram';

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** URLが Instagram / YouTube のどちらかを判定します(どちらでもなければ null) */
export function detectPlatform(value: string): Platform | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (hostIs(host, 'youtube.com') || host === 'youtu.be' || hostIs(host, 'youtube-nocookie.com')) return 'youtube';
  if (hostIs(host, 'instagram.com') || host === 'instagr.am') return 'instagram';
  return null;
}

/** http/https で、Instagram または YouTube のURLなら true */
export function isAllowedVideoUrl(value: string): boolean {
  return detectPlatform(value) !== null;
}

/** 入力欄のURLチェック。問題があれば日本語のエラーメッセージ、問題なければ null */
export function validateVideoUrl(value: string): string | null {
  if (value.trim() === '') return '動画URLを入力してください。';
  if (!parseHttpUrl(value)) return 'http:// または https:// で始まるURLを入力してください。';
  if (!isAllowedVideoUrl(value)) return 'Instagram または YouTube のURLを入力してください。';
  return null;
}

/** YouTubeの動画IDを取り出します(取り出せなければ null) */
export function getYouTubeId(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url || detectPlatform(value) !== 'youtube') return null;
  let id: string | null = null;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (url.searchParams.get('v')) {
    id = url.searchParams.get('v');
  } else {
    // /shorts/ID, /embed/ID, /live/ID などの形式
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    id = m ? m[1] : null;
  }
  return id && /^[\w-]{6,}$/.test(id) ? id : null;
}

/**
 * URLから自動で決められるサムネイルURLを返します。
 * YouTubeは公開の画像URLが決まっているので組み立てられます。
 * Instagramは認証なしで取得できないため null(代替表示になります)。
 */
export function autoThumbnailUrl(value: string): string | null {
  const id = getYouTubeId(value);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** 外部リンクとして安全に開けるURLかどうか */
export function isSafeExternalUrl(value: string): boolean {
  return parseHttpUrl(value) !== null;
}
