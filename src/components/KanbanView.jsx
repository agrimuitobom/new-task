import { useState, useRef } from "react";
import { STATUSES, FONT_HEADING } from "../constants";
import DeadlineBadge from "./DeadlineBadge";

export default function KanbanView({ fs, cases, onSelect, selectedId, onStatusChange, onReorder }) {
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragSourceRef = useRef(null);

  function handleDragOver(e, statusId, index) {
    e.preventDefault();
    setDragOverStatus(statusId);
    setDragOverIndex(index);
  }
  function handleDrop(e, statusId, index) {
    e.preventDefault();
    const caseId = e.dataTransfer.getData("text/plain");
    if (!caseId) return;

    const sourceCase = cases.find((c) => c.id === caseId);
    if (!sourceCase) return;

    if (sourceCase.status !== statusId) {
      // ステータス変更 + 挿入位置指定
      onStatusChange(caseId, statusId, index);
    } else if (index !== undefined) {
      // 同一列内の並び替え
      onReorder(caseId, statusId, index);
    }

    setDragOverStatus(null);
    setDragOverIndex(null);
    dragSourceRef.current = null;
  }
  function handleDragLeave() {
    setDragOverStatus(null);
    setDragOverIndex(null);
  }

  return (
    <div className="kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "start" }}>
      {STATUSES.map((s) => {
        const cols = cases.filter((c) => c.status === s.id);
        const isOver = dragOverStatus === s.id;
        return (
          <div key={s.id} className="kanban-column"
            onDragOver={(e) => handleDragOver(e, s.id, cols.length)}
            onDrop={(e) => handleDrop(e, s.id, dragOverIndex !== null ? dragOverIndex : cols.length)}
            onDragLeave={handleDragLeave}
            style={{ borderRadius: 10, padding: 6, minHeight: 80, transition: "background 0.15s",
              background: isOver ? s.bg : "transparent", border: isOver ? `2px dashed ${s.color}44` : "2px dashed transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot }} />
              <span style={{ fontWeight: 700, color: s.color, fontSize: fs(13), fontFamily: FONT_HEADING, letterSpacing: "0.03em" }}>{s.label}</span>
              <span style={{ background: s.bg, color: s.color, borderRadius: 10, padding: "0 6px", fontSize: fs(12), fontWeight: 700 }}>{cols.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {cols.map((c, i) => (
                <CaseCard key={c.id} c={c} fs={fs}
                  onClick={() => onSelect(c.id)}
                  isSelected={selectedId === c.id}
                  onStatusChange={onStatusChange}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverStatus(s.id); setDragOverIndex(i); }}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, s.id, i); }}
                  isDragOver={dragOverStatus === s.id && dragOverIndex === i}
                  onDragStart={() => { dragSourceRef.current = c.id; }}
                />
              ))}
              {cols.length === 0 && (
                <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: fs(12), padding: "16px 0" }}>
                  {isOver ? "ここにドロップ" : "なし"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaseCard({ c, fs, onClick, isSelected, onStatusChange, onDragOver, onDrop, isDragOver, onDragStart }) {
  const done = c.tasks.filter((t) => t.done).length;
  const total = c.tasks.length;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick} style={{
      background: "#fff", borderRadius: 12, padding: "11px 13px", cursor: "grab",
      border: isSelected ? "2px solid #6366f1" : isDragOver ? "2px solid #6366f144" : "2px solid transparent",
      borderTop: isDragOver ? "3px solid #6366f1" : undefined,
      boxShadow: isSelected ? "0 0 0 3px #6366f122" : "0 1px 6px #0000000a, 0 1px 2px #0000000a",
      transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      <div style={{ fontWeight: 700, color: "#1e1b4b", fontSize: fs(14), marginBottom: 5, fontFamily: FONT_HEADING }}>{c.name}</div>
      {c.deadline && <div style={{ marginBottom: 5 }}><DeadlineBadge date={c.deadline} fs={fs} /></div>}
      {total > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), color: "#94a3b8", marginBottom: 2 }}>
            <span>タスク</span><span>{done}/{total}</span>
          </div>
          <div style={{ height: 3, background: "#f1f5f9", borderRadius: 4 }}>
            <div style={{ height: 3, background: "#6366f1", borderRadius: 4, width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button key={s.id} onClick={(e) => { e.stopPropagation(); onStatusChange(c.id, s.id); }}
            style={{ padding: "2px 7px", fontSize: fs(11), borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 600,
              background: c.status === s.id ? s.bg : "#f1f5f9", color: c.status === s.id ? s.color : "#94a3b8" }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
