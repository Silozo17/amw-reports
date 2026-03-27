import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const ReportSettingsSection = () => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <CardTitle className="font-display text-lg">Report Layout</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Report branding settings have moved to the <strong>White Label</strong> tab.
        </p>
      </CardContent>
    </Card>
  );
};

export default ReportSettingsSection;
