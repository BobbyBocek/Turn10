import { NavLink } from "react-router-dom";
import { PlusCircle, History, Trophy, BookOpen, Sparkles } from "lucide-react";

const tabs = [
  { to: "/", label: "Ny match", icon: PlusCircle, testid: "tab-new-match" },
  { to: "/historik", label: "Historik", icon: History, testid: "tab-history" },
  { to: "/topplista", label: "Topplista", icon: Trophy, testid: "tab-leaderboard" },
  { to: "/regler", label: "Regler", icon: BookOpen, testid: "tab-rules" },
  { to: "/patchnotes", label: "Patch-notes", icon: Sparkles, testid: "tab-patch-notes" },
];

export default function BottomNav() {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 glass border-t border-slate-800 px-1 py-1.5 flex justify-around items-stretch"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/"}
            data-testid={t.testid}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] rounded-lg transition-colors ${
                isActive ? "text-sky-400" : "text-slate-500 active:text-slate-300"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium tracking-tight">{t.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
