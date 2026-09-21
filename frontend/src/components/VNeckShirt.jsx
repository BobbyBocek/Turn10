// T-shirt med tydlig V-ringning
export default function VNeckShirt({ className = "", size = 20, color = "currentColor", strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Axlar och ärmar */}
      <path d="M8 3 L4 6 L6 9 L8 8 V21 H16 V8 L18 9 L20 6 L16 3" />
      {/* Tydlig V-ringning */}
      <path d="M8 3 L12 9 L16 3" />
    </svg>
  );
}
