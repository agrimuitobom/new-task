import { STATUSES, FONT_HEADING } from "../constants";
import DeadlineBadge from "./DeadlineBadge";

export default function ListView({ fs, cases, onSelect, selectedId }) {
  return (
    <div style={{ maxWidth: 800 }}>
      <table className="list-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            {["案件名", "ステータス", "期限", "タスク"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: fs(12), color: "#64748b", fontWeight: 700 }}>{h}</th>
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
                <td style={{ padding: "10px", fontWeight: 600, color: "#1e1b4b", fontSize: fs(14), fontFamily: FONT_HEADING }}>{c.name}</td>
                <td style={{ padding: "10px" }}>
                  <span style={{ background: st?.bg, color: st?.color, borderRadius: 6, padding: "2px 9px", fontSize: fs(12), fontWeight: 700 }}>{st?.label}</span>
                </td>
                <td style={{ padding: "10px" }}><DeadlineBadge date={c.deadline} fs={fs} /></td>
                <td style={{ padding: "10px", fontSize: fs(13), color: "#64748b" }}>{c.tasks.length > 0 ? `${done}/${c.tasks.length}` : "—"}</td>
              </tr>
            );
          })}
          {cases.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "#cbd5e1", padding: 40, fontSize: fs(13) }}>案件がありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
