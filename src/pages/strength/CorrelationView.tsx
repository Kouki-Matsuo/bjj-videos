// 体重・体脂肪率と筋トレ記録の相関分析
// 相関は「一緒に変化する傾向」を表すだけで、原因と結果(因果関係)を示すものではありません。

import { useMemo } from 'react';
import { useAppData } from '../../AppData';
import { BarChart, EmptyHint, LineChart, ScatterChart } from '../../components/Strength';
import { navigate } from '../../router';
import { analyzeCorrelations, dailyBody, MIN_PAIRS, type Correlation } from '../../utils/body';

export function CorrelationView() {
  const { bodyRecords, strengthRecords, exercises } = useAppData();
  const days = useMemo(() => dailyBody(bodyRecords), [bodyRecords]);
  const { rows, results, perExercise } = useMemo(
    () => analyzeCorrelations(days, strengthRecords, exercises),
    [days, strengthRecords, exercises],
  );
  const recent = rows.slice(-12);
  const monthLabel = (m: string) => `${Number(m.slice(5))}月`;
  const weightPoints = recent.filter((r) => r.weight !== null).map((r) => ({ date: r.month, value: r.weight!, label: monthLabel(r.month) }));
  const fatPoints = recent.filter((r) => r.bodyFat !== null).map((r) => ({ date: r.month, value: r.bodyFat!, label: monthLabel(r.month) }));
  const scatter = results.find((r) => r.id === 'sessions-weight')!;

  if (!bodyRecords.length) {
    return (
      <EmptyHint
        action={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/strength/body', { replace: true })}>
            体重を記録する
          </button>
        }
      >
        体重の記録がまだありません。体重と筋トレの記録がたまると、関係を分析できます。
      </EmptyHint>
    );
  }

  return (
    <div className="stats">
      <div className="banner banner-info caveat">
        相関は「一緒に変化する傾向があるか」を表すだけで、筋トレが体重を変えた(原因と結果)という意味ではありません。
        体重・体脂肪率は、食事・柔術の練習量・睡眠・水分・測定時間などの影響も大きく受けます。
      </div>

      <h2 className="section-title">分析結果</h2>
      <div className="corr-list">
        {results.map((r) => (
          <CorrelationCard key={r.id} result={r} />
        ))}
      </div>

      <h2 className="section-title">筋トレ回数と体重変化(散布図)</h2>
      {scatter.pairs.length >= 2 ? (
        <ScatterChart
          points={scatter.pairs}
          xLabel="月間の筋トレ回数"
          yLabel="前月からの体重変化(kg)"
          label="月間筋トレ回数と体重変化の散布図"
        />
      ) : (
        <EmptyHint>2か月分以上の体重記録(前月との比較)ができると表示します。</EmptyHint>
      )}

      <h2 className="section-title">月ごとの推移</h2>
      <h3 className="day-section-title">体重(月平均)</h3>
      {weightPoints.length >= 2 ? (
        <LineChart points={weightPoints} unit="kg" label="月平均体重の推移" zeroBased={false} />
      ) : (
        <EmptyHint>2か月分以上の記録で表示します。</EmptyHint>
      )}
      <h3 className="day-section-title">体脂肪率(月平均)</h3>
      {fatPoints.length >= 2 ? (
        <LineChart points={fatPoints} unit="%" label="月平均体脂肪率の推移" zeroBased={false} />
      ) : (
        <EmptyHint>2か月分以上の体脂肪率の記録で表示します。</EmptyHint>
      )}
      <h3 className="day-section-title">月間筋トレ回数</h3>
      <BarChart bars={recent.map((r) => ({ label: monthLabel(r.month), value: r.sessions }))} label="月間筋トレ回数" />
      <h3 className="day-section-title">月間総負荷量(kg)</h3>
      <BarChart bars={recent.map((r) => ({ label: monthLabel(r.month), value: r.volume }))} label="月間総負荷量" />

      {perExercise.length > 0 && (
        <>
          <h2 className="section-title">種目別の実施頻度と体重変化</h2>
          <div className="corr-list">
            {perExercise.map((r) => (
              <CorrelationCard key={r.id} result={r} />
            ))}
          </div>
        </>
      )}

      <p className="hint corr-help">
        相関係数(r)は −1〜+1 の値で、0に近いほど関係がなく、±1に近いほど一緒に変化する傾向が強いことを表します。
        体重変化は「その月の平均 − 前月の平均」です。{MIN_PAIRS}件未満は「データ不足」と表示します。
      </p>
    </div>
  );
}

function CorrelationCard({ result }: { result: Correlation }) {
  return (
    <div className={`corr-card ${result.status}`}>
      <div className="corr-head">
        <span className="corr-title">{result.title}</span>
        <span className="corr-r">{result.r !== null ? `r = ${result.r.toFixed(2)}` : result.status === 'insufficient' ? 'データ不足' : '—'}</span>
      </div>
      <p className="corr-text">{result.text}</p>
    </div>
  );
}
