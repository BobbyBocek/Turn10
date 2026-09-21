import * as Icons from "lucide-react";

const SUITS = { "♥": "#F43F5E", "♦": "#F43F5E", "♣": "#E2E8F0", "♠": "#E2E8F0" };

// Renderar en liten spelkorts-ikon för "card:<rank>" (t.ex. "card:2", "card:10")
function MiniCard({ rank, className, style }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[3px] bg-gradient-to-br from-slate-50 to-slate-200 border border-slate-400 font-display font-black leading-none ${className || ""}`}
      style={{ width: "1.15em", height: "1.5em", color: "#E11D48", fontSize: "0.72em", ...style }}
    >
      {rank}
    </span>
  );
}

export default function RuleIcon({ name, className, style }) {
  if (typeof name === "string" && name.startsWith("card:")) {
    return <MiniCard rank={name.slice(5)} className={className} style={style} />;
  }
  if (name && SUITS[name]) {
    return <span className={className} style={{ color: SUITS[name], lineHeight: 1, ...style }}>{name}</span>;
  }
  const Icon = Icons[name] || Icons.Dices;
  return <Icon className={className} style={style} />;
}
