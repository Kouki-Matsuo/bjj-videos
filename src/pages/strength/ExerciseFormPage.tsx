// 筋トレ種目の追加・編集・削除(編集時は紐付いた動画も表示)

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { ConfirmDialog } from '../../components/Dialog';
import { ChartIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { PageHeader } from '../../components/Layout';
import { BodyPartPicker, StrengthVideoCard } from '../../components/Strength';
import { goBack, navigate } from '../../router';
import { repository } from '../../storage/repository';
import type { ExerciseInput, ExerciseKind } from '../../types';
import { EXERCISE_KINDS } from '../../utils/strength';

const EMPTY: ExerciseInput = { name: '', kind: 'weight', bodyParts: [] };

const KIND_HINT: Record<ExerciseKind, string> = {
  weight: '重量と回数を記録します',
  bodyweight: '回数を記録します(加重した場合は重量も入力できます)',
  time: '時間(秒)を記録します',
};

export function ExerciseFormPage({ exerciseId }: { exerciseId: string | null }) {
  const { exercises, strengthVideos, strengthPlans, strengthRecords, loading, reload, showToast } = useAppData();
  const isEdit = exerciseId !== null;
  const original = isEdit ? exercises.find((e) => e.id === exerciseId) : undefined;

  const [form, setForm] = useState<ExerciseInput>(EMPTY);
  const [initial, setInitial] = useState<ExerciseInput>(EMPTY);
  const [ready, setReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEdit && !ready && original) {
      const f = { name: original.name, kind: original.kind, bodyParts: original.bodyParts };
      setForm(f);
      setInitial(f);
      setReady(true);
    }
  }, [isEdit, ready, original]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const update = (patch: Partial<ExerciseInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };
  const back = () => (dirty ? setConfirmDiscard(true) : goBack('/strength/exercises'));

  const linkedVideos = isEdit ? strengthVideos.filter((v) => v.exerciseId === exerciseId) : [];
  const usage = isEdit
    ? {
        plans: strengthPlans.filter((p) => p.items.some((i) => i.exerciseId === exerciseId)).length,
        records: strengthRecords.filter((r) => r.entries.some((e) => e.exerciseId === exerciseId)).length,
      }
    : { plans: 0, records: 0 };

  const save = async () => {
    if (!form.name.trim()) {
      setError('種目名を入力してください。');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) await repository.updateExercise(exerciseId, form);
      else await repository.createExercise(form);
      await reload();
      showToast(isEdit ? '種目を更新しました' : '種目を追加しました');
      goBack('/strength/exercises');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    setSaving(true);
    try {
      await repository.deleteExercise(exerciseId);
      await reload();
      showToast('種目を削除しました');
      goBack('/strength/exercises');
    } catch (e) {
      setError(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="種目の編集" backTo="/strength/exercises" />
        {!loading && <p className="banner banner-error">種目が見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={isEdit ? '種目の編集' : '種目の追加'} onBack={back} />

      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="exercise-name">
            種目名<span className="required">*</span>
          </label>
          <input
            id="exercise-name"
            className={`input ${error ? 'invalid' : ''}`}
            placeholder="例:ブルガリアンスクワット"
            maxLength={40}
            enterKeyHint="done"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <fieldset className="field type-field">
          <legend className="field-label">種目の種類</legend>
          <div className="kind-grid">
            {EXERCISE_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                className={`kind-btn ${form.kind === k.value ? 'selected' : ''}`}
                aria-pressed={form.kind === k.value}
                onClick={() => update({ kind: k.value })}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="hint">{KIND_HINT[form.kind]}</p>
        </fieldset>

        <div className="field">
          <span className="field-label">
            鍛える部位<span className="optional">(複数選択可)</span>
          </span>
          <BodyPartPicker value={form.bodyParts} onChange={(bodyParts) => update({ bodyParts })} />
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={back} disabled={saving}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>

      {isEdit && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-block stats-link"
            onClick={() => navigate(`/strength/stats?exercise=${encodeURIComponent(exerciseId)}`)}
          >
            <ChartIcon size={18} /> この種目の成長を見る
          </button>

          <h2 className="section-title">参考動画({linkedVideos.length}件)</h2>
          {linkedVideos.length > 0 ? (
            <div className="video-list">
              {linkedVideos.map((v) => (
                <StrengthVideoCard key={v.id} video={v} exercises={exercises} />
              ))}
            </div>
          ) : (
            <p className="day-empty">この種目の動画はまだありません。</p>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-block history-add"
            onClick={() => navigate(`/strength/videos/new?exercise=${encodeURIComponent(exerciseId)}`)}
          >
            <PlusIcon size={18} /> この種目の動画を登録
          </button>

          <button
            type="button"
            className="btn btn-danger-outline btn-block"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            <TrashIcon size={18} /> この種目を削除
          </button>
        </>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="入力内容を破棄しますか?"
          message="保存していない変更は失われます。"
          confirmLabel="破棄する"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            goBack('/strength/exercises');
          }}
        />
      )}

      {confirmDelete && original && (
        <ConfirmDialog
          title="この種目を削除しますか?"
          message={
            <>
              <p>「{original.name}」を削除します。この操作は取り消せません。</p>
              {(usage.plans > 0 || usage.records > 0 || linkedVideos.length > 0) && (
                <p>
                  この種目を使った予定{usage.plans}件・実績{usage.records}件は残り、「削除された種目」と表示されます。
                  {linkedVideos.length > 0 && `動画${linkedVideos.length}件は「種目なし」になります。`}
                </p>
              )}
            </>
          }
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
