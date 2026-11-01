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

/** 縦軸の目盛りを、きりのよい数字で3本ほど引きます */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100);
  return ticks;
}

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** 折れ線グラフ(日付ごとの推移) */
export function LineChart({
  points,
  unit,
  label,
}: {
  points: { date: string; value: number }[];
  unit: string;
  label: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - (innerH * v) / top;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const best = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  // 日付ラベルは最大5つまで間引いて表示します
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));

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
        <path d={path} className="chart-line" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === best ? 4.5 : 3} className={i === best ? 'chart-dot best' : 'chart-dot'} />
        ))}
        {points.map(
          (p, i) =>
            (i % labelEvery === 0 || i === points.length - 1) && (
              <text key={`l-${p.date}`} x={x(i)} y={H - 8} className="chart-axis" textAnchor="middle">
                {shortDate(p.date)}
              </text>
            ),
        )}
      </svg>
      <figcaption className="chart-caption">
        単位:{unit}・<span className="chart-best-mark" />
        最高値
      </figcaption>
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
                  {b.value}
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
