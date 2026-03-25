

## Plan: Remove vertical line artifacts from mascot SVG

### Problem
The `src/assets/mascot.svg` contains two SVG elements that draw thin vertical lines on both edges of the graphic:
- **Line 10**: A `<path class="cls-2">` tracing the right edge at x=1392
- **Line 11**: A `<rect class="cls-1">` spanning the left edge at x=0, full height

These are export artifacts, not part of the mascot illustration.

### Fix
Edit `src/assets/mascot.svg` to remove lines 10 and 11 (the right-edge path and the left-edge rect), keeping only the mascot body (cls-3 paths).

### Files
- `src/assets/mascot.svg` — Remove the two border-line elements

