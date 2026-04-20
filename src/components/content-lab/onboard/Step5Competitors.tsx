import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountRef } from "./Step4Admired";

interface Props {
  competitors: AccountRef[];
  onChange: (competitors: AccountRef[]) => void;
}

const SLOTS = 2;

export function Step5Competitors({ competitors, onChange }: Props) {
  const filled = [...competitors];
  while (filled.length < SLOTS) filled.push({ handle: "", platform: "instagram" });

  const update = (i: number, patch: Partial<AccountRef>) => {
    const next = filled.map((a, idx) => (idx === i ? { ...a, ...patch } : a));
    onChange(next.filter((a) => a.handle.trim().length > 0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Direct competitors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. Name up to 2 brands you compete with — we'll track them too.
        </p>
      </div>
      {filled.slice(0, SLOTS).map((a, i) => (
        <div key={i} className="space-y-2">
          <Label htmlFor={`comp-${i}`}>Competitor {i + 1}</Label>
          <div className="flex gap-2">
            <Select
              value={a.platform}
              onValueChange={(v) => update(i, { platform: v as AccountRef["platform"] })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id={`comp-${i}`}
              placeholder="handle"
              value={a.handle}
              onChange={(e) => update(i, { handle: e.target.value.replace(/^@/, "") })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
