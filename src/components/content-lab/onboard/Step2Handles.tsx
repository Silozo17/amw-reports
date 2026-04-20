import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  instagram: string;
  tiktok: string;
  facebook: string;
  onChange: (patch: { instagram?: string; tiktok?: string; facebook?: string }) => void;
}

export function Step2Handles({ instagram, tiktok, facebook, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Your handles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Where do you post? Instagram is required, others are optional.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ig">Instagram handle <span className="text-destructive">*</span></Label>
        <Input
          id="ig"
          placeholder="yourbrand"
          value={instagram}
          onChange={(e) => onChange({ instagram: e.target.value.replace(/^@/, "") })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tt">TikTok handle</Label>
        <Input
          id="tt"
          placeholder="yourbrand"
          value={tiktok}
          onChange={(e) => onChange({ tiktok: e.target.value.replace(/^@/, "") })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fb">Facebook page</Label>
        <Input
          id="fb"
          placeholder="yourbrand"
          value={facebook}
          onChange={(e) => onChange({ facebook: e.target.value.replace(/^@/, "") })}
        />
      </div>
    </div>
  );
}
