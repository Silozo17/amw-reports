import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, ChevronDown } from 'lucide-react';
import { useAdminContentLabRunDetail, type AdminStepLog } from '@/hooks/useAdminContentLab';

interface Props {
  runId: string | null;
  onClose: () => void;
}

const StepIcon = ({ status }: { status: AdminStepLog['status'] }) => {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
};

const RunDetailDrawer = ({ runId, onClose }: Props) => {
  const { data, isLoading } = useAdminContentLabRunDetail(runId);

  const groupBy = <T extends Record<string, unknown>>(items: T[], key: keyof T): Record<string, T[]> => {
    return items.reduce<Record<string, T[]>>((acc, item) => {
      const k = String(item[key] ?? 'unknown');
      acc[k] = acc[k] ?? [];
      acc[k].push(item);
      return acc;
    }, {});
  };

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
            {/* Run summary */}
            {data.run && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-display">Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 font-body">
                  <p><span className="text-muted-foreground">Status: </span><Badge variant="outline" className="text-[10px]">{String(data.run.status)}</Badge></p>
                  <p><span className="text-muted-foreground">Created: </span>{format(new Date(String(data.run.created_at)), 'dd MMM yyyy HH:mm:ss')}</p>
                  {data.run.started_at != null && (
                    <p><span className="text-muted-foreground">Started: </span>{format(new Date(String(data.run.started_at)), 'dd MMM yyyy HH:mm:ss')}</p>
                  )}
                  {data.run.completed_at != null && (
                    <p><span className="text-muted-foreground">Completed: </span>{format(new Date(String(data.run.completed_at)), 'dd MMM yyyy HH:mm:ss')}</p>
                  )}
                  {data.run.error_message != null && (
                    <p className="text-destructive break-words"><span className="text-muted-foreground">Error: </span>{String(data.run.error_message)}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display">Step timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {data.stepLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No step logs recorded.</p>
                ) : (
                  <ol className="space-y-2">
                    {data.stepLogs.map((l) => (
                      <li key={l.id} className="flex items-start gap-2 text-xs">
                        <StepIcon status={l.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{l.step}</span>
                            <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                            {l.duration_ms != null && (
                              <span className="text-muted-foreground tabular-nums">{l.duration_ms} ms</span>
                            )}
                            <span className="text-muted-foreground ml-auto">{format(new Date(l.created_at), 'HH:mm:ss')}</span>
                          </div>
                          {l.message && <p className="text-muted-foreground mt-0.5">{l.message}</p>}
                          {l.error_message && <p className="text-destructive mt-0.5 font-mono break-words">{l.error_message}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* Niche snapshot */}
            {data.niche && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-display">Niche config</CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap bg-muted/30 p-3 rounded">
                        {JSON.stringify(data.niche, null, 2)}
                      </pre>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Posts grouped by bucket */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display">Posts ({data.posts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {data.posts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No posts.</p>
                ) : (
                  <ScrollArea className="h-[260px] pr-3">
                    <div className="space-y-3">
                      {Object.entries(groupBy(data.posts, 'bucket')).map(([bucket, posts]) => (
                        <div key={bucket}>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{bucket} ({posts.length})</p>
                          <ul className="space-y-1">
                            {posts.map((p) => (
                              <li key={String(p.id)} className="text-xs flex items-center gap-2">
                                <span className="font-mono text-muted-foreground">@{String(p.author_handle)}</span>
                                <span className="text-muted-foreground">·</span>
                                <span>{String(p.platform)}</span>
                                <span className="text-muted-foreground ml-auto tabular-nums">
                                  {Number(p.likes ?? 0)}❤ {Number(p.comments ?? 0)}💬
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Ideas grouped by platform */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display">Ideas ({data.ideas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {data.ideas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No ideas.</p>
                ) : (
                  <ScrollArea className="h-[260px] pr-3">
                    <div className="space-y-3">
                      {Object.entries(groupBy(data.ideas, 'target_platform')).map(([platform, ideas]) => (
                        <div key={platform}>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{platform} ({ideas.length})</p>
                          <ul className="space-y-1">
                            {ideas.map((i) => (
                              <li key={String(i.id)} className="text-xs">
                                <span className="text-muted-foreground tabular-nums">#{Number(i.idea_number)}</span>{' '}
                                {String(i.title)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Raw run JSON */}
            <Collapsible>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-display">Raw run JSON</CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap bg-muted/30 p-3 rounded">
                      {JSON.stringify(data.run, null, 2)}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RunDetailDrawer;
