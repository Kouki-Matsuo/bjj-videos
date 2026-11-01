// カレンダー(月表示・選択日の予定と練習ノート)
// 選んだ日付はURL(#/calendar/2026-11-14)に入れるので、予定やノートの画面から戻っても同じ日が表示されます。

import { useMemo, useRef, useState } from 'react';
import { useAppData } from '../AppData';
import { Sheet } from '../components/Dialog';
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, DumbbellIcon, NoteIcon } from '../components/Icons';
import { BottomNav, PageHeader } from '../components/Layout';
import { RelatedVideo, ResultBadge } from '../components/Practice';
import { navigate, newNotePath } from '../router';
import type { CalendarEvent, EventType } from '../types';
import {
  ALL_EVENT_TYPES,
  EVENT_TYPES,
  eventCoversDate,
  eventTypeLabel,
  eventTypesByDate,
  formatEventPeriod,
  monthWeeks,
  parseDate,
  sortDayEvents,
  toDateString,
} from '../utils/calendar';
import { formatPracticeDate, isDateOnly, todayString } from '../utils/practice';
import { PlanCard, RecordCard } from './strength/StrengthCards';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarPage({ date }: { date: string | null }) {
  const { events, practiceNotes, strengthPlans, strengthRecords, loadError } = useAppData();
  const today = todayString();
  const selected = isDateOnly(date) ? date : today;
  const [year, month] = selected.split('-').map(Number);
  const weeks = useMemo(() => monthWeeks(year, month), [year, month]);

  const monthStart = `${selected.slice(0, 7)}-01`;
  const monthEnd = toDateString(new Date(year, month, 0));
  const typesByDate = useMemo(
    () => eventTypesByDate(events, monthStart, monthEnd),
    [events, monthStart, monthEnd],
  );
  const noteCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    practiceNotes.forEach((n) => map.set(n.practiceDate, (map.get(n.practiceDate) ?? 0) + 1));
    return map;
  }, [practiceNotes]);

  // 筋トレ:実績は実施日、予定は予定日で表示します。実績がある予定はマークを実績側にまとめ、二重に数えません
  const strengthMarks = useMemo(() => {
    const map = new Map<string, { plan: boolean; record: boolean }>();
    const get = (d: string) => map.get(d) ?? map.set(d, { plan: false, record: false }).get(d)!;
    const recordedPlans = new Set(strengthRecords.map((r) => r.planId).filter(Boolean));
    strengthRecords.forEach((r) => (get(r.date).record = true));
    strengthPlans.filter((p) => !recordedPlans.has(p.id)).forEach((p) => (get(p.date).plan = true));
    return map;
  }, [strengthPlans, strengthRecords]);
  const dayPlans = useMemo(() => strengthPlans.filter((p) => p.date === selected), [strengthPlans, selected]);
  const dayRecords = useMemo(() => strengthRecords.filter((r) => r.date === selected), [strengthRecords, selected]);

  const dayEvents = useMemo(() => sortDayEvents(events.filter((e) => eventCoversDate(e, selected))), [events, selected]);
  // 同じ日のノートは作成した順に並べます
  const dayNotes = useMemo(
    () =>
      practiceNotes.filter((n) => n.practiceDate === selected).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [practiceNotes, selected],
  );

  const select = (d: string) => navigate(`/calendar/${d}`, { replace: true });

  // 同じ日付を素早く2回タップ(ダブルタップ)したら、その日に登録するメニューを開きます
  const [addFor, setAddFor] = useState<string | null>(null);
  const lastTap = useRef<{ date: string; time: number } | null>(null);
  const tapDate = (d: string) => {
    const now = Date.now();
    if (lastTap.current?.date === d && now - lastTap.current.time < 400) {
      lastTap.current = null;
      setAddFor(d);
    } else {
      lastTap.current = { date: d, time: now };
    }
    if (d !== selected) select(d);
  };

  // 月を移動したときは、その月に今日があれば今日、なければ1日を選びます
  const moveMonth = (delta: number) => {
    const first = toDateString(new Date(year, month - 1 + delta, 1));
    select(first.slice(0, 7) === today.slice(0, 7) ? today : first);
  };

  return (
    <div className="page has-nav">
      <PageHeader title="カレンダー" />

      {loadError && <p className="banner banner-error">{loadError}</p>}

      <div className="cal-header">
        <h2 className="cal-month">
          {year}年{month}月
        </h2>
        {selected.slice(0, 7) !== today.slice(0, 7) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => select(today)}>
            今日
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="前の月" onClick={() => moveMonth(-1)}>
          <ChevronLeftIcon size={24} />
        </button>
        <button type="button" className="icon-btn cal-next" aria-label="次の月" onClick={() => moveMonth(1)}>
          <ChevronRightIcon size={24} />
        </button>
      </div>

      <div className="cal-grid" role="grid" aria-label={`${year}年${month}月`}>
        <div className="cal-row" role="row">
          {WEEKDAYS.map((w, i) => (
            <span key={w} role="columnheader" className={`cal-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div className="cal-row" role="row" key={wi}>
            {week.map((d, i) =>
              d ? (
                <DayCell
                  key={d}
                  date={d}
                  weekday={i}
                  isToday={d === today}
                  isSelected={d === selected}
                  types={typesByDate.get(d)}
                  noteCount={noteCountByDate.get(d) ?? 0}
                  strength={strengthMarks.get(d)}
                  onSelect={() => tapDate(d)}
                />
              ) : (
                <span key={`empty-${i}`} className="cal-cell empty" role="gridcell" />
              ),
            )}
          </div>
        ))}
      </div>

      <ul className="cal-legend" aria-label="マークの説明">
        {EVENT_TYPES.map((t) => (
          <li key={t.value} className={`event-${t.value}`}>
            <span className="event-dot" />
            {t.label}
          </li>
        ))}
        <li className="legend-record">
          <span className="record-mark">
            <CheckIcon size={10} strokeWidth={3} />
          </span>
          練習記録
        </li>
        <li>
          <span className="strength-plan-mark" />
          筋トレ予定
        </li>
        <li>
          <span className="strength-record-mark">
            <CheckIcon size={10} strokeWidth={3} />
          </span>
          筋トレ実績
        </li>
      </ul>

      <p className="hint cal-hint">日付をダブルタップすると、予定・練習ノート・筋トレを登録できます</p>

      <section className="day-panel" aria-label="選択した日の予定と練習記録">
        <h2 className="day-title">
          {formatPracticeDate(selected, true)}
          {selected === today && <span className="today-chip">今日</span>}
        </h2>

        <h3 className="day-section-title">予定</h3>
        {dayEvents.length ? (
          <ul className="event-list">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <EventItem event={e} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="day-empty">予定はありません</p>
        )}

        <h3 className="day-section-title">
          練習記録{dayNotes.length > 0 && <span className="count-chip">{dayNotes.length}件</span>}
        </h3>
        {dayNotes.length ? (
          <div className="video-list">
            {dayNotes.map((n) => (
              <button
                key={n.id}
                type="button"
                className="note-card"
                onClick={() => navigate(`/notes/${encodeURIComponent(n.id)}`)}
              >
                <div className="note-card-head">
                  <span className="note-card-date">
                    <NoteIcon size={16} /> 練習ノート
                  </span>
                  <ResultBadge result={n.result} />
                </div>
                <RelatedVideo videoId={n.videoId} />
                {(n.memo || n.improvement) && <p className="note-card-memo">{n.memo || n.improvement}</p>}
              </button>
            ))}
          </div>
        ) : (
          <p className="day-empty">この日の練習記録はありません</p>
        )}

        <h3 className="day-section-title">筋トレ</h3>
        {dayPlans.length || dayRecords.length ? (
          <div className="video-list">
            {dayPlans.map((p) => (
              <PlanCard key={p.id} plan={p} showDate={false} />
            ))}
            {dayRecords.map((r) => (
              <RecordCard key={r.id} record={r} showDate={false} />
            ))}
          </div>
        ) : (
          <p className="day-empty">この日の筋トレ予定・実績はありません</p>
        )}
      </section>

      <BottomNav active="calendar" />

      {addFor && (
        <Sheet title={`${formatPracticeDate(addFor, true)}に登録`} onClose={() => setAddFor(null)}>
          <div className="add-menu">
            <button
              type="button"
              className="add-menu-item"
              onClick={() => {
                setAddFor(null);
                navigate(`/events/new?date=${addFor}`);
              }}
            >
              <span className="setting-icon">
                <CalendarIcon />
              </span>
              <span className="setting-text">
                <span className="setting-title">予定を登録</span>
                <span className="setting-sub">練習・試合などの予定</span>
              </span>
              <ChevronRightIcon size={18} className="setting-chevron" />
            </button>
            <button
              type="button"
              className="add-menu-item"
              onClick={() => {
                setAddFor(null);
                navigate(newNotePath(null, addFor));
              }}
            >
              <span className="setting-icon">
                <NoteIcon />
              </span>
              <span className="setting-text">
                <span className="setting-title">練習ノートを登録</span>
                <span className="setting-sub">実際に練習した内容の記録</span>
              </span>
              <ChevronRightIcon size={18} className="setting-chevron" />
            </button>
            <button
              type="button"
              className="add-menu-item"
              onClick={() => {
                setAddFor(null);
                navigate(`/strength/plans/new?date=${addFor}`);
              }}
            >
              <span className="setting-icon">
                <DumbbellIcon />
              </span>
              <span className="setting-text">
                <span className="setting-title">筋トレ予定を登録</span>
                <span className="setting-sub">種目ごとの目標重量・回数・セット数</span>
              </span>
              <ChevronRightIcon size={18} className="setting-chevron" />
            </button>
            <button
              type="button"
              className="add-menu-item"
              onClick={() => {
                setAddFor(null);
                navigate(`/strength/records/new?date=${addFor}`);
              }}
            >
              <span className="setting-icon">
                <CheckIcon />
              </span>
              <span className="setting-text">
                <span className="setting-title">筋トレ実績を記録</span>
                <span className="setting-sub">実際に行った重量・回数をセットごとに記録</span>
              </span>
              <ChevronRightIcon size={18} className="setting-chevron" />
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

interface DayCellProps {
  date: string;
  weekday: number;
  isToday: boolean;
  isSelected: boolean;
  types?: Set<EventType>;
  noteCount: number;
  strength?: { plan: boolean; record: boolean };
  onSelect: () => void;
}

function DayCell({ date, weekday, isToday, isSelected, types, noteCount, strength, onSelect }: DayCellProps) {
  const day = parseDate(date).getDate();
  const typeList = ALL_EVENT_TYPES.filter((t) => types?.has(t.value));
  const label = [
    `${day}日`,
    isToday ? '今日' : '',
    typeList.length ? `予定:${typeList.map((t) => t.label).join('・')}` : '',
    noteCount ? `練習記録${noteCount}件` : '',
    strength?.plan ? '筋トレ予定あり' : '',
    strength?.record ? '筋トレ実績あり' : '',
  ]
    .filter(Boolean)
    .join('、');
  return (
    <button
      type="button"
      role="gridcell"
      className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${
        weekday === 0 ? 'sun' : weekday === 6 ? 'sat' : ''
      }`}
      aria-selected={isSelected}
      aria-label={label}
      onClick={onSelect}
    >
      <span className="cal-day">{day}</span>
      <span className="cal-marks">
        {typeList.map((t) => (
          <span key={t.value} className={`event-dot event-${t.value}`} />
        ))}
        {noteCount > 0 && (
          <span className="record-mark">
            <CheckIcon size={9} strokeWidth={3.2} />
          </span>
        )}
        {strength?.plan && <span className="strength-plan-mark" />}
        {strength?.record && (
          <span className="strength-record-mark">
            <CheckIcon size={9} strokeWidth={3.2} />
          </span>
        )}
      </span>
    </button>
  );
}

function EventItem({ event }: { event: CalendarEvent }) {
  return (
    <button
      type="button"
      className={`event-item event-${event.type}`}
      onClick={() => navigate(`/events/${encodeURIComponent(event.id)}`)}
    >
      <span className="event-bar" />
      <span className="event-body">
        <span className="event-meta">
          <span className="event-type-chip">{eventTypeLabel(event.type)}</span>
          <span className="event-period">{formatEventPeriod(event)}</span>
        </span>
        <span className="event-title">{event.title}</span>
        {event.location && <span className="event-location">{event.location}</span>}
        {event.description && <span className="event-desc">{event.description}</span>}
      </span>
      <ChevronRightIcon size={18} className="setting-chevron" />
    </button>
  );
}
