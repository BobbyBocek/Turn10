import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { formatError } from "../api";
import Header from "../components/Header";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayingCard from "../components/PlayingCard";
import CardPicker from "../components/CardPicker";
import RuleIcon from "../components/RuleIcon";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Check, Crown, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 3;

// Adminvy: redigera en redan sparad match. Ändringar räknar om Elo för matchen och alla matcher efter den.
export default function EditMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState([]);
  const [positions, setPositions] = useState([]);
  const [order, setOrder] = useState([]);          // [{user_id, name, icon}] i placeringsordning
  const [cards, setCards] = useState({});          // uid -> {value, suit}
  const [seat, setSeat] = useState({});            // uid -> positionsnamn
  const [ruleIds, setRuleIds] = useState([]);
  const [picker, setPicker] = useState({ open: false, uid: null });
  const [addId, setAddId] = useState("");

  // dra för att ändra placering (samma sätt som i Ny match)
  const rowsRef = useRef({});
  const dragRef = useRef(null);
  const [dragUid, setDragUid] = useState(null);
  const idxAtY = (y) => {
    for (const p of order) {
      const el = rowsRef.current[p.user_id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return order.findIndex((x) => x.user_id === p.user_id);
    }
    return null;
  };
  const onRowDown = (uid, e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = uid; setDragUid(uid); };
  const onRowMove = (e) => {
    const dr = dragRef.current;
    if (dr === null) return;
    const t = idxAtY(e.clientY);
    const cur = order.findIndex((x) => x.user_id === dr);
    if (t !== null && t !== cur) setOrder((prev) => { const a = [...prev]; const [item] = a.splice(cur, 1); a.splice(t, 0, item); return a; });
  };
  const onRowUp = () => { dragRef.current = null; setDragUid(null); };

  useEffect(() => {
    if (!user || !user.is_admin) { setLoading(false); return; }
    Promise.all([api.get(`/matches/${id}`), api.get("/users"), api.get("/rules"), api.get("/positions")])
      .then(([m, u, r, p]) => {
        setUsers(u.data); setRules(r.data); setPositions(p.data);
        const parts = [...m.data.participants].sort((a, b) => a.placement - b.placement);
        setOrder(parts.map((x) => ({ user_id: x.user_id, name: x.name, icon: x.icon })));
        const c = {}, s = {};
        parts.forEach((x) => {
          if (x.exit_card_value) c[x.user_id] = { value: x.exit_card_value, suit: x.exit_card_suit };
          if (x.table_position) s[x.user_id] = x.table_position;
        });
        setCards(c); setSeat(s);
        setRuleIds(m.data.rule_ids || []);
      })
      .catch((e) => toast.error(formatError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [id, user]);

  const removePlayer = (uid) => {
    if (order.length <= MIN_PLAYERS) { toast.error(`En match måste ha minst ${MIN_PLAYERS} spelare`); return; }
    setOrder((prev) => prev.filter((p) => p.user_id !== uid));
  };
  const addPlayer = () => {
    if (!addId) return;
    if (order.length >= MAX_PLAYERS) { toast.error(`Max ${MAX_PLAYERS} spelare`); return; }
    const u = users.find((x) => x.id === addId);
    if (!u) return;
    setOrder((prev) => [...prev, { user_id: u.id, name: u.display_name, icon: u.icon }]);
    const used = new Set(Object.values(seat));
    const free = positions.find((p) => !used.has(p.name));
    if (free) setSeat((prev) => ({ ...prev, [u.id]: free.name }));
    setAddId("");
  };
  const toggleRule = (rid) => setRuleIds((prev) => (prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]));

  const save = async () => {
    if (!window.confirm("Spara ändringarna? Elo och statistik räknas om för den här matchen och alla matcher efter den.")) return;
    setSaving(true);
    try {
      const last = order.length - 1;
      const participants = order.map((p, idx) => ({
        user_id: p.user_id, placement: idx + 1,
        table_position: seat[p.user_id] || null,
        exit_card_value: idx === last ? null : (cards[p.user_id]?.value ?? null),
        exit_card_suit: idx === last ? null : (cards[p.user_id]?.suit ?? null),
      }));
      await api.put(`/matches/${id}`, { participants, rule_ids: ruleIds });
      toast.success("Matchen är uppdaterad och Elo omräknat");
      navigate(`/match/${id}`);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!window.confirm("Ta bort hela matchen? Dess kommentarer tas också bort och Elo räknas om för alla senare matcher. En säkerhetskopia sparas.")) return;
    try {
      await api.delete(`/matches/${id}`);
      toast.success("Matchen är borttagen");
      navigate("/historik", { replace: true });
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>;
  if (!user || !user.is_admin) {
    return (<div><Header title="Redigera match" /><p className="p-6 text-sm text-slate-400">Bara admin kan redigera matcher.</p></div>);
  }

  const inMatch = new Set(order.map((p) => p.user_id));
  const available = users.filter((u) => !inMatch.has(u.id));
  const baseRules = rules.filter((r) => r.is_base);
  const optionalRules = rules.filter((r) => !r.is_base);

  const RuleRow = ({ r }) => {
    const on = ruleIds.includes(r.id);
    return (
      <button key={r.id} data-testid={`edit-rule-${r.id}`} onClick={() => toggleRule(r.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm ${on ? "bg-amber-500/10 border-amber-500/40 text-slate-100" : "bg-slate-900/60 border-slate-800 text-slate-400"}`}>
        <RuleIcon name={r.icon} className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{r.name}</span>
        <span className={`w-5 h-5 rounded border flex items-center justify-center ${on ? "bg-amber-500 border-amber-500" : "border-slate-600"}`}>{on && <Check className="w-3.5 h-3.5 text-slate-950" />}</span>
      </button>
    );
  };

  return (
    <div>
      <Header title="Redigera match" subtitle="Adminläge" />
      <div className="px-4 py-4 space-y-5">
        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          Dra i greppet för att ändra placering (1:a överst). Elo och statistik räknas om för den här matchen och alla matcher efter den. Matcher före påverkas inte. En säkerhetskopia sparas automatiskt.
        </p>

        <div>
          <h2 className="text-sm font-semibold text-slate-200 mb-2">Spelare och placering ({order.length}/{MAX_PLAYERS})</h2>
          <div className="space-y-2">
            {order.map((p, idx) => {
              const isLast = idx === order.length - 1;
              const isWinner = idx === 0;
              const c = cards[p.user_id];
              return (
                <div key={p.user_id} ref={(el) => { rowsRef.current[p.user_id] = el; }} data-testid={`edit-row-${p.user_id}`}
                  className={`flex items-center gap-2 p-2 rounded-xl border ${isWinner ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-800"} ${dragUid === p.user_id ? "ring-2 ring-amber-400 opacity-80" : ""}`}>
                  <div className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${isWinner ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{isWinner ? <Crown className="w-3.5 h-3.5" /> : idx + 1}</div>
                  <PlayerAvatar icon={p.icon} name={p.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate leading-tight">{p.name}</div>
                    <select data-testid={`edit-pos-${p.user_id}`} value={seat[p.user_id] || ""} onChange={(e) => setSeat((prev) => ({ ...prev, [p.user_id]: e.target.value }))}
                      className="w-full mt-0.5 px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300">
                      <option value="">Ingen position</option>
                      {positions.map((pos) => <option key={pos.id} value={pos.name}>{pos.name}</option>)}
                    </select>
                  </div>
                  {isLast ? (
                    <span className="text-[9px] text-slate-500 w-[34px] text-center leading-tight shrink-0">kom sist</span>
                  ) : (
                    <button data-testid={`edit-card-${p.user_id}`} className="shrink-0" onClick={() => setPicker({ open: true, uid: p.user_id })}>
                      {c ? <PlayingCard value={c.value} suit={c.suit} size="sm" /> : <div className="w-[34px] h-[48px] rounded-md border-2 border-dashed border-slate-600 flex items-center justify-center text-[8px] text-slate-500 text-center leading-tight">Välj kort</div>}
                    </button>
                  )}
                  <button data-testid={`edit-remove-${p.user_id}`} aria-label="Ta bort spelare" onClick={() => removePlayer(p.user_id)}
                    className="shrink-0 w-8 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-center"><X className="w-4 h-4" /></button>
                  <div data-testid={`edit-drag-${p.user_id}`} onPointerDown={(e) => onRowDown(p.user_id, e)} onPointerMove={onRowMove} onPointerUp={onRowUp}
                    className="shrink-0 w-9 h-11 rounded bg-slate-800 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>

          {order.length < MAX_PLAYERS && (
            <div className="flex gap-2 mt-3">
              <select data-testid="edit-add-select" value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200">
                <option value="">Lägg till spelare…</option>
                {available.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select>
              <button data-testid="edit-add-button" onClick={addPlayer} className="px-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> Lägg till</button>
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-1.5">En ny spelare hamnar sist; dra upp den till rätt placering.</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-200 mb-2">Grundregler</h2>
          <div className="space-y-1.5">{baseRules.map((r) => <RuleRow key={r.id} r={r} />)}</div>
          {optionalRules.length > 0 && (<>
            <h2 className="text-sm font-semibold text-slate-200 mt-4 mb-2">Tillval</h2>
            <div className="space-y-1.5">{optionalRules.map((r) => <RuleRow key={r.id} r={r} />)}</div>
          </>)}
        </div>

        <div className="flex gap-2">
          <button data-testid="edit-delete-button" onClick={del} className="py-3.5 px-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1"><Trash2 className="w-4 h-4" /> Ta bort match</button>
          <button data-testid="edit-save-button" onClick={save} disabled={saving} className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Spara ändringar
          </button>
        </div>
      </div>

      <CardPicker open={picker.open} initial={cards[picker.uid]} onClose={() => setPicker({ open: false, uid: null })}
        onSelect={(card) => setCards((prev) => ({ ...prev, [picker.uid]: card }))} />
    </div>
  );
}
