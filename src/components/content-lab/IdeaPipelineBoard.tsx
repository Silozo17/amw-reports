import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GripVertical, Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

export type PipelineStatus = 'not_started' | 'scripted' | 'filming' | 'posted' | 'archived';

const COLUMNS: Array<{ status: PipelineStatus; label: string }> = [
  { status: 'not_started', label: 'Not started' },
  { status: 'scripted', label: 'Scripted' },
  { status: 'filming', label: 'Filming' },
  { status: 'posted', label: 'Posted' },
  { status: 'archived', label: 'Archived' },
];

const VALID_STATUSES = new Set<PipelineStatus>(COLUMNS.map((c) => c.status));

interface PipelineIdea {
  id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
}

interface IdeaPipelineBoardProps {
  runId: string;
  ideas: PipelineIdea[];
  onSelect: (idea: PipelineIdea) => void;
}

const normaliseStatus = (s: string): PipelineStatus =>
  VALID_STATUSES.has(s as PipelineStatus) ? (s as PipelineStatus) : 'not_started';

const IdeaPipelineBoard = ({ runId, ideas, onSelect }: IdeaPipelineBoardProps) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateStatus = async (ideaId: string, status: PipelineStatus) => {
    setUpdatingId(ideaId);
    try {
      const { error } = await supabase
        .from('content_lab_ideas')
        .update({ status })
        .eq('id', ideaId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['content-lab-ideas', runId] });
      queryClient.invalidateQueries({ queryKey: ['content-lab-all-ideas'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to move idea');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = normaliseStatus(String(over.id));
    const idea = ideas.find((i) => i.id === active.id);
    if (!idea || normaliseStatus(idea.status) === newStatus) return;
    updateStatus(idea.id, newStatus);
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {ideas.map((idea) => (
          <MobileIdeaRow
            key={idea.id}
            idea={idea}
            disabled={updatingId === idea.id}
            onChange={(s) => updateStatus(idea.id, s)}
            onSelect={() => onSelect(idea)}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const colIdeas = ideas.filter((i) => normaliseStatus(i.status) === col.status);
          return (
            <Column key={col.status} status={col.status} label={col.label} count={colIdeas.length}>
              {colIdeas.map((idea) => (
                <DraggableIdeaCard key={idea.id} idea={idea} onSelect={() => onSelect(idea)} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
};

const Column = ({
  status,
  label,
  count,
  children,
}: {
  status: PipelineStatus;
  label: string;
  count: number;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 p-2 transition-colors ${isOver ? 'border-primary bg-primary/5' : 'border-border/60'}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">{children}</div>
    </div>
  );
};

/**
 * Drag handle (the ⋮⋮ grip + body) is the draggable. The "open" button is a plain
 * button outside the listener spread → no race with @dnd-kit activation distance.
 */
const DraggableIdeaCard = ({ idea, onSelect }: { idea: PipelineIdea; onSelect: () => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idea.id });

  return (
    <Card
      ref={setNodeRef}
      className={`space-y-2 p-3 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="-ml-1 flex cursor-grab items-center gap-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Idea {idea.idea_number}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          aria-label="Open idea"
        >
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <p className="text-sm font-medium line-clamp-3">{idea.hook ?? idea.title}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {idea.target_platform && (
            <Badge variant="secondary" className="text-[10px] capitalize">{idea.target_platform}</Badge>
          )}
          {idea.rating != null && (
            <p className="text-[10px] text-muted-foreground">★ {idea.rating}/10</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const MobileIdeaRow = ({
  idea,
  disabled,
  onChange,
  onSelect,
}: {
  idea: PipelineIdea;
  disabled: boolean;
  onChange: (s: PipelineStatus) => void;
  onSelect: () => void;
}) => (
  <Card className="space-y-2 p-3">
    <div className="flex items-start justify-between gap-2">
      <button onClick={onSelect} className="text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Idea {idea.idea_number}
        </span>
        <p className="mt-1 text-sm font-medium line-clamp-2">{idea.hook ?? idea.title}</p>
      </button>
      {idea.target_platform && (
        <Badge variant="secondary" className="text-[10px] capitalize">{idea.target_platform}</Badge>
      )}
    </div>
    <Select
      value={normaliseStatus(idea.status)}
      onValueChange={(v) => onChange(v as PipelineStatus)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {COLUMNS.map((c) => (
          <SelectItem key={c.status} value={c.status} className="text-xs">{c.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Card>
);

export default IdeaPipelineBoard;
