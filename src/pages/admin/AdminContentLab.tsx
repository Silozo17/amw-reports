import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';
import usePageMeta from '@/hooks/usePageMeta';
import {
  useAdminContentLabRuns,
  useAdminContentLabNiches,
  useAdminContentLabRealtime,
} from '@/hooks/useAdminContentLab';
import RunsTable from '@/components/admin/contentLab/RunsTable';
import RunDetailDrawer from '@/components/admin/contentLab/RunDetailDrawer';
import StepLogsTable from '@/components/admin/contentLab/StepLogsTable';
import NichesTable from '@/components/admin/contentLab/NichesTable';
import ContentLabAnalyticsTab from '@/components/admin/contentLab/ContentLabAnalyticsTab';

const AdminContentLab = () => {
  usePageMeta({ title: 'Content Lab — Admin — AMW Reports', description: 'Platform-wide Content Lab runs, step logs, and niches.' });
  useAdminContentLabRealtime();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: runs = [], isLoading: runsLoading } = useAdminContentLabRuns();
  const { data: niches = [], isLoading: nichesLoading } = useAdminContentLabNiches();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Content Lab
          </h1>
          <p className="text-muted-foreground font-body mt-1">
            Platform-wide debug console for Content Lab runs, pipeline step logs, and niches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Observability</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="analytics">
              <TabsList>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
                <TabsTrigger value="logs">Step Logs</TabsTrigger>
                <TabsTrigger value="niches">Niches ({niches.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="analytics" className="mt-4">
                <ContentLabAnalyticsTab />
              </TabsContent>
              <TabsContent value="runs" className="mt-4">
                <RunsTable rows={runs} isLoading={runsLoading} onSelect={setSelectedRunId} />
              </TabsContent>
              <TabsContent value="logs" className="mt-4">
                <StepLogsTable />
              </TabsContent>
              <TabsContent value="niches" className="mt-4">
                <NichesTable rows={niches} isLoading={nichesLoading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <RunDetailDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </AppLayout>
  );
};

export default AdminContentLab;
