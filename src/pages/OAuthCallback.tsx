import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const authCode = params.get("auth_code"); // TikTok

    if (error) {
      navigate(`/clients?oauth_error=${encodeURIComponent(error)}`);
      return;
    }

    const finalCode = code || authCode;
    if (!finalCode || !state) {
      navigate(`/clients?oauth_error=missing_params`);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const callbackUrl = `${supabaseUrl}/functions/v1/oauth-callback?code=${encodeURIComponent(finalCode)}&state=${encodeURIComponent(state)}`;
    window.location.href = callbackUrl;
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Connecting your account...</p>
    </div>
  );
}
