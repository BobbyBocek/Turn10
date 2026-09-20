import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayingCard from "../components/PlayingCard";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Crown, Send, Loader2, ArrowUp, ArrowDown, Minus, RotateCw } from "lucide-react";

const QUICK_EMOJIS = ["🔥", "💩", "🤡", "👑", "🎯", "🚀", "😭", "🍺"];

function EloBadge({ delta }) {
  if (delta > 0) return <span data-testid="elo-change-badge" className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><ArrowUp className="w-3 h-3" />+{delta}</span>;
  if (delta < 0) return <span data-testid="elo-change-badge" className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30"><ArrowDown className="w-3 h-3" />{delta}</span>;
  return <span data-testid="elo-change-badge" className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-700/40 text-slate-400 border border-slate-600/30"><Minus className="w-3 h-3" />0</span>;
}

function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get(`/matches/${id}`).then((r) => setMatch(r.data)).catch((e) => toast.error(formatError(e.response?.data?.detail)));
    api.get(`/matches/${id}/comments`).then((r) => setComments(r.data)).catch(() => {});
  }, [id]);

  const sendComment = async (emoji) => {
    const payload = emoji ? { emoji } : { text: text.trim() };
    if (!emoji && !text.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/matches/${id}/comments`, payload);
      setComments((prev) => [...prev, data]);
      if (!emoji) setText("");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSending(false); }
  };

  const playAgain = () => {
    const players = match.participants.map((p) => p.user_id);
    navigate("/ny-match", { state: { players, ruleIds: match.rule_ids } });
  };

  if (!match) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>;

  return (
    <div>
      <Header title="Matchdetaljer" subtitle={fmtDateTime(match.date)}
        right={<button data-testid="play-again-button" onClick={playAgain} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold active:scale-95 transition-transform"><RotateCw className="w-4 h-4" /> Spela igen</button>} />
      <div className="px-4 py-4 space-y-5">
        <div className="space-y-2">
          {match.participants.map((p, idx) => {
            const isWinner = p.placement === 1;
            return (
              <motion.div key={p.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                data-testid={`detail-participant-${p.user_id}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${isWinner ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-800"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${isWinner ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                  {isWinner ? <Crown className="w-4 h-4" /> : p.placement}
                </div>
                <PlayerAvatar icon={p.icon} name={p.name} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-100 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{p.table_position || "—"}</div>
                  {p.utgangs_bonus > 0 && <div className="text-[10px] text-emerald-400">+{p.utgangs_bonus} utgångsbonus</div>}
                </div>
                {p.exit_card_value && <PlayingCard value={p.exit_card_value} suit={p.exit_card_suit} size="sm" />}
                <div className="text-right">
                  <EloBadge delta={p.elo_delta} />
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.elo_before}→{p.elo_after}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {match.rules && match.rules.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2">Aktiva regler</h3>
            <div className="grid grid-cols-2 gap-2">
              {match.rules.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-b from-slate-800/80 to-slate-900 border border-amber-500/20">
                  <RuleIcon name={r.icon} className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-200 truncate">{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2">Shittalk 🗣️</h3>
          <div className="space-y-2 mb-3">
            {comments.length === 0 && <p className="text-sm text-slate-500 py-2">Ingen har snackat skit än. Var först.</p>}
            {comments.map((c) => (
              <div key={c.id} data-testid={`comment-${c.id}`} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <PlayerAvatar icon={c.icon} name={c.name} size={24} />
                  <span className="text-sm font-medium text-slate-200">{c.name}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{fmtDateTime(c.created_at)}</span>
                </div>
                {c.emoji && <div className="text-2xl">{c.emoji}</div>}
                {c.text && <p className="text-sm text-slate-300">{c.text}</p>}
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 mb-2 flex-wrap">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} data-testid={`emoji-${e}`} onClick={() => sendComment(e)} className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-xl active:scale-90 transition-transform">{e}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input data-testid="comment-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()}
              placeholder="Skriv en kommentar..." className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none text-sm" />
            <button data-testid="send-comment-button" onClick={() => sendComment()} disabled={sending}
              className="w-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
