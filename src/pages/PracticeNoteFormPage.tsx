// 練習ノートの作成・編集
// 入力内容は1文字ごとに下書きとして自動保存し、画面を移動・再読み込みしても続きから入力できます。

import { useEffect, useMemo, useState } from 'react';
import { categoryName, useAppData } from '../AppData';
import { ConfirmDialog, Sheet } from '../components/Dialog';
import { CloseIcon, MinusIcon, PlayIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { RelatedVideo, RESULT_ICON, useRelatedVideo } from '../components/Practice';
import { Thumbnail } from '../components/Thumbnail';
import { goBack } from '../router';
import { clearDraft, editDraftKey, loadDraft, newDraftKey, saveDraft } from '../storage/practiceDraft';
import { repository } from '../storage/repository';
import { EMPTY_FILTER, type PracticeNote, type PracticeNoteInput, type PracticeResult } from '../types';
import { formatDateTime, matchesFilter } from '../utils/format';
import { isDateOnly, parsePracticeCount, PRACTICE_RESULTS, todayString } from '../utils/practice';
import { isSafeExternalUrl } from '../utils/url';

interface Props {
  /** 編集時はノートのID。新規作成時は undefined */
  noteId?: string;
  /** 動画詳細から作成したときの動画ID */
  initialVideoId?: string | null;
}

interface FormState {
  practiceDate: string;
  videoId: string | null;
  result: PracticeResult;
  memo: string;
  improvement: string;
  /** 入力欄の文字列のまま持ちます(空欄 = 未入力) */
  practiceCount: string;
}

const fromInput = (n: PracticeNoteInput): FormState => ({
  practiceDate: n.practiceDate,
  videoId: n.videoId,
  result: n.result,
  memo: n.memo,
  improvement: n.improvement,
  practiceCount: n.practiceCount ? String(n.practiceCount) : '',
});

const toInput = (f: FormState): PracticeNoteInput => ({
  practiceDate: f.practiceDate,
  videoId: f.videoId,
  result: f.result,
  memo: f.memo,
  improvement: f.improvement,
  practiceCount: parsePracticeCount(f.practiceCount),
});

const newForm = (videoId: string | null): FormState => ({
  practiceDate: todayString(),
  videoId,
  result: 'unrated',
  memo: '',
  improvement: '',
  practiceCount: '',
});

export function PracticeNoteFormPage({ noteId, initialVideoId = null }: Props) {
  const { practiceNotes, loading, reload, showToast } = useAppData();
  const isEdit = noteId !== undefined;
  const original: PracticeNote | undefined = isEdit ? practiceNotes.find((n) => n.id === noteId) : undefined;
  const draftKey = isEdit ? editDraftKey(noteId) : newDraftKey(initialVideoId);

  const [form, setForm] = useState<FormState>(() => newForm(initialVideoId));
  const [initial, setInitial] = useState<FormState>(() => newForm(initialVideoId));
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [draftFailed, setDraftFailed] = useState(false);
  const [errors, setErrors] = useState<{ date?: string; count?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 最初の内容を決めます(下書きがあればそれを復元)。編集時はノートの読み込みを待ちます
  useEffect(() => {
    if (ready || (isEdit && !original)) return;
    const base = original ? fromInput(original) : newForm(initialVideoId);
    const draft = loadDraft(draftKey);
    setInitial(base);
    setForm(draft ? fromInput(draft.form) : base);
    setRestoredAt(draft ? draft.savedAt : null);
    setReady(true);
  }, [ready, isEdit, original, initialVideoId, draftKey]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  // 自動保存:変更があれば下書きを保存し、元の内容に戻ったら下書きを消します
  useEffect(() => {
    if (!ready) return;
    if (dirty) setDraftFailed(!saveDraft(draftKey, toInput(form)));
    else clearDraft(draftKey);
  }, [ready, dirty, form, draftKey]);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const backPath = isEdit ? `/notes/${encodeURIComponent(noteId)}` : '/notes';

  const back = () => {
    if (dirty && !draftFailed) showToast('入力内容は下書きとして保存されています');
    goBack(backPath);
  };

  const changeCount = (delta: number) => {
    const current = parsePracticeCount(form.practiceCount) ?? 0;
    const next = Math.min(9999, Math.max(0, current + delta));
    update({ practiceCount: next ? String(next) : '' });
    setErrors((e) => ({ ...e, count: undefined }));
  };

  const save = async () => {
    setSaveError(null);
    const next: typeof errors = {};
    if (!isDateOnly(form.practiceDate)) next.date = '練習日を選択してください。';
    if (form.practiceCount.trim() && parsePracticeCount(form.practiceCount) === null)
      next.count = '練習回数は1〜9999の整数で入力してください。';
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
      return;
    }
    setSaving(true);
    try {
      if (isEdit) await repository.updatePracticeNote(noteId, toInput(form));
      else await repository.createPracticeNote(toInput(form));
      clearDraft(draftKey);
      await reload();
      showToast(isEdit ? '練習記録を更新しました' : '練習記録を保存しました');
      goBack(backPath);
    } catch (e) {
      // 失敗しても下書きは残っているので、入力内容は失われません
      setSaveError(`保存に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
    }
  };

  const discard = () => {
    clearDraft(draftKey);
    setForm(initial);
    setRestoredAt(null);
    setErrors({});
    setConfirmDiscard(false);
    showToast('入力内容を破棄しました');
  };

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="練習ノート" backTo="/notes" />
        {isEdit && !loading && <p className="banner banner-error">編集する練習ノートが見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? '練習ノートを編集' : '練習ノート'}
        onBack={back}
        right={
          dirty && (
            <span className={`status-chip ${draftFailed ? 'error' : ''}`}>
              {draftFailed ? '自動保存できません' : '下書き保存済み'}
            </span>
          )
        }
      />

      {restoredAt !== null && dirty && (
        <div className="banner banner-info draft-banner">
          <span>
            前回の入力途中の内容を復元しました
            {restoredAt && `(${formatDateTime(restoredAt)})`}
          </span>
        </div>
      )}

      <form
        className="form practice-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="note-date">
            練習日
          </label>
          <input
            id="note-date"
            className={`input date-input ${errors.date ? 'invalid' : ''}`}
            type="date"
            value={form.practiceDate}
            onChange={(e) => {
              update({ practiceDate: e.target.value });
              setErrors((er) => ({ ...er, date: undefined }));
            }}
          />
          {errors.date && <p className="field-error">{errors.date}</p>}
        </div>

        <VideoField
          videoId={form.videoId}
          onPick={() => setPicking(true)}
          onClear={() => update({ videoId: null })}
        />

        <div className="field">
          <label className="field-label practice-label" htmlFor="note-memo">
            今日の練習メモ
          </label>
          <textarea
            id="note-memo"
            className="input textarea textarea-lg"
            placeholder="うまくいったこと・気づいたことなど"
            rows={4}
            value={form.memo}
            onChange={(e) => update({ memo: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label practice-label" htmlFor="note-improvement">
            改善点・次回意識すること
          </label>
          <textarea
            id="note-improvement"
            className="input textarea textarea-lg"
            placeholder="次の練習で試すこと・直したいことなど"
            rows={3}
            value={form.improvement}
            onChange={(e) => update({ improvement: e.target.value })}
          />
        </div>

        <fieldset className="field result-field">
          <legend className="field-label practice-label">今回の結果</legend>
          <div className="result-grid">
            {PRACTICE_RESULTS.map((r) => {
              const Icon = RESULT_ICON[r.value];
              const selected = form.result === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  className={`result-btn result-${r.value} ${selected ? 'selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => update({ result: r.value })}
                >
                  <Icon size={24} />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="note-count">
            練習回数<span className="optional">(任意)</span>
          </label>
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              aria-label="1回減らす"
              onClick={() => changeCount(-1)}
              disabled={!form.practiceCount}
            >
              <MinusIcon size={22} />
            </button>
            <div className="stepper-value">
              <input
                id="note-count"
                className={`input ${errors.count ? 'invalid' : ''}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="未入力"
                enterKeyHint="done"
                value={form.practiceCount}
                onChange={(e) => {
                  update({ practiceCount: e.target.value.replace(/[^0-9０-９]/g, '').normalize('NFKC') });
                  setErrors((er) => ({ ...er, count: undefined }));
                }}
              />
              <span className="stepper-unit">回</span>
            </div>
            <button type="button" className="stepper-btn" aria-label="1回増やす" onClick={() => changeCount(1)}>
              <PlusIcon size={22} />
            </button>
          </div>
          {errors.count && <p className="field-error">{errors.count}</p>}
        </div>

        {saveError && <p className="banner banner-error">{saveError}</p>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={saving}>
          {saving ? '保存中…' : isEdit ? '変更を保存' : '練習記録を保存'}
        </button>
        {dirty && (
          <button type="button" className="link-btn discard-btn" onClick={() => setConfirmDiscard(true)}>
            入力内容を破棄
          </button>
        )}
      </form>

      {picking && (
        <VideoPickerSheet
          selectedId={form.videoId}
          onClose={() => setPicking(false)}
          onSelect={(videoId) => {
            update({ videoId });
            setPicking(false);
          }}
        />
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="入力内容を破棄しますか?"
          message={isEdit ? '保存していない変更を取り消し、保存済みの内容に戻します。' : '入力途中の内容(下書き)を削除します。'}
          confirmLabel="破棄する"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={discard}
        />
      )}
    </div>
  );
}

/** 関連する技術動画の欄。カードをタップすると動画を選び直せます */
function VideoField({ videoId, onPick, onClear }: { videoId: string | null; onPick: () => void; onClear: () => void }) {
  const { video } = useRelatedVideo(videoId);
  const canOpen = video && isSafeExternalUrl(video.url);
  return (
    <div className="field">
      <div className="field-label-row">
        <span className="field-label">
          関連する技術動画<span className="optional">(任意)</span>
        </span>
        {videoId && (
          <button type="button" className="link-btn" onClick={onClear}>
            選択を解除
          </button>
        )}
      </div>
      <div className="related-card">
        <button type="button" className="related-card-main" onClick={onPick} aria-label="関連動画を選択">
          <RelatedVideo videoId={videoId} emptyLabel="タップして登録済みの動画から選択" />
        </button>
        {canOpen && (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="related-play"
            aria-label="元動画を開く"
          >
            <PlayIcon size={16} />
          </a>
        )}
      </div>
    </div>
  );
}

/** 登録済みの動画から関連動画を選ぶシート(技名・タグ・メモで検索可能) */
function VideoPickerSheet({
  selectedId,
  onClose,
  onSelect,
}: {
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
}) {
  const { videos, positions, techniqueTypes } = useAppData();
  const [keyword, setKeyword] = useState('');
  const results = useMemo(
    () => videos.filter((v) => matchesFilter(v, { ...EMPTY_FILTER, keyword })),
    [videos, keyword],
  );

  return (
    <Sheet title="関連動画を選択" onClose={onClose}>
      <div className="search-box">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="技名・タグ・メモを検索"
          aria-label="動画を検索"
          value={keyword}
          enterKeyHint="search"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {keyword && (
          <button type="button" className="icon-btn search-clear" aria-label="キーワードを消去" onClick={() => setKeyword('')}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <ul className="pick-list video-pick-list">
        <li>
          <button
            type="button"
            className={`pick-item ${selectedId === null ? 'selected' : ''}`}
            onClick={() => onSelect(null)}
          >
            選択しない
          </button>
        </li>
        {results.map((v) => {
          const meta = [categoryName(positions, v.positionId), categoryName(techniqueTypes, v.techniqueTypeId)]
            .filter(Boolean)
            .join(' / ');
          return (
            <li key={v.id}>
              <button
                type="button"
                className={`pick-item video-pick-item ${selectedId === v.id ? 'selected' : ''}`}
                aria-pressed={selectedId === v.id}
                onClick={() => onSelect(v.id)}
              >
                <Thumbnail src={v.thumbnailUrl} videoUrl={v.url} className="thumb-pick" />
                <span className="video-pick-body">
                  <span className="video-pick-title">{v.title}</span>
                  {meta && <span className="video-pick-meta">{meta}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {videos.length === 0 && <p className="hint">登録済みの動画がありません。動画を登録すると選択できます。</p>}
      {videos.length > 0 && results.length === 0 && <p className="hint">条件に一致する動画が見つかりませんでした。</p>}
    </Sheet>
  );
}
