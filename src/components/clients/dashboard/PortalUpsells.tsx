import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { PORTAL_UPSELL_CATEGORY_LABELS, type ClientPortalUpsell, type PortalUpsellCategory } from '@/types/database';

interface PortalUpsellsProps {
  upsells: ClientPortalUpsell[];
}

const PortalUpsells = ({ upsells }: PortalUpsellsProps) => {
  if (!upsells || upsells.length === 0) return null;

  // Group by category, preserve sort order within each
  const grouped = upsells.reduce<Record<string, ClientPortalUpsell[]>>((acc, u) => {
    (acc[u.category] ??= []).push(u);
    return acc;
  }, {});

  const categories = (Object.keys(PORTAL_UPSELL_CATEGORY_LABELS) as PortalUpsellCategory[])
    .filter(c => grouped[c]?.length);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-body">
          Recommended for you
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Services that could help you get more from your marketing.
        </p>
      </div>

      {categories.map(category => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold font-body text-foreground">
            {PORTAL_UPSELL_CATEGORY_LABELS[category]}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {grouped[category].map(offer => (
              <Card key={offer.id} className="flex flex-col">
                <CardContent className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex-1 space-y-2">
                    <h4 className="font-display text-base text-foreground">{offer.title}</h4>
                    {offer.price_label && (
                      <p className="text-sm font-medium text-primary">{offer.price_label}</p>
                    )}
                    {offer.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {offer.description}
                      </p>
                    )}
                  </div>
                  {offer.cta_url && (
                    <Button
                      asChild
                      size="sm"
                      className="w-full gap-2"
                    >
                      <a
                        href={offer.cta_url}
                        target={offer.cta_url.startsWith('mailto:') ? undefined : '_blank'}
                        rel="noopener noreferrer"
                      >
                        {offer.cta_label}
                        {!offer.cta_url.startsWith('mailto:') && <ExternalLink className="h-3.5 w-3.5" />}
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

export default PortalUpsells;
