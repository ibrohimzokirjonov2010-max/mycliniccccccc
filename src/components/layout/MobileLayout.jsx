import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Calendar, DollarSign, 
  Package, Phone, ClipboardList, Bell, Settings,
  Menu, Plus, Stethoscope,
  Wallet, CreditCard, AlertTriangle, Activity, 
  FileText, BarChart3, Briefcase, Globe, Wrench
} from 'lucide-react';
import { Tooth, ImplantIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import AdBanner from './AdBanner';

/**
 * Mobile-optimized navigation items
 * Main bottom navigation (4 items)
 */
const getMobileNavItems = (t) => [
  { path: '/', icon: LayoutDashboard, label: t('navigation.dashboard') },
  { path: '/patients', icon: Users, label: t('navigation.patients') },
  { path: '/appointments', icon: Calendar, label: t('navigation.appointments') },
  { path: '/payments', icon: DollarSign, label: t('navigation.payments') },
];

/**
 * Additional menu items (shown in sheet)
 * All other clinic modules
 */
const getMoreNavItems = (t) => [
  // Asosiy modullar
  { path: '/services', icon: Stethoscope, label: t('navigation.services'), category: 'main' },
  { path: '/inventory', icon: Package, label: t('navigation.inventory'), category: 'main' },
  { path: '/leads', icon: Phone, label: t('navigation.leads'), category: 'main' },
  { path: '/treatment-plans', icon: ClipboardList, label: t('navigation.treatmentPlans'), category: 'main' },
  { path: '/recalls', icon: Bell, label: t('navigation.recalls'), category: 'main' },
  { path: '/technicians', icon: Wrench, label: t('navigation.technicians'), category: 'main' },
  // Moliya
  { path: '/expenses', icon: Wallet, label: t('navigation.expenses'), category: 'finance' },
  { path: '/payroll', icon: Briefcase, label: t('navigation.payroll'), category: 'finance' },
  { path: '/debts', icon: CreditCard, label: t('navigation.debts'), category: 'finance' },
  { path: '/reports', icon: BarChart3, label: t('navigation.reports'), category: 'finance' },
  // Kuzatuv
  { path: '/no-shows', icon: AlertTriangle, label: t('navigation.noShow'), category: 'tracking' },
  { path: '/treatment-tracking', icon: Activity, label: t('navigation.treatmentTracking'), category: 'tracking' },
  { path: '/implants', icon: ImplantIcon, label: t('navigation.implants'), category: 'tracking' },
];

/**
 * Mobile Layout Component
 * Optimized for phone screens with bottom navigation
 */
export default function MobileLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, changeLanguage, language, availableLanguages } = useTranslation();
  const { clinicName } = useClinic();
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Check if running as installed PWA
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || window.navigator.standalone 
        || document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };
    checkInstalled();

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const isActive = (path) => location.pathname === path;
  
  const MOBILE_NAV_ITEMS = getMobileNavItems(t);
  const MORE_NAV_ITEMS = getMoreNavItems(t);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b md:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center shadow-sm">
              <Tooth className="w-5 h-5 text-slate-800" />
            </div>
            <span className="font-bold text-lg">{clinicName}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => setShowLangMenu(!showLangMenu)}
              >
                <Globe className="h-5 w-5" />
              </Button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                        language === lang.code ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                    >
                      {lang.nativeName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showInstallPrompt && !isInstalled && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleInstall}
                className="text-xs"
              >
                📲 O'rnatish
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center shadow-sm">
                        <Tooth className="w-5 h-5 text-slate-800" />
                      </div>
                      <span className="font-bold">{clinicName}</span>
                    </div>
                  </div>
                  <nav className="flex-1 p-2">
                    {[...getMobileNavItems(t), ...getMoreNavItems(t)].map((item) => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isActive(item.path) 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </button>
                    ))}
                  </nav>
                  <div className="p-4 border-t">
                    <button
                      onClick={() => navigate('/settings')}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent"
                    >
                      <Settings className="h-5 w-5" />
                      {t('navigation.settings')}
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:p-6 pb-24">
        {children}
      </main>

      {/* Advertisement Banner */}
      <AdBanner />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {MOBILE_NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${
                isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          
          {/* More Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground">
                <div className="relative">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium">{t('common.more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl overflow-y-auto">
              <div className="p-4 space-y-6">
                <h3 className="font-semibold text-lg">{t('common.all')}</h3>
                
                {/* Asosiy modullar */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('common.main')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {MORE_NAV_ITEMS.filter(i => i.category === 'main').map((item) => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                          isActive(item.path) 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Moliya */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('common.finance')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {MORE_NAV_ITEMS.filter(i => i.category === 'finance').map((item) => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                          isActive(item.path) 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kuzatuv */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('common.tracking')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {MORE_NAV_ITEMS.filter(i => i.category === 'tracking').map((item) => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                          isActive(item.path) 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium text-center">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sozlamalar */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('common.system')}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => navigate('/settings')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                        isActive('/settings') 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <Settings className="h-5 w-5" />
                      <span className="text-[10px] font-medium text-center">{t('navigation.settings')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Safe area spacer for notched phones */}
      <div className="fixed bottom-0 left-0 right-0 h-safe-area-inset-bottom bg-background md:hidden pointer-events-none" />
    </div>
  );
}
