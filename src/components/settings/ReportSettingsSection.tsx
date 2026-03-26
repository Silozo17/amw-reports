import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/hooks/useOrg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ReportSettings {
  show_logo: boolean;
  show_ai_insights: boolean;
  report_accent_color: string | null;
}

const DEFAULT_SETTINGS: ReportSettings = {
  show_logo: true,
  show_ai_insights: true,
  report_accent_color: null,
};

const ReportSettingsSection = () => {
  const { org, refetchOrg } = useOrg();
  const [settings, setSettings] = useState<ReportSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (org) {
      const raw = (org as any).report_settings as Record<string, unknown> | null;
      setSettings({
        show_logo: raw?.show_logo !== false,
        show_ai_insights: raw?.show_ai_insights !== false,
        report_accent_color: (raw?.report_accent_color as string) || null,
      });
    }
  }, [org]);

  const handleSave = async () => {
    if (!org) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('organisations')
      .update({ report_settings: settings as any })
      .eq('id', org.id);

    if (error) {
      toast.error('Failed to save report settings');
    } else {
      toast.success('Report settings saved');
      refetchOrg();
    }
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <CardTitle className="font-display text-lg">Report Layout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Control how generated PDF reports look. Changes apply to all future reports.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Show Organisation Logo</Label>
            <p className="text-xs text-muted-foreground">Display your logo on the cover and closing pages</p>
          </div>
          <Switch
            checked={settings.show_logo}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, show_logo: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Include AI Insights</Label>
            <p className="text-xs text-muted-foreground">Add AI-generated platform analysis section</p>
          </div>
          <Switch
            checked={settings.show_ai_insights}
            onCheckedChange={(v) => setSettings(prev => ({ ...prev, show_ai_insights: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-medium">Report Accent Colour</Label>
          <p className="text-xs text-muted-foreground">Override the primary colour used in reports. Leave empty to use your org primary colour.</p>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={settings.report_accent_color || '#B32FBF'}
              onChange={(e) => setSettings(prev => ({ ...prev, report_accent_color: e.target.value }))}
              className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={settings.report_accent_color || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, report_accent_color: e.target.value || null }))}
              placeholder="e.g. #B32FBF"
              className="w-32 font-mono text-sm"
            />
            {settings.report_accent_color && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSettings(prev => ({ ...prev, report_accent_color: null }))}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Report Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ReportSettingsSection;
