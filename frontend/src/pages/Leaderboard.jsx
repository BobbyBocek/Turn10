import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import PlayerAvatar from "../components/PlayerAvatar";
import Badges, { BADGE_META } from "../components/Badges";
import { toast } from "sonner";
import { Loader2, ChevronUp, ChevronDown, Trophy, Shirt } from "lucide-react";

const COLS = [
  { key: "rating", label: "Rating" },
  { key: "wins", label: "V" },
  { key: "losses", label: "F" },
  { key: "last_places", label: "Sist" },
  { key: "win_pct", label: "V%" },
];

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [sortKey, setSortKey] = useState("rating");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    api.get("/leaderboard").then((r) => setData(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setData({ rows: [], badges: {} }); });
    api.get("/awards/history").then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  const rows = data?.rows || [];
  const sorted = [...rows].sort((a, b) => (asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
  const setSort = (key) => { if (key === sortKey) setAsc((v) => !v); else { setSortKey(key); setAsc(false); } };
  const medal = (i) => (i === 0 ? "bg-amber-500 text-slate-950" : i === 1 ? "bg-slate-400 text-slate-950" : i === 2 ? "bg-amber-700 text-slate-100" : "bg-slate-800 text-slate-400");

  return (
    <div>
      <Header title="Topplista" subtitle="Spelare med ≥1 match" />
      <div className="px-3 py-4">
        {data === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}

        {data && data.monthly_best && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-transparent border border-amber-500/30 mb-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div><div className="text-[11px] uppercase tracking-wide text-amber-400/80">Månadens spelare</div>
              <div className="font-bold text-slate-100">{data.monthly_best.name} <span className="text-emerald-400 font-mono text-sm">+{data.monthly_best.total}</span></div></div>
          </div>
        )}

        {data && rows.length === 0 && <div className="text-center py-16 text-slate-500">Inga matcher spelade ännu.</div>}

        {data && rows.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <div className="w-7 py-2.5 text-center">#</div>
              <div className="flex-1 py-2.5 pl-1">Spelare</div>
              {COLS.map((c) => (
                <button key={c.key} data-testid={`sort-${c.key}`} onClick={() => setSort(c.key)}
                  className={`w-[48px] py-2.5 flex items-center justify-center gap-0.5 ${sortKey === c.key ? "text-amber-400" : ""}`}>
                  {c.label}{sortKey === c.key && (asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </button>
              ))}
            </div>
            {sorted.map((r, i) => (
              <div key={r.id} data-testid={`leaderboard-row-${r.id}`} className="flex items-center border-b border-slate-800/60 last:border-0 bg-slate-900/40 text-sm">
                <div className="w-7 flex justify-center"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${medal(i)}`}>{i + 1}</span></div>
                <div className="flex-1 py-2.5 pl-1 flex items-center gap-2 min-w-0">
                  <PlayerAvatar icon={r.icon} name={r.name} size={28} />
                  <span className="font-medium text-slate-100 truncate">{r.name}</span>
                  <Badges badges={data.badges} userId={r.id} size="text-xs" />
                </div>
                <div className="w-[48px] text-center font-mono font-bold text-amber-400">{r.rating}</div>
                <div className="w-[48px] text-center font-mono text-emerald-400">{r.wins}</div>
                <div className="w-[48px] text-center font-mono text-slate-400">{r.losses}</div>
                <div className="w-[48px] text-center font-mono text-rose-400">{r.last_places}</div>
                <div className="w-[48px] text-center font-mono text-slate-300">{r.win_pct}%</div>
              </div>
            ))}
          </div>
        )}

        {/* Badge-förklaring */}
        {data && rows.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 px-1">
            {Object.entries(BADGE_META).map(([k, v]) => (
              <span key={k} className="text-[11px] text-slate-500">{v.emoji} {v.title}</span>
            ))}
          </div>
        )}

        {/* Historiska vinnare */}
        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold font-display text-slate-200 mb-2">Tidigare månadsvinnare</h3>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.month} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="font-mono text-slate-500 w-16">{h.month}</span>
                  {h.best_player && <span className="flex items-center gap-1 text-slate-200"><Trophy className="w-3.5 h-3.5 text-amber-400" />{h.best_player.name}</span>}
                  {h.v_ringad && <span className="flex items-center gap-1 text-slate-400 ml-auto"><Shirt className="w-3.5 h-3.5 text-amber-400" />{h.v_ringad.name}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-600 mt-3 px-1">V = vinster (1:a) • F = förluster (ej 1:a) • Sist = sistaplatser</p>
      </div>
    </div>
  );
}
