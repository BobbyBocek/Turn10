export const BADGE_META = {
  win_streak: { emoji: "🔥", title: "Bästa vinst-streak" },
  most_comments: { emoji: "💬", title: "Mest kommentarer" },
  most_losses: { emoji: "🥄", title: "Träslev (flest förluster)" },
  most_rules: { emoji: "📖", title: "Flest skapade regler" },
  v_ringad: { emoji: "👕", title: "Innehavare av V-ringat" },
  monthly_best: { emoji: "🏆", title: "Månadens spelare" },
};

export default function Badges({ badges, userId, size = "text-sm" }) {
  if (!badges) return null;
  const mine = Object.keys(BADGE_META).filter((k) => badges[k] === userId);
  if (mine.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {mine.map((k) => (
        <span key={k} title={BADGE_META[k].title} data-testid={`badge-${k}`} className={size}>{BADGE_META[k].emoji}</span>
      ))}
    </span>
  );
}
