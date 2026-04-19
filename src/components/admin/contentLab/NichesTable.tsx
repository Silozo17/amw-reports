import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { AdminNicheRow } from '@/hooks/useAdminContentLab';

interface Props {
  rows: AdminNicheRow[];
  isLoading: boolean;
}

const formatCost = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const NichesTable = ({ rows, isLoading }: Props) => {
  if (isLoading) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Loading niches…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-muted-foreground text-sm py-8 text-center">No niches yet.</div>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Niche</TableHead>
            <TableHead>Org / Client</TableHead>
            <TableHead>Discovered</TableHead>
            <TableHead className="text-right">Runs</TableHead>
            <TableHead className="text-right">Total cost</TableHead>
            <TableHead>Last run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="text-sm font-medium truncate max-w-[260px]">{n.label}</TableCell>
              <TableCell className="text-sm">
                <div className="truncate max-w-[180px]">{n.client_name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[180px]">{n.org_name}</div>
              </TableCell>
              <TableCell>
                {n.discovered_at ? (
                  <span className="text-xs text-muted-foreground">{format(new Date(n.discovered_at), 'dd MMM yyyy')}</span>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Not discovered</Badge>
                )}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">{n.run_count}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{formatCost(n.total_cost_pence)}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {n.last_run_at ? format(new Date(n.last_run_at), 'dd MMM HH:mm') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default NichesTable;
