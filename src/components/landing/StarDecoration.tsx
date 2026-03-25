import { cn } from "@/lib/utils";

interface StarDecorationProps {
  size?: number;
  color?: "purple" | "blue" | "green" | "orange" | "offwhite";
  className?: string;
  animated?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  purple: "text-primary",
  blue: "text-secondary",
  green: "text-accent",
  orange: "text-warning",
  offwhite: "text-sidebar-foreground",
};

const StarDecoration = ({ size = 24, color = "purple", className, animated = true }: StarDecorationProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn(COLOR_MAP[color], animated && "animate-star-spin", className)}
    aria-hidden="true"
  >
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

export default StarDecoration;
