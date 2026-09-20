import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayingCard, { rankLabel } from "../components/PlayingCard";
import RoundTable from "../components/RoundTable";
import CardPicker from "../components/CardPicker";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Plus, X, Crown, Loader2, Search } from "lucide-react";

const ICON_CHOICES = ["♥", "♦", "♣", "♠", "RotateCcw", "RefreshCw", "Dices", "EyeOff", "Send", "Copy", "Lock", "Zap", "VolumeX", "Layers"];

export default function NewMatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [step, setStep] = useState(1);
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState([]); // [{user_id, name, icon, table_position}]
  const [activeRuleIds, setActiveRuleIds] = useState([]);
  const [order, setOrder] = useState([]);
  const [cards, setCards] = useState({}); // user_id -> {value, suit}
  const [saving, setSaving] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", description: "", icon: "♠" });
  const [picker, setPicker] = useState({ open: false, uid: null });

  useEffect(() => {
    Promise.all([api.get("/users"), api.get("/rules"), api.get("/positions")])
      .then(([u, r, p]) => {
        setUsers(u.data); setRules(r.data); setPositions(p.data);
        if (prefill.players) {
          const sel = prefill.players.map((id) => {
            const usr = u.data.find((x) => x.id === id);
            return usr ? { user_id: id, name: usr.display_name, icon: usr.icon, table_position: "" } : null;
          }).filter(Boolean);
          setSelected(sel);
          setActiveRuleIds(prefill.ruleIds || r.data.filter((x) => x.is_base).map((x) => x.id));
        } else {
          setActiveRuleIds(r.data.filter((x) => x.is_base).map((x) => x.id));
        }
      })
      .catch((e) => toast.error(formatError(e.response?.data?.detail)));
    // eslint-disable-next-line
  }, []);

  const toggleUser = (u) => {
    setSelected((prev) => {
      if (prev.find((p) => p.user_id === u.id)) return prev.filter((p) => p.user_id !== u.id);
      if (prev.length >= 6) { toast.error("Max 6 spelare"); return prev; }
      return [...prev, { user_id: u.id, name: u.display_name, icon: u.icon, table_position: "" }];
    });
  };

  const toggleRule = (id) => setActiveRuleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const setPos = (uid, pos) => setSelected((prev) => prev.map((s) => (s.user_id === uid ? { ...s, table_position: pos } : s)));

  const goToOrder = () => {
    if (selected.length < 3) { toast.error("Minst 3 spelare krävs"); return; }
    setOrder(selected.map((s) => s.user_id));
    setStep(3);
  };

  const move = (idx, dir) => {
    setOrder((prev) => {
      const arr = [...prev]; const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  };

  const createCustomRule = async () => {
    if (!newRule.name.trim()) { toast.error("Regeln behöver ett namn"); return; }
    try {
      const { data } = await api.post("/rules", { ...newRule, is_base: false });
      setRules((prev) => [...prev, data]);
      setActiveRuleIds((prev) => [...prev, data.id]);
      setRuleModal(false); setNewRule({ name: "", description: "", icon: "♠" });
      toast.success("Regel tillagd i biblioteket");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const participants = order.map((uid, idx) => {
        const s = selected.find((p) => p.user_id === uid);
        const c = cards[uid];
        return {
          user_id: uid, placement: idx + 1, table_position: s.table_position || null,
          exit_card_value: c?.value ?? null, exit_card_suit: c?.suit ?? null,
        };
      });
      const { data } = await api.post("/matches", { participants, rule_ids: activeRuleIds });
      toast.success("Match sparad!");
      navigate(`/match/${data.id}`);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const filtered = users.filter((u) => u.display_name.toLowerCase().includes(search.toLowerCase()));
  const tablePlayers = selected.map((s) => ({ id: s.user_id, name: s.name, icon: s.icon }));

  return (
    <div>
      <Header title="Ny match" subtitle={`Steg ${step} av 3`} />
      <div className="flex gap-1.5 px-4 pt-3">
        {[1, 2, 3].map((s) => (<div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-amber-500" : "bg-slate-800"}`} />))}
      </div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <RoundTable players={tablePlayers} />
              <div className="flex items-center gap-2 mb-3 mt-2">
                <h2 className="text-lg font-semibold text-slate-200">Välj deltagare</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono">{selected.length}/6</span>
              </div>
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input data-testid="player-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök spelare..."
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none text-sm" />
              </div>
              <div className="space-y-2">
                {filtered.map((u) => {
                  const isSel = selected.find((p) => p.user_id === u.id);
                  return (
                    <button key={u.id} data-testid={`player-select-checkbox-${u.id}`} onClick={() => toggleUser(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${isSel ? "bg-amber-500/15 border-amber-500/60" : "bg-slate-900/60 border-slate-800 active:bg-slate-800"}`}>
                      <PlayerAvatar icon={u.icon} name={u.display_name} size={38} />
                      <div className="flex-1">
                        <div className="font-medium text-slate-100">{u.display_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.rating} • {u.matches_played} matcher</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isSel ? "bg-amber-500 border-amber-500" : "border-slate-600"}`}>
                        {isSel && <Check className="w-4 h-4 text-slate-950" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button data-testid="step1-next-button" onClick={() => (selected.length >= 3 ? setStep(2) : toast.error("Minst 3 spelare krävs"))}
                className="w-full mt-5 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-1 active:scale-[0.98] transition-transform">
                Fortsätt <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="text-lg font-semibold text-slate-200 mb-1">Bordsposition</h2>
              <p className="text-xs text-slate-500 mb-3">Valfritt – används bara för statistik.</p>
              <div className="space-y-2 mb-6">
                {selected.map((s) => (
                  <div key={s.user_id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <PlayerAvatar icon={s.icon} name={s.name} size={30} />
                    <span className="flex-1 font-medium text-slate-200 text-sm">{s.name}</span>
                    <select data-testid={`position-select-${s.user_id}`} value={s.table_position} onChange={(e) => setPos(s.user_id, e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-200 outline-none max-w-[140px]">
                      <option value="">Position...</option>
                      {positions.map((p) => (<option key={p.id} value={p.name}>{p.name}</option>))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-200">Aktiva regler</h2>
                <button data-testid="add-rule-button" onClick={() => setRuleModal(true)} className="flex items-center gap-1 text-amber-400 text-sm font-medium"><Plus className="w-4 h-4" /> Ny regel</button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {rules.map((r) => {
                  const active = activeRuleIds.includes(r.id);
                  return (
                    <motion.button key={r.id} data-testid={`rule-card-toggle-${r.id}`} whileTap={{ scale: 0.92 }} onClick={() => toggleRule(r.id)}
                      className={`relative flex flex-col items-center justify-start p-2 rounded-xl border-2 min-h-[92px] transition-all ${active ? "bg-gradient-to-b from-amber-500/20 to-amber-600/5 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]" : "bg-gradient-to-b from-slate-800/70 to-slate-900 border-slate-700/60"}`}>
                      {active && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"><Check className="w-3 h-3 text-slate-950" /></div>}
                      <RuleIcon name={r.icon} className={`w-6 h-6 mt-1 mb-1 ${active ? "text-amber-300" : "text-slate-400"}`} />
                      <span className={`text-[10px] leading-tight text-center font-medium ${active ? "text-amber-200" : "text-slate-400"}`}>{r.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-6">
                <button data-testid="step2-back-button" onClick={() => setStep(1)} className="py-3.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> Tillbaka</button>
                <button data-testid="step2-next-button" onClick={goToOrder} className="flex-1 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-1 active:scale-[0.98] transition-transform">Placeringar <ChevronRight className="w-5 h-5" /></button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="text-lg font-semibold text-slate-200 mb-1">Slutplacering & utgångskort</h2>
              <p className="text-xs text-slate-500 mb-3">Ordna 1:a överst. Tryck på kortet för att välja vad var och en gick ut på.</p>
              <div className="space-y-2">
                {order.map((uid, idx) => {
                  const s = selected.find((p) => p.user_id === uid);
                  const isWinner = idx === 0;
                  const c = cards[uid];
                  return (
                    <div key={uid} data-testid={`placement-row-${uid}`} className={`flex items-center gap-2 p-2.5 rounded-xl border ${isWinner ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-800"}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${isWinner ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                        {isWinner ? <Crown className="w-4 h-4" /> : idx + 1}
                      </div>
                      <PlayerAvatar icon={s?.icon} name={s?.name} size={34} />
                      <div className="flex-1 min-w-0"><div className="font-medium text-slate-100 truncate">{s?.name}</div></div>
                      <button data-testid={`exit-card-picker-button-${uid}`} onClick={() => setPicker({ open: true, uid })}>
                        {c ? <PlayingCard value={c.value} suit={c.suit} size="sm" /> :
                          <div className="w-[34px] h-[48px] rounded-md border-2 border-dashed border-slate-600 flex items-center justify-center text-[8px] text-slate-500 text-center leading-tight">Välj kort</div>}
                      </button>
                      <div className="flex flex-col gap-1">
                        <button data-testid={`move-up-${uid}`} onClick={() => move(idx, -1)} disabled={idx === 0} className="w-7 h-6 rounded bg-slate-800 disabled:opacity-30 flex items-center justify-center"><ChevronLeft className="w-4 h-4 rotate-90 text-slate-300" /></button>
                        <button data-testid={`move-down-${uid}`} onClick={() => move(idx, 1)} disabled={idx === order.length - 1} className="w-7 h-6 rounded bg-slate-800 disabled:opacity-30 flex items-center justify-center"><ChevronRight className="w-4 h-4 rotate-90 text-slate-300" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-6">
                <button data-testid="step3-back-button" onClick={() => setStep(2)} className="py-3.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> Tillbaka</button>
                <button data-testid="submit-match-results-button" onClick={save} disabled={saving} className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Spara match
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CardPicker open={picker.open} initial={cards[picker.uid]} onClose={() => setPicker({ open: false, uid: null })}
        onSelect={(card) => setCards((prev) => ({ ...prev, [picker.uid]: card }))} />

      {/* Custom rule modal */}
      <AnimatePresence>
        {ruleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/70 flex items-end justify-center" onClick={() => setRuleModal(false)}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-slate-900 border-t border-amber-500/30 rounded-t-2xl p-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100 font-display">Skapa ny regel</h3>
                <button data-testid="close-rule-modal" onClick={() => setRuleModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <input data-testid="new-rule-name" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="Regelnamn"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-amber-500 outline-none mb-3" />
              <textarea data-testid="new-rule-description" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} placeholder="Beskrivning (valfritt)" rows={2}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-amber-500 outline-none mb-3 resize-none" />
              <p className="text-xs text-slate-500 mb-2">Välj ikon</p>
              <div className="grid grid-cols-7 gap-2 mb-5">
                {ICON_CHOICES.map((ic) => (
                  <button key={ic} data-testid={`icon-choice-${ic}`} onClick={() => setNewRule({ ...newRule, icon: ic })}
                    className={`aspect-square rounded-lg flex items-center justify-center border ${newRule.icon === ic ? "bg-amber-500/20 border-amber-400" : "bg-slate-800 border-slate-700"}`}>
                    <RuleIcon name={ic} className="w-5 h-5 text-amber-300" />
                  </button>
                ))}
              </div>
              <button data-testid="save-rule-button" onClick={createCustomRule} className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold active:scale-[0.98] transition-transform">Lägg till regel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
