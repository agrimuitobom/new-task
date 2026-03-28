import { useState, useRef } from "react";
import { STATUSES } from "../constants";
import { useUI } from "../store/UIContext";
import DeadlineBadge from "./DeadlineBadge";
import s from "./KanbanView.module.css";

export default function KanbanView({ cases, onSelect, selectedId, onStatusChange, onReorder }) {
  const { fs } = useUI();
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
      onStatusChange(caseId, statusId, index);
    } else if (index !== undefined) {
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
    <div className={`${s.grid} kanban-grid`}>
      {STATUSES.map((st) => {
        const cols = cases.filter((c) => c.status === st.id);
        const isOver = dragOverStatus === st.id;
        return (
          <div key={st.id} className={`${s.column} kanban-column ${isOver ? s.columnOver : ""}`}
            onDragOver={(e) => handleDragOver(e, st.id, cols.length)}
            onDrop={(e) => handleDrop(e, st.id, dragOverIndex ?? cols.length)}
            onDragLeave={handleDragLeave}
            style={{ background: isOver ? st.bg : undefined, borderColor: isOver ? `${st.color}44` : undefined }}>
            <div className={s.columnHeader}>
              <div className={s.dot} style={{ background: st.dot }} />
              <span style={{ fontWeight: 700, color: st.color, fontSize: fs(13), fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>{st.label}</span>
              <span className={s.badge} style={{ background: st.bg, color: st.color, fontSize: fs(12) }}>{cols.length}</span>
            </div>
            <div className={s.cards}>
              {cols.map((c, i) => (
                <CaseCard key={c.id} c={c} fs={fs}
                  onClick={() => onSelect(c.id)}
                  isSelected={selectedId === c.id}
                  onStatusChange={onStatusChange}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverStatus(st.id); setDragOverIndex(i); }}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, st.id, i); }}
                  isDragOver={dragOverStatus === st.id && dragOverIndex === i}
                  onDragStart={() => { dragSourceRef.current = c.id; }}
                />
              ))}
              {cols.length === 0 && (
                <div className={s.emptyCol} style={{ fontSize: fs(12) }}>
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
      onClick={onClick}
      className={`${s.card} ${isSelected ? s.cardSelected : ""} ${isDragOver ? s.cardDragOver : ""}`}>
      <div className={s.cardTitle} style={{ fontSize: fs(14) }}>{c.name}</div>
      {(c.tags || []).length > 0 && (
        <div className={s.cardTags}>
          {(c.tags || []).map((tag) => <span key={tag} className={s.cardTag} style={{ fontSize: fs(9) }}>{tag}</span>)}
        </div>
      )}
      {c.deadline && <div style={{ marginBottom: 5 }}><DeadlineBadge date={c.deadline} fs={fs} /></div>}
      {total > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div className={s.progressRow} style={{ fontSize: fs(11) }}>
            <span>タスク</span><span>{done}/{total}</span>
          </div>
          <div className={s.progressTrack}>
            <div className={s.progressFill} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <div className={s.statusButtons}>
        {STATUSES.map((st) => (
          <button key={st.id} onClick={(e) => { e.stopPropagation(); onStatusChange(c.id, st.id); }}
            className={s.statusBtn}
            style={{ fontSize: fs(11), background: c.status === st.id ? st.bg : "#f1f5f9", color: c.status === st.id ? st.color : "#94a3b8" }}>
            {st.label}
          </button>
        ))}
      </div>
    </div>
  );
}
