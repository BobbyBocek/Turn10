const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankLabel = (v) => RANK_LABEL[v] || String(v);
export const SUITS = ["♠", "♥", "♦", "♣"];
export const isRed = (s) => s === "♥" || s === "♦";

const SIZES = {
  sm: { w: 34, h: 48, corner: 9, center: 16 },
  md: { w: 52, h: 74, corner: 12, center: 26 },
  lg: { w: 74, h: 104, corner: 15, center: 40 },
};

export default function PlayingCard({ value, suit, size = "md", selected, onClick, faceDown, className = "", testid }) {
  const s = SIZES[size] || SIZES.md;
  const clickable = typeof onClick === "function";
  const base = {
    width: s.w, height: s.h,
  };

  if (faceDown || !value || !suit) {
    return (
      <div
        data-testid={testid}
        onClick={onClick}
        style={base}
        className={`shrink-0 rounded-md border-2 border-amber-500/40 flex items-center justify-center ${
          clickable ? "cursor-pointer active:scale-95 transition-transform" : ""
        } ${className}`}
      >
        <div className="w-full h-full rounded-[3px] m-[3px] bg-[repeating-linear-gradient(45deg,#7f1d1d,#7f1d1d_4px,#991b1b_4px,#991b1b_8px)] opacity-80" />
      </div>
    );
  }

  const red = isRed(suit);
  const color = red ? "#E11D48" : "#0F172A";
  return (
    <div
      data-testid={testid}
      onClick={onClick}
      style={base}
      className={`shrink-0 relative rounded-md bg-gradient-to-br from-slate-50 to-slate-200 border border-slate-300 shadow-md flex items-center justify-center ${
        clickable ? "cursor-pointer active:scale-95 transition-transform" : ""
      } ${selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#090B10] scale-105" : ""} ${className}`}
    >
      <span className="absolute top-0.5 left-1 font-bold font-display leading-none" style={{ color, fontSize: s.corner }}>
        {rankLabel(value)}<br />{suit}
      </span>
      <span className="font-bold leading-none" style={{ color, fontSize: s.center }}>{suit}</span>
      <span className="absolute bottom-0.5 right-1 font-bold font-display leading-none rotate-180" style={{ color, fontSize: s.corner }}>
        {rankLabel(value)}<br />{suit}
      </span>
    </div>
  );
}
