import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Headphones, Pause, Play, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceBriefingProps {
  clientId: string;
  month: number;
  year: number;
}

const VoiceBriefing = ({ clientId, month, year }: VoiceBriefingProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setIsPlaying(false);
    setProgress(0);
    setHasExisting(false);
  }, []);

  const setupAudio = useCallback((url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
    });
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  // Check for existing recording when month/year changes
  useEffect(() => {
    cleanup();
    let cancelled = false;

    const checkExisting = async () => {
      setIsChecking(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-briefing`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ client_id: clientId, month, year, check_existing: true }),
          },
        );

        if (!response.ok || cancelled) return;

        const data = await response.json();
        if (cancelled) return;

        if (data.exists && data.signed_url) {
          setHasExisting(true);
          const audioResponse = await fetch(data.signed_url);
          if (cancelled || !audioResponse.ok) return;
          const blob = await audioResponse.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setupAudio(url);
        }
      } catch (e) {
        console.error("Check existing briefing error:", e);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    checkExisting();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, month, year]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const generate = async () => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("You must be signed in to use voice briefings");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ client_id: clientId, month, year }),
        },
      );

      if (response.status === 429) {
        const err = await response.json().catch(() => ({}));
        const retryAfter = err.retry_after ? new Date(err.retry_after) : null;
        const msg = retryAfter
          ? `Voice briefing on cooldown. Try again after ${retryAfter.toLocaleTimeString()}.`
          : "Voice briefing already generated recently. Try again later.";
        toast.error(msg);
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${response.status})`);
      }

      // Clean up old audio before setting new
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setupAudio(url);
      setHasExisting(true);

      const audio = audioRef.current!;
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error("Voice briefing error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to generate voice briefing");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleClick = () => {
    if (audioUrl && !isLoading) {
      togglePlayback();
    } else if (!isLoading) {
      generate();
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    generate();
  };

  if (isChecking) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled className="gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : audioUrl ? (
          <Play className="h-3.5 w-3.5" />
        ) : (
          <Headphones className="h-3.5 w-3.5" />
        )}
        {isLoading ? "Generating..." : isPlaying ? "Pause" : audioUrl ? "Play Briefing" : "Voice Briefing"}
      </Button>
      {audioUrl && (
        <>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {!isLoading && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRegenerate}
              className="h-7 w-7 p-0"
              title="Regenerate briefing"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceBriefing;
