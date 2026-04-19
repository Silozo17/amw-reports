import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminContentLabStepLogs } from '@/hooks/useAdminContentLab';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ok: 'default',
  started: 'secondary',
  failed: 'destructive',
};

const StepLogsTable = () => {
  const [runId, setRunId] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [step, setStep] = useState<string>('all');
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const { data: logs = [], isLoading } = useAdminContentLabStepLogs({
    runId: runId.trim() || undefined,
    status: status === 'all' ? undefined : status,
    step: step === 'all' ? undefined : step,
  });

  const togglePayload = (id: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Filter by run id"
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          className="max-w-[320px] font-mono text-xs"
        />
        <Select value={step} onValueChange={setStep}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Step" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All steps</SelectItem>
            <SelectItem value="pipeline">pipeline</SelectItem>
            <SelectItem value="discover">discover</SelectItem>
            <SelectItem value="scrape">scrape</SelectItem>
            <SelectItem value="analyse">analyse</SelectItem>
            <SelectItem value="ideate">ideate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="started">started</SelectItem>
            <SelectItem value="ok">ok</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">Loading step logs…</div>
      ) : logs.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center">No matching step logs.</div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => {
                const isOpen = openRows.has(l.id);
                const hasPayload = (l.payload && Object.keys(l.payload).length > 0) || !!l.error_message;
                return (
                  <Collapsible asChild key={l.id} open={isOpen} onOpenChange={() => togglePayload(l.id)}>
                    <>
                      <TableRow className="hover:bg-accent/40">
                        <TableCell>
                          {hasPayload && (
                            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(l.created_at), 'dd MMM HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{l.step}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[l.status] ?? 'outline'} className="text-[10px]">{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {l.duration_ms != null ? `${l.duration_ms} ms` : '—'}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[320px]">{l.message ?? ''}</TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">{l.run_id}</TableCell>
                      </TableRow>
                      {hasPayload && (
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30">
                              {l.error_message && (
                                <p className="text-xs text-destructive mb-2 font-mono">{l.error_message}</p>
                              )}
                              <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(l.payload, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      )}
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default StepLogsTable;
