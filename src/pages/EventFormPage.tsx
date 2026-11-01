// カレンダー予定の登録・編集・削除

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../AppData';
import { ConfirmDialog } from '../components/Dialog';
import { TrashIcon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { goBack } from '../router';
import { repository } from '../storage/repository';
import type { CalendarEvent, CalendarEventInput, EventType } from '../types';
import { EVENT_TYPES, eventTypeLabel, validateEventDates } from '../utils/calendar';
import { formatPracticeDate, isDateOnly, todayString } from '../utils/practice';

interface Props {
  /** 編集時は予定のID。新規登録時は undefined */
  eventId?: string;
  /** カレンダーで選んでいた日付(新規登録時の開始日) */
  initialDate?: string | null;
}

interface FormState {
  title: string;
  type: EventType;
  startDate: string;
  /** 空欄 = 1日だけの予定 */
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}

const fromEvent = (e: CalendarEvent): FormState => ({
  title: e.title,
  type: e.type,
  startDate: e.startDate,
  endDate: e.endDate ?? '',
  startTime: e.startTime ?? '',
  endTime: e.endTime ?? '',
  location: e.location,
  description: e.description,
});

const toInput = (f: FormState): CalendarEventInput => ({
  title: f.title,
  type: f.type,
  startDate: f.startDate,
  endDate: f.endDate || null,
  startTime: f.startTime || null,
  endTime: f.endTime || null,
  location: f.location,
  description: f.description,
});

export function EventFormPage({ eventId, initialDate }: Props) {
  const { events, loading, reload, showToast } = useAppData();
  const isEdit = eventId !== undefined;
  const original = isEdit ? events.find((e) => e.id === eventId) : undefined;

  const emptyForm = (): FormState => ({
    title: '',
    type: 'practice',
    startDate: isDateOnly(initialDate) ? initialDate : todayString(),
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
  });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [initial, setInitial] = useState<FormState>(emptyForm);
  const [ready, setReady] = useState(!isEdit);
  const [errors, setErrors] = useState<{ dates?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 編集時は、読み込みが終わった時点の内容をフォームに入れます
  useEffect(() => {
    if (isEdit && !ready && original) {
      const f = fromEvent(original);
      setForm(f);
      setInitial(f);
      setReady(true);
    }
  }, [isEdit, ready, original]);

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  // 保存・削除後は、その予定の開始日を選んだカレンダーに戻ります
  const backPath = `/calendar/${(isEdit ? original?.startDate : form.startDate) ?? ''}`;
  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(backPath));

  const save = async () => {
    setSaveError(null);
    const dateError = validateEventDates(toInput(form));
    if (dateError) {
      setErrors({ dates: dateError });
      requestAnimationFrame(() =>
        document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
      return;
    }
    setSaving(true);
    try {
      if (isEdit) await repository.updateEvent(eventId, toInput(form));
      else await repository.createEvent(toInput(form));
      await reload();
      showToast(isEdit ? '予定を更新しました' : '予定を登録しました');
      goBack(backPath);
    } catch (e) {
      setSaveError(`保存に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    setSaving(true);
    try {
      await repository.deleteEvent(eventId);
      await reload();
      showToast('予定を削除しました');
      goBack(backPath);
    } catch (e) {
      setSaveError(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="予定の編集" backTo="/calendar" />
        {!loading && <p className="banner banner-error">編集する予定が見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={isEdit ? '予定の編集' : '予定の登録'} onBack={cancel} />

      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="field type-field">
          <legend className="field-label">種類</legend>
          <div className="type-grid">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`type-btn event-${t.value} ${form.type === t.value ? 'selected' : ''}`}
                aria-pressed={form.type === t.value}
                onClick={() => update({ type: t.value })}
              >
                <span className="event-dot" />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="event-title">
            タイトル<span className="optional">(空欄なら「{eventTypeLabel(form.type)}」)</span>
          </label>
          <input
            id="event-title"
            className="input"
            placeholder={`例:${form.type === 'match' ? '〇〇オープン' : form.type === 'seminar' ? '〇〇先生セミナー' : '夜クラス'}`}
            maxLength={60}
            enterKeyHint="next"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>

        <div className="field-pair">
          <div className="field">
            <label className="field-label" htmlFor="event-start">
              開始日<span className="required">*</span>
            </label>
            <input
              id="event-start"
              className={`input date-input ${errors.dates ? 'invalid' : ''}`}
              type="date"
              value={form.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="event-end">
              終了日<span className="optional">(任意)</span>
            </label>
            <input
              id="event-end"
              className={`input date-input ${errors.dates ? 'invalid' : ''}`}
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </div>
        </div>
        {form.endDate && form.endDate > form.startDate && isDateOnly(form.startDate) && (
          <p className="hint field-hint">
            {formatPracticeDate(form.startDate)}〜{formatPracticeDate(form.endDate)}の複数日の予定になります
            {'  '}
            <button type="button" className="link-btn" onClick={() => update({ endDate: '' })}>
              1日だけにする
            </button>
          </p>
        )}

        <div className="field-pair">
          <div className="field">
            <label className="field-label" htmlFor="event-start-time">
              開始時刻<span className="optional">(任意)</span>
            </label>
            <input
              id="event-start-time"
              className="input date-input"
              type="time"
              value={form.startTime}
              onChange={(e) => update({ startTime: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="event-end-time">
              終了時刻<span className="optional">(任意)</span>
            </label>
            <input
              id="event-end-time"
              className="input date-input"
              type="time"
              value={form.endTime}
              onChange={(e) => update({ endTime: e.target.value })}
            />
          </div>
        </div>
        {errors.dates && <p className="field-error">{errors.dates}</p>}

        <div className="field">
          <label className="field-label" htmlFor="event-location">
            場所<span className="optional">(任意)</span>
          </label>
          <input
            id="event-location"
            className="input"
            placeholder="例:〇〇柔術アカデミー"
            maxLength={100}
            enterKeyHint="next"
            value={form.location}
            onChange={(e) => update({ location: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="event-description">
            メモ<span className="optional">(任意)</span>
          </label>
          <textarea
            id="event-description"
            className="input textarea"
            placeholder="持ち物・エントリー情報など"
            rows={3}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
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

        {isEdit && (
          <button
            type="button"
            className="btn btn-danger-outline btn-block event-delete"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            <TrashIcon size={18} /> この予定を削除
          </button>
        )}
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

      {confirmDelete && original && (
        <ConfirmDialog
          title="この予定を削除しますか?"
          message={`「${original.title}」を削除します。この操作は取り消せません。`}
          confirmLabel="削除する"
          danger
          busy={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
