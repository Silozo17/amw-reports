import { useState } from "react";
import igPlaceholder from "@/assets/ig-placeholder.png";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const IG_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "akamaized.net",
];

/** True when the URL belongs to a CDN that blocks hot-linking from arbitrary referrers. */
function shouldProxy(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return IG_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

function buildProxiedUrl(rawUrl: string): string {
  if (!SUPABASE_URL) return rawUrl;
  return `${SUPABASE_URL}/functions/v1/content-lab-image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

interface Props {
  src: string | null | undefined;
  alt: string;
  /** Tailwind classes for the wrapper (size, aspect ratio, rounding). */
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}

/**
 * Renders a social-media thumbnail (Instagram / TikTok). For CDNs that block
 * hot-linking we route through `content-lab-image-proxy`. Falls back to a
 * branded placeholder rather than a broken-image icon.
 */
const IgThumb = ({ src, alt, className, imgClassName, loading = "lazy" }: Props) => {
  const [errored, setErrored] = useState(false);

  const resolved = (() => {
    if (!src || errored) return igPlaceholder;
    return shouldProxy(src) ? buildProxiedUrl(src) : src;
  })();

  return (
    <div className={cn("relative bg-muted overflow-hidden", className)}>
      <img
        src={resolved}
        alt={alt}
        loading={loading}
        onError={() => setErrored(true)}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
};

export default IgThumb;
