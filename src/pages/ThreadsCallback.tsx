import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ThreadsCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error || !code || !state) {
      navigate(`/clients?oauth_error=${error || "no_code"}`);
      return;
    }

    // Forward to the Supabase edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const callbackUrl = `${supabaseUrl}/functions/v1/oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    window.location.href = callbackUrl;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-lg text-muted-foreground">Connecting Threads...</p>
    </div>
  );
}
