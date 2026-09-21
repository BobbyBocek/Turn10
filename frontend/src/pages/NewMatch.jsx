import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayingCard from "../components/PlayingCard";
import RoundTable from "../components/RoundTable";
import CardPicker from "../components/CardPicker";
import RuleFormModal from "../components/RuleFormModal";
import { catMeta } from "../components/ruleCategory";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, ChevronLeft, Plus, Crown, Loader2, Search } from "lucide-react";

export default function NewMatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [step, setStep] = useState(1);
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState([]); // platsordning: [{user_id, name, icon}]
  const [activeRuleIds, setActiveRuleIds] = useState([]);
  const [order, setOrder] = useState([]);
  const [cards, setCards] = useState({});
  const [saving, setSaving] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [picker, setPicker] = useState({ open: false, uid: null });

  useEffect(() => {
    Promise.all([api.get("/users"), api.get("/rules"), api.get("/positions")])
      .then(([u, r, p]) => {
        setUsers(u.data); setRules(r.data); setPositions(p.data);
        const baseIds = r.data.filter((x) => x.is_base).map((x) => x.id);
        if (prefill.players) {
          setSelected(prefill.players.map((id) => {
            const usr = u.data.find((x) => x.id === id);
            return usr ? { user_id: id, name: usr.display_name, icon: usr.icon } : null;
          }).filter(Boolean));
          setActiveRuleIds(prefill.ruleIds || baseIds);
        } else {
          setActiveRuleIds(baseIds); // grundregler förvalda
        }
      })
      .catch((e) => toast.error(formatError(e.response?.data?.detail)));
    // eslint-disable-next-line
  }, []);

  const toggleUser = (u) => {
    setSelected((prev) => {
      if (prev.find((p) => p.user_id === u.id)) return prev.filter((p) => p.user_id !== u.id);
      if (prev.length >= 6) { toast.error("Max 6 spelare"); return prev; }
      return [...prev, { user_id: u.id, name: u.display_name, icon: u.icon }];
    });
  };
  const toggleRule = (id) => setActiveRuleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const reorder = (ids) => setSelected((prev) => ids.map((id) => prev.find((p) => p.user_id === id)));

  const goToOrder = () => { setOrder(selected.map((s) => s.user_id)); setStep(3); };
  const move = (idx, dir) => setOrder((prev) => { const a = [...prev]; const j = idx + dir; if (j < 0 || j >= a.length) return prev; [a[idx], a[j]] = [a[j], a[idx]]; return a; });

  const createCustomRule = async (payload) => {
    try {
      const { data } = await api.post("/rules", payload);
      setRules((prev) => [...prev, data]);
      setActiveRuleIds((prev) => [...prev, data.id]);
      setRuleModal(false);
      toast.success("Regel tillagd i biblioteket");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const lastIdx = order.length - 1;
      const participants = order.map((uid, idx) => {
        const seatIdx = selected.findIndex((p) => p.user_id === uid);
        const c = idx === lastIdx ? null : cards[uid];
        return {
          user_id: uid, placement: idx + 1,
          table_position: positions[seatIdx]?.name || null,
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
  const seatLabels = selected.map((_, i) => positions[i]?.name || `Plats ${i + 1}`);
  const baseRules = rules.filter((r) => r.is_base);
  const optionalRules = rules.filter((r) => !r.is_base);

  const RuleGrid = ({ list }) => (
    <div className="grid grid-cols-3 gap-2.5">
      {list.map((r) => {
        const active = activeRuleIds.includes(r.id);
        const cm = catMeta(r.category);
        return (
          <motion.button key={r.id} data-testid={`rule-card-toggle-${r.id}`} whileTap={{ scale: 0.92 }} onClick={() => toggleRule(r.id)}
            className="relative flex flex-col items-center justify-start p-2 rounded-xl border-2 min-h-[92px] transition-all"
            style={active ? { borderColor: cm.color, background: `${cm.color}22`, boxShadow: `0 0 12px ${cm.color}55` } : { borderColor: "#334155", background: "#1e293b80" }}>
            {active && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: cm.color }}><Check className="w-3 h-3 text-slate-950" /></div>}
            <RuleIcon name={r.icon} className="w-6 h-6 mt-1 mb-1" style={active ? { color: cm.color } : { color: "#94a3b8" }} />
            <span className={`text-[10px] leading-tight text-center font-medium ${active ? "text-slate-100" : "text-slate-400"}`}>{r.name}</span>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div>
      <Header title="Ny match" subtitle={`Steg ${step} av 3`} />
      <div className="flex gap-1.5 px-4 pt-3">{[1, 2, 3].map((s) => (<div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-amber-500" : "bg-slate-800"}`} />))}</div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <RoundTable players={tablePlayers} onReorder={reorder} seatLabels={seatLabels} />
              <p className="text-center text-xs text-slate-500 mb-3 -mt-1">Dra en spelare till en annan plats för att byta bordsposition.</p>
              <div className="flex items-center gap-2 mb-3">
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
                  const seatIdx = selected.findIndex((p) => p.user_id === u.id);
                  const sel = seatIdx >= 0;
                  return (
                    <button key={u.id} data-testid={`player-select-checkbox-${u.id}`} onClick={() => toggleUser(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${sel ? "bg-amber-500/15 border-amber-500/60" : "bg-slate-900/60 border-slate-800 active:bg-slate-800"}`}>
                      <PlayerAvatar icon={u.icon} name={u.display_name} size={38} />
                      <div className="flex-1">
                        <div className="font-medium text-slate-100">{u.display_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.rating} • {u.matches_played} matcher{sel ? ` • ${positions[seatIdx]?.name || ""}` : ""}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${sel ? "bg-amber-500 border-amber-500" : "border-slate-600"}`}>{sel && <Check className="w-4 h-4 text-slate-950" />}</div>
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
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold font-display text-amber-400">Grundregler</h2>
                <span className="text-[11px] text-slate-500">avmarkera för att begränsa</span>
              </div>
              {baseRules.length === 0 ? <p className="text-sm text-slate-500 mb-4">Inga grundregler.</p> : <div className="mb-6"><RuleGrid list={baseRules} /></div>}

              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold font-display text-slate-100">Tillval</h2>
                <button data-testid="add-rule-button" onClick={() => setRuleModal(true)} className="flex items-center gap-1 text-amber-400 text-sm font-medium"><Plus className="w-4 h-4" /> Ny regel</button>
              </div>
              {optionalRules.length === 0 ? <p className="text-sm text-slate-500">Inga tillval ännu – tryck "Ny regel".</p> : <RuleGrid list={optionalRules} />}

              <div className="flex gap-2 mt-6">
                <button data-testid="step2-back-button" onClick={() => setStep(1)} className="py-3.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> Tillbaka</button>
                <button data-testid="step2-next-button" onClick={goToOrder} className="flex-1 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-1 active:scale-[0.98] transition-transform">Placeringar <ChevronRight className="w-5 h-5" /></button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="text-lg font-semibold text-slate-200 mb-1">Slutplacering & utgångskort</h2>
              <p className="text-xs text-slate-500 mb-3">Ordna 1:a överst. Sistaplacerad väljer inget kort (gick inte ut).</p>
              <div className="space-y-2">
                {order.map((uid, idx) => {
                  const s = selected.find((p) => p.user_id === uid);
                  const isWinner = idx === 0;
                  const isLast = idx === order.length - 1;
                  const c = cards[uid];
                  return (
                    <div key={uid} data-testid={`placement-row-${uid}`} className={`flex items-center gap-2 p-2.5 rounded-xl border ${isWinner ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-800"}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${isWinner ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{isWinner ? <Crown className="w-4 h-4" /> : idx + 1}</div>
                      <PlayerAvatar icon={s?.icon} name={s?.name} size={34} />
                      <div className="flex-1 min-w-0"><div className="font-medium text-slate-100 truncate">{s?.name}</div></div>
                      {isLast ? (
                        <span className="text-[9px] text-slate-500 w-[34px] text-center leading-tight">kom sist</span>
                      ) : (
                        <button data-testid={`exit-card-picker-button-${uid}`} onClick={() => setPicker({ open: true, uid })}>
                          {c ? <PlayingCard value={c.value} suit={c.suit} size="sm" /> : <div className="w-[34px] h-[48px] rounded-md border-2 border-dashed border-slate-600 flex items-center justify-center text-[8px] text-slate-500 text-center leading-tight">Välj kort</div>}
                        </button>
                      )}
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
      <RuleFormModal open={ruleModal} onClose={() => setRuleModal(false)} onSubmit={createCustomRule} />
    </div>
  );
}
