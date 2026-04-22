import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ThreadsPost {
  caption?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  reposts?: number;
  views?: number;
  quotes?: number;
  permalink_url?: string | null;
  media_url?: string | null;
  is_quote_post?: boolean;
  total_engagement?: number;
  type?: string;
}

interface ThreadsExtrasProps {
  topContent?: ThreadsPost[];
}

const hasAnySignal = (p: ThreadsPost): boolean =>
  Boolean(
    p.caption ||
    p.views ||
    p.likes ||
    p.comments ||
    p.shares ||
    p.reposts ||
    p.quotes,
  );

const ThreadsExtras = ({ topContent }: ThreadsExtrasProps) => {
  const posts = (topContent ?? []).filter(hasAnySignal);

  if (posts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Top Threads Posts</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Media</TableHead>
              <TableHead className="min-w-[200px]">Post</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Replies</TableHead>
              <TableHead className="text-right">Reposts</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.slice(0, 10).map((post, i) => (
              <TableRow key={i}>
                <TableCell>
                  {post.media_url ? (
                    <img
                      src={post.media_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 rounded object-cover border border-border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted" aria-hidden="true" />
                  )}
                </TableCell>
                <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <div className="truncate">
                      {post.permalink_url ? (
                        <a
                          href={post.permalink_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {post.caption || 'No caption'}
                        </a>
                      ) : (
                        post.caption || 'No caption'
                      )}
                    </div>
                    {post.is_quote_post && (
                      <Badge variant="secondary" className="w-fit text-[10px]">Quote</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{(post.views ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.likes ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.comments ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.reposts ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.shares ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.quotes ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{(post.total_engagement ?? 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ThreadsExtras;
