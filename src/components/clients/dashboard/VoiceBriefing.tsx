import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Headphones, Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceBriefingProps {
  clientId: string;
  month: number;
  year: number;
}

const VoiceBriefing = ({ clientId, month, year }: VoiceBriefingProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const generate = async () => {
    if (audioUrl) {
      // Already generated, just play/pause
      togglePlayback();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ client_id: clientId, month, year }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("timeupdate", () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      });
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setProgress(0);
      });

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

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={generate}
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
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default VoiceBriefing;
