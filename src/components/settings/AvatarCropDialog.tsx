import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (blob: Blob) => void;
  isUploading?: boolean;
}

const CROP_OUTPUT_SIZE = 256;

const AvatarCropDialog = ({ open, onOpenChange, imageFile, onCropComplete, isUploading }: AvatarCropDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [displayScale, setDisplayScale] = useState(1);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      const minDim = Math.min(img.width, img.height);
      setCropSize(minDim);
      setCropPos({
        x: (img.width - minDim) / 2,
        y: (img.height - minDim) / 2,
      });
    };
    img.src = URL.createObjectURL(imageFile);
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  // Draw preview
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const maxDisplay = 400;
    const scale = Math.min(maxDisplay / image.width, maxDisplay / image.height, 1);
    setDisplayScale(scale);
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw full image dimmed
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw crop area bright
    const sx = cropPos.x * scale;
    const sy = cropPos.y * scale;
    const ss = cropSize * scale;
    ctx.drawImage(
      image,
      cropPos.x, cropPos.y, cropSize, cropSize,
      sx, sy, ss, ss
    );

    // Draw crop border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, ss, ss);
  }, [image, cropPos, cropSize, displayScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setDragging(true);
    setDragStart({ x: e.clientX - cropPos.x * displayScale, y: e.clientY - cropPos.y * displayScale });
  }, [cropPos, displayScale]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !image) return;
    const newX = Math.max(0, Math.min((e.clientX - dragStart.x) / displayScale, image.width - cropSize));
    const newY = Math.max(0, Math.min((e.clientY - dragStart.y) / displayScale, image.height - cropSize));
    setCropPos({ x: newX, y: newY });
  }, [dragging, dragStart, displayScale, image, cropSize]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCrop = () => {
    if (!image) return;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = CROP_OUTPUT_SIZE;
    outputCanvas.height = CROP_OUTPUT_SIZE;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      image,
      cropPos.x, cropPos.y, cropSize, cropSize,
      0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE
    );
    outputCanvas.toBlob((blob) => {
      if (blob) onCropComplete(blob);
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Crop Avatar</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Drag the bright area to reposition the crop.</p>
        <div ref={containerRef} className="flex justify-center py-4">
          <canvas
            ref={canvasRef}
            className="cursor-move rounded-md border border-border"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isUploading ? 'Uploading...' : 'Crop & Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
