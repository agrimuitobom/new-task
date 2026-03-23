import { useState, useEffect, useRef, useCallback } from "react";
import { STATUSES } from "../constants";
import { useUI } from "../store/UIContext";
import css from "./GanttView.module.css";

const MIN_DAY_W = 16;
const MAX_DAY_W = 60;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function GanttView({ cases, onSelect, selectedId }) {
  const { fs } = useUI();
  const ROW_H = 48;
  const SUB_ROW_H = 40;
  const HEADER_H = 70;
  const [dayW, setDayW] = useState(36);
  const [expanded, setExpanded] = useState({});

  function toggleExpand(caseId) {
    setExpanded((prev) => ({ ...prev, [caseId]: !prev[caseId] }));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDates = [today];

  const casesWithDates = cases.filter((c) => c.deadline).map((c) => {
    const end = new Date(c.deadline);
    let start = c.startDate ? new Date(c.startDate) : new Date(end);
    if (!c.startDate) start.setDate(start.getDate() - 14);
    allDates.push(start, end);
    (c.tasks || []).forEach((t) => {
      if (t.startDate) allDates.push(new Date(t.startDate));
      if (t.deadline) allDates.push(new Date(t.deadline));
    });
    return { ...c, _start: start, _end: end };
  });

  cases.filter((c) => !c.deadline).forEach((c) => {
    (c.tasks || []).forEach((t) => {
      if (t.startDate) allDates.push(new Date(t.startDate));
      if (t.deadline) allDates.push(new Date(t.deadline));
    });
  });

  let rangeStart = new Date(Math.min(...allDates));
  let rangeEnd = new Date(Math.max(...allDates));
  if (rangeStart.getTime() === rangeEnd.getTime()) {
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 30);
  }
  rangeStart.setDate(rangeStart.getDate() - 3);
  rangeEnd.setDate(rangeEnd.getDate() + 7);

  const days = [];
  const d = new Date(rangeStart);
  while (d <= rangeEnd) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }

  const months = [];
  let currentMonth = null;
  days.forEach((day, i) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    if (key !== currentMonth) {
      months.push({ year: day.getFullYear(), month: day.getMonth() + 1, startIdx: i, count: 1 });
      currentMonth = key;
    } else {
      months[months.length - 1].count++;
    }
  });

  function countBusinessDays(start, end) {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) { const dow = cur.getDay(); if (dow !== 0 && dow !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  }

  function calcBar(startDate, endDate, color, bgColor) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const startDiff = Math.round((s - rangeStart) / 86400000);
    const duration = Math.round((e - s) / 86400000) + 1;
    return { left: startDiff * dayW, width: Math.max(duration * dayW - 4, dayW), color, bg: bgColor };
  }

  const todayIdx = Math.round((today - rangeStart) / 86400000);

  const summary = casesWithDates.length > 0 ? {
    start: new Date(Math.min(...casesWithDates.map((c) => c._start))),
    end: new Date(Math.max(...casesWithDates.map((c) => c._end))),
  } : null;

  const timelineRef = useRef(null);
  const leftRef = useRef(null);
  const LEFT_W = 280;

  useEffect(() => {
    if (timelineRef.current && todayIdx > 3) timelineRef.current.scrollLeft = (todayIdx - 3) * dayW;
  }, []);

  // Vertical scroll sync
  useEffect(() => {
    const timeline = timelineRef.current;
    const left = leftRef.current;
    if (!timeline || !left) return;
    let syncing = false;
    function syncLeft() { if (syncing) return; syncing = true; left.scrollTop = timeline.scrollTop; syncing = false; }
    function syncRight() { if (syncing) return; syncing = true; timeline.scrollTop = left.scrollTop; syncing = false; }
    timeline.addEventListener("scroll", syncLeft);
    left.addEventListener("scroll", syncRight);
    return () => { timeline.removeEventListener("scroll", syncLeft); left.removeEventListener("scroll", syncRight); };
  }, []);

  // ── Pinch-to-zoom on timeline ──
  const pinchRef = useRef({ active: false, startDist: 0, startW: 36 });

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startW: dayW };
    }
  }, [dayW]);

  const handleTouchMove = useCallback((e) => {
    if (!pinchRef.current.active || e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const scale = dist / pinchRef.current.startDist;
    const newW = Math.round(Math.min(MAX_DAY_W, Math.max(MIN_DAY_W, pinchRef.current.startW * scale)));
    setDayW(newW);
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
  }, []);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Build flat rows
  const rows = [];
  cases.forEach((c) => {
    const st = STATUSES.find((sv) => sv.id === c.status);
    const cwd = casesWithDates.find((cw) => cw.id === c.id);
    const hasTasks = c.tasks && c.tasks.length > 0;
    const isExpanded = expanded[c.id];
    const duration = cwd ? Math.round((cwd._end - cwd._start) / 86400000) + 1 : null;
    rows.push({ type: "case", c, st, cwd, duration, hasTasks, isExpanded });
    if (isExpanded && hasTasks) {
      c.tasks.forEach((t) => { rows.push({ type: "task", t, caseId: c.id, parentSt: st }); });
    }
  });

  function WeekendBg({ height }) {
    return (
      <div style={{ display: "flex", position: "absolute", inset: 0 }}>
        {days.map((day, i) => {
          const dow = day.getDay();
          return <div key={i} style={{ width: dayW, flexShrink: 0, height, background: (dow === 0 || dow === 6) ? "#faf9f6" : "transparent" }} />;
        })}
      </div>
    );
  }

  const compactDay = dayW < 26;

  return (
    <div className={css.root}>
      {/* Zoom controls */}
      <div className={css.zoomControls}>
        <button className={css.zoomBtn} onClick={() => setDayW((w) => Math.max(MIN_DAY_W, w - 4))}>−</button>
        <span className={css.zoomLabel} style={{ fontSize: fs(11) }}>{dayW}px</span>
        <button className={css.zoomBtn} onClick={() => setDayW((w) => Math.min(MAX_DAY_W, w + 4))}>＋</button>
      </div>

      <div className={`${css.wrapper} gantt-wrapper`}>
        {/* Left panel */}
        <div ref={leftRef} className={`${css.left} gantt-left`} style={{ width: LEFT_W }}>
          <div className={css.leftHeader} style={{ height: HEADER_H, fontSize: fs(12) }}>
            <span style={{ flex: 1 }}>タスク名</span>
            <span style={{ width: 40, textAlign: "center" }}>日数</span>
          </div>
          <div className={css.milestoneRow} />

          {rows.map((row) => {
            if (row.type === "case") {
              const { c, st, duration, hasTasks, isExpanded } = row;
              return (
                <div key={`c-${c.id}`} className={`${css.caseRow} ${selectedId === c.id ? css.caseRowSelected : ""}`} style={{ height: ROW_H }}>
                  {hasTasks ? (
                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }} className={css.expandBtn}>
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  ) : <div style={{ width: 20 }} />}
                  <div className={css.statusDot} style={{ background: st?.dot || "#cbd5e1" }} />
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => onSelect(c.id)}>
                    <div className={css.caseName} style={{ fontSize: fs(13) }}>{c.name}</div>
                  </div>
                  <div className={css.daysCol} style={{ fontSize: fs(12) }}>{duration ? `${duration}日` : "—"}</div>
                </div>
              );
            } else {
              const { t } = row;
              const tDuration = (t.startDate && t.deadline) ? Math.round((new Date(t.deadline) - new Date(t.startDate)) / 86400000) + 1 : null;
              return (
                <div key={`t-${t.id}`} className={css.taskRow} style={{ height: SUB_ROW_H }}>
                  <div className={css.taskDot} style={{ background: t.done ? "#34d399" : "#cbd5e1" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`${css.taskName} ${t.done ? css.taskDone : ""}`} style={{ fontSize: fs(11), color: t.done ? undefined : "#475569" }}>
                      {t.label}
                    </div>
                  </div>
                  <div style={{ width: 40, textAlign: "center", fontSize: fs(11), color: "#94a3b8" }}>{tDuration ? `${tDuration}日` : "—"}</div>
                </div>
              );
            }
          })}

          {cases.length === 0 && <div className={css.empty} style={{ fontSize: fs(13) }}>案件がありません</div>}

          {summary && (
            <div className={css.summaryBox}>
              <div className={css.summaryTitle} style={{ fontSize: fs(13) }}>
                スケジュール概要 <span style={{ color: "#94a3b8", fontSize: fs(10) }}>▼</span>
              </div>
              <div className={css.summaryGrid} style={{ fontSize: fs(12) }}>
                <span style={{ color: "var(--c-muted)" }}>開始日</span>
                <span style={{ fontWeight: 700 }}>{summary.start.getFullYear()}年{summary.start.getMonth() + 1}月{summary.start.getDate()}日</span>
                <span style={{ color: "var(--c-muted)" }}>完了日</span>
                <span style={{ fontWeight: 700 }}>{summary.end.getFullYear()}年{summary.end.getMonth() + 1}月{summary.end.getDate()}日</span>
                <span style={{ color: "var(--c-muted)" }}>合計営業日</span>
                <span style={{ fontWeight: 700 }}>{countBusinessDays(summary.start, summary.end)}日</span>
                <span style={{ color: "var(--c-muted)" }}>期間</span>
                <span style={{ fontWeight: 700 }}>約{Math.ceil((summary.end - summary.start) / (7 * 86400000))}週間</span>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className={`${css.timeline} gantt-timeline`}>
          <div style={{ minWidth: days.length * dayW, position: "relative" }}>
            {/* Month header */}
            <div className={css.monthRow} style={{ height: 28 }}>
              {months.map((m, i) => (
                <div key={i} className={css.monthCell} style={{ width: m.count * dayW, fontSize: compactDay ? 10 : 12 }}>
                  {compactDay ? `${m.month}月` : `${m.year}年${m.month}月`}
                </div>
              ))}
            </div>

            {/* Day header */}
            <div className={css.dayRow} style={{ height: HEADER_H - 28, top: 28 }}>
              {days.map((day, i) => {
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} className={css.dayCell} style={{
                    width: dayW,
                    background: isToday ? "#eef2ff" : isWeekend ? "#faf9f6" : "#fff",
                  }}>
                    <div className={css.dayNum} style={{
                      fontSize: compactDay ? 10 : 13,
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#1e1b4b",
                    }}>
                      {day.getDate()}
                    </div>
                    {!compactDay && (
                      <div style={{ fontSize: 9, color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#94a3b8", fontWeight: 600 }}>
                        {WEEKDAYS[dow]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Milestone row */}
            <div style={{ display: "flex", height: 20, borderBottom: "1px solid var(--c-border)" }}>
              {days.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString();
                const dow = day.getDay();
                return (
                  <div key={i} className={css.milestoneCell} style={{ width: dayW, background: (dow === 0 || dow === 6) ? "#faf9f6" : "#fff" }}>
                    {isToday && <div className={css.todayDot} />}
                  </div>
                );
              })}
            </div>

            {/* Data rows */}
            {rows.map((row) => {
              if (row.type === "case") {
                const { c, cwd, st } = row;
                const bar = cwd ? calcBar(cwd._start, cwd._end, st?.color || "#6366f1", st?.dot || "#818cf8") : null;
                return (
                  <div key={`c-${c.id}`} className={css.barRow} style={{ height: ROW_H }}>
                    <WeekendBg height={ROW_H} />
                    {bar ? (
                      <div onClick={() => onSelect(c.id)} className={css.bar} style={{
                        top: 8, left: bar.left + 2, width: bar.width, height: ROW_H - 16,
                        background: `linear-gradient(135deg, ${bar.bg}, ${bar.bg}88)`,
                        fontSize: fs(12),
                        boxShadow: selectedId === c.id ? `0 0 0 2px ${bar.color}` : "none",
                      }}>
                        {c.name}
                      </div>
                    ) : (
                      <div className={css.noDate} style={{ fontSize: fs(11) }}>期限未設定</div>
                    )}
                  </div>
                );
              } else {
                const { t } = row;
                const hasTaskDates = t.startDate && t.deadline;
                const taskBar = hasTaskDates ? calcBar(t.startDate, t.deadline, "#0891b2", t.done ? "#34d399" : "#22d3ee") : null;
                return (
                  <div key={`t-${t.id}`} className={css.barTaskRow} style={{ height: SUB_ROW_H }}>
                    <WeekendBg height={SUB_ROW_H} />
                    {taskBar ? (
                      <div className={css.barTask} style={{
                        top: 8, left: taskBar.left + 2, width: taskBar.width, height: SUB_ROW_H - 16,
                        background: t.done
                          ? "repeating-linear-gradient(135deg, #34d399, #34d399 4px, #34d39966 4px, #34d39966 8px)"
                          : `linear-gradient(135deg, ${taskBar.bg}, ${taskBar.bg}88)`,
                        fontSize: fs(11),
                      }}>
                        {t.label}
                      </div>
                    ) : (
                      <div className={css.noDate} style={{ top: 12, fontSize: fs(11), color: "#cbd5e1" }}>日付未設定</div>
                    )}
                  </div>
                );
              }
            })}

            {/* Today line */}
            {todayIdx >= 0 && todayIdx < days.length && (
              <div className={css.todayLine} style={{ left: todayIdx * dayW + dayW / 2 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
