import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  nicheId: string;
  onReady: () => void;
}

const POLL_MS = 3000;
const TIMEOUT_MS = 120_000;

export function VoiceBuildingScreen({ nicheId, onReady }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const poll = async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("content_lab_niches")
        .select("brand_voice_snapshot")
        .eq("id", nicheId)
        .maybeSingle();
      if (data?.brand_voice_snapshot) {
        onReady();
        return;
      }
      if (Date.now() - start > TIMEOUT_MS) {
        setTimedOut(true);
        setTimeout(onReady, 2000);
        return;
      }
      setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [nicheId, onReady]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {timedOut ? "Still analysing in the background" : "Analysing your brand voice…"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {timedOut
            ? "Your first run will use a basic voice — we'll refine it shortly. Taking you to your niche now."
            : "We're scanning your website and recent posts to learn how your brand sounds. About 90 seconds."}
        </p>
      </div>
    </div>
  );
}
