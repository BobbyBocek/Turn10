import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import Header from "../components/Header";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, X, Sparkles } from "lucide-react";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

export default function PatchNotes() {
  const [notes, setNotes] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/patch-notes").then((r) => setNotes(r.data)).catch((e) => { toast.error(formatError(e.response?.data?.detail)); setNotes([]); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Fyll i rubrik och beskrivning"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/patch-notes", form);
      setNotes((prev) => [data, ...prev]);
      setModal(false); setForm({ title: "", description: "" });
      toast.success("Patch note tillagd");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Header
        title="Patch-notes"
        subtitle="Vad som ändrats i appen"
        right={
          <button data-testid="add-patch-note-button" onClick={() => setModal(true)} className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center text-slate-950 active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-4 py-4 space-y-3">
        {notes === null && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>}
        {notes && notes.length === 0 && <div className="text-center py-16 text-slate-500">Inga patch-notes ännu.</div>}
        {notes && notes.map((n) => (
          <div key={n.id} data-testid={`patch-note-${n.id}`} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-slate-100">{n.title}</h3>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{n.description}</p>
            <div className="text-[11px] text-slate-500 mt-2 font-mono">{fmtDate(n.created_at)} • {n.author_name}</div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/70 flex items-end justify-center" onClick={() => setModal(false)}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-slate-900 border-t border-slate-700 rounded-t-2xl p-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100">Ny patch note</h3>
                <button data-testid="close-patch-modal" onClick={() => setModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <input data-testid="patch-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Rubrik" className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-sky-500 outline-none mb-3" />
              <textarea data-testid="patch-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beskrivning" rows={4} className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-sky-500 outline-none mb-4 resize-none" />
              <button data-testid="save-patch-button" onClick={save} disabled={saving} className="w-full py-3.5 rounded-xl bg-sky-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Publicera
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
