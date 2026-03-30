import { AlertTriangle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEntitlements } from '@/hooks/useEntitlements';

const BillingStatusBanner = () => {
  const { subscriptionStatus, isInGracePeriod, isLocked, gracePeriodEnd } = useEntitlements();

  if (subscriptionStatus === 'active' || subscriptionStatus === 'none') {
    return null;
  }

  if (isInGracePeriod && gracePeriodEnd) {
    const daysLeft = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
      <div className="bg-yellow-500/15 border-b border-yellow-500/30 px-4 py-2.5 text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Your payment failed. Features will be restricted in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.{' '}
          <Link to="/settings?tab=billing" className="underline font-medium hover:no-underline">
            Update your payment method
          </Link>
        </span>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2.5 text-sm flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          Your subscription has been suspended. Some features are restricted.{' '}
          <Link to="/settings?tab=billing" className="underline font-medium hover:no-underline">
            Upgrade or update payment to restore access
          </Link>
        </span>
      </div>
    );
  }

  return null;
};

export default BillingStatusBanner;
