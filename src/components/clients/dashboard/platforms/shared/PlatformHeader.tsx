import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { PLATFORM_LOGOS, PLATFORM_LABELS } from '@/types/database';
import type { PlatformType, JobStatus } from '@/types/database';
import { CheckCircle2, AlertTriangle, Clock, Wifi } from 'lucide-react';

interface PlatformHeaderProps {
  platform: PlatformType;
  syncStatus?: JobStatus | null;
  lastSyncAt?: string | null;
}

const PlatformHeader = ({ platform, syncStatus, lastSyncAt }: PlatformHeaderProps) => {
  const logo = PLATFORM_LOGOS[platform];
  const label = PLATFORM_LABELS[platform];

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
      <div className="flex items-center gap-3">
        {logo && <img src={logo} alt="" className="h-6 w-6 object-contain" />}
        <h3 className="text-base font-semibold font-body tracking-wide">{label}</h3>
      </div>
      <div className="flex items-center gap-2">
        {lastSyncAt && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Synced {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
          </span>
        )}
        <Badge
          variant={syncStatus === 'success' ? 'default' : syncStatus === 'failed' ? 'destructive' : 'secondary'}
          className="text-[10px] px-1.5 py-0"
        >
          {syncStatus === 'success' ? (
            <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
          ) : syncStatus === 'failed' ? (
            <><AlertTriangle className="h-3 w-3 mr-1" />Error</>
          ) : (
            <><Wifi className="h-3 w-3 mr-1" />Connected</>
          )}
        </Badge>
      </div>
    </div>
  );
};

export default PlatformHeader;
