import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Loader2, Trash2, Star } from "lucide-react";

const GAME_RULES = [
  {
    h: "Grunduppsättning",
    p: [
      "Turn10 spelas med två kortlekar så att 3–6 spelare kan vara med.",
      "Varje spelare får tre kort nedvända framför sig, tre uppvända ovanpå dessa, och tre kort på hand.",
      "Kortvärde (lägst→högst): 2, 3, 4, 5, 6, 7, 8, 9, 10, knekt (11), dam (12), kung (13), ess (14). Klädda kort räknas alltså INTE som 10.",
    ],
  },
  {
    h: "Spelets gång",
    p: [
      "Spelaren med lägst kort på hand lägger först.",
      "Kort läggs i stigande ordning – du måste lägga ett högre kort än det översta (eller en kombination enligt dubbel/trippel).",
      "Kan du inte lägga högre måste du plocka upp hela högen på bordet.",
      "Chansa: istället för att plocka upp direkt kan du dra ett blint kort från draghögen och lägga det utan att titta. Är det högt nog gäller det – annars plockar du ändå upp hela högen.",
    ],
  },
  {
    h: "Specialkort",
    p: [
      "Tvåan (2): nollställer högen. Nästa spelare får lägga valfritt kort.",
      "Tian (10): vänder bort hela högen ur spel. Den som lade tian lägger vidare på en tom hög.",
    ],
  },
  {
    h: "Fusk / bluff (\"fejka\")",
    p: [
      "Du får lägga ett kort dolt (upp och ner) i högen.",
      "Vem som helst får syna genom att vända kortet.",
      "Är kortet giltigt när det synas → den som synade plockar upp hela högen.",
      "Är kortet ogiltigt (misslyckad bluff) → du som lade det plockar upp hela högen.",
    ],
  },
  {
    h: "Kasta in kort",
    p: [
      "Ser du att någon är på väg att lägga ett kort du också har, får du kasta in ditt eget av samma valör innan de hinner.",
      "Lyckas den andra ändå lägga sitt kort (det \"sitter\") räknas det som lagt.",
    ],
  },
  {
    h: "Dubbel / trippel",
    p: [
      "Du får lägga flera kort av samma valör samtidigt som en läggning.",
      "Blir du påkommen med att korten inte matchar (fusk) plockar du upp dem och får bara lägga ett.",
    ],
  },
  {
    h: "Superregeln (turordningens låsning)",
    p: [
      "Allt kaos mellan dragen – bluffar, inkast, dubbel/trippel – är öppet och kan ifrågasättas ända tills nästa spelare lägger sitt kort ovanpå.",
      "När nästa spelares kort ligger där är föregående läggning låst och godkänd, oavsett om den egentligen var giltig. Hittar ingen på något innan turen går vidare, så gäller det som lagts.",
    ],
  },
];

export default function Rules() {
  const { user } = useAuth();
  const [rules, setRules] = useState(null);

  useEffect(() => { api.get("/rules").then((r) => setRules(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setRules([]); }); }, []);

  const del = async (id) => {
    try { await api.delete(`/rules/${id}`); setRules((prev) => prev.filter((r) => r.id !== id)); toast.success("Regel borttagen"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const RuleCard = ({ r }) => (
    <div data-testid={`rule-item-${r.id}`} className="relative flex flex-col p-3 rounded-xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-amber-500/20 min-h-[112px]">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-slate-950/60 border border-amber-500/20 flex items-center justify-center">
          <RuleIcon name={r.icon} className="w-5 h-5 text-amber-400" />
        </div>
        {r.is_base && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
        {!r.is_base && r.created_by === user?.id && (
          <button data-testid={`delete-rule-${r.id}`} onClick={() => del(r.id)} className="text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
      <div className="mt-2 font-semibold text-slate-100 text-sm">{r.name}</div>
      {r.description && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{r.description}</p>}
    </div>
  );

  const base = rules?.filter((r) => r.is_base) || [];
  const extra = rules?.filter((r) => !r.is_base) || [];

  return (
    <div>
      <Header title="Regler" subtitle="Så spelas Turn10" />
      <div className="px-4 py-4">
        <div className="space-y-4 mb-8">
          {GAME_RULES.map((sec) => (
            <div key={sec.h} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-base font-bold font-display text-amber-400 mb-2">{sec.h}</h2>
              <ul className="space-y-1.5">
                {sec.p.map((line, i) => (
                  <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2">
                    <span className="text-amber-500/60 mt-0.5">•</span><span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {rules === null && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}
        {rules && (
          <>
            <h2 className="text-lg font-bold font-display text-slate-100 mb-1 flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Grundregler (förvalda)</h2>
            <p className="text-xs text-slate-500 mb-3">Dessa är påslagna som standard i en ny match.</p>
            <div className="grid grid-cols-2 gap-2.5 mb-6">{base.map((r) => <RuleCard key={r.id} r={r} />)}</div>

            <h2 className="text-lg font-bold font-display text-slate-100 mb-3">Tillval ({extra.length})</h2>
            <div className="grid grid-cols-2 gap-2.5">{extra.map((r) => <RuleCard key={r.id} r={r} />)}</div>
            <p className="text-xs text-slate-600 mt-4">Nya regler skapas i "Ny match"-flödet och läggs automatiskt till här.</p>
          </>
        )}
      </div>
    </div>
  );
}
