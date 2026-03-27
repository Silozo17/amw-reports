import { useOrg } from '@/contexts/OrgContext';
import { useEntitlements } from '@/hooks/useEntitlements';

export default function LoadingScreen() {
  const { org } = useOrg();
  const { hasWhitelabel } = useEntitlements();

  const showLogo = hasWhitelabel && !!org?.logo_url;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        {showLogo ? (
          <img
            src={org!.logo_url!}
            alt={org!.name}
            className="h-10 w-auto mx-auto object-contain"
          />
        ) : (
          <h1 className="text-2xl font-display text-primary">AMW</h1>
        )}
        <p className="text-sm text-muted-foreground mt-2">Loading...</p>
      </div>
    </div>
  );
}
