// 筋トレの画面で共通して使う部品(上部タブ・部位の選択・状態バッジ・グラフなど)です。

import type { ReactNode } from 'react';
import { navigate, type StrengthTab } from '../router';
import type { Exercise, PlanStatus, StrengthVideo } from '../types';
import { formatDate } from '../utils/format';
import { BODY_PARTS, exerciseName, planStatusLabel } from '../utils/strength';
import { HeartIcon } from './Icons';
import { Thumbnail } from './Thumbnail';

const TABS: { tab: StrengthTab; label: string; path: string }[] = [
  { tab: 'log', label: '記録', path: '/strength' },
  { tab: 'body', label: '体重', path: '/strength/body' },
  { tab: 'stats', label: '分析', path: '/strength/stats' },
  { tab: 'videos', label: '動画', path: '/strength/videos' },
  { tab: 'exercises', label: '種目', path: '/strength/exercises' },
];

/** 筋トレ画面の上部の切り替えタブ */
export function StrengthTabs({ active }: { active: StrengthTab }) {
  return (
    <div className="segmented" role="tablist" aria-label="筋トレのメニュー">
      {TABS.map((t) => (
        <button
          key={t.tab}
          type="button"
          role="tab"
          aria-selected={active === t.tab}
          className={`segmented-item ${active === t.tab ? 'active' : ''}`}
          onClick={() => active !== t.tab && navigate(t.path, { replace: true })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 選択肢をチップで並べ、タップでON/OFFする部品(部位の選択などで使用) */
export function ChipToggleGroup({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <div className="chip-toggle-group" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`chip-toggle ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function BodyPartPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  // 以前登録した独自の部位があれば、それも選択肢に残します
  const options = [...BODY_PARTS, ...value.filter((v) => !BODY_PARTS.includes(v))];
  return <ChipToggleGroup options={options} value={value} onChange={onChange} label="鍛える部位" />;
}

/** 種目を選ぶプルダウン */
export function ExerciseSelect({
  id,
  exercises,
  value,
  onChange,
  emptyLabel = '種目を選択',
}: {
  id?: string;
  exercises: Exercise[];
  value: string | null;
  onChange: (id: string | null) => void;
  emptyLabel?: string;
}) {
  const missing = value && !exercises.some((e) => e.id === value);
  return (
    <div className="select-wrap">
      <select id={id} className="input select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{emptyLabel}</option>
        {missing && <option value={value}>削除された種目</option>}
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return <span className={`status-badge status-${status}`}>{planStatusLabel(status)}</span>;
}

/** 筋トレ動画のカード(一覧・種目の画面で使用) */
export function StrengthVideoCard({
  video,
  exercises,
  onToggleFavorite,
}: {
  video: StrengthVideo;
  exercises: Exercise[];
  onToggleFavorite?: () => void;
}) {
  return (
    <article className="video-card">
      <button
        type="button"
        className="video-card-main"
        onClick={() => navigate(`/strength/videos/${encodeURIComponent(video.id)}`)}
        aria-label={`${video.title}の詳細を開く`}
      >
        <Thumbnail src={video.thumbnailUrl} videoUrl={video.url} className="thumb-card" />
        <div className="video-card-body">
          <h3 className="video-card-title">{video.title}</h3>
          <div className="chip-row">
            {video.exerciseId && <span className="chip chip-outline">{exerciseName(exercises, video.exerciseId)}</span>}
            {video.bodyParts.map((p) => (
              <span key={p} className="chip chip-tag">
                {p}
              </span>
            ))}
          </div>
          {video.tags.length > 0 && (
            <div className="chip-row">
              {video.tags.slice(0, 3).map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <time className="video-card-date" dateTime={video.createdAt}>
            {formatDate(video.createdAt)}
          </time>
        </div>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          className={`fav-btn ${video.isFavorite ? 'on' : ''}`}
          aria-label={video.isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
          aria-pressed={video.isFavorite}
          onClick={onToggleFavorite}
        >
          <HeartIcon size={20} filled={video.isFavorite} />
        </button>
      )}
    </article>
  );
}

// ---------- グラフ(外部ライブラリを使わず SVG で描きます) ----------

const W = 320;
const H = 170;
const PAD = { top: 16, right: 12, bottom: 26, left: 40 };

const shortDate = (d: string) => {
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}`;
};

/** 縦軸の目盛りを、きりのよい数字で3〜5本ほど引きます */
function niceTicks(min: number, max: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks.length < 2) ticks.push(Math.round((start + step) * 100) / 100);
  return ticks;
}

const compact = (n: number) =>
  Math.abs(n) >= 10000 ? `${Math.round(n / 1000)}k` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

/** 折れ線グラフ(日付ごとの推移)。trend を渡すと、長期的な傾向として点線を重ねます */
export function LineChart({
  points,
  unit,
  label,
  zeroBased = true,
  trend,
  trendLabel = '傾向',
}: {
  points: { date: string; value: number; label?: string }[];
  unit: string;
  label: string;
  /** false にすると、縦軸を0からではなく記録の範囲に合わせます(体重など) */
  zeroBased?: boolean;
  trend?: (number | null)[];
  trendLabel?: string;
}) {
  const values = [...points.map((p) => p.value), ...(trend ?? []).filter((v): v is number => v !== null)];
  const rawMin = zeroBased ? 0 : Math.min(...values);
  const rawMax = Math.max(...values, zeroBased ? 0 : -Infinity);
  const pad = zeroBased ? 0 : Math.max((rawMax - rawMin) * 0.15, 0.5);
  const ticks = niceTicks(rawMin - pad, rawMax + pad);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1] === lo ? lo + 1 : ticks[ticks.length - 1];
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // 横軸は日付の間隔に合わせます(記録の間があいた期間も正しい長さで表示されます)
  const times = points.map((p) => new Date(`${p.date.length === 7 ? `${p.date}-01` : p.date}T00:00:00`).getTime());
  const t0 = times[0];
  const span = times[times.length - 1] - t0;
  const x = (i: number) =>
    PAD.left + (points.length === 1 || !span ? innerW / 2 : (innerW * (times[i] - t0)) / span);
  const y = (v: number) => PAD.top + innerH - (innerH * (v - lo)) / (hi - lo);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const trendPath = (trend ?? [])
    .map((v, i) => (v === null ? null : { i, v }))
    .filter((t): t is { i: number; v: number } => t !== null)
    .map((t, k) => `${k ? 'L' : 'M'}${x(t.i).toFixed(1)},${y(t.v).toFixed(1)}`)
    .join(' ');
  const best = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  // 日付ラベルは、重ならないよう間隔をあけて表示します(最初と最後は必ず表示)
  const labelIndexes: number[] = [];
  points.forEach((_, i) => {
    const prev = labelIndexes[labelIndexes.length - 1];
    if (prev === undefined || x(i) - x(prev) >= 52) labelIndexes.push(i);
  });
  const lastIdx = points.length - 1;
  if (labelIndexes[labelIndexes.length - 1] !== lastIdx) {
    if (labelIndexes.length > 1 && x(lastIdx) - x(labelIndexes[labelIndexes.length - 1]) < 52) labelIndexes.pop();
    labelIndexes.push(lastIdx);
  }
  const many = points.length > 40;

  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 4} className="chart-axis" textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        <path d={path} className={`chart-line ${trendPath ? 'faint' : ''}`} />
        {trendPath && <path d={trendPath} className="chart-trend" />}
        {!many &&
          points.map((p, i) => (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.value)}
              r={i === best ? 4.5 : 3}
              className={i === best ? 'chart-dot best' : 'chart-dot'}
            />
          ))}
        {labelIndexes.map((i) => (
          <text key={`l-${points[i].date}`} x={x(i)} y={H - 8} className="chart-axis" textAnchor="middle">
            {points[i].label ?? shortDate(points[i].date)}
          </text>
        ))}
      </svg>
      <figcaption className="chart-caption">
        単位:{unit}
        {trendPath ? (
          <>
            ・<span className="chart-trend-mark" />
            {trendLabel}
          </>
        ) : (
          !many && (
            <>
              ・<span className="chart-best-mark" />
              最高値
            </>
          )
        )}
      </figcaption>
    </figure>
  );
}

/** 散布図(横軸と縦軸の2つの値の関係) */
export function ScatterChart({
  points,
  xLabel,
  yLabel,
  label,
}: {
  points: { x: number; y: number; label: string }[];
  xLabel: string;
  yLabel: string;
  label: string;
}) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xt = niceTicks(Math.min(0, ...xs), Math.max(...xs, 1));
  const yt = niceTicks(Math.min(...ys, 0), Math.max(...ys, 0));
  const [x0, x1] = [xt[0], xt[xt.length - 1]];
  const [y0, y1] = [yt[0], yt[yt.length - 1] === yt[0] ? yt[0] + 1 : yt[yt.length - 1]];
  const pad = { ...PAD, bottom: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const x = (v: number) => pad.left + (innerW * (v - x0)) / (x1 - x0 || 1);
  const y = (v: number) => pad.top + innerH - (innerH * (v - y0)) / (y1 - y0);
  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-grid zero' : 'chart-grid'} />
            <text x={pad.left - 6} y={y(t) + 4} className="chart-axis" textAnchor="end">
              {t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - 20} className="chart-axis" textAnchor="middle">
            {compact(t)}
          </text>
        ))}
        <text x={pad.left + innerW / 2} y={H - 4} className="chart-axis" textAnchor="middle">
          {xLabel} →
        </text>
        {points.map((p) => (
          <circle key={p.label} cx={x(p.x)} cy={y(p.y)} r={5} className="chart-scatter">
            <title>{`${p.label}: ${p.x} / ${p.y}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="chart-caption">縦軸:{yLabel}・1つの点が1か月</figcaption>
    </figure>
  );
}

/** 棒グラフ(月ごとの回数) */
export function BarChart({ bars, label }: { bars: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const innerW = W - 24;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / bars.length;
  const bw = Math.min(28, slot * 0.6);
  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line x1={12} x2={W - 12} y1={PAD.top + innerH} y2={PAD.top + innerH} className="chart-grid" />
        {bars.map((b, i) => {
          const h = (innerH * b.value) / max;
          const cx = 12 + slot * i + slot / 2;
          return (
            <g key={b.label}>
              <rect x={cx - bw / 2} y={PAD.top + innerH - h} width={bw} height={h} rx={4} className="chart-bar" />
              {b.value > 0 && (
                <text x={cx} y={PAD.top + innerH - h - 4} className="chart-value" textAnchor="middle">
                  {compact(b.value)}
                </text>
              )}
              <text x={cx} y={H - 8} className="chart-axis" textAnchor="middle">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** 記録が少ないときの案内 */
export function EmptyHint({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-hint">
      <p>{children}</p>
      {action}
    </div>
  );
}
