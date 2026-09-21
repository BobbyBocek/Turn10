import PlayerAvatar from "./PlayerAvatar";
import PlayingCard from "./PlayingCard";
import { Crown } from "lucide-react";

const POSITION_ORDER = ["Dealer", "Andra hand", "Mittemot", "Cutoff", "Hijack", "Sista hand"];

function eloClasses(d) {
  if (d > 0) return "bg-emerald-500 text-slate-950";
  if (d < 0) return "bg-rose-500 text-slate-950";
  return "bg-slate-600 text-slate-100";
}

// Visar den faktiska matchen på bordet: placering, Elo-delta, utgångskort + bonus.
export default function MatchRoundTable({ participants = [] }) {
  const seated = [...participants].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a.table_position);
    const ib = POSITION_ORDER.indexOf(b.table_position);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.placement - b.placement;
  });
  const n = seated.length;

  return (
    <div className="relative w-full max-w-[320px] mx-auto aspect-square my-2" data-testid="match-round-table">
      <div className="absolute inset-[20%] rounded-full felt border-4 border-amber-900/40 shadow-inner flex items-center justify-center">
        <span className="font-display font-black text-amber-500/40 text-lg tracking-widest">TURN10</span>
      </div>
      {seated.map((p, i) => {
        const angle = -90 + (i * 360) / Math.max(n, 1);
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 40 * Math.cos(rad);
        const y = 50 + 40 * Math.sin(rad);
        const isWinner = p.placement === 1;
        return (
          <div key={p.user_id} data-testid={`table-player-${p.user_id}`} className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <div className="relative">
              <PlayerAvatar icon={p.icon} name={p.name} size={44} ring={isWinner} />
              {/* Placeringsbadge */}
              <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${isWinner ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-200 border border-slate-600"}`}>
                {isWinner ? <Crown className="w-3 h-3" /> : p.placement}
              </span>
              {/* Elo-badge */}
              <span className={`absolute -bottom-1 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${eloClasses(p.elo_delta)}`}>
                {p.elo_delta > 0 ? "+" : ""}{p.elo_delta}
              </span>
            </div>
            <span className="text-[10px] text-slate-200 mt-1 max-w-[70px] truncate font-medium">{p.name}</span>
            <span className="text-[8px] text-amber-300/70">{p.table_position || ""}</span>
            {/* Utgångskort + bonus */}
            <div className="flex items-center gap-0.5 mt-0.5 h-[36px]">
              {p.exit_card_value ? (
                <>
                  <PlayingCard value={p.exit_card_value} suit={p.exit_card_suit} size="sm" />
                  {p.utgangs_bonus > 0 && <span className="text-[9px] font-mono font-bold text-emerald-400">+{p.utgangs_bonus}</span>}
                </>
              ) : (
                <span className="text-[8px] text-slate-600">–</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
