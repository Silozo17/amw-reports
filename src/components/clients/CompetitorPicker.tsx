import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Plus, X, Globe, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  parseCompetitors,
  serializeCompetitors,
  hostnameFromUrl,
  type Competitor,
} from '@/lib/competitors';

interface Prediction {
  place_id: string;
  name: string;
  address: string;
  website?: string;
}

interface Props {
  /** Raw value from `clients.competitors`. */
  value: string;
  onChange: (next: string) => void;
}

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/** Search Google Places live as you type, or paste a URL, to add competitors one at a time. */
const CompetitorPicker = ({ value, onChange }: Props) => {
  const list = parseCompetitors(value);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prediction[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Latest-request-wins guard so fast typing doesn't flash old results.
  const requestSeq = useRef(0);

  const setList = (next: Competitor[]) => onChange(serializeCompetitors(next));

  const addCompetitor = (c: Competitor) => {
    if (!c.name.trim() && !c.website) return;
    const exists = list.some(
      (x) =>
        x.name.toLowerCase() === c.name.toLowerCase() ||
        (c.website && x.website && x.website === c.website),
    );
    if (exists) {
      toast.info('Already added');
      return;
    }
    setList([...list, c]);
  };

  const removeAt = (idx: number) => setList(list.filter((_, i) => i !== idx));

  // Live debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const mySeq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('google-places-lookup', {
          body: { query: q },
        });
        if (mySeq !== requestSeq.current) return; // stale
        if (error) throw error;
        setResults((data?.results ?? []) as Prediction[]);
      } catch (e) {
        if (mySeq !== requestSeq.current) return;
        toast.error(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        if (mySeq === requestSeq.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAddByUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    try {
      new URL(normalized);
    } catch {
      toast.error('Enter a valid URL');
      return;
    }
    addCompetitor({ name: hostnameFromUrl(normalized), website: normalized });
    setUrlInput('');
  };

  return (
    <div className="space-y-3">
      {/* Live search by name */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
              }}
              placeholder="Search a competitor by name (Google)"
              className="pl-8 pr-9"
            />
            {searching && (
              <Loader2 className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-1"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <p className="p-3 text-sm text-muted-foreground">Type at least 2 characters…</p>
          ) : searching ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results. Try another name.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      addCompetitor({ name: r.name, website: r.website || undefined });
                      setOpen(false);
                      setQuery('');
                      setResults([]);
                    }}
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left text-sm hover:bg-muted"
                  >
                    <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{r.name}</span>
                      {r.address && <span className="block truncate text-xs text-muted-foreground">{r.address}</span>}
                      {r.website && <span className="block truncate text-xs text-primary">{hostnameFromUrl(r.website)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {/* Add by URL */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddByUrl();
              }
            }}
            placeholder="…or paste a website URL"
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" onClick={handleAddByUrl} disabled={!urlInput.trim()}>
          Add
        </Button>
      </div>

      {/* Chip list */}
      {list.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {list.map((c, i) => (
            <li
              key={`${c.name}-${i}`}
              className="inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm"
            >
              <span className="truncate max-w-[200px]">{c.name}</span>
              {c.website && (
                <a
                  href={c.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-muted-foreground hover:text-primary"
                  title={c.website}
                >
                  <Globe className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                aria-label={`Remove ${c.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No competitors yet — add 3-5 for sharper local research.</p>
      )}
    </div>
  );
};

export default CompetitorPicker;
