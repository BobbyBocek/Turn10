import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatError } from "../api";
import Header from "../components/Header";
import PlayerAvatar from "../components/PlayerAvatar";
import { toast } from "sonner";
import { LogOut, Sparkles, Check, Loader2, ChevronRight } from "lucide-react";

const BG_COLORS = ["#E11D48", "#F59E0B", "#10B981", "#38BDF8", "#A855F7", "#EC4899", "#F97316", "#334155"];
const SYMBOLS = ["♠", "♥", "♦", "♣", "★", "♛", "⚡", "🔥"];

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [bg, setBg] = useState(user?.icon?.bg || "#334155");
  const [symbol, setSymbol] = useState(user?.icon?.symbol || (user?.name || "?")[0]?.toUpperCase());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/profile", { nickname, icon: { bg, symbol } });
      await refreshUser();
      toast.success("Profil sparad");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Header title="Min sida" subtitle={user?.email} />
      <div className="px-4 py-4 space-y-6">
        {/* Preview */}
        <div className="flex flex-col items-center gap-2 py-2">
          <PlayerAvatar icon={{ bg, symbol }} name={nickname || user?.name} size={80} ring />
          <div className="font-bold text-lg font-display text-slate-100">{nickname || user?.name}</div>
          <div className="text-xs text-slate-500 font-mono">Rating {user?.rating}</div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2 block">Smeknamn</label>
          <input data-testid="nickname-input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ditt smeknamn"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2 block">Bakgrundsfärg</label>
          <div className="grid grid-cols-8 gap-2">
            {BG_COLORS.map((c) => (
              <button key={c} data-testid={`bg-color-${c}`} onClick={() => setBg(c)} style={{ background: c }}
                className={`aspect-square rounded-lg flex items-center justify-center ${bg === c ? "ring-2 ring-amber-400" : ""}`}>
                {bg === c && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-slate-400 font-mono mb-2 block">Symbol</label>
          <div className="grid grid-cols-8 gap-2">
            {SYMBOLS.map((s) => (
              <button key={s} data-testid={`symbol-${s}`} onClick={() => setSymbol(s)}
                className={`aspect-square rounded-lg bg-slate-800 border text-xl flex items-center justify-center ${symbol === s ? "border-amber-400 text-amber-400" : "border-slate-700 text-slate-300"}`}>
                {s}
              </button>
            ))}
          </div>
          <input data-testid="symbol-custom-input" value={symbol} onChange={(e) => setSymbol(e.target.value.slice(0, 2))} placeholder="Eller egen symbol/bokstav"
            className="w-full mt-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none text-sm" />
        </div>

        <button data-testid="save-profile-button" onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Spara profil
        </button>

        <div className="pt-2 space-y-2 border-t border-slate-800">
          <button data-testid="patch-notes-link" onClick={() => navigate("/patchnotes")}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 active:bg-slate-800">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="flex-1 text-left font-medium text-slate-200">Patch-notes</span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button data-testid="logout-button" onClick={logout}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 active:bg-slate-800 text-rose-400">
            <LogOut className="w-5 h-5" />
            <span className="flex-1 text-left font-medium">Logga ut</span>
          </button>
        </div>
      </div>
    </div>
  );
}
