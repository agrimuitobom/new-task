import { useEffect } from "react";
import { FONT_BODY } from "./constants";

export function labelStyleFn(fs) {
  return { display: "block", fontSize: fs(11), fontWeight: 700, color: "#64748b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: FONT_BODY };
}

export function inputStyleFn(fs) {
  return { width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: fs(14), outline: "none", boxSizing: "border-box", color: "#1e1b4b", fontFamily: FONT_BODY, transition: "border-color 0.2s" };
}

export function btnStyle(bg, color) {
  return { background: bg, color, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY, transition: "opacity 0.15s" };
}

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

export function InjectMobileCSS() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = mobileCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}
