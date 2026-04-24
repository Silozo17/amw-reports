import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAdminContentLabRunDetail } from '@/hooks/useAdminContentLab';

interface Props {
  runId: string | null;
  onClose: () => void;
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'ok' || status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
};

const RunDetailDrawer = ({ runId, onClose }: Props) => {
  const { data, isLoading } = useAdminContentLabRunDetail(runId);

  return (
    <Sheet open={!!runId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Run detail</SheetTitle>
          <SheetDescription className="font-mono text-xs">{runId}</SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Loading…</div>
        ) : (
          <div className="space-y-6 mt-6">
            {data.run && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-display">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm font-body">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline">{String(data.run.status)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phase</span>
                    <span>{String(data.run.current_phase ?? '—')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span>£{(Number(data.run.cost_pence ?? 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-mono text-xs">
                      {data.run.started_at ? format(new Date(String(data.run.started_at)), 'PP HH:mm') : '—'}
                    </span>
                  </div>
                  {!!data.run.error_message && (
                    <p className="text-xs text-destructive mt-2">{String(data.run.error_message)}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display">Progress ({data.progress.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.progress.length === 0 && (
                  <p className="text-sm text-muted-foreground">No progress events.</p>
                )}
                {data.progress.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 text-xs font-body border-b border-border pb-2">
                    <StatusIcon status={p.status} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{p.phase}</span>
                        <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                      </div>
                      {p.message && <p className="text-muted-foreground mt-1">{p.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(p.created_at), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm font-display">Posts</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-display">{data.posts.length}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm font-display">Ideas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-display">{data.ideas.length}</p></CardContent>
              </Card>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RunDetailDrawer;
