import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { 
  getActiveAds, 
  trackAdImpression, 
  trackAdClick 
} from '@/utils/adManager';

/**
 * Advertisement Banner Component
 * Displays active advertisements at the bottom of the site
 */
export default function AdBanner() {
  const [activeAds, setActiveAds] = useState([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const ads = await getActiveAds();
        setActiveAds(ads);
        if (ads.length > 0) {
          await trackAdImpression(ads[0].id);
        }
      } catch (err) {
        // Silently fail - ads are optional
      }
    };

    // Load immediately
    loadAds();
    
    // Reload every 60 seconds to pick up new ads or time changes
    const interval = setInterval(loadAds, 60000);
    return () => clearInterval(interval);
  }, []);

  // Stats calculated from state
  const adStats = useMemo(() => {
    const totalAds = activeAds.length;
    const totalImpressions = activeAds.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const totalClicks = activeAds.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    return { 
      totalAds, 
      totalImpressions, 
      totalClicks, 
      ctr 
    };
  }, [activeAds]);

  // Auto-rotate ads every 10 seconds
  useEffect(() => {
    if (activeAds.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % activeAds.length);
      // Track impression for new ad
      trackAdImpression(activeAds[(currentAdIndex + 1) % activeAds.length].id);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeAds, currentAdIndex]);

  const handleAdClick = (ad) => {
    trackAdClick(ad.id);
    if (ad.link_url) {
      window.open(ad.link_url, '_blank');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || activeAds.length === 0) {
    return null;
  }

  const currentAd = activeAds[currentAdIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
      >
        {/* Ad Container */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-white/10 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute -top-3 right-4 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors z-10 shadow-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Ad Content */}
          <div 
            onClick={() => handleAdClick(currentAd)}
            className="cursor-pointer px-4 py-3 md:px-6 md:py-4"
          >
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              {/* Ad Image */}
              {currentAd.image_url && (
                <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  <img
                    src={currentAd.image_url}
                    alt={currentAd.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Ad Text Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm md:text-base font-bold text-white mb-1 line-clamp-1">
                      {currentAd.title}
                    </h3>
                    {currentAd.description && (
                      <p className="text-xs md:text-sm text-slate-300 line-clamp-2">
                        {currentAd.description}
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  {currentAd.cta_text && (
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs md:text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-xl">
                        {currentAd.cta_text}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Ad Meta Info */}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Reklama
                  </span>
                  {activeAds.length > 1 && (
                    <div className="flex items-center gap-1">
                      {activeAds.map((_, index) => (
                        <div
                          key={index}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            index === currentAdIndex ? 'bg-blue-400' : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar (for auto-rotation) */}
          {activeAds.length > 1 && (
            <div className="h-0.5 bg-slate-700">
              <motion.div
                key={currentAdIndex}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 10, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
