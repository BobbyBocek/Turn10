import { useRef, useState } from "react";
import PlayerAvatar from "./PlayerAvatar";

// players: [{id, name, icon}] i platsordning. onReorder(newIds) vid släpp.
// seatLabels: array med positionsnamn per plats.
export default function RoundTable({ players = [], onReorder, seatLabels = [] }) {
  const ref = useRef(null);
  const n = players.length;
  const [dragIdx, setDragIdx] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const dragRef = useRef(null);
  const hoverRef = useRef(null);

  const seatPct = (i) => {
    const angle = -90 + (i * 360) / Math.max(n, 1);
    const rad = (angle * Math.PI) / 180;
    return { x: 50 + 42 * Math.cos(rad), y: 50 + 42 * Math.sin(rad) };
  };

  const nearestSeat = (clientX, clientY) => {
    const r = ref.current.getBoundingClientRect();
    let best = null, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const s = seatPct(i);
      const sx = r.left + (s.x / 100) * r.width;
      const sy = r.top + (s.y / 100) * r.height;
      const d = (sx - clientX) ** 2 + (sy - clientY) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const onDown = (i, e) => {
    if (!onReorder) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = i; hoverRef.current = i;
    setDragIdx(i);
    setPos({ x: e.clientX, y: e.clientY });
    setHover(i);
  };
  const onMove = (e) => {
    if (dragRef.current === null) return;
    setPos({ x: e.clientX, y: e.clientY });
    const nearest = nearestSeat(e.clientX, e.clientY);
    hoverRef.current = nearest;
    setHover(nearest);
  };
  const onUp = () => {
    const di = dragRef.current, hi = hoverRef.current;
    if (di !== null && hi !== null && hi !== di) {
      const arr = players.map((p) => p.id);
      [arr[di], arr[hi]] = [arr[hi], arr[di]];
      onReorder(arr);
    }
    dragRef.current = null; hoverRef.current = null;
    setDragIdx(null); setHover(null);
  };

  const r = ref.current?.getBoundingClientRect();

  return (
    <div ref={ref} className="relative w-full max-w-[300px] mx-auto aspect-square my-2 select-none touch-none" data-testid="round-table">
      <div className="absolute inset-[18%] rounded-full felt border-4 border-amber-900/40 shadow-inner flex items-center justify-center">
        <span className="font-display font-black text-amber-500/40 text-xl tracking-widest">TURN10</span>
      </div>
      {players.map((p, i) => {
        const s = seatPct(i);
        const isDragging = dragIdx === i;
        const isHover = hover === i && dragIdx !== null && dragIdx !== i;
        let style = { left: `${s.x}%`, top: `${s.y}%` };
        if (isDragging && r) {
          style = { left: `${((pos.x - r.left) / r.width) * 100}%`, top: `${((pos.y - r.top) / r.height) * 100}%`, zIndex: 40 };
        }
        return (
          <div key={p.id} data-testid={`round-table-avatar-${p.id}`} onPointerDown={(e) => onDown(i, e)} onPointerMove={onMove} onPointerUp={onUp}
            className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${onReorder ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "scale-110" : "transition-all"}`}
            style={style}>
            <PlayerAvatar icon={p.icon} name={p.name} size={42} ring={isHover} />
            <span className="text-[10px] text-slate-300 mt-0.5 max-w-[62px] truncate">{p.name}</span>
            {seatLabels[i] && <span className={`text-[8px] mt-0.5 px-1 rounded ${isHover ? "text-amber-200 bg-amber-500/30" : "text-amber-300/80 bg-amber-500/10"}`}>{seatLabels[i]}</span>}
          </div>
        );
      })}
      {n === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">Lägg till spelare</div>}
    </div>
  );
}
