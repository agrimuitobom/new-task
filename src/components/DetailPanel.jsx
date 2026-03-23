import { useState, useEffect, useRef } from "react";
import { STATUSES, TASK_TEMPLATES, DEFAULT_TAGS, genId } from "../constants";
import { useUI } from "../store/UIContext";
import { useCases } from "../store/CaseContext";
import DeadlineBadge from "./DeadlineBadge";
import s from "./DetailPanel.module.css";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export default function DetailPanel({ c, onClose }) {
  const { fs } = useUI();
  const { dispatch } = useCases();
  const caseId = c.id;

  const [newTask, setNewTask] = useState("");
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(c.name);
  const [noteVal, setNoteVal] = useState(c.note || "");
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [commentText, setCaseComment] = useState("");
  const [customTag, setCustomTag] = useState("");
  const caseFileRef = useRef(null);
  const dragSrcIdx = useRef(null);
  const tags = c.tags || [];

  useEffect(() => { setNameVal(c.name); setNoteVal(c.note || ""); }, [c.id]);

  function onUpdate(patch) { dispatch({ type: "UPDATE", id: caseId, patch }); }
  function onAddTask(label) { dispatch({ type: "ADD_TASK", caseId, label }); }
  function onToggleTask(taskId) { dispatch({ type: "TOGGLE_TASK", caseId, taskId }); }
  function onUpdateTask(taskId, patch) { dispatch({ type: "UPDATE_TASK", caseId, taskId, patch }); }
  function onDeleteTask(taskId) { dispatch({ type: "DELETE_TASK", caseId, taskId }); }

  function handleTaskDragStart(e, idx) {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }
  function handleTaskDragOver(e, idx) { e.preventDefault(); setDragOverIdx(idx); }
  function handleTaskDrop(e, toIdx) {
    e.preventDefault();
    const fromIdx = dragSrcIdx.current;
    if (fromIdx !== null && fromIdx !== toIdx) {
      dispatch({ type: "REORDER_TASKS", caseId, fromIdx, toIdx });
    }
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }
  function handleTaskDragEnd() { dragSrcIdx.current = null; setDragOverIdx(null); }

  return (
    <div className={`${s.panel} detail-panel`}>
      {/* Title */}
      <div className={s.header}>
        {editName ? (
          <input value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={() => { onUpdate({ name: nameVal }); setEditName(false); }} autoFocus
            className={s.editInput} style={{ fontSize: fs(15) }} />
        ) : (
          <div className={s.caseName} style={{ fontSize: fs(15) }} onClick={() => setEditName(true)}>
            {c.name} <span style={{ fontSize: fs(10), color: "var(--c-faint)" }}>✏</span>
          </div>
        )}
        <button onClick={onClose} className={s.closeBtn}>×</button>
      </div>

      {/* Status */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>ステータス</label>
        <div className={s.statusBtns}>
          {STATUSES.map((st) => (
            <button key={st.id} onClick={() => onUpdate({ status: st.id })} className={s.statusBtn}
              style={{ fontSize: fs(12), background: c.status === st.id ? st.bg : "#f1f5f9", color: c.status === st.id ? st.color : "#94a3b8",
                boxShadow: c.status === st.id ? `0 0 0 2px ${st.dot}88` : "none" }}>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>タグ</label>
        <div className={s.tagList}>
          {tags.map((tag) => (
            <span key={tag} className={s.tag} style={{ fontSize: fs(11) }}>
              {tag}
              <button onClick={() => onUpdate({ tags: tags.filter((t) => t !== tag) })} className={s.tagRemove}>×</button>
            </span>
          ))}
        </div>
        <div className={s.tagAdd}>
          {DEFAULT_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((tag) => (
            <button key={tag} onClick={() => onUpdate({ tags: [...tags, tag] })} className={s.tagSuggest} style={{ fontSize: fs(10) }}>
              + {tag}
            </button>
          ))}
        </div>
        <div className={s.tagCustomRow}>
          <input value={customTag} onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customTag.trim() && !tags.includes(customTag.trim())) {
                onUpdate({ tags: [...tags, customTag.trim()] });
                setCustomTag("");
              }
            }}
            placeholder="カスタムタグ… Enter" className={s.tagCustomInput} style={{ fontSize: fs(11) }} />
        </div>
      </div>

      {/* Start date */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>開始日</label>
        <input type="date" value={c.startDate || ""} onChange={(e) => onUpdate({ startDate: e.target.value })}
          className={s.dateInput} style={{ fontSize: fs(13) }} />
      </div>

      {/* Deadline */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>期限</label>
        <div className={s.dateRow}>
          <input type="date" value={c.deadline || ""} onChange={(e) => onUpdate({ deadline: e.target.value })}
            className={s.dateInput} style={{ fontSize: fs(13) }} />
          <DeadlineBadge date={c.deadline} fs={fs} />
        </div>
      </div>

      {/* Tasks */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>タスク ({c.tasks.filter((t) => t.done).length}/{c.tasks.length})</label>
        <div className={s.taskList}>
          {c.tasks.map((t, idx) => (
            <TaskItem key={t.id} t={t} idx={idx} fs={fs} caseId={caseId}
              dragOverIdx={dragOverIdx}
              onDragStart={handleTaskDragStart}
              onDragOver={handleTaskDragOver}
              onDrop={handleTaskDrop}
              onDragEnd={handleTaskDragEnd}
              onToggle={() => onToggleTask(t.id)}
              onDelete={() => onDeleteTask(t.id)}
              onUpdateTask={(patch) => onUpdateTask(t.id, patch)}
            />
          ))}
        </div>
        <div className={s.quickAdd}>
          {TASK_TEMPLATES.map((tl) => (
            <button key={tl} onClick={() => onAddTask(tl)} className={s.quickAddBtn} style={{ fontSize: fs(11) }}>
              + {tl}
            </button>
          ))}
        </div>
        <div className={s.addRow}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            placeholder="タスクを入力… Enter" className={s.addInput} style={{ fontSize: fs(13) }} />
          <button onClick={() => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            className={s.addBtn} style={{ fontSize: 13 }}>追加</button>
        </div>
      </div>

      {/* Note */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>メモ</label>
        <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} onBlur={() => onUpdate({ note: noteVal })}
          rows={3} placeholder="案件に関するメモ…" className={s.noteArea} style={{ fontSize: fs(13) }} />
      </div>

      {/* Attachments */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>添付ファイル ({(c.attachments || []).length})</label>
        {(c.attachments || []).length > 0 && (
          <div className={s.caseAttachList}>
            {(c.attachments || []).map((a) => (
              <div key={a.id} className={s.caseAttachItem}>
                <a href={a.dataUrl} download={a.name} className={s.caseAttachLink} style={{ fontSize: fs(12) }}>
                  {a.type?.startsWith("image/") ? "🖼" : "📎"} {a.name}
                </a>
                <span className={s.caseAttachMeta} style={{ fontSize: fs(10) }}>{formatSize(a.size)}</span>
                <button onClick={() => dispatch({ type: "DELETE_CASE_ATTACHMENT", caseId, attachmentId: a.id })}
                  className={s.caseAttachDelete}>×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => caseFileRef.current?.click()} className={s.caseAttachBtn} style={{ fontSize: fs(12) }}>
          + ファイルを追加
        </button>
        <input ref={caseFileRef} type="file" onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) { alert("5MB以下のファイルを選択してください"); return; }
          const reader = new FileReader();
          reader.onload = (ev) => {
            dispatch({ type: "ADD_CASE_ATTACHMENT", caseId, name: file.name, size: file.size, type: file.type, dataUrl: ev.target.result });
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }} style={{ display: "none" }} />
      </div>

      {/* Comments */}
      <div className={s.section}>
        <label className={s.label} style={{ fontSize: fs(11) }}>コメント ({(c.comments || []).length})</label>
        {(c.comments || []).length > 0 && (
          <div className={s.caseCommentList}>
            {(c.comments || []).map((cm) => (
              <div key={cm.id} className={s.caseCommentItem}>
                <div className={s.caseCommentBody}>
                  <span className={s.caseCommentText} style={{ fontSize: fs(12) }}>{cm.text}</span>
                  <span className={s.caseCommentTime} style={{ fontSize: fs(10) }}>{formatTime(cm.createdAt)}</span>
                </div>
                <button onClick={() => dispatch({ type: "DELETE_CASE_COMMENT", caseId, commentId: cm.id })}
                  className={s.caseCommentDelete}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className={s.caseCommentAdd}>
          <input value={commentText} onChange={(e) => setCaseComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commentText.trim()) {
                dispatch({ type: "ADD_CASE_COMMENT", caseId, text: commentText.trim() });
                setCaseComment("");
              }
            }}
            placeholder="コメントを入力… Enter" className={s.caseCommentInput} style={{ fontSize: fs(12) }} />
        </div>
      </div>

      {/* Archive / Delete */}
      <div className={s.section} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => { onUpdate({ archived: !c.archived }); if (!c.archived) onClose(); }}
          className={s.archiveBtn} style={{ fontSize: fs(13) }}>
          {c.archived ? "📂 アーカイブから戻す" : "📦 アーカイブする"}
        </button>
        <button onClick={() => { if (window.confirm("この案件を削除しますか？")) { dispatch({ type: "DELETE", id: caseId }); onClose(); } }}
          className={s.deleteBtn} style={{ fontSize: fs(13) }}>
          🗑 この案件を削除
        </button>
      </div>
    </div>
  );
}

/* ── Task item with comments & attachments ── */
function TaskItem({ t, idx, fs, caseId, dragOverIdx, onDragStart, onDragOver, onDrop, onDragEnd, onToggle, onDelete, onUpdateTask }) {
  const { dispatch } = useCases();
  const [commentText, setCommentText] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef(null);

  const comments = t.comments || [];
  const attachments = t.attachments || [];

  function addComment() {
    if (!commentText.trim()) return;
    dispatch({ type: "ADD_COMMENT", caseId, taskId: t.id, text: commentText.trim() });
    setCommentText("");
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("5MB以下のファイルを選択してください"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      dispatch({ type: "ADD_ATTACHMENT", caseId, taskId: t.id, name: file.name, size: file.size, type: file.type, dataUrl: ev.target.result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  }

  function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, idx)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDrop={(e) => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      className={`${s.taskItem} ${t.done ? s.taskDone : ""} ${dragOverIdx === idx ? s.taskDragOver : ""}`}>
      <div className={s.taskRow}>
        <span className={s.dragHandle}>⠿</span>
        <input type="checkbox" checked={t.done} onChange={onToggle} className={s.taskCheckbox} />
        <span className={`${s.taskLabel} ${t.done ? s.taskLabelDone : ""}`} style={{ fontSize: fs(13), color: t.done ? undefined : "var(--c-text)" }}>
          {t.label}
        </span>
        <button onClick={() => setShowDetail((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 11, padding: 0, flexShrink: 0 }}
          title="コメント・添付">
          {(comments.length > 0 || attachments.length > 0) ? `💬${comments.length + attachments.length}` : "💬"}
        </button>
        <button onClick={onDelete} className={s.taskDeleteBtn}>×</button>
      </div>

      {/* Task dates */}
      <div className={s.taskDates}>
        <input type="date" value={t.startDate || ""} onChange={(e) => onUpdateTask({ startDate: e.target.value })}
          title="開始日" className={s.taskDateInput} style={{ fontSize: fs(11) }} />
        <span className={s.taskDateArrow} style={{ fontSize: fs(11) }}>→</span>
        <input type="date" value={t.deadline || ""} onChange={(e) => onUpdateTask({ deadline: e.target.value })}
          title="期限" className={s.taskDateInput} style={{ fontSize: fs(11) }} />
      </div>

      {/* Comments & Attachments (collapsible) */}
      {showDetail && (
        <div className={s.commentSection}>
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className={s.attachmentList}>
              {attachments.map((a) => (
                <div key={a.id} className={s.attachmentItem}>
                  <a href={a.dataUrl} download={a.name} className={s.attachmentLink} style={{ fontSize: fs(11) }} title={a.name}>
                    📎 {a.name}
                  </a>
                  <span className={s.attachmentSize} style={{ fontSize: fs(10) }}>{formatSize(a.size)}</span>
                  <button onClick={() => dispatch({ type: "DELETE_ATTACHMENT", caseId, taskId: t.id, attachmentId: a.id })}
                    className={s.attachmentDeleteBtn}>×</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => fileRef.current?.click()} className={s.attachBtn} style={{ fontSize: fs(11), marginBottom: 4 }}>
            📎 ファイル添付
          </button>
          <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />

          {/* Comments */}
          {comments.length > 0 && (
            <div className={s.commentList}>
              {comments.map((cm) => (
                <div key={cm.id} className={s.commentItem}>
                  <span className={s.commentText} style={{ fontSize: fs(11) }}>{cm.text}</span>
                  <span className={s.commentTime} style={{ fontSize: fs(9) }}>{formatTime(cm.createdAt)}</span>
                  <button onClick={() => dispatch({ type: "DELETE_COMMENT", caseId, taskId: t.id, commentId: cm.id })}
                    className={s.commentDeleteBtn}>×</button>
                </div>
              ))}
            </div>
          )}

          <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
            placeholder="コメント… Enter" className={s.commentInput} style={{ fontSize: fs(11) }} />
        </div>
      )}
    </div>
  );
}
