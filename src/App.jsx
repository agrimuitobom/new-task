import { useState, useEffect, useRef, useCallback } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from "firebase/firestore";

import { FONT_HEADING, FONT_BODY, FONT_SCALES, STATUSES, DOC_TEMPLATES, genId, daysUntil } from "./constants";
import { btnStyle, InjectMobileCSS } from "./styles";
import KanbanView from "./components/KanbanView";
import ListView from "./components/ListView";
import GanttView from "./components/GanttView";
import DetailPanel from "./components/DetailPanel";
import { Modal, NewCaseModal } from "./components/Modal";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cases, setCases]       = useState([]);
  const [view, setView]         = useState("kanban");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortKey, setSortKey] = useState("deadline");
  const [fontScale, setFontScale] = useState(() => {
    try { return parseFloat(localStorage.getItem("fontScale")) || 1.15; } catch { return 1.15; }
  });
  const fs = useCallback((base) => Math.round(base * fontScale), [fontScale]);
  function cycleFontScale() {
    setFontScale((prev) => {
      const idx = FONT_SCALES.findIndex((s) => s.value === prev);
      const next = FONT_SCALES[(idx + 1) % FONT_SCALES.length].value;
      try { localStorage.setItem("fontScale", String(next)); } catch {}
      return next;
    });
  }

  // Firebase Auth 監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  function handleLogin() {
    signInWithPopup(auth, googleProvider).catch((err) => {
      console.error("Login failed:", err);
    });
  }
  async function handleLogout() {
    await signOut(auth);
    setCases([]);
    setSelected(null);
  }

  // Undo/Redo 履歴管理
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((snapshot) => {
    if (isUndoRedoRef.current) return;
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(JSON.stringify(snapshot));
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    isUndoRedoRef.current = true;
    setCases(JSON.parse(historyRef.current[historyIndexRef.current]));
    isUndoRedoRef.current = false;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    isUndoRedoRef.current = true;
    setCases(JSON.parse(historyRef.current[historyIndexRef.current]));
    isUndoRedoRef.current = false;
  }, []);

  // Ctrl+Z / Ctrl+Shift+Z キーボードショートカット
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Firestore リアルタイム同期（ログイン時）/ localStorage（未ログイン時）
  const firestoreSkipRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        const saved = localStorage.getItem("cases-v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          setCases(parsed);
          historyRef.current = [JSON.stringify(parsed)];
          historyIndexRef.current = 0;
        }
      } catch {}
      return;
    }
    const colRef = collection(db, "users", user.uid, "cases");
    const unsub = onSnapshot(colRef, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      firestoreSkipRef.current = true;
      setCases(data);
      historyRef.current = [JSON.stringify(data)];
      historyIndexRef.current = 0;
      firestoreSkipRef.current = false;
    }, (err) => {
      console.error("Firestore sync error:", err);
    });
    return unsub;
  }, [user, authLoading]);

  // cases変更時にFirestore/localStorageに保存
  useEffect(() => {
    if (authLoading) return;
    pushHistory(cases);
    if (!user) {
      try { localStorage.setItem("cases-v1", JSON.stringify(cases)); } catch {}
      return;
    }
    if (firestoreSkipRef.current) return;
    const colRef = collection(db, "users", user.uid, "cases");
    cases.forEach((c) => {
      const { id, ...data } = c;
      setDoc(doc(colRef, id), data).catch(() => {});
    });
  }, [cases, user, authLoading, pushHistory]);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [notifyEnabled, setNotifyEnabled] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  const checkAndNotify = useCallback((caseList) => {
    if (Notification.permission !== "granted") return;
    const urgent = caseList.filter((c) => {
      if (c.status === "done") return false;
      const d = daysUntil(c.deadline);
      return d !== null && d <= 3;
    });
    if (urgent.length === 0) return;
    const notifiedKey = "notified-date";
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(notifiedKey) === today) return; } catch {}
    const body = urgent.map((c) => {
      const d = daysUntil(c.deadline);
      const label = d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? "本日締切" : `あと${d}日`;
      return `・${c.name}（${label}）`;
    }).join("\n");
    new Notification("案件管理 - 期限通知", { body, icon: "./icon-192.png" });
    try { localStorage.setItem(notifiedKey, today); } catch {}
  }, []);

  function requestNotification() {
    if (!("Notification" in window)) { alert("このブラウザは通知に対応していません"); return; }
    Notification.requestPermission().then((perm) => {
      setNotifyEnabled(perm === "granted");
      if (perm === "granted") checkAndNotify(cases);
    });
  }

  const initialNotifyDone = useRef(false);
  useEffect(() => {
    if (cases.length > 0 && !initialNotifyDone.current) {
      initialNotifyDone.current = true;
      checkAndNotify(cases);
    }
  }, [cases, checkAndNotify]);

  useEffect(() => {
    if (Notification.permission !== "granted") return;
    const interval = setInterval(() => checkAndNotify(cases), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cases, checkAndNotify]);

  const [showDataMenu, setShowDataMenu] = useState(false);
  const fileInputRef = useRef(null);

  function exportData() {
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `案件データ_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDataMenu(false);
  }

  function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          setCases(data);
          setSelected(null);
          if (user) {
            const colRef = collection(db, "users", user.uid, "cases");
            const batch = writeBatch(db);
            data.forEach((c) => { const { id, ...rest } = c; batch.set(doc(colRef, id), rest); });
            batch.commit().catch(() => {});
          }
        } else {
          alert("無効なデータ形式です");
        }
      } catch {
        alert("JSONの読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
    setShowDataMenu(false);
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
    if (user) deleteDoc(doc(db, "users", user.uid, "cases", id)).catch(() => {});
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
  function updateTask(caseId, taskId, patch) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : c
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
  function reorderTasks(caseId, fromIdx, toIdx) {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const tasks = [...c.tasks];
        const [moved] = tasks.splice(fromIdx, 1);
        tasks.splice(toIdx, 0, moved);
        return { ...c, tasks };
      })
    );
  }
  function copyTemplate(body) {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedId(body);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  // カンバン列内の並び替え
  function handleKanbanReorder(caseId, statusId, toIndex) {
    setCases((prev) => {
      const caseItem = prev.find((c) => c.id === caseId);
      if (!caseItem) return prev;
      const withoutItem = prev.filter((c) => c.id !== caseId);
      // 同じステータスの案件の中での挿入位置を計算
      const sameStatus = withoutItem.filter((c) => c.status === statusId);
      const others = withoutItem.filter((c) => c.status !== statusId);
      sameStatus.splice(toIndex, 0, { ...caseItem, status: statusId });
      return [...others, ...sameStatus];
    });
  }

  // カンバンでステータス変更 + 挿入位置指定
  function handleStatusChangeWithPosition(caseId, newStatus, insertIndex) {
    setCases((prev) => {
      const caseItem = prev.find((c) => c.id === caseId);
      if (!caseItem) return prev;
      const withoutItem = prev.filter((c) => c.id !== caseId);
      const sameStatus = withoutItem.filter((c) => c.status === newStatus);
      const others = withoutItem.filter((c) => c.status !== newStatus);
      const idx = insertIndex !== undefined ? insertIndex : sameStatus.length;
      sameStatus.splice(idx, 0, { ...caseItem, status: newStatus });
      return [...others, ...sameStatus];
    });
  }

  const filteredCases = cases.filter((c) => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortKey === "deadline") {
      const da = a.deadline ? new Date(a.deadline) : new Date("9999");
      const dbv = b.deadline ? new Date(b.deadline) : new Date("9999");
      return da - dbv;
    }
    if (sortKey === "name") return a.name.localeCompare(b.name, "ja");
    if (sortKey === "created") return (a.id > b.id ? 1 : -1);
    if (sortKey === "created_desc") return (a.id < b.id ? 1 : -1);
    // manual: preserve current order
    return 0;
  });

  const urgentCount = cases.filter((c) => {
    const d = daysUntil(c.deadline);
    return c.status !== "done" && d !== null && d <= 3;
  }).length;

  // ログイン画面
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6", fontFamily: FONT_BODY }}>
        <div style={{ textAlign: "center", color: "#64748b", fontSize: fs(14) }}>読み込み中…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6", fontFamily: FONT_BODY }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: "44px 40px", boxShadow: "0 8px 32px #0000000f, 0 2px 8px #0000000a", textAlign: "center", maxWidth: 380, border: "1px solid #f0ede8" }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#818cf8,#6366f1)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 18px", boxShadow: "0 4px 12px #6366f133" }}>📋</div>
          <h1 style={{ fontSize: fs(22), fontWeight: 700, color: "#1e1b4b", margin: "0 0 8px", fontFamily: FONT_HEADING }}>案件管理</h1>
          <p style={{ fontSize: fs(14), color: "#64748b", margin: "0 0 24px", letterSpacing: "0.04em" }}>複数デバイスでタスクを同期管理</p>
          <button onClick={handleLogin}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 28px", fontSize: fs(14), fontWeight: 600, cursor: "pointer", color: "#1e1b4b", display: "flex", alignItems: "center", gap: 10, margin: "0 auto", boxShadow: "0 2px 8px #0000000c", transition: "box-shadow 0.2s, border-color 0.2s", fontFamily: FONT_BODY }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 000 24c0 3.77.9 7.35 2.56 10.51l7.97-5.92z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.92C6.51 42.62 14.62 48 24 48z"/></svg>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf9f6", fontFamily: FONT_BODY }}>
      <InjectMobileCSS />
      {isOffline && (
        <div style={{ background: "#fbbf24", color: "#78350f", textAlign: "center", padding: "4px 12px", fontSize: fs(12), fontWeight: 700 }}>
          オフラインモード — データはローカルに保存されます
        </div>
      )}
      {/* Header */}
      <div className="app-header" style={{ background: "linear-gradient(135deg, #1e1b4b, #2d2a5e)", color: "#fff", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, boxShadow: "0 2px 16px #1e1b4b55", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#818cf8,#6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📋</div>
          <span className="app-title" style={{ fontWeight: 700, fontSize: fs(16), fontFamily: FONT_HEADING, letterSpacing: "0.05em" }}>案件管理</span>
          {urgentCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: fs(11), fontWeight: 700 }}>⚠ {urgentCount}件</span>
          )}
        </div>
        <div className="app-header-buttons" style={{ display: "flex", gap: 6 }}>
          {notifyEnabled ? (
            <button onClick={() => checkAndNotify(cases)} title="通知チェック" style={btnStyle("#312e81", "#a5b4fc")}>🔔</button>
          ) : (
            <button onClick={requestNotification} title="通知を有効にする" style={btnStyle("#312e81", "#64748b")}>🔕</button>
          )}
          <button onClick={undo} title="元に戻す (Ctrl+Z)" style={btnStyle("#312e81", "#a5b4fc")}>↩</button>
          <button onClick={redo} title="やり直す (Ctrl+Shift+Z)" style={btnStyle("#312e81", "#a5b4fc")}>↪</button>
          <button onClick={cycleFontScale} title="文字サイズ変更" style={{ ...btnStyle("#4f46e5", "#fff"), border: "1px solid #818cf8", minWidth: 50 }}>
            Aa {FONT_SCALES.find((s) => s.value === fontScale)?.label || "中"}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDataMenu((v) => !v)} style={btnStyle("#312e81", "#a5b4fc")}>💾 データ</button>
            {showDataMenu && (
              <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px #00000020", padding: 6, zIndex: 50, minWidth: 140 }}>
                <button onClick={exportData} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: fs(13), cursor: "pointer", borderRadius: 6, color: "#1e1b4b", fontWeight: 600 }}>
                  📥 エクスポート
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: fs(13), cursor: "pointer", borderRadius: 6, color: "#1e1b4b", fontWeight: 600 }}>
                  📤 インポート
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
              </div>
            )}
          </div>
          <button onClick={() => setShowTemplate(true)} style={btnStyle("#3730a3", "#fff")}>📄 テンプレ</button>
          <button onClick={() => { setShowNew(true); setSelected(null); }} style={btnStyle("#6366f1", "#fff")}>＋ 新規</button>
          <button onClick={() => setView(v => v === "kanban" ? "list" : v === "list" ? "gantt" : "kanban")} style={btnStyle("#312e81", "#a5b4fc")}>
            {view === "kanban" ? "≡ リスト" : view === "list" ? "📊 ガント" : "⊞ カンバン"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} referrerPolicy="no-referrer" />}
            <span style={{ fontSize: 11, color: "#a5b4fc", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName?.split(" ")[0]}</span>
            <button onClick={handleLogout} title="ログアウト" style={btnStyle("#312e81", "#94a3b8")}>↗</button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #eee8e0", flexWrap: "wrap" }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 案件名で検索…"
          style={{ flex: 1, minWidth: 150, border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 11px", fontSize: fs(13), outline: "none", color: "#1e1b4b" }}
        />
        <div className="filter-buttons" style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setFilterStatus("all")}
            style={{ padding: "4px 10px", fontSize: fs(12), borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
              background: filterStatus === "all" ? "#1e1b4b" : "#f1f5f9", color: filterStatus === "all" ? "#fff" : "#64748b" }}>
            すべて
          </button>
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => setFilterStatus(s.id)}
              style={{ padding: "4px 10px", fontSize: fs(12), borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
                background: filterStatus === s.id ? s.bg : "#f1f5f9", color: filterStatus === s.id ? s.color : "#94a3b8" }}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 8px", fontSize: fs(13), color: "#1e1b4b", outline: "none", background: "#fff" }}>
          <option value="deadline">期限順</option>
          <option value="name">名前順</option>
          <option value="created">作成日（古い順）</option>
          <option value="created_desc">作成日（新しい順）</option>
        </select>
        {(searchQuery || filterStatus !== "all") && (
          <span style={{ fontSize: fs(12), color: "#64748b" }}>{filteredCases.length}件</span>
        )}
      </div>

      <div className="main-content" style={{ display: "flex", height: "calc(100vh - 58px - 49px)" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {view === "kanban" ? (
            <KanbanView fs={fs} cases={filteredCases} onSelect={setSelected} selectedId={selected}
              onStatusChange={handleStatusChangeWithPosition} onReorder={handleKanbanReorder} />
          ) : view === "list" ? (
            <ListView fs={fs} cases={filteredCases} onSelect={setSelected} selectedId={selected} />
          ) : (
            <GanttView fs={fs} cases={filteredCases} onSelect={setSelected} selectedId={selected} onUpdate={updateCase} />
          )}
        </div>

        {selectedCase && (
          <DetailPanel
            fs={fs}
            c={selectedCase}
            onUpdate={(patch) => updateCase(selectedCase.id, patch)}
            onDelete={() => deleteCase(selectedCase.id)}
            onClose={() => setSelected(null)}
            onAddTask={(label) => addTask(selectedCase.id, label)}
            onToggleTask={(tid) => toggleTask(selectedCase.id, tid)}
            onUpdateTask={(tid, patch) => updateTask(selectedCase.id, tid, patch)}
            onDeleteTask={(tid) => deleteTask(selectedCase.id, tid)}
            onReorderTasks={(from, to) => reorderTasks(selectedCase.id, from, to)}
          />
        )}
      </div>

      {showNew && <NewCaseModal fs={fs} onAdd={addCase} onClose={() => setShowNew(false)} />}

      {showTemplate && (
        <Modal onClose={() => setShowTemplate(false)} title="📄 書類テンプレート">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DOC_TEMPLATES.map((t) => (
              <div key={t.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: "#1e1b4b", fontSize: fs(14) }}>{t.name}</span>
                  <button onClick={() => copyTemplate(t.body)} style={btnStyle(copiedId === t.body ? "#059669" : "#6366f1", "#fff")}>
                    {copiedId === t.body ? "✓ コピー済" : "📋 コピー"}
                  </button>
                </div>
                <pre style={{ fontSize: fs(12), color: "#64748b", whiteSpace: "pre-wrap", background: "#faf9f6", borderRadius: 6, padding: 8, maxHeight: 100, overflow: "auto", margin: 0 }}>
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
