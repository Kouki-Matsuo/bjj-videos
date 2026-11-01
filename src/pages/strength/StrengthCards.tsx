// 筋トレの予定・実績を一覧で表示するカード(記録タブ・カレンダーで使用)

import { useAppData } from '../../AppData';
import { PlanStatusBadge } from '../../components/Strength';
import { navigate } from '../../router';
import type { StrengthPlan, StrengthRecord } from '../../types';
import { formatPracticeDate } from '../../utils/practice';
import { entryStats, exerciseName, formatSeconds, formatTarget } from '../../utils/strength';

export function PlanCard({ plan, showDate = true }: { plan: StrengthPlan; showDate?: boolean }) {
  const { exercises } = useAppData();
  return (
    <button
      type="button"
      className="s-card s-plan"
      onClick={() => navigate(`/strength/plans/${encodeURIComponent(plan.id)}`)}
    >
      <span className="s-card-head">
        <span className="s-card-kind">筋トレ予定</span>
        {showDate && <span className="s-card-date">{formatPracticeDate(plan.date)}</span>}
        <PlanStatusBadge status={plan.status} />
      </span>
      <span className="s-card-lines">
        {plan.items.map((i) => {
          const ex = exercises.find((e) => e.id === i.exerciseId);
          return (
            <span key={i.id} className="s-card-line">
              <span className="s-card-name">{exerciseName(exercises, i.exerciseId)}</span>
              <span className="s-card-detail">{formatTarget(i, ex?.kind)}</span>
            </span>
          );
        })}
      </span>
    </button>
  );
}

export function RecordCard({ record, showDate = true }: { record: StrengthRecord; showDate?: boolean }) {
  const { exercises } = useAppData();
  return (
    <button
      type="button"
      className="s-card s-record"
      onClick={() => navigate(`/strength/records/${encodeURIComponent(record.id)}`)}
    >
      <span className="s-card-head">
        <span className="s-card-kind">筋トレ実績</span>
        {showDate && <span className="s-card-date">{formatPracticeDate(record.date)}</span>}
      </span>
      <span className="s-card-lines">
        {record.entries.map((e) => {
          const ex = exercises.find((x) => x.id === e.exerciseId);
          const s = entryStats(e, ex?.kind);
          const best =
            ex?.kind === 'time'
              ? `最長${formatSeconds(s.maxReps)}`
              : s.maxWeight
                ? `最大${s.maxWeight}kg・${s.totalReps}回`
                : `計${s.totalReps}回`;
          return (
            <span key={e.id} className="s-card-line">
              <span className="s-card-name">{exerciseName(exercises, e.exerciseId)}</span>
              <span className="s-card-detail">
                {s.sets}セット・{best}
              </span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
