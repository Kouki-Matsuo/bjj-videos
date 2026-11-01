// 筋トレ実績の記録・編集・詳細
// 予定から開いた場合は、目標の重量・回数・セット数を初期値として入れます。

import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { ConfirmDialog } from '../../components/Dialog';
import { CloseIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { PageHeader } from '../../components/Layout';
import { ExerciseSelect, PlanStatusBadge } from '../../components/Strength';
import { goBack, navigate } from '../../router';
import { repository } from '../../storage/repository';
import type { ExerciseKind, SetRecord, StrengthRecordInput } from '../../types';
import { createId } from '../../utils/id';
import { formatPracticeDate, isDateOnly, todayString } from '../../utils/practice';
import {
  entryStats,
  exerciseName,
  formatSeconds,
  formatSet,
  parseNonNegative,
  parsePositive,
  setsFromTarget,
} from '../../utils/strength';
import { NumberField, PlanComparison } from './PlanPages';

interface SetForm {
  id: string;
  weight: string;
  amount: string;
}

interface EntryForm {
  id: string;
  exerciseId: string | null;
  sets: SetForm[];
}

const str = (n: number | null) => (n === null ? '' : String(n));
const newSet = (from?: SetForm): SetForm => ({ id: createId(), weight: from?.weight ?? '', amount: from?.amount ?? '' });
const newEntry = (): EntryForm => ({ id: createId(), exerciseId: null, sets: [newSet()] });
const setToForm = (s: SetRecord, kind: ExerciseKind | undefined): SetForm => ({
  id: createId(),
  weight: str(s.weight),
  amount: str(kind === 'time' ? s.seconds : s.reps),
});

interface FormState {
  date: string;
  entries: EntryForm[];
  memo: string;
}

export function RecordFormPage({
  recordId,
  initialDate,
  planId,
}: {
  recordId: string | null;
  initialDate?: string | null;
  planId?: string | null;
}) {
  const { strengthRecords, strengthPlans, exercises, loading, reload, showToast } = useAppData();
  const isEdit = recordId !== null;
  const original = isEdit ? strengthRecords.find((r) => r.id === recordId) : undefined;
  const plan = !isEdit && planId ? strengthPlans.find((p) => p.id === planId) : undefined;
  // 保存直後は自分で作った実績が見つかるので、保存中は判定しません
  const [saving, setSaving] = useState(false);
  const existingForPlan = plan && !saving ? strengthRecords.find((r) => r.planId === plan.id) : undefined;
  const kindOf = (id: string | null) => exercises.find((e) => e.id === id)?.kind;

  const [form, setForm] = useState<FormState>({ date: todayString(), entries: [newEntry()], memo: '' });
  const [initial, setInitial] = useState<FormState>(form);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // 最初の内容を決めます。編集・予定からの入力は、データの読み込みを待ってから入れます
  useEffect(() => {
    if (ready || loading) return;
    let f: FormState;
    if (isEdit) {
      if (!original) return;
      f = {
        date: original.date,
        memo: original.memo,
        entries: original.entries.map((e) => ({
          id: e.id,
          exerciseId: e.exerciseId,
          sets: e.sets.map((s) => setToForm(s, kindOf(e.exerciseId))),
        })),
      };
    } else if (plan) {
      f = {
        date: plan.date,
        memo: '',
        entries: plan.items.map((i) => ({
          id: createId(),
          exerciseId: i.exerciseId,
          sets: setsFromTarget(i, kindOf(i.exerciseId)).map((s) => setToForm(s, kindOf(i.exerciseId))),
        })),
      };
    } else {
      f = { date: isDateOnly(initialDate) ? initialDate : todayString(), entries: [newEntry()], memo: '' };
    }
    setForm(f);
    setInitial(f);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loading, isEdit, original, plan, initialDate]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const backPath = isEdit
    ? `/strength/records/${encodeURIComponent(recordId)}`
    : plan
      ? `/strength/plans/${encodeURIComponent(plan.id)}`
      : '/strength';
  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(backPath));

  const updateEntry = (id: string, patch: Partial<EntryForm>) => {
    setForm((f) => ({ ...f, entries: f.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    setError(null);
  };
  const updateSet = (entry: EntryForm, setId: string, patch: Partial<SetForm>) =>
    updateEntry(entry.id, { sets: entry.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) });

  const save = async () => {
    if (!isDateOnly(form.date)) {
      setError('実施日を選択してください。');
      return;
    }
    const input: StrengthRecordInput = {
      date: form.date,
      planId: isEdit ? original?.planId ?? null : plan?.id ?? null,
      memo: form.memo,
      entries: form.entries
        .filter((e) => e.exerciseId)
        .map((e) => {
          const kind = kindOf(e.exerciseId);
          return {
            id: e.id,
            exerciseId: e.exerciseId!,
            sets: e.sets.map((s) => ({
              weight: parseNonNegative(s.weight),
              reps: kind === 'time' ? null : parsePositive(s.amount, 99999),
              seconds: kind === 'time' ? parsePositive(s.amount, 99999) : null,
            })),
          };
        }),
    };
    setSaving(true);
    try {
      if (isEdit) await repository.updateStrengthRecord(recordId, input);
      else await repository.createStrengthRecord(input);
      await reload();
      showToast(isEdit ? '実績を更新しました' : plan ? '実績を保存し、予定を「完了」にしました' : '実績を保存しました');
      goBack(backPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
      setSaving(false);
    }
  };

  if (!isEdit && planId && !loading && !plan) {
    return (
      <div className="page">
        <PageHeader title="筋トレ実績の記録" backTo="/strength" />
        <p className="banner banner-error">予定が見つかりませんでした。削除された可能性があります。</p>
      </div>
    );
  }

  // 同じ予定に実績を二重に作らないよう、既存の実績へ案内します
  if (existingForPlan) {
    return (
      <div className="page">
        <PageHeader title="筋トレ実績の記録" backTo={backPath} />
        <p className="banner banner-info">この予定の実績はすでに記録されています。</p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => navigate(`/strength/records/${encodeURIComponent(existingForPlan.id)}`, { replace: true })}
        >
          記録済みの実績を開く
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page">
        <PageHeader title="筋トレ実績" backTo="/strength" />
        {isEdit && !loading && <p className="banner banner-error">実績が見つかりませんでした。</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={isEdit ? '筋トレ実績の編集' : '筋トレ実績の記録'} onBack={cancel} />
      {plan && <p className="banner banner-info">{formatPracticeDate(plan.date)}の予定から入力しています。目標の値が入っているので、実際の数字に直してください。</p>}
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="record-date">
            実施日
          </label>
          <input
            id="record-date"
            className="input date-input"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        {form.entries.map((entry, idx) => {
          const kind = kindOf(entry.exerciseId) ?? 'weight';
          return (
            <section key={entry.id} className="item-card">
              <div className="item-card-head">
                <span className="item-num">{idx + 1}</span>
                <ExerciseSelect
                  exercises={exercises}
                  value={entry.exerciseId}
                  onChange={(exerciseId) => updateEntry(entry.id, { exerciseId })}
                />
                {form.entries.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${idx + 1}つ目の種目を削除`}
                    onClick={() => setForm((f) => ({ ...f, entries: f.entries.filter((e) => e.id !== entry.id) }))}
                  >
                    <CloseIcon size={20} />
                  </button>
                )}
              </div>
              <ol className="set-list">
                {entry.sets.map((s, si) => (
                  <li key={s.id} className="set-row">
                    <span className="set-num">{si + 1}</span>
                    {kind !== 'time' && (
                      <NumberField
                        label={kind === 'bodyweight' ? '加重' : '重量'}
                        unit="kg"
                        decimal
                        placeholder={kind === 'bodyweight' ? 'なし' : undefined}
                        value={s.weight}
                        onChange={(weight) => updateSet(entry, s.id, { weight })}
                      />
                    )}
                    <NumberField
                      label={kind === 'time' ? '時間' : '回数'}
                      unit={kind === 'time' ? '秒' : '回'}
                      value={s.amount}
                      onChange={(amount) => updateSet(entry, s.id, { amount })}
                    />
                    <button
                      type="button"
                      className="icon-btn set-remove"
                      aria-label={`${si + 1}セット目を削除`}
                      disabled={entry.sets.length === 1}
                      onClick={() => updateEntry(entry.id, { sets: entry.sets.filter((x) => x.id !== s.id) })}
                    >
                      <CloseIcon size={18} />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn btn-secondary btn-block add-set"
                onClick={() => updateEntry(entry.id, { sets: [...entry.sets, newSet(entry.sets[entry.sets.length - 1])] })}
              >
                <PlusIcon size={18} /> セットを追加
              </button>
            </section>
          );
        })}
        <button
          type="button"
          className="btn btn-secondary btn-block add-item"
          onClick={() => setForm((f) => ({ ...f, entries: [...f.entries, newEntry()] }))}
        >
          <PlusIcon size={18} /> 種目を追加
        </button>

        <div className="field">
          <label className="field-label" htmlFor="record-memo">
            メモ<span className="optional">(任意)</span>
          </label>
          <textarea
            id="record-memo"
            className="input textarea"
            placeholder="調子・フォームで気づいたことなど"
            rows={3}
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          />
        </div>

        {error && <p className="banner banner-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={saving}>
          {saving ? '保存中…' : isEdit ? '変更を保存' : '実績を保存'}
        </button>
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

export function RecordDetailPage({ recordId }: { recordId: string }) {
  const { strengthRecords, strengthPlans, exercises, loading, reload, showToast } = useAppData();
  const record = strengthRecords.find((r) => r.id === recordId);
  const plan = record?.planId ? strengthPlans.find((p) => p.id === record.planId) : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!record) {
    return (
      <div className="page">
        <PageHeader title="筋トレ実績" backTo="/strength" />
        {!loading && <p className="banner banner-error">実績が見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  const editPath = `/strength/records/${encodeURIComponent(record.id)}/edit`;

  const remove = async () => {
    setBusy(true);
    try {
      await repository.deleteStrengthRecord(record.id);
      await reload();
      showToast(plan ? '実績を削除し、予定を「予定」に戻しました' : '実績を削除しました');
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
        title="筋トレ実績"
        backTo="/strength"
        right={
          <button type="button" className="icon-btn" aria-label="編集" onClick={() => navigate(editPath)}>
            <PencilIcon size={22} />
          </button>
        }
      />
      <div className="note-detail-head">
        <h1 className="detail-title">{formatPracticeDate(record.date, true)}</h1>
      </div>

      {record.entries.map((e) => {
        const ex = exercises.find((x) => x.id === e.exerciseId);
        const s = entryStats(e, ex?.kind);
        return (
          <section key={e.id} className="item-card">
            <div className="target-main">
              <span className="target-name">{exerciseName(exercises, e.exerciseId)}</span>
              <span className="target-value">
                {s.sets}セット
                {ex?.kind === 'time'
                  ? `・合計${formatSeconds(s.totalReps)}`
                  : `・計${s.totalReps}回${s.volume ? `・総負荷${Math.round(s.volume)}kg` : ''}`}
              </span>
            </div>
            <ol className="set-summary">
              {e.sets.map((set, i) => (
                <li key={i}>
                  <span className="set-num">{i + 1}</span>
                  {formatSet(set, ex?.kind)}
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {record.memo && (
        <>
          <h2 className="section-title">メモ</h2>
          <div className="memo-box">{record.memo}</div>
        </>
      )}

      {plan && (
        <>
          <div className="history-head">
            <h2 className="section-title">予定との比較</h2>
            <PlanStatusBadge status={plan.status} />
          </div>
          <PlanComparison plan={plan} record={record} />
          <button
            type="button"
            className="btn btn-secondary btn-block history-add"
            onClick={() => navigate(`/strength/plans/${encodeURIComponent(plan.id)}`)}
          >
            予定を開く
          </button>
        </>
      )}

      <div className="form-footer">
        <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={18} /> 削除
        </button>
        <button type="button" className="btn btn-primary" onClick={() => navigate(editPath)}>
          <PencilIcon size={18} /> 編集
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="この実績を削除しますか?"
          message={`${formatPracticeDate(record.date, true)}の筋トレ実績を削除します。${plan ? '予定は「予定」の状態に戻ります。' : ''}この操作は取り消せません。`}
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
