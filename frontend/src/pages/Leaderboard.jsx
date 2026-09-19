import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import { toast } from "sonner";
import { Loader2, ChevronUp, ChevronDown } from "lucide-react";

const COLS = [
  { key: "rating", label: "Rating" },
  { key: "wins", label: "V" },
  { key: "losses", label: "F" },
  { key: "last_places", label: "Sist" },
  { key: "win_pct", label: "Vinst%" },
];

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [sortKey, setSortKey] = useState("rating");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    api.get("/leaderboard").then((r) => setRows(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setRows([]); });
  }, []);

  const sorted = rows ? [...rows].sort((a, b) => (asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])) : [];

  const setSort = (key) => {
    if (key === sortKey) setAsc((v) => !v);
    else { setSortKey(key); setAsc(false); }
  };

  const medal = (i) => (i === 0 ? "bg-amber-500 text-slate-950" : i === 1 ? "bg-slate-400 text-slate-950" : i === 2 ? "bg-amber-700 text-slate-100" : "bg-slate-800 text-slate-400");

  return (
    <div>
      <Header title="Topplista" subtitle="Endast spelare med ≥1 match" />
      <div className="px-3 py-4">
        {rows === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>}
        {rows && rows.length === 0 && <div className="text-center py-16 text-slate-500">Inga matcher spelade ännu.</div>}
        {rows && rows.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <div className="w-8 py-2.5 text-center">#</div>
              <div className="flex-1 py-2.5 pl-1">Spelare</div>
              {COLS.map((c) => (
                <button
                  key={c.key}
                  data-testid={`sort-${c.key}`}
                  onClick={() => setSort(c.key)}
                  className={`w-[52px] py-2.5 flex items-center justify-center gap-0.5 ${sortKey === c.key ? "text-sky-400" : ""}`}
                >
                  {c.label}
                  {sortKey === c.key && (asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </button>
              ))}
            </div>
            {sorted.map((r, i) => (
              <div key={r.id} data-testid={`leaderboard-row-${r.id}`} className="flex items-center border-b border-slate-800/60 last:border-0 bg-slate-900/40 text-sm">
                <div className="w-8 flex justify-center">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${medal(i)}`}>{i + 1}</span>
                </div>
                <div className="flex-1 py-3 pl-1 font-medium text-slate-100 truncate flex items-center gap-1">
                  {r.name}
                  {r.win_streak >= 2 && <span className="text-xs" title={`${r.win_streak} vinster i rad`}>🔥</span>}
                </div>
                <div className="w-[52px] text-center font-mono font-bold text-sky-400">{r.rating}</div>
                <div className="w-[52px] text-center font-mono text-emerald-400">{r.wins}</div>
                <div className="w-[52px] text-center font-mono text-slate-400">{r.losses}</div>
                <div className="w-[52px] text-center font-mono text-rose-400">{r.last_places}</div>
                <div className="w-[52px] text-center font-mono text-slate-300">{r.win_pct}%</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-600 mt-3 px-1">V = vinster (1:a plats) • F = förluster (ej 1:a) • Sist = sistaplatser</p>
      </div>
    </div>
  );
}
