import { useRef, useState, useCallback } from 'react';

interface TiltState {
  transform: string;
  overlayBackground: string;
}

const NEUTRAL: TiltState = {
  transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
  overlayBackground: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%)',
};

const useTilt = (maxTilt = 8) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<TiltState>(NEUTRAL);
  const frameRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        const rect = ref.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateX = (y - 0.5) * -maxTilt;
        const rotateY = (x - 0.5) * maxTilt;
        setState({
          transform: `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.005)`,
          overlayBackground: `radial-gradient(circle at ${(x * 100).toFixed(0)}% ${(y * 100).toFixed(0)}%, hsla(0,0%,100%,0.15) 0%, transparent 60%)`,
        });
      });
    },
    [maxTilt],
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    setState(NEUTRAL);
  }, []);

  const style: React.CSSProperties = {
    transform: state.transform,
    transition: 'transform 0.25s ease-out',
    willChange: 'transform',
    transformStyle: 'preserve-3d',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    background: state.overlayBackground,
    transition: 'background 0.25s ease-out',
    zIndex: 20,
  };

  return { ref, style, overlayStyle, handleMouseMove, handleMouseLeave };
};

export default useTilt;
