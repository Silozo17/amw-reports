import { Shield, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

const ConnectionDisclaimer = () => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        <Shield className="h-3.5 w-3.5" />
        <span className="font-medium">Data Collection & Privacy Policy</span>
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg border bg-muted/30 p-4 mt-1 space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div>
            <p className="font-semibold text-foreground mb-1">What data we collect</p>
            <p>
              We collect platform performance data including impressions, reach, engagement metrics,
              ad spend, follower counts, search performance, website analytics, and business profile
              insights via official APIs (Google Ads API, Google Search Console API, Google Analytics
              Data API, Business Profile Performance API, Meta Graph API, TikTok Marketing API,
              LinkedIn Marketing API). We do not collect
              personal messages, private user data, or data from individual end-users of your pages.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Why we collect it</p>
            <p>
              Solely to generate automated marketing performance reports for your business.
              Data is used for analytics, trend analysis, and report generation within this platform.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">How data is stored</p>
            <p>
              Data is stored securely in encrypted cloud infrastructure. Access tokens are stored
              server-side and are never exposed to the browser. All API communications use HTTPS encryption.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Data retention & deletion</p>
            <p>
              Data is retained while the connection is active. When a connection is removed, all
              associated performance data, sync logs, and platform configuration are <strong>permanently
              deleted</strong>. Deleting a client removes all associated data across all platforms.
            </p>
          </div>

          <div className="pt-2 border-t space-y-2">
            <p className="font-semibold text-foreground">Platform-specific disclosures</p>
            <p>
              <strong>Meta (Facebook & Instagram):</strong> Data obtained through Meta APIs is used
              solely to provide reporting and analytics features. We do not share, sell, or transfer
              Meta user data to third parties. Usage complies with the Meta Platform Terms and
              Developer Policies.
            </p>
            <p>
              <strong>Google Ads:</strong> Google Ads data is accessed and used in compliance with
              the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
            <p>
              <strong>TikTok:</strong> TikTok Marketing API data is used exclusively for performance
              reporting in accordance with TikTok's Marketing API Terms of Service.
            </p>
            <p>
              <strong>LinkedIn:</strong> LinkedIn Marketing API data is processed in accordance with
              LinkedIn's API Terms of Use and is used solely for analytics reporting.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ConnectionDisclaimer;
