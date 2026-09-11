import { useState, useRef, useCallback } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Native pull-to-refresh component
 * iOS/Android style pull down to refresh
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const springConfig = { stiffness: 300, damping: 30 };
  const y = useSpring(0, springConfig);
  const rotate = useTransform(y, [0, 100], [0, 360]);
  const opacity = useTransform(y, [0, 50], [0, 1]);

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === 0) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0 && containerRef.current.scrollTop === 0) {
      const progress = Math.min(diff * 0.5, 100);
      setPullProgress(progress);
      y.set(progress);
    }
  }, [y]);

  const handleTouchEnd = useCallback(async () => {
    if (pullProgress >= 80 && !isRefreshing) {
      setIsRefreshing(true);
      y.set(80);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
        y.set(0);
        startY.current = 0;
      }
    } else {
      setPullProgress(0);
      y.set(0);
      startY.current = 0;
    }
  }, [pullProgress, isRefreshing, onRefresh, y]);

  return (
    <div className="relative w-full min-w-0 max-w-none overflow-x-hidden overflow-y-visible">
      {/* Pull indicator */}
      <motion.div
        style={{ y, opacity }}
        className="absolute top-0 left-0 right-0 flex items-center justify-center h-20 -mt-20 z-10"
      >
        <div className="flex flex-col items-center">
          <motion.div style={{ rotate }}>
            <Loader2 
              className={`w-6 h-6 ${isRefreshing ? 'animate-spin text-teal-500' : 'text-gray-400'}`} 
            />
          </motion.div>
          <span className="text-xs text-gray-500 mt-1">
            {isRefreshing ? 'Yangilanmoqda...' : pullProgress > 50 ? 'Yangilash uchun qo\'yib yuboring' : 'Yangilash uchun torting'}
          </span>
        </div>
      </motion.div>

      {/* Content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full min-w-0 overflow-y-auto overflow-x-hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <motion.div className="w-full min-w-0" style={{ y }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
