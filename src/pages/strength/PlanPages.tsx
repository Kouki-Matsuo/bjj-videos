// 筋トレ予定の登録・編集(日付変更を含む)・詳細(状態の変更・予定と実績の比較)

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { ConfirmDialog, Sheet } from '../../components/Dialog';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { PageHeader } from '../../components/Layout';
import { ExerciseSelect, PlanStatusBadge } from '../../components/Strength';
import { Thumbnail } from '../../components/Thumbnail';
import { goBack, navigate } from '../../router';
import { repository } from '../../storage/repository';
import type { Exercise, PlanItem, PlanStatus, StrengthPlan, StrengthPlanInput, StrengthRecord } from '../../types';
import { createId } from '../../utils/id';
import { formatPracticeDate, isDateOnly, todayString } from '../../utils/practice';
import {
  compareWithTarget,
  exerciseName,
  formatSet,
  formatTarget,
  parseNonNegative,
  parsePositive,
  PLAN_STATUSES,
} from '../../utils/strength';

interface ItemForm {
  id: string;
  exerciseId: string | null;
  weight: string;
  reps: string;
  sets: string;
  videoIds: string[];
}

const newItem = (): ItemForm => ({ id: createId(), exerciseId: null, weight: '', reps: '', sets: '', videoIds: [] });
const str = (n: number | null) => (n === null ? '' : String(n));

const itemFromPlan = (i: PlanItem): ItemForm => ({
  id: i.id,
  exerciseId: i.exerciseId,
  weight: str(i.targetWeight),
  reps: str(i.targetReps),
  sets: str(i.targetSets),
  videoIds: i.videoIds,
});

/** 数値の入力欄(半角・全角の数字と小数点のみ受け付けます) */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  decimal = false,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="num-field">
      <span className="num-label">{label}</span>
      <span className="num-input-wrap">
        <input
          className="input num-input"
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          maxLength={7}
          placeholder={placeholder ?? '—'}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.normalize('NFKC').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))
          }
        />
        <span className="num-unit">{unit}</span>
      </span>
    </label>
  );
}

export function PlanFormPage({ planId, initialDate }: { planId: string | null; initialDate?: string | null }) {
  const { strengthPlans, exercises, loading, reload, showToast } = useAppData();
  const isEdit = planId !== null;
  const original = isEdit ? strengthPlans.find((p) => p.id === planId) : undefined;

  type FormState = { date: string; items: ItemForm[]; memo: string; status: PlanStatus };
  const empty = (): FormState => ({
    date: isDateOnly(initialDate) ? initialDate : todayString(),
    items: [newItem()],
    memo: '',
    status: 'planned',
  });
  const [form, setForm] = useState<FormState>(empty);
  const [initial, setInitial] = useState<FormState>(empty);
  const [ready, setReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && !ready && original) {
      const f: FormState = { date: original.date, items: original.items.map(itemFromPlan), memo: original.memo, status: original.status };
      setForm(f);
      setInitial(f);
      setReady(true);
    }
  }, [isEdit, ready, original]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const backPath = isEdit ? `/strength/plans/${encodeURIComponent(planId)}` : '/strength';
  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(backPath));

  const updateItem = (id: string, patch: Partial<ItemForm>) => {
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    setError(null);
  };

  const save = async () => {
    if (!isDateOnly(form.date)) {
      setError('予定日を選択してください。');
      return;
    }
    if (!form.items.some((i) => i.exerciseId)) {
      setError('種目を1つ以上選択してください。');
      return;
    }
    const input: StrengthPlanInput = {
      date: form.date,
      status: form.status,
      memo: form.memo,
      items: form.items
        .filter((i) => i.exerciseId)
        .map((i) => ({
          id: i.id,
          exerciseId: i.exerciseId!,
          targetWeight: parseNonNegative(i.weight),
          targetReps: parsePositive(i.reps, 99999),
          targetSets: parsePositive(i.sets, 100),
          videoIds: i.videoIds,
        })),
    };
    setSaving(true);
    try {
      if (isEdit) await repository.updateStrengthPlan(planId, input);
      else await repository.createStrengthPlan(input);
      await reload();
      showToast(isEdit ? '予定を更新しました' : '筋トレ予定を登録しました');
      goBack(backPath);
    } catch (e) {
      setError(`保存に失敗しました。${e instanceof Error ? e.message : ''}`);
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="筋トレ予定の編集" backTo="/strength" />
        {!loading && <p className="banner banner-error">予定が見つかりませんでした。</p>}
      </div>
    );
  }

  const pickingItem = form.items.find((i) => i.id === pickingFor);

  return (
    <div className="page">
      <PageHeader title={isEdit ? '筋トレ予定の編集' : '筋トレ予定の登録'} onBack={cancel} />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="plan-date">
            予定日
          </label>
          <input
            id="plan-date"
            className="input date-input"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        <span className="field-label">種目と目標</span>
        {form.items.map((item, idx) => {
          const ex = exercises.find((e) => e.id === item.exerciseId);
          return (
            <section key={item.id} className="item-card">
              <div className="item-card-head">
                <span className="item-num">{idx + 1}</span>
                <ExerciseSelect
                  exercises={exercises}
                  value={item.exerciseId}
                  onChange={(exerciseId) => updateItem(item.id, { exerciseId })}
                />
                {form.items.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${idx + 1}つ目の種目を削除`}
                    onClick={() => setForm((f) => ({ ...f, items: f.items.filter((i) => i.id !== item.id) }))}
                  >
                    <CloseIcon size={20} />
                  </button>
                )}
              </div>
              <TargetFields item={item} exercise={ex} onChange={(patch) => updateItem(item.id, patch)} />
              <LinkedVideos item={item} onPick={() => setPickingFor(item.id)} onRemove={(vid) => updateItem(item.id, { videoIds: item.videoIds.filter((v) => v !== vid) })} />
            </section>
          );
        })}
        <button
          type="button"
          className="btn btn-secondary btn-block add-item"
          onClick={() => setForm((f) => ({ ...f, items: [...f.items, newItem()] }))}
        >
          <PlusIcon size={18} /> 種目を追加
        </button>

        <div className="field">
          <label className="field-label" htmlFor="plan-memo">
            メモ<span className="optional">(任意)</span>
          </label>
          <textarea
            id="plan-memo"
            className="input textarea"
            placeholder="ジムの場所・意識することなど"
            rows={3}
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          />
        </div>

        {error && <p className="banner banner-error">{error}</p>}

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={saving}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>

      {pickingItem && (
        <VideoPicker
          exerciseId={pickingItem.exerciseId}
          selected={pickingItem.videoIds}
          onClose={() => setPickingFor(null)}
          onChange={(videoIds) => updateItem(pickingItem.id, { videoIds })}
        />
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
            goBack(backPath);
          }}
        />
      )}
    </div>
  );
}

/** 目標重量・回数(時間)・セット数の入力欄。種目の種類によって項目が変わります */
function TargetFields({
  item,
  exercise,
  onChange,
}: {
  item: ItemForm;
  exercise: Exercise | undefined;
  onChange: (patch: Partial<ItemForm>) => void;
}) {
  const kind = exercise?.kind ?? 'weight';
  return (
    <div className="num-row">
      {kind !== 'time' && (
        <NumberField
          label={kind === 'bodyweight' ? '加重' : '重量'}
          unit="kg"
          decimal
          placeholder={kind === 'bodyweight' ? 'なし' : undefined}
          value={item.weight}
          onChange={(weight) => onChange({ weight })}
        />
      )}
      <NumberField
        label={kind === 'time' ? '時間' : '回数'}
        unit={kind === 'time' ? '秒' : '回'}
        value={item.reps}
        onChange={(reps) => onChange({ reps })}
      />
      <NumberField label="セット" unit="set" value={item.sets} onChange={(sets) => onChange({ sets })} />
    </div>
  );
}

function LinkedVideos({ item, onPick, onRemove }: { item: ItemForm; onPick: () => void; onRemove: (id: string) => void }) {
  const { strengthVideos } = useAppData();
  const videos = item.videoIds.map((id) => strengthVideos.find((v) => v.id === id)).filter(Boolean);
  return (
    <div className="linked-videos">
      {videos.map(
        (v) =>
          v && (
            <span key={v.id} className="chip chip-outline chip-removable">
              {v.title}
              <button type="button" className="chip-x" aria-label={`${v.title}を外す`} onClick={() => onRemove(v.id)}>
                <CloseIcon size={12} />
              </button>
            </span>
          ),
      )}
      <button type="button" className="link-btn" onClick={onPick}>
        ＋ 参考動画を紐付ける
      </button>
    </div>
  );
}

/** 筋トレ動画を選ぶシート(はじめは選んだ種目の動画だけを表示) */
function VideoPicker({
  exerciseId,
  selected,
  onClose,
  onChange,
}: {
  exerciseId: string | null;
  selected: string[];
  onClose: () => void;
  onChange: (ids: string[]) => void;
}) {
  const { strengthVideos, exercises } = useAppData();
  const hasOwn = strengthVideos.some((v) => v.exerciseId === exerciseId);
  const [showAll, setShowAll] = useState(!exerciseId || !hasOwn);
  const list = showAll ? strengthVideos : strengthVideos.filter((v) => v.exerciseId === exerciseId);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Sheet
      title="参考動画を選択"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          決定({selected.length}件)
        </button>
      }
    >
      {exerciseId && hasOwn && (
        <div className="segmented small">
          <button type="button" className={`segmented-item ${!showAll ? 'active' : ''}`} onClick={() => setShowAll(false)}>
            {exerciseName(exercises, exerciseId)}の動画
          </button>
          <button type="button" className={`segmented-item ${showAll ? 'active' : ''}`} onClick={() => setShowAll(true)}>
            すべての動画
          </button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="hint">筋トレ動画が登録されていません。筋トレ → 動画から登録できます。</p>
      ) : (
        <ul className="pick-list">
          {list.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className={`pick-item video-pick-item ${selected.includes(v.id) ? 'selected' : ''}`}
                aria-pressed={selected.includes(v.id)}
                onClick={() => toggle(v.id)}
              >
                <Thumbnail src={v.thumbnailUrl} videoUrl={v.url} className="thumb-pick" />
                <span className="video-pick-body">
                  <span className="video-pick-title">{v.title}</span>
                  <span className="video-pick-meta">{exerciseName(exercises, v.exerciseId)}</span>
                </span>
                {selected.includes(v.id) && <CheckIcon size={20} className="pick-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

// ---------- 予定と実績の比較 ----------

const RESULT_LABEL = { achieved: '達成', missed: '未達', notDone: '未記録' } as const;

/** 予定(目標)と実績を種目ごとに並べて比較します */
export function PlanComparison({ plan, record }: { plan: StrengthPlan; record: StrengthRecord }) {
  const { exercises } = useAppData();
  const extra = record.entries.filter((e) => !plan.items.some((i) => i.exerciseId === e.exerciseId));
  return (
    <div className="compare">
      {plan.items.map((item) => {
        const ex = exercises.find((e) => e.id === item.exerciseId);
        const entry = record.entries.find((e) => e.exerciseId === item.exerciseId);
        const result = compareWithTarget(item, entry, ex?.kind);
        return (
          <div key={item.id} className="compare-row">
            <div className="compare-head">
              <span className="compare-name">{exerciseName(exercises, item.exerciseId)}</span>
              <span className={`compare-result ${result}`}>{RESULT_LABEL[result]}</span>
            </div>
            <div className="compare-line">
              <span className="compare-label">目標</span>
              <span>{formatTarget(item, ex?.kind)}</span>
            </div>
            <div className="compare-line">
              <span className="compare-label">実績</span>
              <span>{entry ? entry.sets.map((s) => formatSet(s, ex?.kind)).join('、') : '記録なし'}</span>
            </div>
          </div>
        );
      })}
      {extra.map((e) => {
        const ex = exercises.find((x) => x.id === e.exerciseId);
        return (
          <div key={e.id} className="compare-row">
            <div className="compare-head">
              <span className="compare-name">{exerciseName(exercises, e.exerciseId)}</span>
              <span className="compare-result extra">予定外</span>
            </div>
            <div className="compare-line">
              <span className="compare-label">実績</span>
              <span>{e.sets.map((s) => formatSet(s, ex?.kind)).join('、')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlanDetailPage({ planId }: { planId: string }) {
  const { strengthPlans, strengthRecords, strengthVideos, exercises, loading, reload, showToast } = useAppData();
  const plan = strengthPlans.find((p) => p.id === planId);
  const record = strengthRecords.find((r) => r.planId === planId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!plan) {
    return (
      <div className="page">
        <PageHeader title="筋トレ予定" backTo="/strength" />
        {!loading && <p className="banner banner-error">予定が見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  const editPath = `/strength/plans/${encodeURIComponent(plan.id)}/edit`;

  const changeStatus = async (status: PlanStatus) => {
    if (status === plan.status) return;
    try {
      await repository.setPlanStatus(plan.id, status);
      await reload();
      showToast(`状態を「${PLAN_STATUSES.find((s) => s.value === status)?.label}」にしました`);
    } catch (e) {
      showToast(`変更に失敗しました。${e instanceof Error ? e.message : ''}`);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await repository.deleteStrengthPlan(plan.id);
      await reload();
      showToast('予定を削除しました');
      goBack('/strength');
    } catch (e) {
      showToast(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="筋トレ予定"
        backTo="/strength"
        right={
          <button type="button" className="icon-btn" aria-label="編集" onClick={() => navigate(editPath)}>
            <PencilIcon size={22} />
          </button>
        }
      />
      <div className="note-detail-head">
        <h1 className="detail-title">{formatPracticeDate(plan.date, true)}</h1>
        <PlanStatusBadge status={plan.status} />
      </div>

      <h2 className="section-title">状態</h2>
      <div className="kind-grid" role="group" aria-label="予定の状態">
        {PLAN_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`kind-btn status-btn status-${s.value} ${plan.status === s.value ? 'selected' : ''}`}
            aria-pressed={plan.status === s.value}
            onClick={() => changeStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <h2 className="section-title">種目と目標</h2>
      <ul className="target-list">
        {plan.items.map((i) => {
          const ex = exercises.find((e) => e.id === i.exerciseId);
          const videos = i.videoIds.map((id) => strengthVideos.find((v) => v.id === id)).filter(Boolean);
          return (
            <li key={i.id} className="target-item">
              <div className="target-main">
                <span className="target-name">{exerciseName(exercises, i.exerciseId)}</span>
                <span className="target-value">{formatTarget(i, ex?.kind)}</span>
              </div>
              {videos.length > 0 && (
                <div className="linked-videos">
                  {videos.map(
                    (v) =>
                      v && (
                        <button
                          key={v.id}
                          type="button"
                          className="chip chip-outline chip-link"
                          onClick={() => navigate(`/strength/videos/${encodeURIComponent(v.id)}`)}
                        >
                          ▶ {v.title}
                        </button>
                      ),
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {plan.memo && (
        <>
          <h2 className="section-title">メモ</h2>
          <div className="memo-box">{plan.memo}</div>
        </>
      )}

      <h2 className="section-title">予定と実績の比較</h2>
      {record ? (
        <>
          <PlanComparison plan={plan} record={record} />
          <button
            type="button"
            className="btn btn-secondary btn-block history-add"
            onClick={() => navigate(`/strength/records/${encodeURIComponent(record.id)}`)}
          >
            実績を見る・編集する
          </button>
        </>
      ) : (
        <>
          <p className="day-empty">まだ実績が記録されていません。</p>
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg history-add"
            onClick={() => navigate(`/strength/records/new?plan=${encodeURIComponent(plan.id)}`)}
          >
            この予定の実績を入力
          </button>
        </>
      )}

      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
        <TrashIcon size={18} /> 予定を削除
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="この予定を削除しますか?"
          message={`${formatPracticeDate(plan.date, true)}の筋トレ予定を削除します。${record ? 'この予定から入力した実績は残ります。' : ''}この操作は取り消せません。`}
          confirmLabel="削除する"
          danger
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
