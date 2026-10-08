/** Thoth Cell mark (dark theme) — shared geometry with the website mark.
 * Isometric cube: three sensing faces on a 3×3 lattice, nucleus where
 * they meet. Palette follows the brand tokens. */
const FACES = {
  top: '32,6 54.5,19 32,32 9.5,19',
  left: '9.5,19 32,32 32,58 9.5,45',
  right: '32,32 54.5,19 54.5,45 32,58',
};

const LATTICE: Array<[number, number, number, number, string]> = [
  [24.5, 10.33, 47, 23.33, 'ink'], [17, 14.67, 39.5, 27.67, 'ink'],
  [39.5, 10.33, 17, 23.33, 'ink'], [47, 14.67, 24.5, 27.67, 'ink'],
  [9.5, 27.67, 32, 40.67, 'light'], [9.5, 36.33, 32, 49.33, 'light'],
  [17, 23.33, 17, 49.33, 'light'], [24.5, 27.67, 24.5, 53.67, 'light'],
  [32, 40.67, 54.5, 27.67, 'ink'], [32, 49.33, 54.5, 36.33, 'ink'],
  [39.5, 27.67, 39.5, 53.67, 'ink'], [47, 23.33, 47, 49.33, 'ink'],
];

export default function CellLogo({ size = 26, tone = 'dark', className = '' }:
  { size?: number; tone?: 'light' | 'dark'; className?: string }) {
  const dark = tone === 'dark';
  const edge = dark ? '#f4f1e9' : '#11110f';
  const latInk = dark ? 'rgba(17,17,15,0.28)' : 'rgba(244,241,233,0.32)';
  const latLight = dark ? 'rgba(244,241,233,0.32)' : 'rgba(17,17,15,0.28)';
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64"
      role="img" aria-label="Thoth" style={{ display: 'inline-block', overflow: 'visible' }}>
      <polygon points={FACES.top} fill={dark ? '#3a372e' : '#e9e2d0'} />
      <polygon points={FACES.left} fill={dark ? '#f4f1e9' : '#11110f'} />
      <polygon points={FACES.right} fill="#a3502e" />
      {LATTICE.map(([x1, y1, x2, y2, onLeft], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={onLeft === 'light' ? latInk : latLight}
          strokeWidth="0.9" strokeLinecap="round" />
      ))}
      <polygon points="32,6 54.5,19 54.5,45 32,58 9.5,45 9.5,19"
        fill="none" stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="4" fill={edge} />
    </svg>
  );
}
