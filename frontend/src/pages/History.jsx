import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import { toast } from "sonner";
import { Trophy, Users, MessageCircle, ChevronRight, Loader2 } from "lucide-react";

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
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
        {matches === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>}
        {matches && matches.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Inga matcher ännu. Registrera din första!
          </div>
        )}
        {matches && matches.map((m) => (
          <button
            key={m.id}
            data-testid={`match-card-${m.id}`}
            onClick={() => navigate(`/match/${m.id}`)}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 active:bg-slate-800 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 truncate">
                🏆 {m.winner_name}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                <span>{fmtDate(m.date)}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.player_count}</span>
                {m.comment_count > 0 && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{m.comment_count}</span>}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        ))}
      </div>
    </div>
  );
}
