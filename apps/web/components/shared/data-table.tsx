import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  loading,
  emptyTitle = 'No data',
  emptyDescription,
  className,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn('ibas-table-wrap p-4 space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <div className={cn('ibas-table-wrap', className)}>
      <table className="ibas-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
