// Cloudflare Turnstile widget — lightweight bot challenge.
// Renders the script tag once, then a div the Turnstile JS hydrates.
// onVerify fires with the token; pass it to verify-turnstile edge function before signup/reset.

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';

const TurnstileWidget = ({ siteKey, onVerify, onExpire, theme = 'auto' }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const render = () => {
      if (!window.turnstile || !containerRef.current) return;
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onExpire?.(),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      window.onTurnstileLoad = render;
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    } else {
      // Script present but not yet loaded — wait for global onload
      window.onTurnstileLoad = render;
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onExpire, theme]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
};

export default TurnstileWidget;
