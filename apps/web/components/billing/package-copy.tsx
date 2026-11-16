import { Check } from 'lucide-react';

/** Description and highlights, shown as soon as the package is on screen. */
export function PackageCopy({ description, features }: { description?: string; features?: string[] }) {
  const lines = (features ?? []).map((f) => f.trim()).filter(Boolean);
  if (!description?.trim() && lines.length === 0) return null;
  return (
    <div className="space-y-2">
      {description?.trim() ? <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{description}</p> : null}
      {lines.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {lines.map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
