import { daysUntil } from "../constants";

export default function DeadlineBadge({ date, fs: fsProp }) {
  if (!date) return null;
  const f = fsProp || ((v) => v);
  const d = daysUntil(date);
  let color = "#64748b", bg = "#f1f5f9", text = `${d}日後`;
  if (d < 0)        { color = "#dc2626"; bg = "#fef2f2"; text = `${Math.abs(d)}日超過`; }
  else if (d === 0) { color = "#dc2626"; bg = "#fef2f2"; text = "本日締切"; }
  else if (d <= 3)  { color = "#d97706"; bg = "#fffbeb"; }
  return (
    <span style={{ fontSize: f(12), fontWeight: 600, color, background: bg, borderRadius: 6, padding: "2px 7px", border: `1px solid ${color}22`, fontFamily: "var(--font-mono)" }}>
      {text}
    </span>
  );
}
