import { useState, useEffect, useRef, useCallback } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from "firebase/firestore";

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

function DeadlineBadge({ date }) {
  if (!date) return null;
  const d = daysUntil(date);
  let color = "#64748b", bg = "#f1f5f9", text = `${d}日後`;
  if (d < 0)      { color = "#dc2626"; bg = "#fef2f2"; text = `${Math.abs(d)}日超過`; }
  else if (d === 0) { color = "#dc2626"; bg = "#fef2f2"; text = "本日締切"; }
  else if (d <= 3)  { color = "#d97706"; bg = "#fffbeb"; }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 6, padding: "2px 7px", border: `1px solid ${color}22` }}>
      {text}
    </span>
  );
}

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

  // Firebase Auth 監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  async function handleLogin() {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { if (e.code !== "auth/popup-closed-by-user") alert("ログインに失敗しました: " + e.message); }
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
      // 未ログイン時はlocalStorageから読み込み
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
    // Firestoreからリアルタイム購読
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
    // Firestoreに同期
    const colRef = collection(db, "users", user.uid, "cases");
    cases.forEach((c) => {
      const { id, ...data } = c;
      setDoc(doc(colRef, id), data).catch(() => {});
    });
  }, [cases, user, authLoading, pushHistory]);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [notifyEnabled, setNotifyEnabled] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  // オンライン/オフライン状態の監視
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  // ブラウザ通知：期限が近い案件を通知
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

  // 起動時に通知チェック
  const initialNotifyDone = useRef(false);
  useEffect(() => {
    if (cases.length > 0 && !initialNotifyDone.current) {
      initialNotifyDone.current = true;
      checkAndNotify(cases);
    }
  }, [cases, checkAndNotify]);

  // 30分ごとに通知チェック
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
          // Firestoreにも一括書き込み
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

  const filteredCases = cases.filter((c) => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortKey === "deadline") {
      const da = a.deadline ? new Date(a.deadline) : new Date("9999");
      const db = b.deadline ? new Date(b.deadline) : new Date("9999");
      return da - db;
    }
    if (sortKey === "name") return a.name.localeCompare(b.name, "ja");
    if (sortKey === "created") return (a.id > b.id ? 1 : -1);
    if (sortKey === "created_desc") return (a.id < b.id ? 1 : -1);
    return 0;
  });

  const urgentCount = cases.filter((c) => {
    const d = daysUntil(c.deadline);
    return c.status !== "done" && d !== null && d <= 3;
  }).length;

  // ログイン画面
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4", fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>読み込み中…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4", fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 36px", boxShadow: "0 4px 24px #00000012", textAlign: "center", maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#818cf8,#6366f1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 16px" }}>📋</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b", margin: "0 0 8px" }}>案件管理</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>複数デバイスでタスクを同期管理</p>
          <button onClick={handleLogin}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#1e1b4b", display: "flex", alignItems: "center", gap: 10, margin: "0 auto", boxShadow: "0 1px 4px #00000010" }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 000 24c0 3.77.9 7.35 2.56 10.51l7.97-5.92z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.92C6.51 42.62 14.62 48 24 48z"/></svg>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <InjectMobileCSS />
      {isOffline && (
        <div style={{ background: "#fbbf24", color: "#78350f", textAlign: "center", padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
          オフラインモード — データはローカルに保存されます
        </div>
      )}
      {/* Header */}
      <div className="app-header" style={{ background: "#1e1b4b", color: "#fff", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, boxShadow: "0 2px 12px #1e1b4b44", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#818cf8,#6366f1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📋</div>
          <span className="app-title" style={{ fontWeight: 700, fontSize: 16 }}>案件管理</span>
          {urgentCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>⚠ {urgentCount}件</span>
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
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDataMenu((v) => !v)} style={btnStyle("#312e81", "#a5b4fc")}>💾 データ</button>
            {showDataMenu && (
              <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px #00000020", padding: 6, zIndex: 50, minWidth: 140 }}>
                <button onClick={exportData} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 12, cursor: "pointer", borderRadius: 6, color: "#1e1b4b", fontWeight: 600 }}>
                  📥 エクスポート
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: 12, cursor: "pointer", borderRadius: 6, color: "#1e1b4b", fontWeight: 600 }}>
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
      <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 案件名で検索…"
          style={{ flex: 1, minWidth: 150, border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 11px", fontSize: 13, outline: "none", color: "#1e1b4b" }}
        />
        <div className="filter-buttons" style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setFilterStatus("all")}
            style={{ padding: "4px 10px", fontSize: 11, borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
              background: filterStatus === "all" ? "#1e1b4b" : "#f1f5f9", color: filterStatus === "all" ? "#fff" : "#64748b" }}>
            すべて
          </button>
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => setFilterStatus(s.id)}
              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 700,
                background: filterStatus === s.id ? s.bg : "#f1f5f9", color: filterStatus === s.id ? s.color : "#94a3b8" }}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 8px", fontSize: 12, color: "#1e1b4b", outline: "none", background: "#fff" }}>
          <option value="deadline">期限順</option>
          <option value="name">名前順</option>
          <option value="created">作成日（古い順）</option>
          <option value="created_desc">作成日（新しい順）</option>
        </select>
        {(searchQuery || filterStatus !== "all") && (
          <span style={{ fontSize: 11, color: "#64748b" }}>{filteredCases.length}件</span>
        )}
      </div>

      <div className="main-content" style={{ display: "flex", height: "calc(100vh - 58px - 49px)" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {view === "kanban" ? (
            <KanbanView cases={filteredCases} onSelect={setSelected} selectedId={selected} onStatusChange={(id, s) => updateCase(id, { status: s })} />
          ) : view === "list" ? (
            <ListView cases={filteredCases} onSelect={setSelected} selectedId={selected} />
          ) : (
            <GanttView cases={filteredCases} onSelect={setSelected} selectedId={selected} onUpdate={updateCase} />
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

function KanbanView({ cases, onSelect, selectedId, onStatusChange }) {
  const [dragOverStatus, setDragOverStatus] = useState(null);

  function handleDragOver(e, statusId) {
    e.preventDefault();
    setDragOverStatus(statusId);
  }
  function handleDrop(e, statusId) {
    e.preventDefault();
    const caseId = e.dataTransfer.getData("text/plain");
    if (caseId) onStatusChange(caseId, statusId);
    setDragOverStatus(null);
  }
  function handleDragLeave() {
    setDragOverStatus(null);
  }

  return (
    <div className="kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "start" }}>
      {STATUSES.map((s) => {
        const cols = cases.filter((c) => c.status === s.id);
        const isOver = dragOverStatus === s.id;
        return (
          <div key={s.id} className="kanban-column"
            onDragOver={(e) => handleDragOver(e, s.id)}
            onDrop={(e) => handleDrop(e, s.id)}
            onDragLeave={handleDragLeave}
            style={{ borderRadius: 10, padding: 6, minHeight: 80, transition: "background 0.15s",
              background: isOver ? s.bg : "transparent", border: isOver ? `2px dashed ${s.color}44` : "2px dashed transparent" }}>
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
                <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 12, padding: "16px 0" }}>
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

function ListView({ cases, onSelect, selectedId }) {
  return (
    <div style={{ maxWidth: 800 }}>
      <table className="list-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            {["案件名", "ステータス", "期限", "タスク"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => {
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
          {cases.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "#cbd5e1", padding: 40 }}>案件がありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GanttView({ cases, onSelect, selectedId, onUpdate }) {
  const DAY_W = 36;
  const ROW_H = 56;
  const LEFT_W = 260;
  const HEADER_H = 70;
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  // 案件の日付範囲を計算
  const casesWithDates = cases.filter((c) => c.deadline).map((c) => {
    const end = new Date(c.deadline);
    let start;
    if (c.startDate) {
      start = new Date(c.startDate);
    } else {
      // startDateがない場合、deadline の14日前をデフォルト
      start = new Date(end);
      start.setDate(start.getDate() - 14);
    }
    return { ...c, _start: start, _end: end };
  });

  // タイムライン範囲
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let rangeStart, rangeEnd;

  if (casesWithDates.length > 0) {
    rangeStart = new Date(Math.min(...casesWithDates.map((c) => c._start), today));
    rangeEnd = new Date(Math.max(...casesWithDates.map((c) => c._end)));
  } else {
    rangeStart = new Date(today);
    rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 30);
  }
  // 前後に余裕
  rangeStart.setDate(rangeStart.getDate() - 3);
  rangeEnd.setDate(rangeEnd.getDate() + 7);

  // 日付配列を生成
  const days = [];
  const d = new Date(rangeStart);
  while (d <= rangeEnd) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  // 月ヘッダーを生成
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

  // 営業日計算
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

  // バーの位置計算
  function getBarStyle(caseItem) {
    const startDiff = Math.round((caseItem._start - rangeStart) / 86400000);
    const duration = Math.round((caseItem._end - caseItem._start) / 86400000) + 1;
    const st = STATUSES.find((s) => s.id === caseItem.status);
    return {
      left: startDiff * DAY_W,
      width: Math.max(duration * DAY_W - 4, DAY_W),
      color: st?.color || "#6366f1",
      bg: st?.dot || "#818cf8",
    };
  }

  // 今日のインデックス
  const todayIdx = Math.round((today - rangeStart) / 86400000);

  // スケジュール概要
  const summary = casesWithDates.length > 0 ? {
    start: new Date(Math.min(...casesWithDates.map((c) => c._start))),
    end: new Date(Math.max(...casesWithDates.map((c) => c._end))),
  } : null;

  const timelineRef = useRef(null);

  // 初回マウント時に今日の位置へスクロール
  useEffect(() => {
    if (timelineRef.current && todayIdx > 3) {
      timelineRef.current.scrollLeft = (todayIdx - 3) * DAY_W;
    }
  }, []);

  const allCases = cases.length > 0 ? cases : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左パネル: タスクリスト */}
        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: "2px solid #e2e8f0", background: "#fff", overflow: "auto" }}>
          {/* ヘッダー行 */}
          <div style={{ height: HEADER_H, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-end", padding: "0 12px 8px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
            <span style={{ flex: 1 }}>タスク名</span>
            <span style={{ width: 40, textAlign: "center" }}>日数</span>
          </div>
          {/* タスク行 */}
          {allCases.map((c) => {
            const st = STATUSES.find((s) => s.id === c.status);
            const cwd = casesWithDates.find((cw) => cw.id === c.id);
            const duration = cwd ? Math.round((cwd._end - cwd._start) / 86400000) + 1 : "—";
            return (
              <div key={c.id} onClick={() => onSelect(c.id)}
                style={{
                  height: ROW_H, display: "flex", alignItems: "center", padding: "0 12px", gap: 8,
                  borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                  background: selectedId === c.id ? "#eef2ff" : "#fff",
                }}>
                <div style={{ color: "#cbd5e1", fontSize: 12, cursor: "grab", userSelect: "none" }}>⫶</div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: st?.dot || "#cbd5e1", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                </div>
                <div style={{ width: 40, textAlign: "center", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {typeof duration === "number" ? `${duration}日` : duration}
                </div>
              </div>
            );
          })}
          {allCases.length === 0 && (
            <div style={{ textAlign: "center", color: "#cbd5e1", padding: 40, fontSize: 13 }}>案件がありません</div>
          )}

          {/* スケジュール概要 */}
          {summary && (
            <div style={{ margin: 12, padding: 14, background: "#f8f7f4", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                スケジュール概要 <span style={{ color: "#94a3b8", fontSize: 10 }}>▼</span>
              </div>
              <div style={{ fontSize: 12, color: "#1e1b4b", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
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

        {/* 右パネル: タイムライン */}
        <div ref={timelineRef} style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          <div style={{ minWidth: days.length * DAY_W, position: "relative" }}>
            {/* 月ヘッダー */}
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

            {/* 日付ヘッダー */}
            <div style={{ display: "flex", height: HEADER_H - 28, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 28, background: "#fff", zIndex: 5 }}>
              {days.map((day, i) => {
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} style={{
                    width: DAY_W, textAlign: "center", flexShrink: 0, borderRight: "1px solid #f1f5f9",
                    background: isToday ? "#eef2ff" : isWeekend ? "#f8f7f4" : "#fff",
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 1,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#1e1b4b" }}>
                      {day.getDate()}
                    </div>
                    <div style={{ fontSize: 9, color: isToday ? "#6366f1" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#94a3b8", fontWeight: 600 }}>
                      {WEEKDAYS[dow]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* マイルストーン行（今日マーカー） */}
            <div style={{ display: "flex", height: 20, borderBottom: "1px solid #e2e8f0" }}>
              {days.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString();
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div key={i} style={{ width: DAY_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isWeekend ? "#f8f7f4" : "#fff", borderRight: "1px solid #f1f5f9" }}>
                    {isToday && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />}
                  </div>
                );
              })}
            </div>

            {/* タスクバー行 */}
            {allCases.map((c) => {
              const cwd = casesWithDates.find((cw) => cw.id === c.id);
              const bar = cwd ? getBarStyle(cwd) : null;
              const st = STATUSES.find((s) => s.id === c.status);
              return (
                <div key={c.id} style={{ height: ROW_H, position: "relative", borderBottom: "1px solid #f1f5f9" }}>
                  {/* 背景の週末ハイライト */}
                  <div style={{ display: "flex", position: "absolute", inset: 0 }}>
                    {days.map((day, i) => {
                      const dow = day.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      return (
                        <div key={i} style={{ width: DAY_W, flexShrink: 0, background: isWeekend ? "#f8f7f4" : "transparent", borderRight: "1px solid #f1f5f900" }} />
                      );
                    })}
                  </div>
                  {/* バー */}
                  {bar && (
                    <div onClick={() => onSelect(c.id)} style={{
                      position: "absolute", top: 12, left: bar.left + 2, width: bar.width,
                      height: ROW_H - 24, borderRadius: 6, cursor: "pointer",
                      background: `linear-gradient(135deg, ${bar.bg}, ${bar.bg}88)`,
                      display: "flex", alignItems: "center", paddingLeft: 10,
                      fontSize: 12, fontWeight: 600, color: "#fff",
                      boxShadow: selectedId === c.id ? `0 0 0 2px ${bar.color}` : "none",
                      overflow: "hidden", whiteSpace: "nowrap",
                      transition: "box-shadow 0.15s",
                    }}>
                      {c.name}
                    </div>
                  )}
                  {/* 日付なしの案件 */}
                  {!bar && (
                    <div style={{ position: "absolute", top: 16, left: 8, fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
                      期限未設定
                    </div>
                  )}
                </div>
              );
            })}

            {/* 今日の縦線 */}
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

function CaseCard({ c, onClick, isSelected, onStatusChange }) {
  const done = c.tasks.filter((t) => t.done).length;
  const total = c.tasks.length;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onClick} style={{
      background: "#fff", borderRadius: 12, padding: "11px 13px", cursor: "grab",
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

  return (
    <div className="detail-panel" style={{ width: 300, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 18, overflow: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        {editName ? (
          <input value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={() => { onUpdate({ name: nameVal }); setEditName(false); }} autoFocus
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
        <label style={labelStyle}>開始日</label>
        <input type="date" value={c.startDate || ""} onChange={(e) => onUpdate({ startDate: e.target.value })}
          style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 9px", fontSize: 12, color: "#1e1b4b", outline: "none" }} />
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
        <label style={labelStyle}>タスク ({c.tasks.filter(t=>t.done).length}/{c.tasks.length})</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 7 }}>
          {c.tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={t.done} onChange={() => onToggleTask(t.id)}
                style={{ accentColor: "#6366f1", width: 14, height: 14, cursor: "pointer" }} />
              <span style={{ flex: 1, fontSize: 12, color: t.done ? "#94a3b8" : "#1e1b4b", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
              <button onClick={() => onDeleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 13, padding: 0 }}>×</button>
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
          <label style={labelStyle}>案件名 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus
            placeholder="例：〇〇事業補助金申請" style={inputStyle} />
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

// モバイル対応CSS（styleタグで挿入）
const mobileCSS = `
@media (max-width: 768px) {
  .app-header { height: auto !important; padding: 8px 12px !important; }
  .app-header-buttons { gap: 4px !important; }
  .app-header-buttons button { padding: 5px 8px !important; font-size: 11px !important; }
  .search-bar { padding: 8px 12px !important; gap: 6px !important; }
  .search-bar input { min-width: 100px !important; font-size: 12px !important; }
  .filter-buttons { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .filter-buttons button { white-space: nowrap; font-size: 10px !important; padding: 3px 7px !important; }
  .main-content { flex-direction: column !important; }
  .kanban-grid { display: flex !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; gap: 12px !important; padding-bottom: 8px; scroll-snap-type: x mandatory; }
  .kanban-column { min-width: 220px !important; flex-shrink: 0 !important; scroll-snap-align: start; }
  .detail-panel { width: 100% !important; border-left: none !important; border-top: 1px solid #e2e8f0; max-height: 50vh; position: relative !important; }
  .list-table { font-size: 11px !important; }
  .list-table td, .list-table th { padding: 6px 5px !important; }
}
@media (max-width: 480px) {
  .kanban-column { min-width: 180px !important; }
  .app-title { font-size: 14px !important; }
}
`;

function InjectMobileCSS() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = mobileCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}

const labelStyle = { display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" };
const inputStyle = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", color: "#1e1b4b" };
function btnStyle(bg, color) {
  return { background: bg, color, border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
}
