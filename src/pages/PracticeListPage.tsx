// 練習ノート一覧(練習日が新しい順)

import { useMemo } from 'react';
import { useAppData } from '../AppData';
import { NoteIcon, PencilIcon, PlusIcon } from '../components/Icons';
import { BottomNav, PageHeader } from '../components/Layout';
import { RelatedVideo, ResultBadge } from '../components/Practice';
import { navigate } from '../router';
import { listNewDrafts } from '../storage/practiceDraft';
import { formatPracticeDate } from '../utils/practice';

export function PracticeListPage() {
  const { loading, loadError, practiceNotes, videos } = useAppData();
  // 書きかけ(未保存)のノート。この画面を開くたびに読み直します
  const drafts = useMemo(() => listNewDrafts(), []);
  const videoTitle = (id: string | null) => (id ? videos.find((v) => v.id === id)?.title : undefined);

  const openNew = () => navigate('/notes/new');

  return (
    <div className="page has-nav">
      <PageHeader title="練習ノート" />

      {loadError && <p className="banner banner-error">{loadError}</p>}

      {drafts.length > 0 && (
        <section className="draft-list" aria-label="書きかけのノート">
          {drafts.map((d) => {
            const videoId = d.key.slice('new:'.length);
            return (
              <button
                key={d.key}
                type="button"
                className="draft-card"
                onClick={() => navigate(videoId ? `/notes/new/${encodeURIComponent(videoId)}` : '/notes/new')}
              >
                <PencilIcon size={18} />
                <span className="draft-card-body">
                  <span className="draft-card-title">書きかけのノートがあります</span>
                  <span className="draft-card-sub">
                    {formatPracticeDate(d.form.practiceDate)}
                    {videoTitle(d.form.videoId) && `・${videoTitle(d.form.videoId)}`}
                  </span>
                </span>
                <span className="draft-card-action">続きを書く</span>
              </button>
            );
          })}
        </section>
      )}

      {!loading && practiceNotes.length === 0 && !loadError ? (
        <div className="empty-state">
          <div className="empty-icon">
            <NoteIcon size={36} />
          </div>
          <h2>練習ノートはまだありません</h2>
          <p>
            練習中・練習後に気づいたことを記録して
            <br />
            参考にした技術動画と一緒に振り返りましょう。
          </p>
          <button type="button" className="btn btn-primary btn-pill" onClick={openNew}>
            <PlusIcon size={18} /> 記録する
          </button>
        </div>
      ) : (
        <div className="video-list">
          {practiceNotes.map((n) => (
            <button
              key={n.id}
              type="button"
              className="note-card"
              onClick={() => navigate(`/notes/${encodeURIComponent(n.id)}`)}
            >
              <div className="note-card-head">
                <time className="note-card-date" dateTime={n.practiceDate}>
                  {formatPracticeDate(n.practiceDate)}
                </time>
                <ResultBadge result={n.result} />
              </div>
              <RelatedVideo videoId={n.videoId} />
              {(n.memo || n.improvement) && <p className="note-card-memo">{n.memo || n.improvement}</p>}
            </button>
          ))}
        </div>
      )}

      {practiceNotes.length > 0 && (
        <button type="button" className="fab" aria-label="練習ノートを作成" onClick={openNew}>
          <PlusIcon size={26} />
        </button>
      )}

      <BottomNav active="notes" />
    </div>
  );
}
