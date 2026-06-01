interface Props {
  code: string;
  color?: string;
  className?: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  SDO: '#1D9E75',
  DDO: '#185FA5',
  AO: '#BA7517',
  FD: '#534AB7',
  ADMIN: '#A32D2D',
  SYSTEM: '#888888',
};

export function RoleBadge({ code, color, className = '' }: Props) {
  const bg = color ?? DEFAULT_COLORS[code] ?? '#666';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white ${className}`}
      style={{ backgroundColor: bg }}
    >
      {code}
    </span>
  );
}
