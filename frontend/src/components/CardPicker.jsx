import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PlayingCard, { SUITS, rankLabel } from "./PlayingCard";
import { useState } from "react";

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export default function CardPicker({ open, onClose, onSelect, initial }) {
  const [suit, setSuit] = useState(initial?.suit || "♠");
  const [value, setValue] = useState(initial?.value || null);

  const confirm = () => {
    if (!value) return;
    onSelect({ value, suit });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/75 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border-t border-amber-500/30 rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100 font-display">Välj utgångskort</h3>
              <button data-testid="close-card-picker" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="flex justify-center mb-4">
              <PlayingCard value={value} suit={suit} size="lg" />
            </div>

            <div className="flex justify-center gap-2 mb-4">
              {SUITS.map((s) => {
                const red = s === "♥" || s === "♦";
                return (
                  <button
                    key={s}
                    data-testid={`suit-${s}`}
                    onClick={() => setSuit(s)}
                    className={`w-12 h-12 rounded-lg border-2 text-2xl font-bold flex items-center justify-center transition-all ${
                      suit === s ? "border-amber-400 bg-amber-500/10 scale-105" : "border-slate-700 bg-slate-800"
                    }`}
                    style={{ color: red ? "#E11D48" : "#E2E8F0" }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-5">
              {RANKS.map((r) => (
                <button
                  key={r}
                  data-testid={`rank-${r}`}
                  onClick={() => setValue(r)}
                  className={`aspect-[2.5/3.4] rounded-md border font-bold font-display text-sm transition-all ${
                    value === r ? "bg-amber-500 text-slate-950 border-amber-400 scale-105" : "bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                >
                  {rankLabel(r)}
                </button>
              ))}
            </div>

            <button
              data-testid="confirm-card-button"
              onClick={confirm}
              disabled={!value}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              Bekräfta kort
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
