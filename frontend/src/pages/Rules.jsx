import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import RuleIcon from "../components/RuleIcon";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Star } from "lucide-react";

export default function Rules() {
  const { user } = useAuth();
  const [rules, setRules] = useState(null);

  const load = () => api.get("/rules").then((r) => setRules(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setRules([]); });
  useEffect(load, []);

  const del = async (id) => {
    try { await api.delete(`/rules/${id}`); setRules((prev) => prev.filter((r) => r.id !== id)); toast.success("Regel borttagen"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const base = rules?.filter((r) => r.is_base) || [];
  const extra = rules?.filter((r) => !r.is_base) || [];

  const Card = ({ r }) => (
    <div data-testid={`rule-item-${r.id}`} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
        <RuleIcon name={r.icon} className="w-5 h-5 text-sky-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-100">{r.name}</span>
          {r.is_base && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
        </div>
        {r.description && <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>}
      </div>
      {r.created_by === user?.id && (
        <button data-testid={`delete-rule-${r.id}`} onClick={() => del(r.id)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-rose-400 active:scale-90 transition-transform">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div>
      <Header title="Regler" subtitle="Grundregler & regelbibliotek" />
      <div className="px-4 py-4">
        {rules === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>}
        {rules && (
          <>
            <div className="flex items-center gap-1.5 mb-3">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <h2 className="text-lg font-semibold text-slate-200">Grundregler</h2>
            </div>
            <div className="space-y-2 mb-6">{base.map((r) => <Card key={r.id} r={r} />)}</div>

            <h2 className="text-lg font-semibold text-slate-200 mb-3">Tillval ({extra.length})</h2>
            <div className="space-y-2">{extra.map((r) => <Card key={r.id} r={r} />)}</div>
            <p className="text-xs text-slate-600 mt-4">Nya regler skapas i "Ny match"-flödet och läggs automatiskt till här.</p>
          </>
        )}
      </div>
    </div>
  );
}
