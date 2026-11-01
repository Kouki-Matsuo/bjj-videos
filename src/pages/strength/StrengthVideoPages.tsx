// 筋トレ動画の登録・編集・詳細

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { ConfirmDialog } from '../../components/Dialog';
import { ExternalIcon, HeartIcon, PencilIcon, TrashIcon, VideoIcon } from '../../components/Icons';
import { PageHeader, Switch } from '../../components/Layout';
import { BodyPartPicker, ExerciseSelect } from '../../components/Strength';
import { TagInput } from '../../components/TagInput';
import { Thumbnail } from '../../components/Thumbnail';
import { goBack, navigate } from '../../router';
import { repository } from '../../storage/repository';
import type { StrengthVideoInput } from '../../types';
import { formatDateTime } from '../../utils/format';
import { exerciseName } from '../../utils/strength';
import { autoThumbnailUrl, isSafeExternalUrl, validateVideoUrl } from '../../utils/url';

interface FormState {
  url: string;
  title: string;
  exerciseId: string | null;
  bodyParts: string[];
  tags: string[];
  notes: string;
  isFavorite: boolean;
}

export function StrengthVideoFormPage({ videoId, initialExerciseId }: { videoId: string | null; initialExerciseId?: string | null }) {
  const { strengthVideos, exercises, loading, reload, showToast } = useAppData();
  const isEdit = videoId !== null;
  const original = isEdit ? strengthVideos.find((v) => v.id === videoId) : undefined;

  const empty = (): FormState => {
    const ex = exercises.find((e) => e.id === initialExerciseId);
    return {
      url: '',
      title: '',
      exerciseId: ex?.id ?? null,
      bodyParts: ex?.bodyParts ?? [],
      tags: [],
      notes: '',
      isFavorite: false,
    };
  };
  const [form, setForm] = useState<FormState>(empty);
  const [initial, setInitial] = useState<FormState>(empty);
  const [ready, setReady] = useState(!isEdit);
  const [errors, setErrors] = useState<{ url?: string; title?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 種目の画面から開いたとき、再読み込み直後でも種目と部位が入るようにします
  useEffect(() => {
    if (isEdit || !initialExerciseId || initial.exerciseId) return;
    const ex = exercises.find((e) => e.id === initialExerciseId);
    if (!ex) return;
    const patch = { exerciseId: ex.id, bodyParts: ex.bodyParts };
    setForm((f) => ({ ...f, ...patch }));
    setInitial((f) => ({ ...f, ...patch }));
  }, [isEdit, initialExerciseId, initial.exerciseId, exercises]);

  useEffect(() => {
    if (isEdit && !ready && original) {
      const f: FormState = {
        url: original.url,
        title: original.title,
        exerciseId: original.exerciseId,
        bodyParts: original.bodyParts,
        tags: original.tags,
        notes: original.notes,
        isFavorite: original.isFavorite,
      };
      setForm(f);
      setInitial(f);
      setReady(true);
    }
  }, [isEdit, ready, original]);

  const tagSuggestions = useMemo(
    () => Array.from(new Set(strengthVideos.flatMap((v) => v.tags))),
    [strengthVideos],
  );
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const backPath = isEdit ? `/strength/videos/${encodeURIComponent(videoId)}` : '/strength/videos';
  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(backPath));

  // 種目を選んだとき、部位が未選択なら種目の部位を入れます
  const changeExercise = (exerciseId: string | null) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    update({ exerciseId, bodyParts: form.bodyParts.length || !ex ? form.bodyParts : ex.bodyParts });
  };

  const save = async () => {
    setSaveError(null);
    const next: typeof errors = {};
    const urlError = validateVideoUrl(form.url);
    if (urlError) next.url = urlError;
    // タイトルが空欄なら種目名を使います
    const title = form.title.trim() || (form.exerciseId ? exerciseName(exercises, form.exerciseId) : '');
    if (!title) next.title = 'タイトルを入力するか、種目を選択してください。';
    setErrors(next);
    if (Object.keys(next).length) return;
    const input: StrengthVideoInput = {
      url: form.url,
      title,
      exerciseId: form.exerciseId,
      bodyParts: form.bodyParts,
      tags: form.tags,
      notes: form.notes,
      isFavorite: form.isFavorite,
      thumbnailUrl: original?.thumbnailUrl && original.url === form.url.trim() ? original.thumbnailUrl : autoThumbnailUrl(form.url),
    };
    setSaving(true);
    try {
      if (isEdit) await repository.updateStrengthVideo(videoId, input);
      else await repository.createStrengthVideo(input);
      await reload();
      showToast(isEdit ? '変更を保存しました' : '動画を登録しました');
      goBack(backPath);
    } catch (e) {
      setSaveError(`保存に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="筋トレ動画の編集" backTo="/strength/videos" />
        {!loading && <p className="banner banner-error">編集する動画が見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={isEdit ? '筋トレ動画の編集' : '筋トレ動画の登録'} onBack={cancel} />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="thumb-editor">
          <Thumbnail src={null} videoUrl={form.url} className="thumb-form" />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sv-url">
            動画URL<span className="required">*</span>
          </label>
          <input
            id="sv-url"
            className={`input ${errors.url ? 'invalid' : ''}`}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            placeholder="https://youtu.be/... または https://instagram.com/..."
            value={form.url}
            onChange={(e) => update({ url: e.target.value })}
          />
          <p className="hint">Instagram または YouTube のURLを入力してください</p>
          {errors.url && <p className="field-error">{errors.url}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sv-exercise">
            種目<span className="optional">(任意)</span>
          </label>
          <ExerciseSelect id="sv-exercise" exercises={exercises} value={form.exerciseId} onChange={changeExercise} emptyLabel="種目なし" />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sv-title">
            タイトル<span className="optional">(空欄なら種目名)</span>
          </label>
          <input
            id="sv-title"
            className={`input ${errors.title ? 'invalid' : ''}`}
            placeholder="例:ベンチプレスのフォーム解説"
            maxLength={100}
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div className="field">
          <span className="field-label">
            鍛える部位<span className="optional">(任意)</span>
          </span>
          <BodyPartPicker value={form.bodyParts} onChange={(bodyParts) => update({ bodyParts })} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-tags">
            タグ<span className="optional">(任意)</span>
          </label>
          <TagInput value={form.tags} onChange={(tags) => update({ tags })} suggestions={tagSuggestions} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sv-notes">
            メモ<span className="optional">(任意)</span>
          </label>
          <textarea
            id="sv-notes"
            className="input textarea"
            placeholder="フォームのポイントなど"
            rows={3}
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>

        <div className="switch-row">
          <span className="switch-label">
            <HeartIcon size={18} filled={form.isFavorite} className={form.isFavorite ? 'heart-on' : ''} /> お気に入り
          </span>
          <Switch label="お気に入り" checked={form.isFavorite} onChange={(isFavorite) => update({ isFavorite })} />
        </div>

        {saveError && <p className="banner banner-error">{saveError}</p>}

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={saving}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>

      {confirmDiscard && (
        <ConfirmDialog
          title="入力内容を破棄しますか?"
          message="保存していない変更は失われます。"
          confirmLabel="破棄する"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            goBack(backPath);
          }}
        />
      )}
    </div>
  );
}

export function StrengthVideoDetailPage({ videoId }: { videoId: string }) {
  const { strengthVideos, exercises, loading, reload, showToast } = useAppData();
  const video = strengthVideos.find((v) => v.id === videoId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!video) {
    return (
      <div className="page">
        <PageHeader title="筋トレ動画" backTo="/strength/videos" />
        {!loading && <p className="banner banner-error">動画が見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  const canOpen = isSafeExternalUrl(video.url);
  const linkProps = { href: video.url, target: '_blank', rel: 'noopener noreferrer' };
  const editPath = `/strength/videos/${encodeURIComponent(video.id)}/edit`;

  const toggleFavorite = async () => {
    try {
      await repository.setStrengthVideoFavorite(video.id, !video.isFavorite);
      await reload();
    } catch {
      showToast('お気に入りの変更に失敗しました');
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await repository.deleteStrengthVideo(video.id);
      await reload();
      showToast('動画を削除しました');
      goBack('/strength/videos');
    } catch (e) {
      showToast(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title=""
        backTo="/strength/videos"
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
      <div className="chip-row chip-row-lg">
        {video.bodyParts.map((p) => (
          <span key={p} className="chip chip-outline">
            {p}
          </span>
        ))}
        {video.tags.map((t) => (
          <span key={t} className="chip chip-tag">
            #{t}
          </span>
        ))}
      </div>
      {canOpen && (
        <a {...linkProps} className="btn btn-primary btn-block open-btn">
          <VideoIcon size={18} /> 動画を開く <ExternalIcon size={16} />
        </a>
      )}
      <dl className="info-list">
        <div>
          <dt>種目</dt>
          <dd>
            {video.exerciseId && exercises.some((e) => e.id === video.exerciseId) ? (
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate(`/strength/exercises/${encodeURIComponent(video.exerciseId!)}`)}
              >
                {exerciseName(exercises, video.exerciseId)}
              </button>
            ) : (
              '種目なし'
            )}
          </dd>
        </div>
        <div>
          <dt>登録日</dt>
          <dd>{formatDateTime(video.createdAt)}</dd>
        </div>
      </dl>
      <h2 className="section-title">メモ</h2>
      <div className="memo-box">{video.notes || <span className="muted">メモはありません</span>}</div>
      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
        <TrashIcon size={18} /> 削除
      </button>
      {confirmDelete && (
        <ConfirmDialog
          title="この動画を削除しますか?"
          message={`「${video.title}」を削除します。予定に紐付けていた場合は、予定からも外れます。この操作は取り消せません。`}
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
