import { db } from '@/api/supabaseClient';

/**
 * Advertisement Manager - Handles CRUD operations for ads using Supabase
 */

/**
 * Get all advertisements
 */
export async function getAllAds() {
  try {
    return await db.advertisements.getAll();
  } catch (error) {
    console.error('Error loading ads:', error);
    return [];
  }
}

/**
 * Save (Add or Update) advertisement
 */
export async function saveAd(adData) {
  try {
    if (adData.id) {
      // Update
      return await db.advertisements.update(adData.id, adData);
    } else {
      // Create
      const newAd = {
        ...adData,
        id: Date.now().toString(),
        clicks: 0,
        impressions: 0,
        created_date: new Date().toISOString()
      };
      return await db.advertisements.create(newAd);
    }
  } catch (error) {
    console.error('Error saving ad:', error);
    throw error;
  }
}

/**
 * Delete advertisement
 */
export async function deleteAd(id) {
  try {
    return await db.advertisements.delete(id);
  } catch (error) {
    console.error('Error deleting ad:', error);
    throw error;
  }
}

/**
 * Get active advertisements (within time range and enabled)
 */
export async function getActiveAds() {
  const ads = await getAllAds();
  const now = new Date();
  
  // Current time as HH:MM string for easy comparison
  const currentHH = now.getHours().toString().padStart(2, '0');
  const currentMM = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHH}:${currentMM}`;
  
  return ads.filter(ad => {
    if (!ad.enabled) return false;
    
    // If no time set - always show
    if (!ad.start_time && !ad.end_time) return true;
    
    const startTime = ad.start_time || '00:00';
    const endTime = ad.end_time || '23:59';
    
    // Direct string comparison works for HH:MM format
    if (endTime < startTime) {
      // Overnight range (e.g. 22:00 - 06:00)
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      // Normal range (e.g. 08:00 - 22:00)
      return currentTime >= startTime && currentTime <= endTime;
    }
  });
}

/**
 * Track ad impression
 */
export async function trackAdImpression(adId) {
  try {
    const ad = await db.advertisements.getById(adId);
    if (ad) {
      await db.advertisements.update(adId, {
        impressions: (ad.impressions || 0) + 1
      });
    }
  } catch (error) {
    console.error('Error tracking impression:', error);
  }
}

/**
 * Track ad click
 */
export async function trackAdClick(adId) {
  try {
    const ad = await db.advertisements.getById(adId);
    if (ad) {
      await db.advertisements.update(adId, {
        clicks: (ad.clicks || 0) + 1
      });
    }
  } catch (error) {
    console.error('Error tracking click:', error);
  }
}

/**
 * Get ad statistics
 */
export async function getAdStats() {
  const ads = await getAllAds();
  const totalAds = ads.length;
  const activeAdsList = await getActiveAds();
  const activeAds = activeAdsList.length;
  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

  return {
    totalAds,
    activeAds,
    inactiveAds: totalAds - activeAds,
    totalImpressions,
    totalClicks,
    ctr
  };
}

// Named object for backward compatibility if needed, but better to use direct imports
export const adManager = {
  getAll: getAllAds,
  saveAd: saveAd,
  deleteAd: deleteAd,
  getActiveAds: getActiveAds,
  trackImpression: trackAdImpression,
  trackClick: trackAdClick,
  getStats: getAdStats
};
