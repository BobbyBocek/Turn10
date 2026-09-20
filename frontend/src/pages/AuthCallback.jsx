import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const match = window.location.hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : null;
    const run = async () => {
      if (!sessionId) { navigate("/login", { replace: true }); return; }
      try {
        const { data } = await api.post("/auth/google-session", {}, { headers: { "X-Session-ID": sessionId } });
        window.history.replaceState(null, "", "/");
        setUser(data);
        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };
    run();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090B10]">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );
}
