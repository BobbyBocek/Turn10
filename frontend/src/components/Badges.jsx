import VNeckShirt from "./VNeckShirt";

export const BADGE_META = {
  win_streak: { emoji: "🔥", title: "Bästa vinst-streak" },
  most_comments: { emoji: "💬", title: "Mest kommentarer" },
  most_losses: { emoji: "🥄", title: "Träslev (flest förluster)" },
  most_rules: { emoji: "📖", title: "Flest skapade regler" },
  v_ringad: { emoji: "vneck", title: "Innehavare av V-ringat" },
  monthly_best: { emoji: "🏆", title: "Månadens spelare" },
};

export function BadgeIcon({ k, className = "" }) {
  const m = BADGE_META[k];
  if (m?.emoji === "vneck") return <VNeckShirt size={14} color="#FBBF24" className={`inline ${className}`} />;
  return <span className={className}>{m?.emoji}</span>;
}

export default function Badges({ badges, userId, size = "text-sm" }) {
  if (!badges) return null;
  const mine = Object.keys(BADGE_META).filter((k) => badges[k] === userId);
  if (mine.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {mine.map((k) => (
        <span key={k} title={BADGE_META[k].title} data-testid={`badge-${k}`} className={size}><BadgeIcon k={k} /></span>
      ))}
    </span>
  );
}
