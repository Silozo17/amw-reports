import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContentLabVerticals } from "@/hooks/useContentLabVerticals";

const NOT_LISTED = "__not_listed__";

interface Props {
  industrySlug: string;
  onChange: (slug: string) => void;
}

export function Step3Industry({ industrySlug, onChange }: Props) {
  const { data: verticals, isLoading } = useContentLabVerticals();
  const sparse = verticals && verticals.length > 0 && verticals.length < 3;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pick your industry</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We use this to set view thresholds and pull a curated benchmark seed pool.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Select value={industrySlug || undefined} onValueChange={onChange}>
          <SelectTrigger id="industry" disabled={isLoading}>
            <SelectValue placeholder={isLoading ? "Loading…" : "Select an industry"} />
          </SelectTrigger>
          <SelectContent>
            {(verticals ?? []).map((v) => (
              <SelectItem key={v.slug} value={v.slug}>
                {v.display_name}
              </SelectItem>
            ))}
            <SelectItem value={NOT_LISTED}>My industry isn't listed</SelectItem>
          </SelectContent>
        </Select>
        {sparse && industrySlug && industrySlug !== NOT_LISTED && (
          <p className="text-xs text-amber-500">
            We're still expanding our seed pool here. Add all 3 admired accounts on the next step for best results.
          </p>
        )}
        {industrySlug === NOT_LISTED && (
          <p className="text-xs text-muted-foreground">
            No problem — we'll rely on your seeded accounts and keyword search instead of a curated pool.
          </p>
        )}
      </div>
    </div>
  );
}
