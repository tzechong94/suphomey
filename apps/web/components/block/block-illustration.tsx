/**
 * A little HDB block drawn in SVG: one row of windows per (scaled) floor, in a
 * pastel picked from the block id so each block keeps its own colour.
 */
const PASTELS = ['#bde7d6', '#ffd2b8', '#ffe9a8', '#c9ddf7', '#e3d5f5'];

export function BlockIllustration({ id, floors, label }: { id: number; floors: number | null; label: string }) {
  const rows = Math.max(4, Math.min(14, Math.round((floors ?? 12) / 3)));
  const colour = PASTELS[id % PASTELS.length];
  const floorH = 14;
  const height = rows * floorH + 30;
  return (
    <svg viewBox={`0 0 120 ${height + 10}`} className="h-44 w-auto" role="img" aria-label={`Illustration of ${label}`}>
      <rect x="10" y="10" width="100" height={height} rx="6" fill={colour} stroke="#1f2430" strokeWidth="2.5" />
      <rect x="6" y="6" width="108" height="12" rx="4" fill="#1f2430" />
      {Array.from({ length: rows }).map((_, r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={20 + c * 22} y={24 + r * floorH} width="14" height="8" rx="2" fill={(r * 3 + c + id) % 7 === 0 ? '#ffe9a8' : '#fbf7f0'} stroke="#1f2430" strokeWidth="1.5" />
        )),
      )}
      <rect x="50" y={height - 8} width="20" height="18" rx="3" fill="#1f2430" />
    </svg>
  );
}
