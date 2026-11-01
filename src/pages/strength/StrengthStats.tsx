// 成長分析:種目ごとの推移グラフ(重量・回数・総負荷量の切り替え)・自己ベスト・月ごとのトレーニング回数

import { useMemo, useState } from 'react';
import { useAppData } from '../../AppData';
import { BarChart, EmptyHint, ExerciseSelect, LineChart } from '../../components/Strength';
import { navigate } from '../../router';
import type { ExerciseKind } from '../../types';
import { todayString, formatPracticeDate } from '../../utils/practice';
import { exerciseHistory, formatSeconds, type EntryStats } from '../../utils/strength';

type MetricKey = 'maxWeight' | 'maxReps' | 'volume' | 'totalReps';

interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  format: (n: number) => string;
}

const kg = (n: number) => `${Math.round(n * 100) / 100}kg`;
const times = (n: number) => `${n}回`;

/** 種目の種類ごとに、切り替えられるグラフの種類を決めます */
function metricsFor(kind: ExerciseKind, hasWeight: boolean): Metric[] {
  if (kind === 'time')
    return [
      { key: 'maxReps', label: '最長時間', unit: '秒', format: formatSeconds },
      { key: 'totalReps', label: '合計時間', unit: '秒', format: formatSeconds },
    ];
  if (kind === 'bodyweight')
    return [
      { key: 'maxReps', label: '最大回数', unit: '回', format: times },
      { key: 'totalReps', label: '総回数', unit: '回', format: times },
      ...(hasWeight ? [{ key: 'maxWeight' as const, label: '加重', unit: 'kg', format: kg }] : []),
    ];
  return [
    { key: 'maxWeight', label: '重量', unit: 'kg', format: kg },
    { key: 'maxReps', label: '回数', unit: '回', format: times },
    { key: 'volume', label: '総負荷量', unit: 'kg', format: kg },
  ];
}

/** 直近6か月の月ごとの回数(実施した日数) */
function monthlyCounts(dates: string[]): { label: string; value: number }[] {
  const [y, m] = todayString().split('-').map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: `${d.getMonth() + 1}月`, value: dates.filter((x) => x.startsWith(key)).length };
  });
}

export function StrengthStats({ exerciseId: routeExerciseId }: { exerciseId: string | null }) {
  const { exercises, strengthRecords } = useAppData();

  // 初期表示は、指定された種目 → 記録が最も多い種目 → 先頭の種目
  const defaultId = useMemo(() => {
    if (routeExerciseId && exercises.some((e) => e.id === routeExerciseId)) return routeExerciseId;
    const counts = new Map<string, number>();
    strengthRecords.forEach((r) => r.entries.forEach((e) => counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)));
    const top = exercises.map((e) => e.id).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0];
    return top ?? null;
  }, [routeExerciseId, exercises, strengthRecords]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const exerciseId = selectedId ?? defaultId;
  const exercise = exercises.find((e) => e.id === exerciseId);

  const history = useMemo(
    () => (exercise ? exerciseHistory(strengthRecords, exercise.id, exercise.kind) : []),
    [strengthRecords, exercise],
  );
  const hasWeight = history.some((h) => h.stats.maxWeight > 0);
  const metrics = exercise ? metricsFor(exercise.kind, hasWeight) : [];
  const [metricKey, setMetricKey] = useState<MetricKey | null>(null);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const select = (id: string | null) => {
    setSelectedId(id);
    setMetricKey(null);
  };

  if (!exercises.length) {
    return <EmptyHint>種目がありません。「種目」タブから追加してください。</EmptyHint>;
  }

  const best = (key: MetricKey) =>
    history.reduce<{ date: string; stats: EntryStats } | null>(
      (b, h) => (h.stats[key] > 0 && (!b || h.stats[key] > b.stats[key]) ? h : b),
      null,
    );

  return (
    <div className="stats">
      <div className="field">
        <label className="field-label" htmlFor="stats-exercise">
          種目
        </label>
        <ExerciseSelect id="stats-exercise" exercises={exercises} value={exerciseId} onChange={select} />
      </div>

      {exercise && history.length === 0 && (
        <EmptyHint
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/strength/records/new?date=${todayString()}`)}>
              実績を記録する
            </button>
          }
        >
          「{exercise.name}」の実績はまだありません。記録するとここに成長グラフが表示されます。
        </EmptyHint>
      )}

      {exercise && history.length > 0 && metric && (
        <>
          <h2 className="section-title">自己ベスト</h2>
          <div className="best-grid">
            {metrics.map((m) => {
              const b = best(m.key);
              return (
                <div key={m.key} className="best-card">
                  <span className="best-label">{m.label}</span>
                  <span className="best-value">{b ? m.format(b.stats[m.key]) : '—'}</span>
                  {b && <span className="best-date">{formatPracticeDate(b.date)}</span>}
                </div>
              );
            })}
          </div>

          <h2 className="section-title">推移</h2>
          <div className="segmented small" role="tablist" aria-label="グラフの種類">
            {metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={metric.key === m.key}
                className={`segmented-item ${metric.key === m.key ? 'active' : ''}`}
                onClick={() => setMetricKey(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {history.length < 2 ? (
            <EmptyHint>
              記録が2回以上になると推移のグラフを表示します(現在{history.length}回)。続けて記録していきましょう。
            </EmptyHint>
          ) : (
            <LineChart
              points={history.slice(-20).map((h) => ({ date: h.date, value: h.stats[metric.key] }))}
              unit={metric.unit}
              label={`${exercise.name}の${metric.label}の推移`}
            />
          )}
          {history.length > 20 && <p className="hint">直近20回分を表示しています。</p>}
          {metric.key === 'volume' && <p className="hint">総負荷量 = 重量 × 回数 × セット数(各セットの合計)</p>}

          <h2 className="section-title">月ごとのトレーニング回数</h2>
          <BarChart bars={monthlyCounts(history.map((h) => h.date))} label={`${exercise.name}の月ごとのトレーニング回数`} />
        </>
      )}
    </div>
  );
}
