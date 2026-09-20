import { NavLink } from "react-router-dom";
import { Home, PlusCircle, History, Trophy, BookOpen, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Hem", icon: Home, testid: "nav-tab-hem" },
  { to: "/ny-match", label: "Ny match", icon: PlusCircle, testid: "nav-tab-ny-match" },
  { to: "/historik", label: "Historik", icon: History, testid: "nav-tab-historik" },
  { to: "/topplista", label: "Topplista", icon: Trophy, testid: "nav-tab-topplista" },
  { to: "/regler", label: "Regler", icon: BookOpen, testid: "nav-tab-regler" },
  { to: "/min-sida", label: "Min sida", icon: User, testid: "nav-tab-min-sida" },
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
              `flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[50px] rounded-lg transition-colors ${
                isActive ? "text-amber-400" : "text-slate-500 active:text-slate-300"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[9px] font-medium tracking-tight">{t.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
