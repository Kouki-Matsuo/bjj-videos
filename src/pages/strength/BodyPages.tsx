// 体重・体脂肪率:かんたん入力・推移グラフ(日・週・月)・記録一覧・編集

import { useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { ConfirmDialog } from '../../components/Dialog';
import { TrashIcon } from '../../components/Icons';
import { PageHeader } from '../../components/Layout';
import { EmptyHint, LineChart } from '../../components/Strength';
import { goBack, navigate } from '../../router';
import { repository } from '../../storage/repository';
import type { BodyRecord, BodyRecordInput } from '../../types';
import {
  aggregateBody,
  dailyBody,
  isValidBodyFat,
  isValidWeight,
  movingAverage,
  periodLabel,
  type Period,
} from '../../utils/body';
import { formatPracticeDate, isDateOnly, todayString } from '../../utils/practice';
import { NumberField } from './PlanPages';

interface FormState {
  date: string;
  time: string;
  weight: string;
  bodyFat: string;
  memo: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toNumber = (s: string) => (s.trim() ? Number(s.normalize('NFKC')) : NaN);
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Math.round(n * 10) / 10)}${unit}`;

/** 入力内容を確認し、保存用のデータかエラーメッセージを返します */
function toInput(f: FormState): BodyRecordInput | string {
  if (!isDateOnly(f.date)) return '日付を選択してください。';
  const weight = toNumber(f.weight);
  if (!isValidWeight(weight)) return '体重を20〜300kgの範囲で入力してください。';
  const fat = f.bodyFat.trim() ? toNumber(f.bodyFat) : null;
  if (fat !== null && !isValidBodyFat(fat)) return '体脂肪率は1〜70%の範囲で入力してください(未入力でも記録できます)。';
  return { date: f.date, time: f.time || null, weight, bodyFat: fat, memo: f.memo };
}

/** 体重・体脂肪率・日付・時間・メモの入力欄 */
function BodyFields({
  form,
  onChange,
  showDetails,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  showDetails: boolean;
}) {
  return (
    <>
      <div className="num-row body-num-row">
        <NumberField
          label="体重"
          unit="kg"
          decimal
          placeholder="例 70.5"
          value={form.weight}
          onChange={(weight) => onChange({ weight })}
        />
        <NumberField
          label="体脂肪率(任意)"
          unit="%"
          decimal
          placeholder="例 18"
          value={form.bodyFat}
          onChange={(bodyFat) => onChange({ bodyFat })}
        />
      </div>
      {showDetails && (
        <>
          <div className="field-pair body-details">
            <div className="field">
              <label className="field-label" htmlFor="body-date">
                日付
              </label>
              <input
                id="body-date"
                className="input date-input"
                type="date"
                value={form.date}
                onChange={(e) => onChange({ date: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="body-time">
                測定時間<span className="optional">(任意)</span>
              </label>
              <input
                id="body-time"
                className="input date-input"
                type="time"
                value={form.time}
                onChange={(e) => onChange({ time: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="body-memo">
              メモ<span className="optional">(任意)</span>
            </label>
            <input
              id="body-memo"
              className="input"
              placeholder="例:起床後・練習後など"
              maxLength={100}
              value={form.memo}
              onChange={(e) => onChange({ memo: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  );
}

export function BodyTab() {
  const { bodyRecords, reload, showToast } = useAppData();
  const empty = (): FormState => ({ date: todayString(), time: nowTime(), weight: '', bodyFat: '', memo: '' });
  const [form, setForm] = useState<FormState>(empty);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => dailyBody(bodyRecords), [bodyRecords]);
  const last = days[days.length - 1];

  const save = async () => {
    const input = toInput(form);
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setSaving(true);
    try {
      await repository.createBodyRecord(input);
      await reload();
      const diff = last && last.date !== input.date ? ` 前回より${signed(input.weight - last.weight, 'kg')}` : '';
      showToast(`${input.weight}kgを記録しました${diff}`);
      setForm(empty());
      setDetails(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form
        className="item-card body-input"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="body-input-head">
          <span className="body-input-title">
            {form.date === todayString() ? '今日' : formatPracticeDate(form.date)}の体重を記録
          </span>
          <button type="button" className="link-btn" onClick={() => setDetails((v) => !v)}>
            {details ? '閉じる' : '日付・時間・メモ'}
          </button>
        </div>
        <BodyFields
          form={form}
          onChange={(patch) => {
            setForm((f) => ({ ...f, ...patch }));
            setError(null);
          }}
          showDetails={details}
        />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block btn-lg body-save" disabled={saving}>
          {saving ? '保存中…' : '記録する'}
        </button>
      </form>

      <BodyCharts days={days} />
      <BodyList records={bodyRecords} />
    </>
  );
}

const PERIODS: { value: Period; label: string; limit: number }[] = [
  { value: 'day', label: '日', limit: 60 },
  { value: 'week', label: '週', limit: 26 },
  { value: 'month', label: '月', limit: 12 },
];

function BodyCharts({ days }: { days: ReturnType<typeof dailyBody> }) {
  const [period, setPeriod] = useState<Period>('day');
  const conf = PERIODS.find((p) => p.value === period)!;

  const series = (field: 'weight' | 'bodyFat') => {
    const all = aggregateBody(days, period, field);
    const trend = period === 'day' ? movingAverage(all) : undefined;
    const from = Math.max(0, all.length - conf.limit);
    return { points: all.slice(from), trend: trend?.slice(from) };
  };
  const weight = series('weight');
  const fat = series('bodyFat');

  if (!days.length) {
    return (
      <EmptyHint>体重を記録すると、ここに推移のグラフが表示されます。毎日同じ時間帯に測ると比べやすくなります。</EmptyHint>
    );
  }

  return (
    <>
      <div className="history-head">
        <h2 className="section-title">推移</h2>
      </div>
      <div className="segmented small" role="tablist" aria-label="グラフの期間">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={period === p.value}
            className={`segmented-item ${period === p.value ? 'active' : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <h3 className="day-section-title">体重</h3>
      <SeriesChart {...weight} period={period} unit="kg" name="体重" />

      <h3 className="day-section-title">体脂肪率</h3>
      {fat.points.length ? (
        <SeriesChart {...fat} period={period} unit="%" name="体脂肪率" />
      ) : (
        <EmptyHint>体脂肪率の記録はまだありません(任意項目です)。</EmptyHint>
      )}
      <p className="hint">
        同じ日に複数記録した場合は、その日の平均値を使います。週・月は、その期間に記録した日の平均です。
        {period === 'day' && '点線は直近7日間の平均(日々の変動をならした傾向)です。'}
      </p>
    </>
  );
}

function SeriesChart({
  points,
  trend,
  period,
  unit,
  name,
}: {
  points: { key: string; value: number }[];
  trend?: (number | null)[];
  period: Period;
  unit: string;
  name: string;
}) {
  if (points.length < 2) {
    return <EmptyHint>記録が2つ以上になると、{name}のグラフを表示します(現在{points.length}件)。</EmptyHint>;
  }
  const first = points[0];
  const lastP = points[points.length - 1];
  const unitWord = period === 'day' ? '日' : period === 'week' ? '週' : 'か月';
  return (
    <>
      <LineChart
        points={points.map((p) => ({ date: p.key, value: p.value, label: periodLabel(p.key, period) }))}
        unit={unit}
        label={`${name}の推移`}
        zeroBased={false}
        trend={trend && trend.some((t) => t !== null) ? trend : undefined}
        trendLabel="7日平均"
      />
      <p className="body-summary">
        表示期間の変化:{first.value}
        {unit} → {lastP.value}
        {unit}({signed(lastP.value - first.value, unit)}、{points.length}
        {unitWord}分)
        {points.length < 5 && <span className="muted">。記録が少ないため、傾向は参考程度に見てください。</span>}
      </p>
    </>
  );
}

function BodyList({ records }: { records: BodyRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const byDate = useMemo(() => {
    const map = new Map<string, BodyRecord[]>();
    records.forEach((r) => map.set(r.date, [...(map.get(r.date) ?? []), r]));
    return [...map.entries()];
  }, [records]);
  if (!records.length) return null;
  const shown = showAll ? byDate : byDate.slice(0, 14);

  return (
    <>
      <h2 className="section-title">記録一覧</h2>
      <div className="body-list">
        {shown.map(([date, list]) => {
          const avg = list.reduce((s, r) => s + r.weight, 0) / list.length;
          return (
            <section key={date} className="body-day">
              <div className="body-day-head">
                <span className="body-day-date">{formatPracticeDate(date)}</span>
                {list.length > 1 && (
                  <span className="body-day-avg">
                    平均 {Math.round(avg * 100) / 100}kg({list.length}件)
                  </span>
                )}
              </div>
              {[...list]
                .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="body-row"
                    onClick={() => navigate(`/strength/body/${encodeURIComponent(r.id)}`)}
                  >
                    <span className="body-time">{r.time ?? '—'}</span>
                    <span className="body-weight">{r.weight}kg</span>
                    <span className="body-fat">{r.bodyFat !== null ? `${r.bodyFat}%` : ''}</span>
                    {r.memo && <span className="body-memo">{r.memo}</span>}
                  </button>
                ))}
            </section>
          );
        })}
      </div>
      {byDate.length > shown.length && (
        <button type="button" className="btn btn-secondary btn-block history-add" onClick={() => setShowAll(true)}>
          すべて表示({byDate.length}日分)
        </button>
      )}
    </>
  );
}

export function BodyEditPage({ recordId }: { recordId: string }) {
  const { bodyRecords, loading, reload, showToast } = useAppData();
  const record = bodyRecords.find((r) => r.id === recordId);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (record && !form) {
    setForm({
      date: record.date,
      time: record.time ?? '',
      weight: String(record.weight),
      bodyFat: record.bodyFat !== null ? String(record.bodyFat) : '',
      memo: record.memo,
    });
  }

  if (!record || !form) {
    return (
      <div className="page">
        <PageHeader title="体重記録の編集" backTo="/strength/body" />
        {!loading && <p className="banner banner-error">記録が見つかりませんでした。削除された可能性があります。</p>}
      </div>
    );
  }

  const save = async () => {
    const input = toInput(form);
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setBusy(true);
    try {
      await repository.updateBodyRecord(record.id, input);
      await reload();
      showToast('記録を更新しました');
      goBack('/strength/body');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await repository.deleteBodyRecord(record.id);
      await reload();
      showToast('記録を削除しました');
      goBack('/strength/body');
    } catch (e) {
      setError(`削除に失敗しました。${e instanceof Error ? e.message : ''}`);
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="体重記録の編集" backTo="/strength/body" />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <BodyFields
          form={form}
          onChange={(patch) => {
            setForm((f) => (f ? { ...f, ...patch } : f));
            setError(null);
          }}
          showDetails
        />
        {error && <p className="field-error">{error}</p>}
        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={() => goBack('/strength/body')} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            保存
          </button>
        </div>
      </form>
      <button type="button" className="btn btn-danger-outline btn-block event-delete" onClick={() => setConfirmDelete(true)}>
        <TrashIcon size={18} /> この記録を削除
      </button>
      {confirmDelete && (
        <ConfirmDialog
          title="この記録を削除しますか?"
          message={`${formatPracticeDate(record.date, true)}${record.time ? ` ${record.time}` : ''}の記録(${record.weight}kg)を削除します。この操作は取り消せません。`}
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
