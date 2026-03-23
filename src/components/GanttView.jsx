import { useState, useEffect, useRef } from "react";
import { STATUSES, FONT_HEADING, FONT_MONO } from "../constants";

export default function GanttView({ fs, cases, onSelect, selectedId, onUpdate }) {
  const DAY_W = 36;
  const ROW_H = 48;
  const SUB_ROW_H = 40;
  const LEFT_W = 280;
  const HEADER_H = 70;
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const [expanded, setExpanded] = useState({});

  function toggleExpand(caseId) {
    setExpanded((prev) => ({ ...prev, [caseId]: !prev[caseId] }));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDates = [today];

  const casesWithDates = cases.filter((c) => c.deadline).map((c) => {
    const end = new Date(c.deadline);
    let start;
    if (c.startDate) {
      start = new Date(c.startDate);
    } else {
      start = new Date(end);
      start.setDate(start.getDate() - 14);
    }
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
  while (d <= rangeEnd) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

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
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function calcBar(startDate, endDate, color, bgColor) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const startDiff = Math.round((s - rangeStart) / 86400000);
    const duration = Math.round((e - s) / 86400000) + 1;
    return {
      left: startDiff * DAY_W,
      width: Math.max(duration * DAY_W - 4, DAY_W),
      color, bg: bgColor,
    };
  }

  const todayIdx = Math.round((today - rangeStart) / 86400000);

  const summary = casesWithDates.length > 0 ? {
    start: new Date(Math.min(...casesWithDates.map((c) => c._start))),
    end: new Date(Math.max(...casesWithDates.map((c) => c._end))),
  } : null;

  const timelineRef = useRef(null);
  const leftRef = useRef(null);

  useEffect(() => {
    if (timelineRef.current && todayIdx > 3) {
      timelineRef.current.scrollLeft = (todayIdx - 3) * DAY_W;
    }
  }, []);

  useEffect(() => {
    const timeline = timelineRef.current;
    const left = leftRef.current;
    if (!timeline || !left) return;
    let syncing = false;
    function syncLeft() {
      if (syncing) return;
      syncing = true;
      left.scrollTop = timeline.scrollTop;
      syncing = false;
    }
    function syncRight() {
      if (syncing) return;
      syncing = true;
      timeline.scrollTop = left.scrollTop;
      syncing = false;
    }
    timeline.addEventListener("scroll", syncLeft);
    left.addEventListener("scroll", syncRight);
    return () => {
      timeline.removeEventListener("scroll", syncLeft);
      left.removeEventListener("scroll", syncRight);
    };
  }, []);

  const rows = [];
  cases.forEach((c) => {
    const st = STATUSES.find((s) => s.id === c.status);
    const cwd = casesWithDates.find((cw) => cw.id === c.id);
    const hasTasks = c.tasks && c.tasks.length > 0;
    const isExpanded = expanded[c.id];
    const duration = cwd ? Math.round((cwd._end - cwd._start) / 86400000) + 1 : null;

    rows.push({ type: "case", c, st, cwd, duration, hasTasks, isExpanded });

    if (isExpanded && hasTasks) {
      c.tasks.forEach((t) => {
        rows.push({ type: "task", t, caseId: c.id, parentSt: st });
      });
    }
  });

  function WeekendBg({ height }) {
    return (
      <div style={{ display: "flex", position: "absolute", inset: 0 }}>
        {days.map((day, i) => {
          const dow = day.getDay();
          return (
            <div key={i} style={{ width: DAY_W, flexShrink: 0, height, background: (dow === 0 || dow === 6) ? "#faf9f6" : "transparent", borderRight: "1px solid transparent" }} />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div ref={leftRef} style={{ width: LEFT_W, flexShrink: 0, borderRight: "2px solid #e2e8f0", background: "#fff", overflow: "auto" }}>
          <div style={{ height: HEADER_H, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-end", padding: "0 12px 8px", fontSize: fs(12), fontWeight: 700, color: "#64748b" }}>
            <span style={{ flex: 1 }}>タスク名</span>
            <span style={{ width: 40, textAlign: "center" }}>日数</span>
          </div>
          <div style={{ height: 20, borderBottom: "1px solid #e2e8f0" }} />

          {rows.map((row) => {
            if (row.type === "case") {
              const { c, st, duration, hasTasks, isExpanded } = row;
              return (
                <div key={`c-${c.id}`} style={{
                  height: ROW_H, display: "flex", alignItems: "center", padding: "0 8px 0 8px", gap: 6,
                  borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                  background: selectedId === c.id ? "#eef2ff" : "#fff",
                }}>
                  {hasTasks ? (
                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#64748b", padding: "2px 4px", width: 20 }}>
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  ) : (
                    <div style={{ width: 20 }} />
                  )}
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: st?.dot || "#cbd5e1", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => onSelect(c.id)}>
                    <div style={{ fontSize: fs(13), fontWeight: 600, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT_HEADING }}>{c.name}</div>
                  </div>
                  <div style={{ width: 40, textAlign: "center", fontSize: fs(12), color: "#64748b", fontWeight: 600 }}>
                    {duration ? `${duration}日` : "—"}
                  </div>
                </div>
              );
            } else {
              const { t } = row;
              const tDuration = (t.startDate && t.deadline) ? Math.round((new Date(t.deadline) - new Date(t.startDate)) / 86400000) + 1 : null;
              return (
                <div key={`t-${t.id}`} style={{
                  height: SUB_ROW_H, display: "flex", alignItems: "center", padding: "0 8px 0 36px", gap: 6,
                  borderBottom: "1px solid #f8f7f4", background: "#fafaf9",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.done ? "#34d399" : "#cbd5e1", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: fs(11), color: t.done ? "#94a3b8" : "#475569", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.label}
                    </div>
                  </div>
                  <div style={{ width: 40, textAlign: "center", fontSize: fs(11), color: "#94a3b8" }}>
                    {tDuration ? `${tDuration}日` : "—"}
                  </div>
                </div>
              );
            }
          })}

          {cases.length === 0 && (
            <div style={{ textAlign: "center", color: "#cbd5e1", padding: 40, fontSize: fs(13) }}>案件がありません</div>
          )}

          {summary && (
            <div style={{ margin: 12, padding: 14, background: "#faf9f6", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: fs(13), fontWeight: 700, color: "#1e1b4b", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_HEADING }}>
                スケジュール概要 <span style={{ color: "#94a3b8", fontSize: fs(10) }}>▼</span>
              </div>
              <div style={{ fontSize: fs(12), color: "#1e1b4b", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
                <span style={{ color: "#64748b" }}>開始日</span>
                <span style={{ fontWeight: 700 }}>{summary.start.getFullYear()}年{summary.start.getMonth() + 1}月{summary.start.getDate()}日</span>
                <span style={{ color: "#64748b" }}>完了日</span>
                <span style={{ fontWeight: 700 }}>{summary.end.getFullYear()}年{summary.end.getMonth() + 1}月{summary.end.getDate()}日</span>
                <span style={{ color: "#64748b" }}>合計営業日</span>
                <span style={{ fontWeight: 700 }}>{countBusinessDays(summary.start, summary.end)}日</span>
                <span style={{ color: "#64748b" }}>期間</span>
                <span style={{ fontWeight: 700 }}>約{Math.ceil((summary.end - summary.start) / (7 * 86400000))}週間</span>
              </div>
            </div>
          )}
        </div>

        <div ref={timelineRef} style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          <div style={{ minWidth: days.length * DAY_W, position: "relative" }}>
            <div style={{ display: "flex", height: 28, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
              {months.map((m, i) => (
                <div key={i} style={{
                  width: m.count * DAY_W, borderRight: "1px solid #e2e8f0",
                  display: "flex", alignItems: "center", paddingLeft: 8,
                  fontSize: 12, fontWeight: 700, color: "#1e1b4b",
                }}>
                  {m.year}年{m.month}月
                </div>
              ))}
            </div>

            <div style={{ display: "flex", height: HEADER_H - 28, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 28, background: "#fff", zIndex: 5 }}>
              {days.map((day, i) => {
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} style={{
                    width: DAY_W, textAlign: "center", flexShrink: 0, borderRight: "1px solid #f1f5f9",
                    background: isToday ? "#eef2ff" : isWeekend ? "#faf9f6" : "#fff",
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 1,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#1e1b4b", fontFamily: FONT_MONO }}>
                      {day.getDate()}
                    </div>
                    <div style={{ fontSize: 9, color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#94a3b8", fontWeight: 600 }}>
                      {WEEKDAYS[dow]}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", height: 20, borderBottom: "1px solid #e2e8f0" }}>
              {days.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString();
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div key={i} style={{ width: DAY_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isWeekend ? "#faf9f6" : "#fff", borderRight: "1px solid #f1f5f9" }}>
                    {isToday && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />}
                  </div>
                );
              })}
            </div>

            {rows.map((row) => {
              if (row.type === "case") {
                const { c, cwd, st } = row;
                const bar = cwd ? calcBar(cwd._start, cwd._end, st?.color || "#6366f1", st?.dot || "#818cf8") : null;
                return (
                  <div key={`c-${c.id}`} style={{ height: ROW_H, position: "relative", borderBottom: "1px solid #f1f5f9" }}>
                    <WeekendBg height={ROW_H} />
                    {bar && (
                      <div onClick={() => onSelect(c.id)} style={{
                        position: "absolute", top: 8, left: bar.left + 2, width: bar.width,
                        height: ROW_H - 16, borderRadius: 6, cursor: "pointer",
                        background: `linear-gradient(135deg, ${bar.bg}, ${bar.bg}88)`,
                        display: "flex", alignItems: "center", paddingLeft: 10,
                        fontSize: fs(12), fontWeight: 600, color: "#fff",
                        boxShadow: selectedId === c.id ? `0 0 0 2px ${bar.color}` : "none",
                        overflow: "hidden", whiteSpace: "nowrap", zIndex: 1,
                      }}>
                        {c.name}
                      </div>
                    )}
                    {!bar && (
                      <div style={{ position: "absolute", top: 14, left: 8, fontSize: fs(11), color: "#94a3b8", fontStyle: "italic", zIndex: 1 }}>
                        期限未設定
                      </div>
                    )}
                  </div>
                );
              } else {
                const { t } = row;
                const hasTaskDates = t.startDate && t.deadline;
                const taskBar = hasTaskDates ? calcBar(t.startDate, t.deadline, "#0891b2", t.done ? "#34d399" : "#22d3ee") : null;
                return (
                  <div key={`t-${t.id}`} style={{ height: SUB_ROW_H, position: "relative", borderBottom: "1px solid #f8f7f4", background: "#fafaf9" }}>
                    <WeekendBg height={SUB_ROW_H} />
                    {taskBar && (
                      <div style={{
                        position: "absolute", top: 8, left: taskBar.left + 2, width: taskBar.width,
                        height: SUB_ROW_H - 16, borderRadius: 5, zIndex: 1,
                        background: t.done
                          ? "repeating-linear-gradient(135deg, #34d399, #34d399 4px, #34d39966 4px, #34d39966 8px)"
                          : `linear-gradient(135deg, ${taskBar.bg}, ${taskBar.bg}88)`,
                        display: "flex", alignItems: "center", paddingLeft: 8,
                        fontSize: fs(11), fontWeight: 600, color: "#fff",
                        overflow: "hidden", whiteSpace: "nowrap",
                      }}>
                        {t.label}
                      </div>
                    )}
                    {!taskBar && (
                      <div style={{ position: "absolute", top: 12, left: 8, fontSize: fs(11), color: "#cbd5e1", fontStyle: "italic", zIndex: 1 }}>
                        日付未設定
                      </div>
                    )}
                  </div>
                );
              }
            })}

            {todayIdx >= 0 && todayIdx < days.length && (
              <div style={{
                position: "absolute", top: 0, left: todayIdx * DAY_W + DAY_W / 2,
                width: 2, height: "100%", background: "#6366f188", zIndex: 3, pointerEvents: "none",
              }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
