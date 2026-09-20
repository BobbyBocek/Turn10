import { useEffect, useState } from "react";
import api, { formatError } from "../api";
import { useAuth } from "../context/AuthContext";
import PlayerAvatar from "./../components/PlayerAvatar";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shirt, Check } from "lucide-react";
import { toast } from "sonner";

export default function MonthlyVoteModal({ open, onClose }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get("/users"), api.get("/vote/status")])
      .then(([u, s]) => { setUsers(u.data.filter((x) => x.id !== user?.id)); setMyVote(s.data.my_vote); })
      .catch((e) => toast.error(formatError(e.response?.data?.detail)));
  }, [open, user]);

  const vote = async (id) => {
    setSaving(true);
    try {
      await api.post("/vote", { voted_for: id });
      setMyVote(id);
      toast.success("Din röst är registrerad!");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/80 flex items-end justify-center" onClick={onClose}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-slate-900 border-t border-amber-500/30 rounded-t-2xl p-5 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shirt className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-slate-100 font-display">Månadens omröstning</h3>
              </div>
              <button data-testid="close-vote-modal" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Vem har betett sig som att man bär V-ringat? 👕 (en röst per månad, går att ändra)</p>
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  data-testid={`v-ringad-vote-button-${u.id}`}
                  onClick={() => vote(u.id)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    myVote === u.id ? "bg-amber-500/15 border-amber-500/60" : "bg-slate-800/60 border-slate-700 active:bg-slate-800"
                  }`}
                >
                  <PlayerAvatar icon={u.icon} name={u.display_name} size={38} />
                  <span className="flex-1 font-medium text-slate-100">{u.display_name}</span>
                  {myVote === u.id && <Check className="w-5 h-5 text-amber-400" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
