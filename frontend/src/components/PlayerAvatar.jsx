export default function PlayerAvatar({ icon, name, size = 40, ring, className = "", testid }) {
  const ic = icon || { bg: "#334155", symbol: (name || "?")[0]?.toUpperCase() };
  return (
    <div
      data-testid={testid}
      className={`shrink-0 rounded-full flex items-center justify-center font-bold font-display select-none ${ring ? "ring-2 ring-amber-400" : ""} ${className}`}
      style={{ width: size, height: size, background: ic.bg, fontSize: size * 0.42, color: "#fff" }}
    >
      {ic.symbol}
    </div>
  );
}
