import type { AccountRef } from "./Step4Admired";

export interface ReviewData {
  nicheName: string;
  website: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  industrySlug: string;
  admired: AccountRef[];
  competitors: AccountRef[];
}

interface Props { data: ReviewData }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function Step6Review({ data }: Props) {
  const fmt = (a: AccountRef[]) => a.map((x) => `@${x.handle} (${x.platform})`).join(", ") || "—";
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Review &amp; submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One last look. We'll start building your brand voice as soon as you submit.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <Row label="Niche" value={data.nicheName} />
        <Row label="Website" value={data.website} />
        <Row label="Instagram" value={data.instagram ? `@${data.instagram}` : ""} />
        <Row label="TikTok" value={data.tiktok ? `@${data.tiktok}` : ""} />
        <Row label="Facebook" value={data.facebook ? `@${data.facebook}` : ""} />
        <Row label="Industry" value={data.industrySlug} />
        <Row label="Admired accounts" value={fmt(data.admired)} />
        <Row label="Competitors" value={fmt(data.competitors)} />
      </div>
    </div>
  );
}
