import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  nicheName: string;
  website: string;
  onChange: (patch: { nicheName?: string; website?: string }) => void;
}

export function Step1NicheBasics({ nicheName, website, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Niche basics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What are we building benchmarks for?
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="niche-name">Niche name</Label>
        <Input
          id="niche-name"
          placeholder="e.g. Mayfair dental clinic"
          value={nicheName}
          onChange={(e) => onChange({ nicheName: e.target.value })}
          maxLength={120}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://yourbrand.co.uk"
          value={website}
          onChange={(e) => onChange({ website: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          We'll scan this to learn your brand voice. Optional but recommended.
        </p>
      </div>
    </div>
  );
}
