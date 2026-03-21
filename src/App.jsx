import { useState, useEffect, useRef } from "react";

const STATUSES = [
  { id: "draft",    label: "起案",    color: "#6366f1", bg: "#eef2ff", dot: "#818cf8" },
  { id: "creating", label: "書類作成", color: "#d97706", bg: "#fffbeb", dot: "#fbbf24" },
  { id: "pending",  label: "承認待ち", color: "#0891b2", bg: "#ecfeff", dot: "#22d3ee" },
  { id: "done",     label: "完了",    color: "#059669", bg: "#ecfdf5", dot: "#34d399" },
];

const TASK_TEMPLATES = [
  "起案書作成", "稟議書作成", "申請書作成", "通知文作成",
  "上長確認", "関係部署連絡", "書類送付", "押印依頼",
];

const DOC_TEMPLATES = [
  {
    id: "ringi",
    name: "稟議書",
    body: `稟議書\n\n件名：〇〇について\n\n起案日：　　　年　　月　　日\n起案者：\n\n【目的・概要】\n\n\n【内容・詳細】\n\n\n【予算・費用】\n\n\n【スケジュール】\n\n\n【添付資料】\n`,
  },
  {
    id: "tsuchi",
    name: "通知文（外部向け）",
    body: `拝啓\n\n〇〇の候、貴社ますますご清祥のこととお慶び申し上げます。\n\nさて、このたびは下記の件についてご連絡申し上げます。\n\n記\n\n１．件名：\n\n２．内容：\n\n３．日程：\n\n４．その他：\n\n以上、よろしくお願いいたします。\n\n敬具\n\n〇〇年〇〇月〇〇日\n西条農業高等学校\n`,
  },
  {
    id: "houkoku",
    name: "報告書",
    body: `報告書\n\n件名：〇〇 実施報告\n\n報告日：　　　年　　月　　日\n報告者：\n\n【実施概要】\n・日時：\n・場所：\n・参加者：\n\n【実施内容】\n\n\n【結果・成果】\n\n\n【課題・改善点】\n\n\n【今後の対応】\n`,
  },
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function exportData(cases) {
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cases }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `案件管理_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function DeadlineBadge({ date }) {
  if (!date) return null;
  const d = daysUntil(date);
  let color = "#64748b", bg = "#f1f5f9", text = `${d}日後`;
  if (d < 0)        { color = "#dc2626"; bg = "#fef2f2"; text = `${Math.abs(d)}日超過`; }
  else if (d === 0) { color = "#dc2626"; bg = "#fef2f2"; text = "本日締切"; }
  else if (d <= 3)  { color = "#d97706"; bg = "#fffbeb"; }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 6, padding: "2px 7px", border: `1px solid ${color}22` }}>
      {text}
    </span>
  );
}

export default function App() {
  // アンドゥ対応の cases 履歴管理
  const [history, setHistory] = useState({ past: [], present: [] });
  const [view, setView]         = useState("kanban");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [kanbanSort, setKanbanSort]     = useState("default"); // "default" | "deadline"
  const importRef = useRef(null);

  const cases    = history.present;
  const canUndo  = history.past.length > 0;

  // localStorage 永続化（present のみ保存）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cases-v1");
      if (saved) setHistory({ past: [], present: JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cases-v1", JSON.stringify(history.present));
    } catch {}
  }, [history.present]);

  // Ctrl+Z / Cmd+Z でアンドゥ
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // cases 変更をアンドゥ履歴付きで実行
  function setCases(updater) {
    setHistory(h => ({
      past: [...h.past.slice(-19), h.present],
      present: typeof updater === "function" ? updater(h.present) : updater,
    }));
  }

  function undo() {
    setHistory(h => {
      if (h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] };
    });
  }

  const selectedCase = cases.find((c) => c.id === selected);

  function addCase(data) {
    setCases((prev) => [...prev, { id: genId(), tasks: [], note: "", ...data }]);
  }
  function updateCase(id, patch) {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteCase(id) {
    setCases((prev) => prev.filter((c) => c.id !== id));
    if (selected === id) setSelected(null);
  }
  function addTask(caseId, label) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, tasks: [...c.tasks, { id: genId(), label, done: false }] } : c
      )
    );
  }
  function toggleTask(caseId, taskId) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : c
      )
    );
  }
  function deleteTask(caseId, taskId) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) } : c
      )
    );
  }
  function copyTemplate(body) {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedId(body);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  // JSON インポート
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cases && Array.isArray(data.cases)) {
          if (window.confirm(`${data.cases.length}件の案件を現在のデータに追加します。よろしいですか？`)) {
            setCases((prev) => [...prev, ...data.cases]);
          }
        } else {
          alert("無効なファイル形式です");
        }
      } catch {
        alert("ファイルの読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // 検索・フィルタ後の案件一覧
  const filteredCases = cases.filter((c) => {
    const matchSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const urgentCount = cases.filter((c) => {
    const d = daysUntil(c.deadline);
    return c.status !== "done" && d !== null && d <= 3;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8f7f4", fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1e1b4b", color: "#fff", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, flexShrink: 0, boxShadow: "0 2px 12px #1e1b4b44", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#818cf8,#6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📋</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>案件管理</span>
          {urgentCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>⚠ {urgentCount}件</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {canUndo && (
            <button onClick={undo} title="元に戻す (Ctrl+Z)" style={btnStyle("#374151", "#d1d5db")}>↩ 元に戻す</button>
          )}
          <button onClick={() => exportData(cases)} style={btnStyle("#0f766e", "#fff")}>⬇ エクスポート</button>
          <button onClick={() => importRef.current?.click()} style={btnStyle("#374151", "#d1d5db")}>⬆ インポート</button>
          <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
          <button onClick={() => setShowTemplate(true)} style={btnStyle("#3730a3", "#fff")}>📄 テンプレ</button>
          <button onClick={() => { setShowNew(true); setSelected(null); }} style={btnStyle("#6366f1", "#fff")}>＋ 新規</button>
          <button onClick={() => setView(v => v === "kanban" ? "list" : "kanban")} style={btnStyle("#312e81", "#a5b4fc")}>
            {view === "kanban" ? "≡" : "⊞"}
          </button>
        </div>
      </div>

      {/* 検索・フィルターバー */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 案件名で検索…"
          style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 11px", fontSize: 12, outline: "none", width: 180, color: "#1e1b4b" }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setFilterStatus("all")}
            style={filterBtnStyle(filterStatus === "all", "#6366f1", "#fff", "#f1f5f9", "#64748b")}>すべて</button>
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => setFilterStatus(s.id)}
              style={filterBtnStyle(filterStatus === s.id, s.bg, s.color, "#f1f5f9", "#64748b", s.dot)}>
              {s.label}
            </button>
          ))}
        </div>
        {view === "kanban" && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>並び順:</span>
            <button onClick={() => setKanbanSort("default")}
              style={filterBtnStyle(kanbanSort === "default", "#6366f1", "#fff", "#f1f5f9", "#64748b")}>標準</button>
            <button onClick={() => setKanbanSort("deadline")}
              style={filterBtnStyle(kanbanSort === "deadline", "#6366f1", "#fff", "#f1f5f9", "#64748b")}>期限順</button>
          </div>
        )}
        {(searchQuery || filterStatus !== "all") && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filteredCases.length}件 / 全{cases.length}件
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                style={{ marginLeft: 6, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>✕ クリア</button>
            )}
          </span>
        )}
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {view === "kanban" ? (
            <KanbanView cases={filteredCases} onSelect={setSelected} selectedId={selected}
              onStatusChange={(id, s) => updateCase(id, { status: s })} sortBy={kanbanSort} />
          ) : (
            <ListView cases={filteredCases} onSelect={setSelected} selectedId={selected} />
          )}
        </div>

        {selectedCase && (
          <DetailPanel
            c={selectedCase}
            onUpdate={(patch) => updateCase(selectedCase.id, patch)}
            onDelete={() => deleteCase(selectedCase.id)}
            onClose={() => setSelected(null)}
            onAddTask={(label) => addTask(selectedCase.id, label)}
            onToggleTask={(tid) => toggleTask(selectedCase.id, tid)}
            onDeleteTask={(tid) => deleteTask(selectedCase.id, tid)}
          />
        )}
      </div>

      {showNew && <NewCaseModal onAdd={addCase} onClose={() => setShowNew(false)} />}

      {showTemplate && (
        <Modal onClose={() => setShowTemplate(false)} title="📄 書類テンプレート">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DOC_TEMPLATES.map((t) => (
              <div key={t.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: "#1e1b4b" }}>{t.name}</span>
                  <button onClick={() => copyTemplate(t.body)} style={btnStyle(copiedId === t.body ? "#059669" : "#6366f1", "#fff")}>
                    {copiedId === t.body ? "✓ コピー済" : "📋 コピー"}
                  </button>
                </div>
                <pre style={{ fontSize: 11, color: "#64748b", whiteSpace: "pre-wrap", background: "#f8f7f4", borderRadius: 6, padding: 8, maxHeight: 100, overflow: "auto", margin: 0 }}>
                  {t.body.slice(0, 180)}…
                </pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function KanbanView({ cases, onSelect, selectedId, onStatusChange, sortBy }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "start" }}>
      {STATUSES.map((s) => {
        let cols = cases.filter((c) => c.status === s.id);
        if (sortBy === "deadline") {
          cols = [...cols].sort((a, b) => {
            const da = a.deadline ? new Date(a.deadline) : new Date("9999");
            const db = b.deadline ? new Date(b.deadline) : new Date("9999");
            return da - db;
          });
        }
        return (
          <div key={s.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot }} />
              <span style={{ fontWeight: 700, color: s.color, fontSize: 12 }}>{s.label}</span>
              <span style={{ background: s.bg, color: s.color, borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700 }}>{cols.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {cols.map((c) => (
                <CaseCard key={c.id} c={c} onClick={() => onSelect(c.id)} isSelected={selectedId === c.id} onStatusChange={onStatusChange} />
              ))}
              {cols.length === 0 && (
                <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 12, padding: "16px 0" }}>なし</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ cases, onSelect, selectedId }) {
  const sorted = [...cases].sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline) : new Date("9999");
    const db = b.deadline ? new Date(b.deadline) : new Date("9999");
    return da - db;
  });
  return (
    <div style={{ maxWidth: 800 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            {["案件名", "ステータス", "期限", "タスク"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const st = STATUSES.find((s) => s.id === c.status);
            const done = c.tasks.filter((t) => t.done).length;
            return (
              <tr key={c.id} onClick={() => onSelect(c.id)}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selectedId === c.id ? "#eef2ff" : "transparent" }}>
                <td style={{ padding: "10px", fontWeight: 600, color: "#1e1b4b", fontSize: 13 }}>{c.name}</td>
                <td style={{ padding: "10px" }}>
                  <span style={{ background: st?.bg, color: st?.color, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{st?.label}</span>
                </td>
                <td style={{ padding: "10px" }}><DeadlineBadge date={c.deadline} /></td>
                <td style={{ padding: "10px", fontSize: 12, color: "#64748b" }}>{c.tasks.length > 0 ? `${done}/${c.tasks.length}` : "—"}</td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "#cbd5e1", padding: 40 }}>案件がありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CaseCard({ c, onClick, isSelected, onStatusChange }) {
  const done = c.tasks.filter((t) => t.done).length;
  const total = c.tasks.length;
  return (
    <div onClick={onClick} style={{
      background: "#fff", borderRadius: 12, padding: "11px 13px", cursor: "pointer",
      border: isSelected ? "2px solid #6366f1" : "2px solid transparent",
      boxShadow: isSelected ? "0 0 0 3px #6366f122" : "0 1px 4px #00000010",
    }}>
      <div style={{ fontWeight: 700, color: "#1e1b4b", fontSize: 13, marginBottom: 5 }}>{c.name}</div>
      {c.deadline && <div style={{ marginBottom: 5 }}><DeadlineBadge date={c.deadline} /></div>}
      {total > 0 && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>
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
            style={{ padding: "2px 7px", fontSize: 10, borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 600,
              background: c.status === s.id ? s.bg : "#f1f5f9", color: c.status === s.id ? s.color : "#94a3b8" }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ c, onUpdate, onDelete, onClose, onAddTask, onToggleTask, onDeleteTask }) {
  const [newTask, setNewTask] = useState("");
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(c.name);
  const [noteVal, setNoteVal] = useState(c.note || "");

  useEffect(() => { setNameVal(c.name); setNoteVal(c.note || ""); }, [c.id]);

  function handleNameBlur() {
    const trimmed = nameVal.trim();
    if (!trimmed) {
      setNameVal(c.name); // 空なら元に戻す
    } else {
      onUpdate({ name: trimmed });
    }
    setEditName(false);
  }

  function handleDeleteTask(tid, label) {
    if (window.confirm(`タスク「${label}」を削除しますか？`)) {
      onDeleteTask(tid);
    }
  }

  return (
    <div style={{ width: 300, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 18, overflow: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        {editName ? (
          <input value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => { if (e.key === "Enter") handleNameBlur(); if (e.key === "Escape") { setNameVal(c.name); setEditName(false); } }}
            autoFocus
            style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", border: "none", borderBottom: "2px solid #6366f1", outline: "none", width: "100%" }} />
        ) : (
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b", cursor: "pointer", flex: 1 }} onClick={() => setEditName(true)}>
            {c.name} <span style={{ fontSize: 10, color: "#94a3b8" }}>✏</span>
          </div>
        )}
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", padding: 0, marginLeft: 8 }}>×</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>ステータス</label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => onUpdate({ status: s.id })}
              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
                background: c.status === s.id ? s.bg : "#f1f5f9", color: c.status === s.id ? s.color : "#94a3b8",
                boxShadow: c.status === s.id ? `0 0 0 2px ${s.dot}88` : "none" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>期限</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="date" value={c.deadline || ""} onChange={(e) => onUpdate({ deadline: e.target.value })}
            style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, color: "#1e1b4b", outline: "none" }} />
          <DeadlineBadge date={c.deadline} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>タスク ({c.tasks.filter(t => t.done).length}/{c.tasks.length})</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 7 }}>
          {c.tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)}
                style={{ accentColor: "#6366f1", width: 14, height: 14, cursor: "pointer" }} />
              <span style={{ flex: 1, fontSize: 12, color: t.done ? "#94a3b8" : "#1e1b4b", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
              <button onClick={() => handleDeleteTask(t.id, t.label)}
                title="タスクを削除"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 13, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
          {TASK_TEMPLATES.map((tl) => (
            <button key={tl} onClick={() => onAddTask(tl)}
              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8f7f4", color: "#64748b", cursor: "pointer" }}>
              + {tl}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            placeholder="タスクを入力… Enter"
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, outline: "none" }} />
          <button onClick={() => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
            style={btnStyle("#6366f1", "#fff")}>追加</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>メモ</label>
        <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} onBlur={() => onUpdate({ note: noteVal })}
          rows={4} placeholder="案件に関するメモ…"
          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 9px", fontSize: 12, color: "#1e1b4b", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      </div>

      <button onClick={() => { if (window.confirm("この案件を削除しますか？")) onDelete(); }}
        style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
        🗑 この案件を削除
      </button>
    </div>
  );
}

function NewCaseModal({ onAdd, onClose }) {
  const [name, setName]         = useState("");
  const [status, setStatus]     = useState("draft");
  const [deadline, setDeadline] = useState("");
  const [error, setError]       = useState("");

  function submit() {
    if (!name.trim()) {
      setError("案件名を入力してください");
      return;
    }
    onAdd({ name: name.trim(), status, deadline });
    onClose();
  }

  return (
    <Modal onClose={onClose} title="＋ 新規案件">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>案件名 *</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus
            placeholder="例：〇〇事業補助金申請"
            style={{ ...inputStyle, borderColor: error ? "#dc2626" : "#e2e8f0" }} />
          {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{error}</div>}
        </div>
        <div>
          <label style={labelStyle}>初期ステータス</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <button key={s.id} onClick={() => setStatus(s.id)}
                style={{ padding: "4px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  background: status === s.id ? s.bg : "#f1f5f9", color: status === s.id ? s.color : "#94a3b8",
                  boxShadow: status === s.id ? `0 0 0 2px ${s.dot}88` : "none" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>期限（任意）</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={submit}
          style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
          作成する
        </button>
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000050", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 440, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px #00000030" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" };
const inputStyle = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", color: "#1e1b4b" };

function btnStyle(bg, color) {
  return { background: bg, color, border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
}

function filterBtnStyle(active, activeBg, activeColor, inactiveBg, inactiveColor, dot) {
  return {
    padding: "3px 10px", fontSize: 11, borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600,
    background: active ? activeBg : inactiveBg,
    color: active ? activeColor : inactiveColor,
    outline: active && dot ? `2px solid ${dot}88` : "none",
  };
}
