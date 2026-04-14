import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ThreadsExtrasProps {
  topContent?: Array<{
    caption?: string;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    quotes?: number;
    permalink_url?: string | null;
    total_engagement?: number;
    type?: string;
  }>;
}

const ThreadsExtras = ({ topContent }: ThreadsExtrasProps) => {
  const posts = (topContent ?? []).filter(
    p => p.caption || p.likes || p.comments || p.shares
  );

  if (posts.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Top Threads Posts</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Post</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Replies</TableHead>
              <TableHead className="text-right">Reposts</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.slice(0, 10).map((post, i) => (
              <TableRow key={i}>
                <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                  {post.permalink_url ? (
                    <a href={post.permalink_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {post.caption || 'No caption'}
                    </a>
                  ) : (
                    post.caption || 'No caption'
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{(post.views ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.likes ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{(post.comments ?? 0).toLocaleString()}</TableCell>
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
