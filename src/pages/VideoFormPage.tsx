// 画面2: 動画登録・編集

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { HeartIcon } from '../components/Icons';
import { PageHeader, Select, Switch } from '../components/Layout';
import { TagInput } from '../components/TagInput';
import { Thumbnail } from '../components/Thumbnail';
import { goBack, navigate } from '../router';
import { repository } from '../storage/repository';
import type { Video, VideoInput } from '../types';
import { autoThumbnailUrl, validateVideoUrl } from '../utils/url';

interface Props {
  /** 編集時は動画のID。新規登録時は undefined */
  videoId?: string;
}

interface FormState {
  url: string;
  title: string;
  positionId: string | null;
  techniqueTypeId: string | null;
  tags: string[];
  notes: string;
  isFavorite: boolean;
  /** 手動で指定したサムネイルURL(空ならURLから自動で決めます) */
  customThumbnail: string;
}

const EMPTY_FORM: FormState = {
  url: '',
  title: '',
  positionId: null,
  techniqueTypeId: null,
  tags: [],
  notes: '',
  isFavorite: false,
  customThumbnail: '',
};

function fromVideo(v: Video): FormState {
  const auto = autoThumbnailUrl(v.url);
  return {
    url: v.url,
    title: v.title,
    positionId: v.positionId,
    techniqueTypeId: v.techniqueTypeId,
    tags: v.tags,
    notes: v.notes,
    isFavorite: v.isFavorite,
    customThumbnail: v.thumbnailUrl && v.thumbnailUrl !== auto ? v.thumbnailUrl : '',
  };
}

const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export function VideoFormPage({ videoId }: Props) {
  const { videos, positions, techniqueTypes, allTags, loading, reload, showToast } = useAppData();
  const isEdit = videoId !== undefined;
  const original = isEdit ? videos.find((v) => v.id === videoId) : undefined;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);
  const [ready, setReady] = useState(!isEdit);
  const [errors, setErrors] = useState<{ url?: string; title?: string; thumb?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbEditing, setThumbEditing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 編集時は、読み込みが終わった時点の内容をフォームに入れます
  useEffect(() => {
    if (isEdit && !ready && original) {
      const f = fromVideo(original);
      setForm(f);
      setInitial(f);
      setThumbEditing(f.customThumbnail !== '');
      setReady(true);
    }
  }, [isEdit, ready, original]);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const previewThumb = form.customThumbnail.trim() && isHttpUrl(form.customThumbnail)
    ? form.customThumbnail.trim()
    : autoThumbnailUrl(form.url);

  const backPath = isEdit ? `/videos/${encodeURIComponent(videoId)}` : '/';
  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(backPath));

  const validate = () => {
    const next: typeof errors = {};
    const urlError = validateVideoUrl(form.url);
    if (urlError) next.url = urlError;
    if (!form.title.trim()) next.title = '技名を入力してください。';
    if (form.customThumbnail.trim() && !isHttpUrl(form.customThumbnail))
      next.thumb = 'http:// または https:// で始まる画像URLを入力してください。';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    setSaveError(null);
    if (!validate()) {
      // 最初のエラー欄までスクロールします
      requestAnimationFrame(() =>
        document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
      return;
    }
    const input: VideoInput = {
      url: form.url,
      title: form.title,
      positionId: form.positionId,
      techniqueTypeId: form.techniqueTypeId,
      tags: form.tags,
      notes: form.notes,
      isFavorite: form.isFavorite,
      thumbnailUrl: form.customThumbnail.trim() || autoThumbnailUrl(form.url),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await repository.updateVideo(videoId, input);
        await reload();
        showToast('変更を保存しました');
        goBack(backPath);
      } else {
        await repository.createVideo(input);
        await reload();
        showToast('動画を登録しました');
        navigate('/', { replace: true });
      }
    } catch (e) {
      setSaveError(`保存に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
    }
  };

  if (isEdit && !ready) {
    return (
      <div className="page">
        <PageHeader title="動画編集" backTo="/" />
        {!loading && <p className="banner banner-error">編集する動画が見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page has-form-footer">
      <PageHeader title={isEdit ? '動画編集' : '動画登録'} onBack={cancel} />

      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="thumb-editor">
          <Thumbnail src={previewThumb} videoUrl={form.url} className="thumb-form" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setThumbEditing((v) => !v)}>
            サムネイルを変更
          </button>
        </div>
        {thumbEditing && (
          <div className="field">
            <label className="field-label" htmlFor="video-thumb">
              サムネイル画像URL<span className="optional">(任意)</span>
            </label>
            <input
              id="video-thumb"
              className="input"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="https://..."
              value={form.customThumbnail}
              onChange={(e) => update({ customThumbnail: e.target.value })}
            />
            <p className="hint">
              空欄の場合、YouTubeは自動でサムネイルを表示します。Instagramは自動取得できないため代替表示になります。
            </p>
            {errors.thumb && <p className="field-error">{errors.thumb}</p>}
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="video-url">
            動画URL<span className="required">*</span>
          </label>
          <input
            id="video-url"
            className={`input ${errors.url ? 'invalid' : ''}`}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="https://instagram.com/... または https://youtu.be/..."
            value={form.url}
            onChange={(e) => update({ url: e.target.value })}
            onBlur={() => form.url && setErrors((er) => ({ ...er, url: validateVideoUrl(form.url) ?? undefined }))}
          />
          <p className="hint">Instagram または YouTube のURLを入力してください</p>
          {errors.url && <p className="field-error">{errors.url}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-title">
            技名<span className="required">*</span>
          </label>
          <input
            id="video-title"
            className={`input ${errors.title ? 'invalid' : ''}`}
            placeholder="例:ハーフガードのスイープ"
            maxLength={100}
            enterKeyHint="next"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-position">
            ポジション<span className="optional">(任意)</span>
          </label>
          <Select
            id="video-position"
            value={form.positionId}
            onChange={(positionId) => update({ positionId })}
            emptyLabel="未選択"
            options={positions}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-type">
            技の種類<span className="optional">(任意)</span>
          </label>
          <Select
            id="video-type"
            value={form.techniqueTypeId}
            onChange={(techniqueTypeId) => update({ techniqueTypeId })}
            emptyLabel="未選択"
            options={techniqueTypes}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-tags">
            タグ<span className="optional">(任意)</span>
          </label>
          <TagInput value={form.tags} onChange={(tags) => update({ tags })} suggestions={allTags} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="video-notes">
            メモ<span className="optional">(任意)</span>
          </label>
          <textarea
            id="video-notes"
            className="input textarea"
            placeholder="メモを入力してください"
            rows={4}
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
