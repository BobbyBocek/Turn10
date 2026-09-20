import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Loader2 } from "lucide-react";

import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import NewMatch from "./pages/NewMatch";
import History from "./pages/History";
import MatchDetail from "./pages/MatchDetail";
import Leaderboard from "./pages/Leaderboard";
import Rules from "./pages/Rules";
import Profile from "./pages/Profile";
import PatchNotes from "./pages/PatchNotes";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090B10]">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );
}

function ProtectedLayout() {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (user === false) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-[#090B10] max-w-md mx-auto relative">
      <div className="pb-24">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ny-match" element={<NewMatch />} />
        <Route path="/historik" element={<History />} />
        <Route path="/match/:id" element={<MatchDetail />} />
        <Route path="/topplista" element={<Leaderboard />} />
        <Route path="/regler" element={<Rules />} />
        <Route path="/min-sida" element={<Profile />} />
        <Route path="/patchnotes" element={<PatchNotes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-center" theme="dark" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
