import * as Icons from "lucide-react";

export default function RuleIcon({ name, className }) {
  const Icon = Icons[name] || Icons.Dices;
  return <Icon className={className} />;
}
