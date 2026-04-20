import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  handle: string;
  platform: "instagram" | "tiktok" | "facebook";
  minFollowers?: number;
}

interface ValidationResult {
  exists: boolean;
  follower_count: number | null;
  display_name: string | null;
}

const DEBOUNCE_MS = 800;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: ValidationResult }>();

export function HandleValidator({ handle, platform, minFollowers = 20000 }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "small" | "missing" | "error">("idle");
  const [info, setInfo] = useState<ValidationResult | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!handle || handle.length < 2) {
      setState("idle");
      setInfo(null);
      return;
    }
    const key = `${platform}:${handle.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      apply(cached.value);
      return;
    }
    setState("loading");
    timer.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke<ValidationResult>(
          "content-lab-validate-handle",
          { body: { handle, platform } },
        );
        if (error || !data) {
          setState("error");
          return;
        }
        cache.set(key, { at: Date.now(), value: data });
        apply(data);
      } catch {
        setState("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };

    function apply(v: ValidationResult) {
      setInfo(v);
      if (!v.exists) setState("missing");
      else if (v.follower_count != null && v.follower_count < minFollowers) setState("small");
      else setState("ok");
    }
  }, [handle, platform, minFollowers]);

  if (state === "idle") return null;
  if (state === "loading")
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
      </p>
    );
  if (state === "missing")
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
        <X className="h-3 w-3" /> We couldn't find this handle.
      </p>
    );
  if (state === "small")
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-500">
        <AlertTriangle className="h-3 w-3" />
        {info?.display_name ?? "Found"} — {(info?.follower_count ?? 0).toLocaleString()} followers. Smaller accounts give weaker benchmarks.
      </p>
    );
  if (state === "ok")
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-500">
        <Check className="h-3 w-3" />
        {info?.display_name ?? "Verified"}
        {info?.follower_count ? ` — ${info.follower_count.toLocaleString()} followers` : ""}
      </p>
    );
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <AlertTriangle className="h-3 w-3" /> Couldn't verify — you can still continue.
    </p>
  );
}
