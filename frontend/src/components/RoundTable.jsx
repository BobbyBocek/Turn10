import PlayerAvatar from "./PlayerAvatar";

// players: [{id, name, icon, position}] ; onAvatarClick(id)
export default function RoundTable({ players = [], onAvatarClick }) {
  const n = players.length;
  return (
    <div className="relative w-full max-w-[300px] mx-auto aspect-square my-2" data-testid="round-table">
      <div className="absolute inset-[18%] rounded-full felt border-4 border-amber-900/40 shadow-inner flex items-center justify-center">
        <span className="font-display font-black text-amber-500/40 text-xl tracking-widest">TURN10</span>
      </div>
      {players.map((p, i) => {
        const angle = -90 + (i * 360) / Math.max(n, 1);
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(rad);
        const y = 50 + 42 * Math.sin(rad);
        return (
          <button
            key={p.id}
            data-testid={`round-table-avatar-${p.id}`}
            onClick={() => onAvatarClick && onAvatarClick(p.id)}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 animate-pop"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerAvatar icon={p.icon} name={p.name} size={40} ring={!!p.position} />
            <span className="text-[10px] text-slate-300 mt-0.5 max-w-[60px] truncate">{p.name}</span>
            <span className={`text-[8px] mt-0.5 px-1 rounded ${p.position ? "text-amber-300 bg-amber-500/15" : "text-slate-500"}`}>
              {p.position || "sätt plats"}
            </span>
          </button>
        );
      })}
      {n === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">Lägg till spelare</div>}
    </div>
  );
}
