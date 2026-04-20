import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GripVertical, Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
const COLUMN_ID_PREFIX = 'col:';

export interface PipelineIdea {
  id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
  is_wildcard?: boolean;
}

interface IdeaPipelineBoardProps {
  runId: string;
  ideas: PipelineIdea[];
  onSelect: (idea: PipelineIdea) => void;
}

const normaliseStatus = (s: string): PipelineStatus =>
  VALID_STATUSES.has(s as PipelineStatus) ? (s as PipelineStatus) : 'not_started';

const parseColumnId = (id: string | number): PipelineStatus | null => {
  const s = String(id);
  if (!s.startsWith(COLUMN_ID_PREFIX)) return null;
  const status = s.slice(COLUMN_ID_PREFIX.length);
  return VALID_STATUSES.has(status as PipelineStatus) ? (status as PipelineStatus) : null;
};

const IdeaPipelineBoard = ({ runId, ideas, onSelect }: IdeaPipelineBoardProps) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 6px activation distance → click on grip starts drag, click on Open button does not.
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = parseColumnId(over.id);
    if (!newStatus) return;
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

  const activeIdea = activeId ? ideas.find((i) => i.id === activeId) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const colIdeas = ideas.filter((i) => normaliseStatus(i.status) === col.status);
          return (
            <Column key={col.status} status={col.status} label={col.label} count={colIdeas.length}>
              {colIdeas.map((idea) => (
                <DraggableIdeaCard
                  key={idea.id}
                  idea={idea}
                  onSelect={() => onSelect(idea)}
                  isOverlay={false}
                />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {activeIdea ? (
          <DraggableIdeaCard idea={activeIdea} onSelect={() => undefined} isOverlay />
        ) : null}
      </DragOverlay>
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
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_ID_PREFIX}${status}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 p-2 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-border/60'
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">{children}</div>
    </div>
  );
};

interface DraggableCardProps {
  idea: PipelineIdea;
  onSelect: () => void;
  isOverlay: boolean;
}

const DraggableIdeaCard = ({ idea, onSelect, isOverlay }: DraggableCardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idea.id });

  return (
    <Card
      ref={isOverlay ? undefined : setNodeRef}
      className={`space-y-2 p-3 transition-opacity ${
        isDragging && !isOverlay ? 'opacity-30' : ''
      } ${isOverlay ? 'shadow-lg ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className="-ml-1 flex cursor-grab items-center gap-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripVertical className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Idea {idea.idea_number}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {idea.is_wildcard && (
            <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>
          )}
          {!isOverlay && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              aria-label="Open idea"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium line-clamp-3">{idea.hook ?? idea.title}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {idea.target_platform && (
            <Badge variant="outline" className="text-[10px] capitalize">{idea.target_platform}</Badge>
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
      <div className="flex flex-col items-end gap-1">
        {idea.is_wildcard && (
          <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>
        )}
        {idea.target_platform && (
          <Badge variant="outline" className="text-[10px] capitalize">{idea.target_platform}</Badge>
        )}
      </div>
    </div>
    <Select
      value={normaliseStatus(idea.status)}
      onValueChange={(v) => onChange(v as PipelineStatus)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COLUMNS.map((c) => (
          <SelectItem key={c.status} value={c.status} className="text-xs">
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Card>
);

export default IdeaPipelineBoard;
