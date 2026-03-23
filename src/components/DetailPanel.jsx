import { useState, useEffect, useRef } from "react";
import { STATUSES, TASK_TEMPLATES, FONT_HEADING, FONT_BODY } from "../constants";
import { labelStyleFn, btnStyle } from "../styles";
import DeadlineBadge from "./DeadlineBadge";

export default function DetailPanel({ fs, c, onUpdate, onDelete, onClose, onAddTask, onToggleTask, onUpdateTask, onDeleteTask, onReorderTasks }) {
  const [newTask, setNewTask] = useState("");
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(c.name);
  const [noteVal, setNoteVal] = useState(c.note || "");
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);

  useEffect(() => { setNameVal(c.name); setNoteVal(c.note || ""); }, [c.id]);

  function handleTaskDragStart(e, idx) {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }
  function handleTaskDragOver(e, idx) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleTaskDrop(e, toIdx) {
    e.preventDefault();
    const fromIdx = dragSrcIdx.current;
    if (fromIdx !== null && fromIdx !== toIdx) {
      onReorderTasks(fromIdx, toIdx);
    }
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }
  function handleTaskDragEnd() {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }

  return (
    <div className="detail-panel" style={{ width: 300, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 18, overflow: "auto", flexShrink: 0, fontFamily: FONT_BODY }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        {editName ? (
          <input value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={() => { onUpdate({ name: nameVal }); setEditName(false); }} autoFocus
            style={{ fontSize: fs(15), fontWeight: 700, color: "#1e1b4b", border: "none", borderBottom: "2px solid #6366f1", outline: "none", width: "100%" }} />
        ) : (
          <div style={{ fontWeight: 700, fontSize: fs(15), color: "#1e1b4b", cursor: "pointer", flex: 1, fontFamily: FONT_HEADING }} onClick={() => setEditName(true)}>
            {c.name} <span style={{ fontSize: fs(10), color: "#94a3b8" }}>✏</span>
          </div>
        )}
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", padding: 0, marginLeft: 8 }}>×</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyleFn(fs)}>ステータス</label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => onUpdate({ status: s.id })}
              style={{ padding: "4px 10px", fontSize: fs(12), borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
                background: c.status === s.id ? s.bg : "#f1f5f9", color: c.status === s.id ? s.color : "#94a3b8",
                boxShadow: c.status === s.id ? `0 0 0 2px ${s.dot}88` : "none" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyleFn(fs)}>開始日</label>
        <input type="date" value={c.startDate || ""} onChange={(e) => onUpdate({ startDate: e.target.value })}
          style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: fs(13), color: "#1e1b4b", outline: "none" }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyleFn(fs)}>期限</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={c.deadline || ""} onChange={(e) => onUpdate({ deadline: e.target.value })}
            style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: fs(13), color: "#1e1b4b", outline: "none" }} />
          <DeadlineBadge date={c.deadline} fs={fs} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyleFn(fs)}>タスク ({c.tasks.filter(t=>t.done).length}/{c.tasks.length})</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 7 }}>
          {c.tasks.map((t, idx) => (
            <div key={t.id}
              draggable
              onDragStart={(e) => handleTaskDragStart(e, idx)}
              onDragOver={(e) => handleTaskDragOver(e, idx)}
              onDrop={(e) => handleTaskDrop(e, idx)}
              onDragEnd={handleTaskDragEnd}
              style={{
                border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 8px",
                background: t.done ? "#f8f7f4" : "#fff",
                borderTop: dragOverIdx === idx ? "3px solid #6366f1" : undefined,
                cursor: "grab", transition: "border-top 0.1s",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#cbd5e1", fontSize: 10, cursor: "grab", userSelect: "none" }}>⠿</span>
                <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)}
                  style={{ accentColor: "#6366f1", width: 14, height: 14, cursor: "pointer" }} />
                <span style={{ flex: 1, fontSize: fs(13), color: t.done ? "#94a3b8" : "#1e1b4b", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
                <button onClick={() => onDeleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: 0 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, marginLeft: 20 }}>
                <input type="date" value={t.startDate || ""} onChange={(e) => onUpdateTask(t.id, { startDate: e.target.value })}
                  title="開始日"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 5, padding: "2px 5px", fontSize: fs(11), color: "#64748b", outline: "none", width: 115 }} />
                <span style={{ fontSize: fs(11), color: "#cbd5e1", lineHeight: "24px" }}>→</span>
                <input type="date" value={t.deadline || ""} onChange={(e) => onUpdateTask(t.id, { deadline: e.target.value })}
                  title="期限"
                  style={{ border: "1px solid #e2e8f0", borderRadius: 5, padding: "2px 5px", fontSize: fs(11), color: "#64748b", outline: "none", width: 115 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
          {TASK_TEMPLATES.map((tl) => (
            <button key={tl} onClick={() => onAddTask(tl)}
              style={{ fontSize: fs(11), padding: "2px 7px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#faf9f6", color: "#64748b", cursor: "pointer" }}>
              + {tl}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            placeholder="タスクを入力… Enter"
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: fs(13), outline: "none" }} />
          <button onClick={() => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            style={btnStyle("#6366f1", "#fff")}>追加</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyleFn(fs)}>メモ</label>
        <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} onBlur={() => onUpdate({ note: noteVal })}
          rows={4} placeholder="案件に関するメモ…"
          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 9px", fontSize: fs(13), color: "#1e1b4b", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      </div>

      <button onClick={() => { if (window.confirm("この案件を削除しますか？")) onDelete(); }}
        style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 8, padding: "8px", fontSize: fs(13), fontWeight: 700, cursor: "pointer", width: "100%" }}>
        🗑 この案件を削除
      </button>
    </div>
  );
}
