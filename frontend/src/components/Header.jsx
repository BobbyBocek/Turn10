import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn } from "lucide-react";

export default function Header({ title, subtitle, right }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 glass border-b border-slate-800 px-4 pt-4 pb-3 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-extrabold font-display tracking-tight text-slate-50">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        {!user && !right && (
          <button data-testid="header-login-button" onClick={() => navigate("/login")}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold active:scale-95 transition-transform">
            <LogIn className="w-4 h-4" /> Logga in
          </button>
        )}
      </div>
    </header>
  );
}
