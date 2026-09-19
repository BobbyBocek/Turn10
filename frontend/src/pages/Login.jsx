import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatError } from "../api";
import { Spade, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const { data } = await api.post(endpoint, body);
      setUser(data);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-[#090B10] text-slate-100 max-w-md mx-auto">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/40 glow-primary mb-4">
          <Spade className="w-8 h-8 text-sky-400" />
        </div>
        <h1 className="text-3xl font-bold font-display tracking-tight">Kortkväll</h1>
        <p className="text-slate-400 text-sm mt-1">Elo, statistik & shittalk för gänget</p>
      </div>

      <div className="flex bg-slate-900/60 rounded-xl p-1 mb-6 border border-slate-800">
        {["login", "register"].map((m) => (
          <button
            key={m}
            data-testid={`auth-tab-${m}`}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              mode === m ? "bg-sky-500 text-slate-950" : "text-slate-400"
            }`}
          >
            {m === "login" ? "Logga in" : "Skapa konto"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <input
            data-testid="register-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Namn"
            required
            className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-500 outline-none"
          />
        )}
        <input
          data-testid="auth-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-post"
          required
          className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-500 outline-none"
        />
        <input
          data-testid="auth-password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Lösenord"
          required
          className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-sky-500 outline-none"
        />
        <button
          data-testid="auth-submit-button"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-sky-500 text-slate-950 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "login" ? "Logga in" : "Skapa konto"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-xs text-slate-500 uppercase tracking-wider">eller</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      <button
        data-testid="google-login-button"
        onClick={googleLogin}
        className="w-full py-3.5 rounded-xl bg-white text-slate-900 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
        Fortsätt med Google
      </button>
    </div>
  );
}
