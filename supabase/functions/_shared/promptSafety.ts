// Sanitise user-supplied strings before they're interpolated into LLM prompts.
// Defends against prompt-injection attacks where attackers embed instructions
// in fields like niche label, handle, scraped page content, etc.
//
// Usage:
//   const safe = sanitisePromptInput(userText, 300);
//   const prompt = `<user_input>${safe}</user_input>`;

const INJECTION_MARKERS = [
  /\bsystem\s*:/gi,
  /\bassistant\s*:/gi,
  /\buser\s*:/gi,
  /<\s*\/?\s*user_input\s*>/gi,
  /<\s*\/?\s*system\s*>/gi,
  /<\s*\/?\s*instructions?\s*>/gi,
  /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /\bdisregard\s+(all\s+)?(previous|prior|above)/gi,
];

export function sanitisePromptInput(input: string | null | undefined, maxLen = 1000): string {
  if (!input) return '';
  let s = String(input);

  // Strip control chars (except newline + tab)
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ');

  // Neutralise injection markers
  for (const re of INJECTION_MARKERS) {
    s = s.replace(re, '[redacted]');
  }

  // Collapse runs of whitespace
  s = s.replace(/\s{3,}/g, '  ').trim();

  if (s.length > maxLen) s = s.slice(0, maxLen) + '…';
  return s;
}

// Convenience: wrap content in clearly delimited tags for LLM prompts.
export function wrapUserInput(content: string, maxLen = 1000): string {
  return `<user_input>\n${sanitisePromptInput(content, maxLen)}\n</user_input>`;
}

// Per-field caps (keep aligned with audit doc)
export const PROMPT_CAPS = {
  nicheLabel: 100,
  handle: 50,
  caption: 300,
  websitePage: 8000,
  competitorList: 500,
  brandVoice: 1000,
} as const;
