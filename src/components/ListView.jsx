import { STATUSES } from "../constants";
import { useUI } from "../store/UIContext";
import DeadlineBadge from "./DeadlineBadge";
import s from "./ListView.module.css";

export default function ListView({ cases, onSelect, selectedId }) {
  const { fs } = useUI();
  return (
    <div className={s.wrapper}>
      <table className={`${s.table} list-table`}>
        <thead>
          <tr>
            {["案件名", "ステータス", "期限", "タスク"].map((h) => (
              <th key={h} style={{ fontSize: fs(12) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => {
            const st = STATUSES.find((sv) => sv.id === c.status);
            const done = c.tasks.filter((t) => t.done).length;
            return (
              <tr key={c.id} onClick={() => onSelect(c.id)}
                className={`${s.row} ${selectedId === c.id ? s.rowSelected : ""}`}>
                <td className={s.nameCell} style={{ fontSize: fs(14) }}>
                  {c.name}
                  {(c.tags || []).length > 0 && (
                    <span className={s.nameTags}>
                      {(c.tags || []).map((tag) => <span key={tag} className={s.nameTag} style={{ fontSize: fs(9) }}>{tag}</span>)}
                    </span>
                  )}
                </td>
                <td>
                  <span className={s.statusBadge} style={{ background: st?.bg, color: st?.color, fontSize: fs(12) }}>{st?.label}</span>
                </td>
                <td><DeadlineBadge date={c.deadline} fs={fs} /></td>
                <td className={s.taskCount} style={{ fontSize: fs(13) }}>{c.tasks.length > 0 ? `${done}/${c.tasks.length}` : "—"}</td>
              </tr>
            );
          })}
          {cases.length === 0 && (
            <tr><td colSpan={4} className={s.empty} style={{ fontSize: fs(13) }}>案件がありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
