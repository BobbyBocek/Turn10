import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import IconPicker from "./IconPicker";
import RuleIcon from "./RuleIcon";
import { CATEGORIES } from "./ruleCategory";

export default function RuleFormModal({ open, onClose, onSubmit, initial, title = "Skapa ny regel" }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("♠");
  const [category, setCategory] = useState("special");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setIcon(initial?.icon || "♠");
      setCategory(initial?.category || "special");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description, icon, category, is_base: false });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/70 flex items-end justify-center" onClick={onClose}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border-t border-amber-500/30 rounded-t-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100 font-display flex items-center gap-2">
                <RuleIcon name={icon} className="w-5 h-5 text-amber-300" /> {title}
              </h3>
              <button data-testid="close-rule-modal" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <input data-testid="new-rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Regelnamn"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-amber-500 outline-none mb-3" />
            <textarea data-testid="new-rule-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beskrivning (valfritt)" rows={2}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-amber-500 outline-none mb-4 resize-none" />

            <p className="text-xs text-slate-500 mb-2">Kategori (styr färg)</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CATEGORIES.map((c) => (
                <button key={c.key} data-testid={`category-${c.key}`} onClick={() => setCategory(c.key)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${category === c.key ? "text-slate-950" : "text-slate-300 bg-slate-800 border-slate-700"}`}
                  style={category === c.key ? { background: c.color, borderColor: c.color } : {}}>
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mb-5"><IconPicker value={icon} onChange={setIcon} /></div>

            <button data-testid="save-rule-button" onClick={submit} className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold active:scale-[0.98] transition-transform">
              Spara regel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
