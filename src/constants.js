export const FONT_HEADING = "'Shippori Mincho B1', 'Hiragino Mincho ProN', serif";
export const FONT_BODY = "'Zen Kaku Gothic New', 'Hiragino Sans', 'Noto Sans JP', sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'SF Mono', monospace";

export const FONT_SCALES = [
  { label: "小", value: 1.0 },
  { label: "中", value: 1.15 },
  { label: "大", value: 1.3 },
];

export const STATUSES = [
  { id: "draft",    label: "起案",    color: "#6366f1", bg: "#eef2ff", dot: "#818cf8" },
  { id: "creating", label: "書類作成", color: "#c2820a", bg: "#fef9ee", dot: "#e9a832" },
  { id: "pending",  label: "承認待ち", color: "#0891b2", bg: "#ecfeff", dot: "#22d3ee" },
  { id: "done",     label: "完了",    color: "#059669", bg: "#ecfdf5", dot: "#34d399" },
];

export const TASK_TEMPLATES = [
  "起案書作成", "稟議書作成", "申請書作成", "通知文作成",
  "上長確認", "関係部署連絡", "書類送付", "押印依頼",
];

export const DOC_TEMPLATES = [
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

export const DEFAULT_TAGS = [
  "教務", "総務", "生徒指導", "進路", "保健", "施設", "予算", "行事", "PTA", "その他",
];

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}
