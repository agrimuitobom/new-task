import { createContext, useContext, useState, useCallback } from "react";
import { FONT_SCALES } from "../constants";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [view, setView] = useState("kanban");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
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

  function cycleView() {
    setView((v) => (v === "kanban" ? "list" : v === "list" ? "gantt" : "kanban"));
  }

  const value = {
    view, cycleView,
    selected, setSelected,
    showNew, setShowNew,
    showTemplate, setShowTemplate,
    searchQuery, setSearchQuery,
    filterStatus, setFilterStatus,
    filterTag, setFilterTag,
    showArchived, setShowArchived,
    sortKey, setSortKey,
    fontScale, fs, cycleFontScale,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
