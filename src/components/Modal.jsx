import { useState } from "react";
import { STATUSES } from "../constants";
import { useUI } from "../store/UIContext";
import s from "./Modal.module.css";

export function Modal({ onClose, title, children }) {
  return (
    <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.dialog}>
        <div className={s.header}>
          <span className={s.title}>{title}</span>
          <button onClick={onClose} className={s.closeBtn}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewCaseModal({ onAdd, onClose }) {
  const { fs } = useUI();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [deadline, setDeadline] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), status, deadline });
    onClose();
  }

  return (
    <Modal onClose={onClose} title="＋ 新規案件">
      <div className={s.form}>
        <div>
          <label className={s.inputLabel} style={{ fontSize: fs(11) }}>案件名 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus
            placeholder="例：〇〇事業補助金申請" className={s.textInput} style={{ fontSize: fs(14) }} />
        </div>
        <div>
          <label className={s.inputLabel} style={{ fontSize: fs(11) }}>初期ステータス</label>
          <div className={s.statusOptions}>
            {STATUSES.map((st) => (
              <button key={st.id} onClick={() => setStatus(st.id)} className={s.statusOption}
                style={{ fontSize: fs(13),
                  background: status === st.id ? st.bg : "#f1f5f9",
                  color: status === st.id ? st.color : "#94a3b8",
                  boxShadow: status === st.id ? `0 0 0 2px ${st.dot}88` : "none" }}>
                {st.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={s.inputLabel} style={{ fontSize: fs(11) }}>期限（任意）</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className={s.textInput} style={{ fontSize: fs(14) }} />
        </div>
        <button onClick={submit} className={s.submitBtn} style={{ fontSize: fs(15) }}>
          作成する
        </button>
      </div>
    </Modal>
  );
}
