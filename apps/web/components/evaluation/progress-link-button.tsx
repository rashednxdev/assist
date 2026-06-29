'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface ProgressLinkButtonProps {
  href: string;
  evaluationPath: string;
}

export function ProgressLinkButton({ href, evaluationPath }: ProgressLinkButtonProps) {
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ data: { overall: { progress_percent: number } } }>(evaluationPath)
      .then((res) => setPercent(res.data.overall.progress_percent))
      .catch(() => setPercent(null));
  }, [evaluationPath]);

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} className="inline-flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4 shrink-0" />
        {percent !== null && (
          <span className="font-semibold tabular-nums text-primary">{percent}%</span>
        )}
        <span>My progress</span>
      </Link>
    </Button>
  );
}
