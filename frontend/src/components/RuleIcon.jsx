import * as Icons from "lucide-react";

const SUITS = { "♥": "#F43F5E", "♦": "#F43F5E", "♣": "#E2E8F0", "♠": "#E2E8F0" };

export default function RuleIcon({ name, className, style }) {
  if (name && SUITS[name]) {
    return <span className={className} style={{ color: SUITS[name], lineHeight: 1, ...style }}>{name}</span>;
  }
  const Icon = Icons[name] || Icons.Dices;
  return <Icon className={className} style={style} />;
}
