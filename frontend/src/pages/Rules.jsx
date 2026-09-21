import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import PlayerAvatar from "../components/PlayerAvatar";
import RuleFormModal from "../components/RuleFormModal";
import { catMeta } from "../components/ruleCategory";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Loader2, Trash2, Pencil, Plus, ArrowDownUp } from "lucide-react";

const GAME_RULES = [
  { h: "Grunduppsättning", p: ["Turn10 spelas med två kortlekar så att 3–6 spelare kan vara med.", "Varje spelare får tre kort nedvända framför sig, tre uppvända ovanpå dessa, och tre kort på hand.", "Kortvärde (lägst→högst): 2, 3, 4, 5, 6, 7, 8, 9, 10, knekt (11), dam (12), kung (13), ess (14). Klädda kort räknas alltså INTE som 10."] },
  { h: "Spelets gång", p: ["Spelaren med lägst kort på hand lägger först.", "Kort läggs i stigande ordning – du måste lägga ett högre kort än det översta (eller en kombination enligt dubbel/trippel).", "Kan du inte lägga högre måste du plocka upp hela högen på bordet.", "Chansa: istället för att plocka upp direkt kan du dra ett blint kort från draghögen och lägga det utan att titta. Är det högt nog gäller det – annars plockar du ändå upp hela högen."] },
  { h: "Specialkort", p: ["Tvåan (2): nollställer högen. Nästa spelare får lägga valfritt kort.", "Tian (10): vänder bort hela högen ur spel. Den som lade tian lägger vidare på en tom hög."] },
  { h: "Fusk / bluff (\"fejka\")", p: ["Du får lägga ett kort dolt (upp och ner) i högen.", "Vem som helst får syna genom att vända kortet.", "Är kortet giltigt när det synas → den som synade plockar upp hela högen.", "Är kortet ogiltigt (misslyckad bluff) → du som lade det plockar upp hela högen."] },
  { h: "Kasta in kort", p: ["Ser du att någon är på väg att lägga ett kort du också har, får du kasta in ditt eget av samma valör innan de hinner.", "Lyckas den andra ändå lägga sitt kort (det \"sitter\") räknas det som lagt."] },
  { h: "Dubbel / trippel", p: ["Du får lägga flera kort av samma valör samtidigt som en läggning.", "Blir du påkommen med att korten inte matchar (fusk) plockar du upp dem och får bara lägga ett."] },
  { h: "Superregeln (turordningens låsning)", p: ["Allt kaos mellan dragen – bluffar, inkast, dubbel/trippel – är öppet och kan ifrågasättas ända tills nästa spelare lägger sitt kort ovanpå.", "När nästa spelares kort ligger där är föregående läggning låst och godkänd. Hittar ingen på något innan turen går vidare, så gäller det som lagts."] },
  { h: "Hur ratingen funkar", p: ["Alla börjar på 1000 poäng. Vinner du mot någon med högre rating får du mer poäng än om du vinner mot någon med lägre rating – och tvärtom när du förlorar. Din poäng jämförs mot alla andra i matchen, inte bara mot vinnaren, så hela placeringen räknas.", "Nya spelare svänger mer i rating de första matcherna för att snabbt hitta rätt nivå. Vinner du flera matcher i rad får du lite extra poäng varje gång – och tvärtom, är du inne i en tuff period förlorar du mindre poäng ju längre den pågår, så det inte känns hopplöst.", "Du får också en liten bonus baserat på vilket kort du lägger sist när du går ut – ju lägre kort, desto mer bonus. Kommer du sist i en match finns inget utgångskort att välja (du tog ju inte slut på kort), så då blir det ingen bonus den gången."] },
];

export default function Rules() {
  const { user } = useAuth();
  const [rules, setRules] = useState(null);
  const [sortBy, setSortBy] = useState("usage"); // usage | name
  const [modal, setModal] = useState({ open: false, rule: null });

  const load = () => api.get("/rules").then((r) => setRules(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setRules([]); });
  useEffect(() => { load(); }, []);

  const submitRule = async (payload) => {
    try {
      if (modal.rule) await api.put(`/rules/${modal.rule.id}`, payload);
      else await api.post("/rules", payload);
      setModal({ open: false, rule: null });
      await load();
      toast.success(modal.rule ? "Regel uppdaterad" : "Regel tillagd");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    try { await api.delete(`/rules/${id}`); setRules((prev) => prev.filter((r) => r.id !== id)); toast.success("Regel borttagen"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const sorted = [...(rules || [])].sort((a, b) => sortBy === "usage" ? (b.usage_count || 0) - (a.usage_count || 0) : a.name.localeCompare(b.name, "sv"));

  const RuleCard = ({ r }) => {
    const cm = catMeta(r.category);
    return (
      <div data-testid={`rule-item-${r.id}`} className="relative flex flex-col p-3 rounded-xl bg-slate-900/70 border-l-4 border border-slate-800" style={{ borderLeftColor: cm.color }}>
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${cm.color}22` }}>
            <RuleIcon name={r.icon} className="w-5 h-5" style={{ color: cm.color }} />
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${cm.color}22`, color: cm.color }}>{cm.label}</span>
        </div>
        <div className="mt-2 font-semibold text-slate-100 text-sm">{r.name}</div>
        {r.description && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{r.description}</p>}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 min-w-0">
            {r.creator_icon && <PlayerAvatar icon={r.creator_icon} name={r.creator_name} size={18} />}
            <span className="text-[10px] text-slate-500 truncate">{r.creator_name || "—"}</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400/80 shrink-0">{r.usage_count || 0}× använd</span>
        </div>
        {user && r.created_by === user.id && (
          <div className="absolute top-1 right-1 flex gap-1">
            <button data-testid={`edit-rule-${r.id}`} onClick={() => setModal({ open: true, rule: r })} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400"><Pencil className="w-3 h-3" /></button>
            <button data-testid={`delete-rule-${r.id}`} onClick={() => del(r.id)} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-rose-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Header title="Regler" subtitle="Så spelas Turn10"
        right={user ? <button data-testid="add-rule-button" onClick={() => setModal({ open: true, rule: null })} className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 active:scale-95 transition-transform"><Plus className="w-5 h-5" /></button> : undefined} />
      <div className="px-4 py-4">
        <div className="space-y-4 mb-8">
          {GAME_RULES.map((sec) => (
            <div key={sec.h} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-base font-bold font-display text-amber-400 mb-2">{sec.h}</h2>
              <ul className="space-y-1.5">
                {sec.p.map((line, i) => (<li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2"><span className="text-amber-500/60 mt-0.5">•</span><span>{line}</span></li>))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-display text-slate-100">Regelbibliotek ({rules?.length || 0})</h2>
          <button data-testid="toggle-sort" onClick={() => setSortBy((s) => (s === "usage" ? "name" : "usage"))} className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
            <ArrowDownUp className="w-3.5 h-3.5" /> {sortBy === "usage" ? "Mest använd" : "Namn"}
          </button>
        </div>

        {rules === null && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}
        {rules && rules.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Inga regler ännu. {user ? "Tryck + för att lägga till din första." : "Logga in för att lägga till regler."}</p>}
        {rules && sorted.filter((r) => r.is_base).length > 0 && (
          <>
            <h3 className="text-sm font-bold font-display text-amber-400 mb-2 flex items-center gap-1.5">🃏 Grundregler <span className="text-[11px] font-normal text-slate-500">(grundspelet)</span></h3>
            <div className="grid grid-cols-2 gap-2.5 mb-5">{sorted.filter((r) => r.is_base).map((r) => <RuleCard key={r.id} r={r} />)}</div>
          </>
        )}
        <h3 className="text-sm font-bold font-display text-slate-100 mb-2">Tillval ({sorted.filter((r) => !r.is_base).length})</h3>
        <div className="grid grid-cols-2 gap-2.5">{sorted.filter((r) => !r.is_base).map((r) => <RuleCard key={r.id} r={r} />)}</div>
        {!user && rules?.length > 0 && <p className="text-xs text-slate-600 mt-4">Logga in för att skapa och redigera regler.</p>}
      </div>

      <RuleFormModal open={modal.open} initial={modal.rule} title={modal.rule ? "Redigera regel" : "Skapa ny regel"}
        onClose={() => setModal({ open: false, rule: null })} onSubmit={submitRule} />
    </div>
  );
}
