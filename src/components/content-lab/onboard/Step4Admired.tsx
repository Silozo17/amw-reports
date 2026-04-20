import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HandleValidator } from "./HandleValidator";

export interface AccountRef {
  handle: string;
  platform: "instagram" | "tiktok" | "facebook";
}

interface Props {
  accounts: AccountRef[];
  onChange: (accounts: AccountRef[]) => void;
}

const SLOTS = 3;

export function Step4Admired({ accounts, onChange }: Props) {
  const filled = [...accounts];
  while (filled.length < SLOTS) filled.push({ handle: "", platform: "instagram" });

  const update = (i: number, patch: Partial<AccountRef>) => {
    const next = filled.map((a, idx) => (idx === i ? { ...a, ...patch } : a));
    onChange(next.filter((a) => a.handle.trim().length > 0));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Gold-standard accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name 3 accounts you consider best-in-class in your niche. We'll use them as seeds.
        </p>
      </div>
      {filled.slice(0, SLOTS).map((a, i) => (
        <div key={i} className="space-y-2">
          <Label htmlFor={`admired-${i}`}>Account {i + 1}</Label>
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
              id={`admired-${i}`}
              placeholder="handle"
              value={a.handle}
              onChange={(e) => update(i, { handle: e.target.value.replace(/^@/, "") })}
            />
          </div>
          <HandleValidator handle={a.handle} platform={a.platform} />
        </div>
      ))}
    </div>
  );
}
