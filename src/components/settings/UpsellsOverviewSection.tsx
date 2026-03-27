import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface UpsellOverview {
  id: string;
  client_id: string;
  report_month: number;
  report_year: number;
  service_name: string;
  is_active: boolean;
  client_name?: string;
}

const UpsellsOverviewSection = () => {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [upsells, setUpsells] = useState<UpsellOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const fetchUpsells = async () => {
      const now = new Date();
      const startMonth = now.getMonth() + 1;
      const startYear = now.getFullYear();

      // Fetch next 6 months of upsells
      const { data, error } = await supabase
        .from('report_upsells')
        .select('id, client_id, report_month, report_year, service_name, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('report_year', { ascending: true })
        .order('report_month', { ascending: true });

      if (error) {
        console.error('Failed to fetch upsells overview:', error);
        setIsLoading(false);
        return;
      }

      // Filter to next 6 months
      const endDate = new Date(startYear, startMonth - 1 + 6);
      const filtered = (data ?? []).filter(u => {
        const uDate = new Date(u.report_year, u.report_month - 1);
        return uDate >= new Date(startYear, startMonth - 1) && uDate < endDate;
      });

      // Fetch client names
      const clientIds = [...new Set(filtered.map(u => u.client_id))];
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, company_name')
          .in('id', clientIds);

        const clientMap = new Map((clients ?? []).map(c => [c.id, c.company_name]));
        const enriched = filtered.map(u => ({ ...u, client_name: clientMap.get(u.client_id) ?? 'Unknown' }));
        setUpsells(enriched);
      } else {
        setUpsells([]);
      }

      setIsLoading(false);
    };

    fetchUpsells();
  }, [orgId]);

  // Group by month
  const grouped = new Map<string, UpsellOverview[]>();
  for (const u of upsells) {
    const key = `${u.report_year}-${u.report_month}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(u);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading scheduled upsells...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Scheduled Upsells — Next 6 Months
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upsells.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No upsells scheduled in the next 6 months</p>
            <p className="text-xs text-muted-foreground mt-1">Schedule upsells from individual client pages</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([key, items]) => {
              const [year, month] = key.split('-').map(Number);
              return (
                <div key={key}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {MONTH_NAMES[month]} {year}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/clients/${item.client_id}?tab=upsells`)}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-body font-medium">{item.client_name}</p>
                            <p className="text-xs text-muted-foreground">{item.service_name}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">Scheduled</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpsellsOverviewSection;
