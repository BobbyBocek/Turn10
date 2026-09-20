import { useState } from "react";
import * as Icons from "lucide-react";
import RuleIcon from "./RuleIcon";
import { Search } from "lucide-react";

const QUICK = ["♠", "♥", "♦", "♣", "Lock", "Star", "Ban", "Zap", "RefreshCw", "Dices", "Crown", "Flame"];
const ALL = Object.keys(Icons).filter((k) => /^[A-Z][A-Za-z0-9]+$/.test(k) && !["Icon", "LucideIcon"].includes(k));

export default function IconPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const results = q.trim() ? ALL.filter((k) => k.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 42) : [];

  const Cell = ({ name }) => (
    <button
      type="button"
      data-testid={`icon-choice-${name}`}
      onClick={() => onChange(name)}
      className={`aspect-square rounded-lg flex items-center justify-center border ${value === name ? "bg-amber-500/20 border-amber-400" : "bg-slate-800 border-slate-700"}`}
    >
      <RuleIcon name={name} className="w-5 h-5 text-amber-300" />
    </button>
  );

  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5">Snabbval</p>
      <div className="grid grid-cols-8 gap-1.5 mb-3">
        {QUICK.map((n) => <Cell key={n} name={n} />)}
      </div>
      <div className="relative mb-2">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input data-testid="icon-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök ikon (t.ex. lock, star, spade)..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 focus:border-amber-500 outline-none text-sm" />
      </div>
      {results.length > 0 && (
        <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto">
          {results.map((n) => <Cell key={n} name={n} />)}
        </div>
      )}
    </div>
  );
}
