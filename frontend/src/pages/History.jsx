import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayingCard from "../components/PlayingCard";
import { toast } from "sonner";
import { Crown, Users, MessageCircle, ChevronRight, Loader2 } from "lucide-react";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function History() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    api.get("/matches").then((r) => setMatches(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setMatches([]); });
  }, []);

  return (
    <div>
      <Header title="Historik" subtitle="Alla spelade matcher" />
      <div className="px-4 py-4 space-y-2.5">
        {matches === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}
        {matches && matches.length === 0 && (
          <div className="text-center py-16 text-slate-500"><Users className="w-10 h-10 mx-auto mb-3 opacity-40" /> Inga matcher ännu.</div>
        )}
        {matches && matches.map((m) => {
          const winner = m.participants.find((p) => p.placement === 1);
          return (
            <button key={m.id} data-testid={`match-card-${m.id}`} onClick={() => navigate(`/match/${m.id}`)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 active:bg-slate-800 transition-colors text-left">
              <PlayerAvatar icon={winner?.icon} name={winner?.name} size={42} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate flex items-center gap-1"><Crown className="w-4 h-4 text-amber-400" /> {m.winner_name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{m.participants.map((p) => p.name).join(", ")}</div>
                <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                  <span>{fmtDate(m.date)}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.player_count}</span>
                  {m.comment_count > 0 && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{m.comment_count}</span>}
                </div>
              </div>
              {winner?.exit_card_value && <PlayingCard value={winner.exit_card_value} suit={winner.exit_card_suit} size="sm" />}
              <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
