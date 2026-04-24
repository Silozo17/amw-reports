import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import usePageMeta from '@/hooks/usePageMeta';
import {
  useAdminContentLabRuns,
  useAdminContentLabRealtime,
} from '@/hooks/useAdminContentLab';
import RunsTable from '@/components/admin/contentLab/RunsTable';
import RunDetailDrawer from '@/components/admin/contentLab/RunDetailDrawer';

const AdminContentLab = () => {
  usePageMeta({ title: 'Content Lab — Admin — AMW Reports', description: 'Platform-wide Content Lab runs.' });
  useAdminContentLabRealtime();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: runs = [], isLoading: runsLoading } = useAdminContentLabRuns();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Content Lab
          </h1>
          <p className="text-muted-foreground font-body mt-1">
            Platform-wide debug console for client-centric Content Lab runs.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Runs ({runs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <RunsTable rows={runs} isLoading={runsLoading} onSelect={setSelectedRunId} />
          </CardContent>
        </Card>
      </div>

      <RunDetailDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </AppLayout>
  );
};

export default AdminContentLab;
