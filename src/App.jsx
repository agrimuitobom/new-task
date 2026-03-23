import { useState, useEffect, useRef, useCallback } from "react";
import { auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

import { FONT_SCALES, STATUSES, DOC_TEMPLATES, daysUntil } from "./constants";
import { CaseProvider, useCases } from "./store/CaseContext";
import { UIProvider, useUI } from "./store/UIContext";
import KanbanView from "./components/KanbanView";
import ListView from "./components/ListView";
import GanttView from "./components/GanttView";
import DetailPanel from "./components/DetailPanel";
import { Modal, NewCaseModal } from "./components/Modal";
import s from "./App.module.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  if (authLoading) {
    return <div className={s.loginPage}><div style={{ color: "#64748b" }}>読み込み中…</div></div>;
  }
  if (!user) {
    const handleLogin = async () => {
      setLoginError(null);
      setLoginLoading(true);
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        console.error("Login error:", err);
        if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
          // User closed popup — not an error
        } else if (err.code === "auth/popup-blocked") {
          setLoginError("ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。");
        } else {
          setLoginError(`ログインに失敗しました (${err.code || err.message})`);
        }
      } finally {
        setLoginLoading(false);
      }
    };
    return <LoginPage onLogin={handleLogin} error={loginError} loading={loginLoading} />;
  }

  return (
    <UIProvider>
      <CaseProvider user={user} authLoading={authLoading}>
        <AppShell user={user} onLogout={async () => { await signOut(auth); }} />
      </CaseProvider>
    </UIProvider>
  );
}

function LoginPage({ onLogin, error, loading }) {
  return (
    <div className={s.loginPage}>
      <div className={s.loginCard}>
        <div className={s.loginIcon}>📋</div>
        <h1 className={s.loginTitle} style={{ fontSize: 22 }}>案件管理</h1>
        <p className={s.loginSubtitle} style={{ fontSize: 14 }}>複数デバイスでタスクを同期管理</p>
        <button onClick={onLogin} disabled={loading} className={s.googleBtn} style={{ fontSize: 14, opacity: loading ? 0.6 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 000 24c0 3.77.9 7.35 2.56 10.51l7.97-5.92z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.92C6.51 42.62 14.62 48 24 48z"/></svg>
          {loading ? "ログイン中…" : "Googleでログイン"}
        </button>
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

function AppShell({ user, onLogout }) {
  const { cases, dispatch, undo, redo, deleteCase, importCases } = useCases();
  const { view, cycleView, selected, setSelected, showNew, setShowNew, showTemplate, setShowTemplate,
    searchQuery, setSearchQuery, filterStatus, setFilterStatus, sortKey, setSortKey,
    fontScale, fs, cycleFontScale } = useUI();

  const [copiedId, setCopiedId] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [notifyEnabled, setNotifyEnabled] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const [showDataMenu, setShowDataMenu] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const goOff = () => setIsOffline(true);
    const goOn = () => setIsOffline(false);
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => { window.removeEventListener("offline", goOff); window.removeEventListener("online", goOn); };
  }, []);

  // ── Notifications ──
  const checkAndNotify = useCallback((caseList) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const urgent = caseList.filter((c) => c.status !== "done" && daysUntil(c.deadline) !== null && daysUntil(c.deadline) <= 3);
    if (!urgent.length) return;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem("notified-date") === today) return; } catch {}
    const body = urgent.map((c) => {
      const d = daysUntil(c.deadline);
      const label = d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? "本日締切" : `あと${d}日`;
      return `・${c.name}（${label}）`;
    }).join("\n");
    new Notification("案件管理 - 期限通知", { body, icon: "./icon-192.png" });
    try { localStorage.setItem("notified-date", today); } catch {}
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
    if (cases.length > 0 && !initialNotifyDone.current) { initialNotifyDone.current = true; checkAndNotify(cases); }
  }, [cases, checkAndNotify]);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const iv = setInterval(() => checkAndNotify(cases), 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [cases, checkAndNotify]);

  // ── Export / Import ──
  function exportData() {
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `案件データ_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    setShowDataMenu(false);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) { importCases(data); setSelected(null); }
        else alert("無効なデータ形式です");
      } catch { alert("JSONの読み込みに失敗しました"); }
    };
    reader.readAsText(file);
    e.target.value = "";
    setShowDataMenu(false);
  }

  function copyTemplate(body) {
    navigator.clipboard.writeText(body).then(() => { setCopiedId(body); setTimeout(() => setCopiedId(null), 1500); });
  }

  // ── Filtered & sorted ──
  const filteredCases = cases.filter((c) => {
    const matchSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    if (sortKey === "deadline") return (a.deadline ? new Date(a.deadline) : new Date("9999")) - (b.deadline ? new Date(b.deadline) : new Date("9999"));
    if (sortKey === "name") return a.name.localeCompare(b.name, "ja");
    if (sortKey === "created") return a.id > b.id ? 1 : -1;
    if (sortKey === "created_desc") return a.id < b.id ? 1 : -1;
    return 0;
  });

  const urgentCount = cases.filter((c) => { const d = daysUntil(c.deadline); return c.status !== "done" && d !== null && d <= 3; }).length;
  const selectedCase = cases.find((c) => c.id === selected);

  const btnSm = { background: "#312e81", color: "#a5b4fc", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" };

  return (
    <div className={s.root}>
      {isOffline && <div className={s.offlineBanner} style={{ fontSize: fs(12) }}>オフラインモード — データはローカルに保存されます</div>}

      {/* ── Header ── */}
      <div className={`${s.header} app-header`}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}>📋</div>
          <span className={`${s.headerTitle} app-title`} style={{ fontSize: fs(16) }}>案件管理</span>
          {urgentCount > 0 && <span className={s.urgentBadge} style={{ fontSize: fs(11) }}>⚠ {urgentCount}件</span>}
        </div>
        <div className="app-header-buttons" style={{ display: "flex", gap: 6 }}>
          {notifyEnabled
            ? <button onClick={() => checkAndNotify(cases)} title="通知チェック" style={btnSm}>🔔</button>
            : <button onClick={requestNotification} title="通知を有効にする" style={{ ...btnSm, color: "#64748b" }}>🔕</button>}
          <button onClick={undo} title="元に戻す (Ctrl+Z)" style={btnSm}>↩</button>
          <button onClick={redo} title="やり直す (Ctrl+Shift+Z)" style={btnSm}>↪</button>
          <button onClick={cycleFontScale} title="文字サイズ変更"
            style={{ ...btnSm, background: "#4f46e5", color: "#fff", border: "1px solid #818cf8", minWidth: 50 }}>
            Aa {FONT_SCALES.find((sc) => sc.value === fontScale)?.label || "中"}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDataMenu((v) => !v)} style={btnSm}>💾 データ</button>
            {showDataMenu && (
              <div className={s.dataMenu}>
                <button onClick={exportData} className={s.dataMenuItem} style={{ fontSize: fs(13) }}>📥 エクスポート</button>
                <button onClick={() => fileInputRef.current?.click()} className={s.dataMenuItem} style={{ fontSize: fs(13) }}>📤 インポート</button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              </div>
            )}
          </div>
          <button onClick={() => setShowTemplate(true)} style={{ ...btnSm, background: "#3730a3", color: "#fff" }}>📄 テンプレ</button>
          <button onClick={() => { setShowNew(true); setSelected(null); }} style={{ ...btnSm, background: "#6366f1", color: "#fff" }}>＋ 新規</button>
          <button onClick={cycleView} style={btnSm}>
            {view === "kanban" ? "≡ リスト" : view === "list" ? "📊 ガント" : "⊞ カンバン"}
          </button>
          <div className={s.userInfo}>
            {user.photoURL && <img src={user.photoURL} alt="" className={s.userAvatar} referrerPolicy="no-referrer" />}
            <span className={s.userName}>{user.displayName?.split(" ")[0]}</span>
            <button onClick={onLogout} title="ログアウト" style={{ ...btnSm, color: "#94a3b8" }}>↗</button>
          </div>
        </div>
      </div>

      {/* ── Search & Filter ── */}
      <div className={`${s.searchBar} search-bar`}>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 案件名で検索…" className={s.searchInput} style={{ fontSize: fs(13) }} />
        <div className="filter-buttons" style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setFilterStatus("all")} className={s.filterBtn}
            style={{ fontSize: fs(12), background: filterStatus === "all" ? "#1e1b4b" : "#f1f5f9", color: filterStatus === "all" ? "#fff" : "#64748b" }}>
            すべて
          </button>
          {STATUSES.map((st) => (
            <button key={st.id} onClick={() => setFilterStatus(st.id)} className={s.filterBtn}
              style={{ fontSize: fs(12), background: filterStatus === st.id ? st.bg : "#f1f5f9", color: filterStatus === st.id ? st.color : "#94a3b8" }}>
              {st.label}
            </button>
          ))}
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className={s.sortSelect} style={{ fontSize: fs(13) }}>
          <option value="deadline">期限順</option>
          <option value="name">名前順</option>
          <option value="created">作成日（古い順）</option>
          <option value="created_desc">作成日（新しい順）</option>
        </select>
        {(searchQuery || filterStatus !== "all") && <span style={{ fontSize: fs(12), color: "#64748b" }}>{filteredCases.length}件</span>}
      </div>

      {/* ── Main ── */}
      <div className={`${s.mainContent} main-content`}>
        <div className={s.viewArea}>
          {view === "kanban" ? (
            <KanbanView cases={filteredCases} onSelect={setSelected} selectedId={selected}
              onStatusChange={(id, st, idx) => dispatch({ type: "STATUS_CHANGE", caseId: id, newStatus: st, insertIndex: idx })}
              onReorder={(id, st, idx) => dispatch({ type: "REORDER_KANBAN", caseId: id, statusId: st, toIndex: idx })} />
          ) : view === "list" ? (
            <ListView cases={filteredCases} onSelect={setSelected} selectedId={selected} />
          ) : (
            <GanttView cases={filteredCases} onSelect={setSelected} selectedId={selected} />
          )}
        </div>

        {selectedCase && <DetailPanel c={selectedCase} onClose={() => setSelected(null)} />}
      </div>

      {/* ── Modals ── */}
      {showNew && <NewCaseModal onAdd={(data) => dispatch({ type: "ADD", data })} onClose={() => setShowNew(false)} />}

      {showTemplate && (
        <Modal onClose={() => setShowTemplate(false)} title="📄 書類テンプレート">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DOC_TEMPLATES.map((t) => (
              <div key={t.id} className={s.templateCard}>
                <div className={s.templateHeader}>
                  <span style={{ fontWeight: 700, color: "#1e1b4b", fontSize: fs(14) }}>{t.name}</span>
                  <button onClick={() => copyTemplate(t.body)}
                    style={{ ...btnSm, background: copiedId === t.body ? "#059669" : "#6366f1", color: "#fff" }}>
                    {copiedId === t.body ? "✓ コピー済" : "📋 コピー"}
                  </button>
                </div>
                <pre className={s.templatePre} style={{ fontSize: fs(12) }}>{t.body.slice(0, 180)}…</pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
