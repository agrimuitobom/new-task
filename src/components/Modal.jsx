import { useState } from "react";
import { STATUSES, FONT_HEADING, FONT_BODY } from "../constants";
import { labelStyleFn, inputStyleFn, btnStyle } from "../styles";

export function Modal({ onClose, title, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000050", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 440, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px #00000025, 0 4px 16px #0000000f", fontFamily: FONT_BODY }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", fontFamily: FONT_HEADING }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewCaseModal({ fs, onAdd, onClose }) {
  const [name, setName]       = useState("");
  const [status, setStatus]   = useState("draft");
  const [deadline, setDeadline] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), status, deadline });
    onClose();
  }

  return (
    <Modal onClose={onClose} title="＋ 新規案件">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyleFn(fs)}>案件名 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus
            placeholder="例：〇〇事業補助金申請" style={inputStyleFn(fs)} />
        </div>
        <div>
          <label style={labelStyleFn(fs)}>初期ステータス</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <button key={s.id} onClick={() => setStatus(s.id)}
                style={{ padding: "4px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, fontSize: fs(13),
                  background: status === s.id ? s.bg : "#f1f5f9", color: status === s.id ? s.color : "#94a3b8",
                  boxShadow: status === s.id ? `0 0 0 2px ${s.dot}88` : "none" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyleFn(fs)}>期限（任意）</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyleFn(fs)} />
        </div>
        <button onClick={submit}
          style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: fs(15), fontWeight: 700, cursor: "pointer", marginTop: 4, fontFamily: FONT_HEADING, letterSpacing: "0.05em", boxShadow: "0 2px 8px #6366f133" }}>
          作成する
        </button>
      </div>
    </Modal>
  );
}
