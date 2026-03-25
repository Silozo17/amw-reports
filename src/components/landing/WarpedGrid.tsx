import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface WarpedGridProps {
  className?: string;
}

const ROWS = 12;
const COLS = 16;
const W = 800;
const H = 600;
const LERP = 0.06;
const INFLUENCE_RADIUS = 0.003;
const MAX_DISPLACEMENT = 30;
const SEGMENTS = 6;

const STROKE_COLOR = "hsl(32 44% 92% / 0.06)";

function displace(px: number, py: number, mx: number, my: number) {
  const dist = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);
  const strength = 1 / (1 + dist * INFLUENCE_RADIUS);
  const dx = (mx - px) * strength * 0.1;
  const dy = (my - py) * strength * 0.1;
  return {
    x: px + Math.max(-MAX_DISPLACEMENT, Math.min(MAX_DISPLACEMENT, dx)),
    y: py + Math.max(-MAX_DISPLACEMENT, Math.min(MAX_DISPLACEMENT, dy)),
  };
}

function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const n = points.length;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function buildPaths(mx: number, my: number) {
  const horizontal: string[] = [];
  const vertical: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    const baseY = (r / (ROWS - 1)) * H;
    const warpAmp = Math.sin((r / (ROWS - 1)) * Math.PI) * 35;
    const points: { x: number; y: number }[] = [];
    for (let s = 0; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS;
      points.push(displace(t * W, baseY + Math.sin(t * Math.PI) * warpAmp, mx, my));
    }
    horizontal.push(catmullRomPath(points));
  }
  for (let c = 0; c < COLS; c++) {
    const baseX = (c / (COLS - 1)) * W;
    const warpAmp = Math.sin((c / (COLS - 1)) * Math.PI) * 25;
    const points: { x: number; y: number }[] = [];
    for (let s = 0; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS;
      points.push(displace(baseX + Math.sin(t * Math.PI) * warpAmp, t * H, mx, my));
    }
    vertical.push(catmullRomPath(points));
  }
  return { horizontal, vertical };
}

function staticPaths() {
  const horizontal: string[] = [];
  const vertical: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = (r / (ROWS - 1)) * H;
    const w = Math.sin((r / (ROWS - 1)) * Math.PI) * 35;
    const pts = [];
    for (let s = 0; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS;
      pts.push({ x: t * W, y: y + Math.sin(t * Math.PI) * w });
    }
    horizontal.push(catmullRomPath(pts));
  }
  for (let c = 0; c < COLS; c++) {
    const x = (c / (COLS - 1)) * W;
    const w = Math.sin((c / (COLS - 1)) * Math.PI) * 25;
    const pts = [];
    for (let s = 0; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS;
      pts.push({ x: x + Math.sin(t * Math.PI) * w, y: t * H });
    }
    vertical.push(catmullRomPath(pts));
  }
  return { horizontal, vertical };
}

const MASK_STYLE = {
  maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
};

const WarpedGrid = ({ className }: WarpedGridProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const targetMouse = useRef({ x: W / 2, y: H / 2 });
  const currentMouse = useRef({ x: W / 2, y: H / 2 });
  const rafId = useRef<number>(0);
  const pathsRef = useRef<SVGPathElement[]>([]);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container || !svgRef.current) return;

    pathsRef.current = Array.from(svgRef.current.querySelectorAll("path"));

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const inBounds =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
      targetMouse.current = inBounds
        ? { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
        : { x: W / 2, y: H / 2 };
    };

    window.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      if (!isVisibleRef.current) { rafId.current = requestAnimationFrame(animate); return; }
      const cur = currentMouse.current;
      const tgt = targetMouse.current;
      cur.x += (tgt.x - cur.x) * LERP;
      cur.y += (tgt.y - cur.y) * LERP;
      const { horizontal, vertical } = buildPaths(cur.x, cur.y);
      const all = [...horizontal, ...vertical];
      const paths = pathsRef.current;
      for (let i = 0; i < paths.length && i < all.length; i++) {
        paths[i].setAttribute("d", all[i]);
      }
      rafId.current = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => { isVisibleRef.current = entry.isIntersecting; }, { threshold: 0 });
    observer.observe(container);
    rafId.current = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(rafId.current); window.removeEventListener("mousemove", onMouseMove); observer.disconnect(); };
  }, [isMobile]);

  if (isMobile) {
    const s = staticPaths();
    return (
      <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} style={MASK_STYLE}>
        <svg className="absolute -left-[5%] -top-[5%] w-[110%] h-[110%]" viewBox="0 0 800 600" preserveAspectRatio="none" fill="none">
          {s.horizontal.map((d, i) => <path key={`h${i}`} d={d} stroke={STROKE_COLOR} strokeWidth="1" />)}
          {s.vertical.map((d, i) => <path key={`v${i}`} d={d} stroke={STROKE_COLOR} strokeWidth="1" />)}
        </svg>
      </div>
    );
  }

  const initial = buildPaths(W / 2, H / 2);
  const allInitial = [...initial.horizontal, ...initial.vertical];

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} style={MASK_STYLE}>
      <svg ref={svgRef} className="absolute -left-[5%] -top-[5%] w-[110%] h-[110%] pointer-events-none" viewBox="0 0 800 600" preserveAspectRatio="none" fill="none">
        {allInitial.map((d, i) => <path key={i} d={d} stroke={STROKE_COLOR} strokeWidth="1" />)}
      </svg>
    </div>
  );
};

export default WarpedGrid;
