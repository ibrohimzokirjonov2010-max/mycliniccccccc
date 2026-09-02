import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Search, Navigation, Check, X, 
  Loader2, ExternalLink, Compass, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LocationMapPickerModal({ 
  isOpen, 
  onClose, 
  onSelectLocation, 
  initialAddress = '',
  clinicName = ''
}) {
  // Default to Tashkent center
  const [coords, setCoords] = useState({ lat: 41.311081, lng: 69.240562 });
  const [zoom, setZoom] = useState(15);
  const [searchQuery, setSearchQuery] = useState(initialAddress || clinicName || '');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '');
  const [loading, setLoading] = useState(false);
  const [locatingGPS, setLocatingGPS] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Initialize or search when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialAddress) {
        handleSearch(initialAddress);
      } else if (clinicName) {
        setSearchQuery(clinicName);
      }
    }
  }, [isOpen, initialAddress]);

  // Reverse geocode when coords change
  const reverseGeocode = async (lat, lng) => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz,ru,en`,
        { headers: { 'User-Agent': 'ShifoCRM-App/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Format a clean, human-readable address
          const addr = data.address || {};
          const parts = [
            addr.road || addr.street || addr.pedestrian,
            addr.house_number ? `${addr.house_number}-uy` : '',
            addr.suburb || addr.neighbourhood || addr.quarter,
            addr.city_district || addr.district,
            addr.city || addr.town || addr.county || 'Toshkent'
          ].filter(Boolean);

          const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name;
          setSelectedAddress(formattedAddress);
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search address by text query
  const handleSearch = async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery)?.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const searchTarget = q.toLowerCase().includes('uzbekistan') || q.toLowerCase().includes('toshkent') 
        ? q 
        : `${q}, O'zbekiston`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTarget)}&limit=5&accept-language=uz,ru,en`,
        { headers: { 'User-Agent': 'ShifoCRM-App/1.0' } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setCoords({ lat, lng });
          setSelectedAddress(first.display_name);
        } else {
          toast.info("Manzil topilmadi. Qidiruv so'zini o'zgartirib ko'ring");
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error("Qidiruvda xatolik yuz berdi");
    } finally {
      setIsSearching(false);
    }
  };

  // Detect current GPS location
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi");
      return;
    }

    setLocatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setLocatingGPS(false);
        reverseGeocode(lat, lng);
        toast.success("📍 Hozirgi joylashuvingiz aniqlandi!");
      },
      (error) => {
        setLocatingGPS(false);
        toast.error("Joylashuvni aniqlab bo'lmadi. Ruxsat berilganini tekshiring.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm and save location
  const handleConfirm = () => {
    const yandexUrl = `https://yandex.uz/maps/?pt=${coords.lng},${coords.lat}&z=17&l=map`;
    const finalAddress = selectedAddress || searchQuery || "Klinika manzili";

    onSelectLocation({
      address: finalAddress,
      yandexMap: yandexUrl,
      lat: coords.lat,
      lng: coords.lng
    });

    toast.success("📍 Klinika joylashuvi va Yandex havolasi saqlandi!");
    onClose();
  };

  if (!isOpen) return null;

  // Static / Interactive map preview URL using OpenStreetMap iframe embed
  const bbox = [
    coords.lng - 0.005,
    coords.lat - 0.003,
    coords.lng + 0.005,
    coords.lat + 0.003
  ].join('%2C');
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
  const yandexPreviewUrl = `https://yandex.uz/maps/?pt=${coords.lng},${coords.lat}&z=17&l=map`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Klinika joylashuvini xaritadan belgilash</h3>
              <p className="text-[11px] text-slate-300">Qidiruvdan toping yoki GPS orqali hozirgi joylashuvingizni oling</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Manzil, ko'cha, bekat yoki klinika nomini yozing..."
                className="pl-9 pr-3 h-10 text-xs bg-white border-slate-300 rounded-xl focus:border-indigo-500 font-medium"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isSearching}
              className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Qidirish"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDetectGPS}
              disabled={locatingGPS}
              className="h-10 px-3 bg-white border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5"
              title="Hozir turgan joyingizni aniqlash"
            >
              <Navigation className={`w-4 h-4 text-sky-600 ${locatingGPS ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">GPS</span>
            </Button>
          </form>

          {/* Search Result Suggestions */}
          {searchResults.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-1 shadow-xs max-h-32 overflow-y-auto custom-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Qidiruv natijalari:</span>
              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const lat = parseFloat(res.lat);
                    const lng = parseFloat(res.lon);
                    setCoords({ lat, lng });
                    setSelectedAddress(res.display_name);
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer text-xs text-slate-700 flex items-start gap-2 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{res.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Container Frame */}
        <div className="relative flex-1 min-h-[260px] bg-slate-100 overflow-hidden">
          <iframe
            title="Interactive Map Preview"
            src={embedUrl}
            className="w-full h-full border-0 pointer-events-auto"
            style={{ minHeight: '260px' }}
          />

          {/* Map Target Center Badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2 text-xs font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Nuqta koordinatalari:</span>
            <span className="font-mono text-[11px] text-slate-600">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
          </div>

          {/* Yandex External Direct Link Button */}
          <a
            href={yandexPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
            Yandex Maps'da ochish
          </a>
        </div>

        {/* Selected Address Details Card & Confirm Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Tanlangan manzil:</span>
                {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5 leading-snug line-clamp-2">
                {selectedAddress || "Manzil aniqlanmoqda..."}
              </p>
              <p className="text-[11px] font-mono text-amber-600 font-medium truncate mt-1">
                {yandexPreviewUrl}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border-slate-300 text-xs font-bold text-slate-700 bg-white"
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Shu joyni tanlash va tasdiqlash
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
