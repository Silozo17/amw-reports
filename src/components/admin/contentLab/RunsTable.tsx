import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceStrict } from 'date-fns';
import type { AdminRunRow } from '@/hooks/useAdminContentLab';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  failed: 'destructive',
  pending: 'outline',
  scraping: 'secondary',
  analysing: 'secondary',
  ideating: 'secondary',
};

interface Props {
  rows: AdminRunRow[];
  isLoading: boolean;
  onSelect: (runId: string) => void;
}

const formatDuration = (start: string | null, end: string | null) => {
  if (!start) return '—';
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  return formatDistanceStrict(to, from);
};

const formatCost = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const RunsTable = ({ rows, isLoading, onSelect }: Props) => {
  if (isLoading) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Loading runs…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-muted-foreground text-sm py-8 text-center">No Content Lab runs yet.</div>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Org / Client</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Posts</TableHead>
            <TableHead className="text-right">Ideas</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => onSelect(r.id)}
            >
              <TableCell>
                <Badge variant={STATUS_VARIANTS[r.status] ?? 'outline'} className="text-[10px]">
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                <div className="font-medium truncate max-w-[180px]">{r.client_name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.org_name}</div>
              </TableCell>
              <TableCell className="text-sm truncate max-w-[200px]">{r.current_phase ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {r.started_at ? format(new Date(r.started_at), 'dd MMM HH:mm') : format(new Date(r.created_at), 'dd MMM HH:mm')}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDuration(r.started_at, r.completed_at)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{r.post_count}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{r.idea_count}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{formatCost(r.cost_pence)}</TableCell>
              <TableCell className="text-xs text-destructive truncate max-w-[200px]">{r.error_message ?? ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RunsTable;
