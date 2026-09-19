import { useAuth } from "../context/AuthContext";
import { LogOut } from "lucide-react";

export default function Header({ title, subtitle, right }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 glass border-b border-slate-800 px-4 pt-4 pb-3 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight text-slate-50">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <button
          data-testid="logout-button"
          onClick={logout}
          title={user?.name}
          className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
