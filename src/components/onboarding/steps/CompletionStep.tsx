import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

interface CompletionStepProps {
  firstName: string;
  isSubmitting: boolean;
  onComplete: (guided: boolean) => void;
}

const CompletionStep = ({ firstName, isSubmitting, onComplete }: CompletionStepProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([]);

  useEffect(() => {
    const colors = ['hsl(295, 60%, 47%)', 'hsl(212, 64%, 59%)', 'hsl(148, 60%, 57%)', 'hsl(27, 84%, 57%)'];
    setParticles(
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
    );
  }, []);

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `confetti-fall 3s ${p.delay}s ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}

      <div className="animate-scale-in space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-body, Montserrat), sans-serif', textTransform: 'none', letterSpacing: '0' }}>
            Welcome, {firstName}!
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Your workspace is ready. Let's get you set up with your first client and connections.
          </p>
        </div>
        <div className="w-full max-w-sm mx-auto rounded-xl border border-border/60 bg-card p-5 text-left space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What happens next</p>
          <ul className="space-y-2 text-sm text-foreground">
            {['Add your first client', 'Connect their marketing platforms', 'Generate your first branded report'].map(text => (
              <li key={text} className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
        <Button onClick={() => onComplete(true)} disabled={isSubmitting} className="flex-1 h-12 text-sm gap-2 shadow-md shadow-primary/15">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" />Guide me through setup</>}
        </Button>
        <Button variant="outline" onClick={() => onComplete(false)} disabled={isSubmitting} className="flex-1 h-12 text-sm border-border text-foreground hover:bg-muted">
          I'll explore on my own
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default CompletionStep;
