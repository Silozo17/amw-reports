// Parse / serialise the `clients.competitors` text column.
// Format: one competitor per line, "Name | https://website" (website optional).
// Backwards compatible with the old comma-separated names-only format.

export interface Competitor {
  name: string;
  website?: string;
}

export const parseCompetitors = (raw: string | null | undefined): Competitor[] => {
  if (!raw) return [];
  // If contains newlines or pipes, treat as new format. Else split on commas.
  const hasNew = raw.includes('\n') || raw.includes('|');
  const lines = hasNew ? raw.split('\n') : raw.split(',');
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, website] = line.split('|').map((p) => p.trim());
      const w = website && /^https?:\/\//i.test(website) ? website : undefined;
      return { name: name || website || 'Unnamed', website: w };
    });
};

export const serializeCompetitors = (list: Competitor[]): string =>
  list
    .filter((c) => c.name.trim())
    .map((c) => (c.website ? `${c.name.trim()} | ${c.website.trim()}` : c.name.trim()))
    .join('\n');

export const hostnameFromUrl = (url: string): string => {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
