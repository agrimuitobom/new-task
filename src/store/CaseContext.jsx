import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { genId } from "../constants";

const CaseContext = createContext(null);

function caseReducer(state, action) {
  switch (action.type) {
    case "SET":
      return action.cases;
    case "ADD":
      return [...state, { id: genId(), tasks: [], note: "", ...action.data }];
    case "UPDATE":
      return state.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c));
    case "DELETE":
      return state.filter((c) => c.id !== action.id);
    case "ADD_TASK":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, tasks: [...c.tasks, { id: genId(), label: action.label, done: false, comments: [], attachments: [] }] }
          : c
      );
    case "TOGGLE_TASK":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, tasks: c.tasks.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t)) }
          : c
      );
    case "UPDATE_TASK":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, tasks: c.tasks.map((t) => (t.id === action.taskId ? { ...t, ...action.patch } : t)) }
          : c
      );
    case "DELETE_TASK":
      return state.map((c) =>
        c.id === action.caseId ? { ...c, tasks: c.tasks.filter((t) => t.id !== action.taskId) } : c
      );
    case "REORDER_TASKS": {
      return state.map((c) => {
        if (c.id !== action.caseId) return c;
        const tasks = [...c.tasks];
        const [moved] = tasks.splice(action.fromIdx, 1);
        tasks.splice(action.toIdx, 0, moved);
        return { ...c, tasks };
      });
    }
    case "REORDER_KANBAN": {
      const item = state.find((c) => c.id === action.caseId);
      if (!item) return state;
      const without = state.filter((c) => c.id !== action.caseId);
      const same = without.filter((c) => c.status === action.statusId);
      const others = without.filter((c) => c.status !== action.statusId);
      same.splice(action.toIndex, 0, { ...item, status: action.statusId });
      return [...others, ...same];
    }
    case "STATUS_CHANGE": {
      const item = state.find((c) => c.id === action.caseId);
      if (!item) return state;
      const without = state.filter((c) => c.id !== action.caseId);
      const same = without.filter((c) => c.status === action.newStatus);
      const others = without.filter((c) => c.status !== action.newStatus);
      const idx = action.insertIndex !== undefined ? action.insertIndex : same.length;
      same.splice(idx, 0, { ...item, status: action.newStatus });
      return [...others, ...same];
    }
    case "ADD_COMMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === action.taskId
                  ? { ...t, comments: [...(t.comments || []), { id: genId(), text: action.text, createdAt: new Date().toISOString() }] }
                  : t
              ),
            }
          : c
      );
    case "DELETE_COMMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === action.taskId ? { ...t, comments: (t.comments || []).filter((cm) => cm.id !== action.commentId) } : t
              ),
            }
          : c
      );
    case "ADD_ATTACHMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === action.taskId
                  ? {
                      ...t,
                      attachments: [
                        ...(t.attachments || []),
                        { id: genId(), name: action.name, size: action.size, type: action.type, dataUrl: action.dataUrl },
                      ],
                    }
                  : t
              ),
            }
          : c
      );
    case "DELETE_ATTACHMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === action.taskId ? { ...t, attachments: (t.attachments || []).filter((a) => a.id !== action.attachmentId) } : t
              ),
            }
          : c
      );
    case "ADD_CASE_COMMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, comments: [...(c.comments || []), { id: genId(), text: action.text, createdAt: new Date().toISOString() }] }
          : c
      );
    case "DELETE_CASE_COMMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, comments: (c.comments || []).filter((cm) => cm.id !== action.commentId) }
          : c
      );
    case "ADD_CASE_ATTACHMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, attachments: [...(c.attachments || []), { id: genId(), name: action.name, size: action.size, type: action.type, dataUrl: action.dataUrl, createdAt: new Date().toISOString() }] }
          : c
      );
    case "DELETE_CASE_ATTACHMENT":
      return state.map((c) =>
        c.id === action.caseId
          ? { ...c, attachments: (c.attachments || []).filter((a) => a.id !== action.attachmentId) }
          : c
      );
    default:
      return state;
  }
}

export function CaseProvider({ user, authLoading, children }) {
  const [cases, dispatch] = useReducer(caseReducer, []);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const firestoreSkipRef = useRef(false);

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
    dispatch({ type: "SET", cases: JSON.parse(historyRef.current[historyIndexRef.current]) });
    isUndoRedoRef.current = false;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    isUndoRedoRef.current = true;
    dispatch({ type: "SET", cases: JSON.parse(historyRef.current[historyIndexRef.current]) });
    isUndoRedoRef.current = false;
  }, []);

  // Firebase / localStorage sync
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        const saved = localStorage.getItem("cases-v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          dispatch({ type: "SET", cases: parsed });
          historyRef.current = [JSON.stringify(parsed)];
          historyIndexRef.current = 0;
        }
      } catch {}
      return;
    }
    try {
      const colRef = collection(db, "users", user.uid, "cases");
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          firestoreSkipRef.current = true;
          dispatch({ type: "SET", cases: data });
          historyRef.current = [JSON.stringify(data)];
          historyIndexRef.current = 0;
          firestoreSkipRef.current = false;
        },
        (err) => console.error("Firestore sync error:", err)
      );
      return unsub;
    } catch (err) {
      console.error("Firestore init error:", err);
    }
  }, [user, authLoading]);

  // Persist changes
  useEffect(() => {
    if (authLoading) return;
    pushHistory(cases);
    if (!user) {
      try { localStorage.setItem("cases-v1", JSON.stringify(cases)); } catch {}
      return;
    }
    if (firestoreSkipRef.current) return;
    try {
      const colRef = collection(db, "users", user.uid, "cases");
      cases.forEach((c) => {
        const { id, ...data } = c;
        setDoc(doc(colRef, id), data).catch(() => {});
      });
    } catch (err) {
      console.error("Firestore write error:", err);
    }
  }, [cases, user, authLoading, pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Delete helper that also cleans up Firestore
  const deleteCase = useCallback(
    (id) => {
      dispatch({ type: "DELETE", id });
      if (user) deleteDoc(doc(db, "users", user.uid, "cases", id)).catch(() => {});
    },
    [user]
  );

  // Import data
  const importCases = useCallback(
    (data) => {
      dispatch({ type: "SET", cases: data });
      if (user) {
        const colRef = collection(db, "users", user.uid, "cases");
        const batch = writeBatch(db);
        data.forEach((c) => { const { id, ...rest } = c; batch.set(doc(colRef, id), rest); });
        batch.commit().catch(() => {});
      }
    },
    [user]
  );

  const value = { cases, dispatch, undo, redo, deleteCase, importCases };
  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCases() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCases must be used within CaseProvider");
  return ctx;
}
