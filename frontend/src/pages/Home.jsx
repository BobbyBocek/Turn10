import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatError } from "../api";
import PlayerAvatar from "../components/PlayerAvatar";
import MonthlyVoteModal from "../components/MonthlyVoteModal";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PlusCircle, ChevronRight, Trophy, Crown, LogIn, BookOpen, History } from "lucide-react";
import VNeckShirt from "../components/VNeckShirt";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }); } catch { return iso; }
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lb, setLb] = useState(null);
  const [matches, setMatches] = useState([]);
  const [voteStatus, setVoteStatus] = useState(null);
  const [voteOpen, setVoteOpen] = useState(false);

  useEffect(() => {
    api.get("/leaderboard").then((r) => setLb(r.data)).catch((e) => toast.error(formatError(e.response?.data?.detail)));
    api.get("/matches").then((r) => setMatches(r.data.slice(0, 3))).catch(() => {});
    if (user) api.get("/vote/status").then((r) => setVoteStatus(r.data)).catch(() => {});
  }, [user]);

  // --- Utloggad publik vy ---
  if (user === false) {
    return (
      <div className="px-6 py-12 text-center">
        <img src="/turn10-logo.jpg" alt="Turn10" className="w-28 h-28 rounded-2xl mx-auto mb-5 glow-gold border border-amber-500/30" />
        <h1 className="text-4xl font-black font-display tracking-tight">Turn10</h1>
        <p className="text-slate-400 text-sm mt-2 mb-8">Den ultimata vändtian-appen för gänget.<br />Logga in för att spela – eller bläddra fritt.</p>
        <button data-testid="guest-login-button" onClick={() => navigate("/login")}
          className="w-full py-4 rounded-2xl bg-amber-500 text-slate-950 font-black font-display text-lg flex items-center justify-center gap-2 glow-gold mb-3">
          <LogIn className="w-5 h-5" /> Logga in / Skapa konto
        </button>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button onClick={() => navigate("/topplista")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300"><Trophy className="w-5 h-5 text-amber-400" /><span className="text-xs">Topplista</span></button>
          <button onClick={() => navigate("/regler")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300"><BookOpen className="w-5 h-5 text-amber-400" /><span className="text-xs">Regler</span></button>
          <button onClick={() => navigate("/historik")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300"><History className="w-5 h-5 text-amber-400" /><span className="text-xs">Historik</span></button>
        </div>
      </div>
    );
  }

  // --- Inloggad dashboard ---
  return (
    <div>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-6">
          <img src="/turn10-logo.jpg" alt="Turn10" className="w-9 h-9 rounded-lg border border-amber-500/30" />
          <span className="text-2xl font-black font-display tracking-tight">Turn10</span>
        </div>

        <button data-testid="home-profile-card" onClick={() => navigate("/min-sida")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-amber-500/20 mb-4 text-left active:scale-[0.99] transition-transform">
          <PlayerAvatar icon={user?.icon} name={user?.display_name} size={52} ring />
          <div className="flex-1">
            <div className="font-bold text-slate-100 text-lg font-display">{user?.display_name}</div>
            <div className="text-xs text-slate-400">Din rating</div>
          </div>
          <div className="text-right"><div className="text-2xl font-black font-mono text-amber-400">{user?.rating ?? 1000}</div><ChevronRight className="w-4 h-4 text-slate-500 ml-auto" /></div>
        </button>

        <motion.button whileTap={{ scale: 0.98 }} data-testid="start-match-button" onClick={() => navigate("/ny-match")}
          className="w-full py-5 rounded-2xl bg-amber-500 text-slate-950 font-black text-lg font-display flex items-center justify-center gap-2 glow-gold mb-4">
          <PlusCircle className="w-6 h-6" /> Starta ny match
        </motion.button>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-amber-500/20">
            <div className="flex items-center gap-1 text-[11px] text-amber-400/80 uppercase tracking-wide mb-1"><Trophy className="w-3.5 h-3.5" /> Månadens</div>
            <div className="font-bold text-slate-100 truncate">{lb?.monthly_best?.name || "—"}</div>
            {lb?.monthly_best && <div className="text-xs text-emerald-400 font-mono">+{lb.monthly_best.total} Elo</div>}
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 uppercase tracking-wide mb-1"><VNeckShirt size={14} color="#94A3B8" /> V-ringad</div>
            <div className="font-bold text-slate-100 truncate">{lb?.v_ringad?.name || "Ingen ännu"}</div>
          </div>
        </div>

        {voteStatus && (
          <button data-testid="open-vote-banner" onClick={() => setVoteOpen(true)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border mb-4 text-left ${voteStatus.voted ? "bg-slate-900/60 border-slate-800" : "bg-amber-500/10 border-amber-500/40"}`}>
            <VNeckShirt size={24} color="#FBBF24" className="shrink-0" />
            <div className="flex-1"><div className="font-semibold text-slate-100 text-sm">Månadens V-ringad-omröstning</div>
              <div className="text-xs text-slate-400">{voteStatus.voted ? "Du har röstat – tryck för att ändra" : "Du har inte röstat än"}</div></div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        )}

        <div className="flex items-center justify-between mb-2 mt-2">
          <h2 className="text-lg font-bold font-display text-slate-100">Senaste matcher</h2>
          <button data-testid="home-all-matches" onClick={() => navigate("/historik")} className="text-xs text-amber-400 flex items-center gap-0.5">Alla <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="space-y-2">
          {matches.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">Inga matcher ännu.</div>}
          {matches.map((m) => (
            <button key={m.id} data-testid={`home-match-${m.id}`} onClick={() => navigate(`/match/${m.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 active:bg-slate-800 text-left">
              <Crown className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0"><div className="font-semibold text-slate-100 truncate">{m.winner_name}</div>
                <div className="text-xs text-slate-500">{fmtDate(m.date)} • {m.player_count} spelare</div></div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          ))}
        </div>
      </div>

      <MonthlyVoteModal open={voteOpen} onClose={() => { setVoteOpen(false); api.get("/vote/status").then((r) => setVoteStatus(r.data)).catch(() => {}); }} />
    </div>
  );
}
