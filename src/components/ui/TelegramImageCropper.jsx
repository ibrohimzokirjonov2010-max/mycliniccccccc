import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RotateCw, 
  FlipHorizontal2, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  X, 
  Crop as CropIcon, 
  Sparkles,
  Undo2,
  Maximize
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Telegram-style High-End Image Cropper & Photo Editor Modal
 * Features:
 * - Interactive Crop overlay with 8 resize handles & drag pan
 * - 90-degree Rotation
 * - Horizontal Flip
 * - Zoom & Scaling with slider + buttons
 * - Aspect Ratio Presets (Erkin, 1:1, 4:3, 16:9, 3:4)
 * - Canvas export with optimal compression
 */
export default function TelegramImageCropper({
  isOpen,
  imageSrc,
  title = "Rasmni tahrirlash",
  onClose,
  onApply
}) {
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Transformations
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [zoom, setZoom] = useState(1); // 1.0 -> 3.0
  const [aspectRatio, setAspectRatio] = useState('free'); // 'free' | 1 | 4/3 | 16/9 | 3/4

  // Crop Box relative to displayed image container (0-100%)
  const [crop, setCrop] = useState({
    x: 10,
    y: 10,
    width: 80,
    height: 80
  });

  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState(null); // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      setFlipH(false);
      setZoom(1);
      setAspectRatio('free');
      setCrop({ x: 10, y: 10, width: 80, height: 80 });
    }
  }, [isOpen, imageSrc]);

  // Adjust crop box when aspect ratio changes
  const applyAspectRatio = useCallback((ratio) => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    setCrop(prev => {
      let newW = prev.width;
      let newH = prev.width / ratio;

      if (newH > 90) {
        newH = 90;
        newW = newH * ratio;
      }
      if (newW > 90) {
        newW = 90;
        newH = newW / ratio;
      }

      const newX = Math.max(5, Math.min(95 - newW, (100 - newW) / 2));
      const newY = Math.max(5, Math.min(95 - newH, (100 - newH) / 2));

      return {
        x: newX,
        y: newY,
        width: newW,
        height: newH
      };
    });
  }, []);

  // Mouse / Touch handlers for dragging and resizing crop box
  const handlePointerDown = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setActiveHandle(handle);

    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      cropX: crop.x,
      cropY: crop.y,
      cropW: crop.width,
      cropH: crop.height
    };
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((clientX - dragStartRef.current.mouseX) / rect.width) * 100;
    const deltaY = ((clientY - dragStartRef.current.mouseY) / rect.height) * 100;

    setCrop(prev => {
      let { cropX, cropY, cropW, cropH } = dragStartRef.current;
      let newX = cropX;
      let newY = cropY;
      let newW = cropW;
      let newH = cropH;

      if (activeHandle === 'move') {
        newX = Math.max(0, Math.min(100 - cropW, cropX + deltaX));
        newY = Math.max(0, Math.min(100 - cropH, cropY + deltaY));
      } else {
        // Resizing
        if (activeHandle.includes('e')) {
          newW = Math.max(15, Math.min(100 - cropX, cropW + deltaX));
        }
        if (activeHandle.includes('s')) {
          newH = Math.max(15, Math.min(100 - cropY, cropH + deltaY));
        }
        if (activeHandle.includes('w')) {
          const maxLeft = cropX + cropW - 15;
          newX = Math.max(0, Math.min(maxLeft, cropX + deltaX));
          newW = cropW + (cropX - newX);
        }
        if (activeHandle.includes('n')) {
          const maxTop = cropY + cropH - 15;
          newY = Math.max(0, Math.min(maxTop, cropY + deltaY));
          newH = cropH + (cropY - newY);
        }

        // Lock Aspect Ratio if not 'free'
        if (aspectRatio !== 'free') {
          if (activeHandle.includes('e') || activeHandle.includes('w')) {
            newH = newW / aspectRatio;
          } else {
            newW = newH * aspectRatio;
          }
          if (newX + newW > 100) newW = 100 - newX;
          if (newY + newH > 100) newH = 100 - newY;
        }
      }

      return {
        x: Math.max(0, Math.min(100 - newW, newX)),
        y: Math.max(0, Math.min(100 - newH, newY)),
        width: Math.max(10, Math.min(100, newW)),
        height: Math.max(10, Math.min(100, newH))
      };
    });
  }, [isDragging, activeHandle, aspectRatio]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setActiveHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Rotate 90 deg clockwise
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Flip horizontal
  const handleFlip = () => {
    setFlipH(prev => !prev);
  };

  // Reset all adjustments
  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setZoom(1);
    setAspectRatio('free');
    setCrop({ x: 10, y: 10, width: 80, height: 80 });
  };

  // Generate cropped output canvas with compression
  const handleConfirmCrop = async () => {
    if (!imageSrc) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // 1. Create source canvas with rotation and flip applied
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d');

      const isRotated90or270 = rotation === 90 || rotation === 270;
      const transW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      const transH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

      srcCanvas.width = transW;
      srcCanvas.height = transH;

      srcCtx.save();
      srcCtx.translate(transW / 2, transH / 2);
      srcCtx.rotate((rotation * Math.PI) / 180);
      srcCtx.scale(flipH ? -1 : 1, 1);
      srcCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      srcCtx.restore();

      // 2. Crop according to crop box percentages
      const cropPixelX = (crop.x / 100) * transW;
      const cropPixelY = (crop.y / 100) * transH;
      const cropPixelW = (crop.width / 100) * transW;
      const cropPixelH = (crop.height / 100) * transH;

      // 3. Final target canvas (max 1400px for crisp dental resolution, low memory footprint)
      const maxDim = 1400;
      let finalW = cropPixelW;
      let finalH = cropPixelH;

      if (finalW > maxDim || finalH > maxDim) {
        if (finalW > finalH) {
          finalH = Math.round((finalH * maxDim) / finalW);
          finalW = maxDim;
        } else {
          finalW = Math.round((finalW * maxDim) / finalH);
          finalH = maxDim;
        }
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = finalW;
      outCanvas.height = finalH;
      const outCtx = outCanvas.getContext('2d');

      // Enable smooth resampling
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';

      outCtx.drawImage(
        srcCanvas,
        cropPixelX,
        cropPixelY,
        cropPixelW,
        cropPixelH,
        0,
        0,
        finalW,
        finalH
      );

      // Export as optimized JPEG
      const finalDataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
      onApply(finalDataUrl);
      onClose();
    } catch (err) {
      console.error("Cropping error:", err);
      // Fallback
      onApply(imageSrc);
      onClose();
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in-50 duration-200">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1499AD]/20 text-[#1499AD] flex items-center justify-center">
                <CropIcon className="w-4 h-4" />
              </div>
              <h3 className="text-white font-black text-sm tracking-tight uppercase">{title}</h3>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center Crop Workspace */}
          <div className="flex-1 bg-black/50 p-4 sm:p-8 flex items-center justify-center relative overflow-hidden select-none min-h-[320px] max-h-[55vh]">
            <div 
              ref={containerRef}
              className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl"
              style={{
                touchAction: 'none'
              }}
            >
              {/* Main Image with transforms */}
              <img 
                ref={imageRef}
                src={imageSrc} 
                alt="Crop preview" 
                draggable={false}
                className="max-h-[46vh] max-w-[85vw] object-contain transition-transform duration-200 pointer-events-none rounded-xl"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`
                }}
              />

              {/* Darkened Mask Outside Crop Box */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle, transparent 60%, rgba(0,0,0,0.6) 100%)`
                }}
              />

              {/* Interactive Crop Box Overlay */}
              <div 
                className="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move rounded-md"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
              >
                {/* Rule of Thirds Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-white/40" />
                  <div className="border-r border-white/40" />
                  <div />
                </div>

                {/* 4 Corner Resize Handles */}
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-white border-2 border-[#1499AD] rounded-full cursor-nwse-resize shadow-md" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white border-2 border-[#1499AD] rounded-full cursor-nesw-resize shadow-md" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-white border-2 border-[#1499AD] rounded-full cursor-nwse-resize shadow-md" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  className="absolute -bottom-2.5 -left-2.5 w-6 h-6 bg-white border-2 border-[#1499AD] rounded-full cursor-nesw-resize shadow-md" 
                />

                {/* 4 Edge Handles */}
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/90 rounded-full cursor-ns-resize" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/90 rounded-full cursor-ns-resize" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-white/90 rounded-full cursor-ew-resize" 
                />
                <div 
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-white/90 rounded-full cursor-ew-resize" 
                />
              </div>
            </div>
          </div>

          {/* Tools & Controls Bar */}
          <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 space-y-4">
            
            {/* Aspect Ratio Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => applyAspectRatio('free')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    aspectRatio === 'free' ? 'bg-[#1499AD] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Erkin
                </button>
                <button
                  type="button"
                  onClick={() => applyAspectRatio(1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    aspectRatio === 1 ? 'bg-[#1499AD] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => applyAspectRatio(4 / 3)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    aspectRatio === 4 / 3 ? 'bg-[#1499AD] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  4:3
                </button>
                <button
                  type="button"
                  onClick={() => applyAspectRatio(16 / 9)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    aspectRatio === 16 / 9 ? 'bg-[#1499AD] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  16:9
                </button>
                <button
                  type="button"
                  onClick={() => applyAspectRatio(3 / 4)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    aspectRatio === 3 / 4 ? 'bg-[#1499AD] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3:4
                </button>
              </div>

              {/* Transform Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRotate}
                  className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 rounded-xl h-9 px-3 gap-1.5 font-bold text-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>90° Burish</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFlip}
                  className={`bg-slate-800 hover:bg-slate-700 text-white border-slate-700 rounded-xl h-9 px-3 gap-1.5 font-bold text-xs ${
                    flipH ? 'bg-[#1499AD]/30 border-[#1499AD]' : ''
                  }`}
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  <span>Aylantirish</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl h-9 px-2.5"
                  title="Qaytarish"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Bottom Actions: Cancel & Apply */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-slate-400 hover:text-white hover:bg-slate-800 font-black text-xs uppercase tracking-wider h-11 px-5 rounded-xl"
              >
                Bekor qilish
              </Button>

              <Button
                type="button"
                onClick={handleConfirmCrop}
                className="bg-gradient-to-r from-[#1499AD] to-[#0E7A8A] hover:from-[#1acced] hover:to-[#1499AD] text-white font-black text-xs uppercase tracking-wider h-11 px-8 rounded-xl shadow-lg shadow-[#1499AD]/20 flex items-center gap-2 border-none active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Qirqish va Saqlash</span>
              </Button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
