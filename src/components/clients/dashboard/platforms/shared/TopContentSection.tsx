import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ExternalLink, ImageOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StarRating } from './MetricCard';
import type { TopContentItem } from './types';
import type { PlatformType } from '@/types/database';

interface TopContentSectionProps {
  platform: PlatformType;
  socialPosts: TopContentItem[];
  gscQueries: TopContentItem[];
  gscPages: TopContentItem[];
  gaPages: TopContentItem[];
  gaSources: TopContentItem[];
  ytVideos: TopContentItem[];
  gbpReviews: TopContentItem[];
  gbpKeywords: TopContentItem[];
}

const TopContentSection = ({
  platform,
  socialPosts,
  gscQueries,
  gscPages,
  gaPages,
  gaSources,
  ytVideos,
  gbpReviews,
  gbpKeywords,
}: TopContentSectionProps) => {
  const [contentOpen, setContentOpen] = useState(false);

  const hasTopContent = socialPosts.length > 0 || gscQueries.length > 0 || gscPages.length > 0 || gaPages.length > 0 || gaSources.length > 0 || ytVideos.length > 0 || gbpReviews.length > 0 || gbpKeywords.length > 0;

  if (!hasTopContent) return null;

  return (
    <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', contentOpen && 'rotate-180')} />
        {socialPosts.length > 0 ? 'Top Posts' :
         gscQueries.length > 0 ? 'Top Search Queries & Pages' :
         ytVideos.length > 0 ? 'Top Videos' :
         gaPages.length > 0 ? 'Top Pages' :
         gaSources.length > 0 ? 'Traffic Sources' :
         gbpReviews.length > 0 ? 'Latest Reviews & Keywords' :
         gbpKeywords.length > 0 ? 'Top Search Keywords' : 'Details'}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {socialPosts.length > 0 && (
        <TooltipProvider delayDuration={200}>
        <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-2" />
                  <TableHead>Post</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Reactions</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  {platform === 'facebook' && <TableHead className="text-right">Clicks</TableHead>}
                  <TableHead className="w-10 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {socialPosts.slice(0, 10).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="w-10 px-2">
                      <div className="flex items-center gap-2">
                        {p.full_picture ? (
                          <img src={p.full_picture} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <ImageOff className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      <span className="truncate block">{(p.message || p.caption || 'No caption').slice(0, 80)}</span>
                      {p.is_promoted && (
                         <span className="inline-block text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded mt-0.5 font-medium">Ad</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                       {(p.views ?? 0) > 0 ? (p.views ?? 0).toLocaleString() : (p.reach ?? 0) > 0 ? (p.reach ?? 0).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {platform === 'facebook' ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2">
                                {(p.reactions ?? p.likes ?? 0).toLocaleString()}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs space-y-0.5 max-w-[180px]">
                              {(p.reaction_like ?? 0) > 0 && <p>👍 Like: {(p.reaction_like ?? 0).toLocaleString()}</p>}
                              {(p.reaction_love ?? 0) > 0 && <p>❤️ Love: {(p.reaction_love ?? 0).toLocaleString()}</p>}
                              {(p.reaction_wow ?? 0) > 0 && <p>😮 Wow: {(p.reaction_wow ?? 0).toLocaleString()}</p>}
                              {(p.reaction_haha ?? 0) > 0 && <p>😂 Haha: {(p.reaction_haha ?? 0).toLocaleString()}</p>}
                              {(p.reaction_sorry ?? 0) > 0 && <p>😢 Sorry: {(p.reaction_sorry ?? 0).toLocaleString()}</p>}
                              {(p.reaction_anger ?? 0) > 0 && <p>😡 Angry: {(p.reaction_anger ?? 0).toLocaleString()}</p>}
                              {!(p.reaction_like || p.reaction_love || p.reaction_wow || p.reaction_haha || p.reaction_sorry || p.reaction_anger) && (
                                <p className="text-muted-foreground">No breakdown available</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                      ) : (
                        (p.likes ?? 0).toLocaleString()
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(p.comments ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(p.shares ?? 0) > 0 ? (p.shares ?? 0).toLocaleString() : '—'}</TableCell>
                    {platform === 'facebook' && (
                      <TableCell className="text-right text-sm tabular-nums">
                       {(p.clicks ?? 0) > 0 ? (p.clicks ?? 0).toLocaleString() : '—'}
                      </TableCell>
                    )}
                    <TableCell className="w-10 px-2">
                      {p.permalink_url && (
                        <a href={p.permalink_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
        )}

        {gscQueries.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gscQueries.slice(0, 8).map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{q.query}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(q.clicks ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(q.impressions ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{q.ctr != null ? `${(q.ctr * 100).toFixed(1)}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {gscPages.length > 0 && (
          <div className="rounded-lg border overflow-hidden mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gscPages.slice(0, 10).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm max-w-[300px] truncate font-body">{p.page}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(p.clicks ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(p.impressions ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{p.ctr != null ? `${(p.ctr * 100).toFixed(1)}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {ytVideos.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ytVideos.slice(0, 5).map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{v.title}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(v.views ?? v.video_views ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(v.likes ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(v.comments ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {gaSources.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaSources.slice(0, 8).map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{s.source}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(s.sessions ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{(s.users ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {gbpReviews.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-body">Latest Reviews</h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rating</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gbpReviews.slice(0, 5).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="w-[120px]">
                        <StarRating rating={r.rating ?? 0} />
                      </TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">{r.author ?? 'Anonymous'}</TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        <span className="line-clamp-2">{r.text || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{r.relative_time ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {gbpKeywords.length > 0 && (
          <div className="space-y-2 mt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-body">Top Search Keywords</h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gbpKeywords.slice(0, 10).map((k, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{k.keyword}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{(k.impressions ?? 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TopContentSection;
