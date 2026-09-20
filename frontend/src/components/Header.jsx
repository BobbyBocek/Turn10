export default function Header({ title, subtitle, right }) {
  return (
    <header className="sticky top-0 z-40 glass border-b border-slate-800 px-4 pt-4 pb-3 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-extrabold font-display tracking-tight text-slate-50">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
