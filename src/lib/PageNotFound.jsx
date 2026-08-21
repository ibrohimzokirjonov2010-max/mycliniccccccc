import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Professional PageNotFound Component
 * 
 * Modern 404 error page with animated elements
 * 
 * @returns {JSX.Element} 404 error page
 */
export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageName = location.pathname.substring(1);

  const { data: authData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return { user, isAuthenticated: true };
      } catch (error) {
        return { user: null, isAuthenticated: false };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const goBack = useCallback(() => navigate(-1), [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full"
      >
        {/* Icon */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="flex justify-center mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileQuestion className="w-10 h-10 text-slate-400" />
          </div>
        </motion.div>

        {/* 404 Code */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-6"
        >
          <h1 className="text-6xl font-bold text-slate-200 mb-2">404</h1>
          <div className="h-1 w-12 bg-emerald-500 rounded-full mx-auto" />
        </motion.div>

        {/* Message */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sahifa topilmadi
          </h2>
          <p className="text-sm text-slate-500">
            "{pageName}" mavjud emas
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <Button
            onClick={goHome}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Home className="w-4 h-4" />
            Bosh sahifa
          </Button>
          
          <Button
            variant="outline"
            onClick={goBack}
            className="w-full h-12 rounded-xl border-slate-200 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Orqaga
          </Button>
        </motion.div>

        {/* Suggested Pages */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-slate-200"
        >
          <p className="text-xs text-slate-400 text-center mb-4">
            O'rniga quyidagilarni ko'ring:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Bemorlar', 'Navbatlar', 'Xizmatlar'].map((page, idx) => (
              <button
                key={page}
                onClick={() => navigate(idx === 0 ? '/patients' : idx === 1 ? '/appointments' : '/services')}
                className="px-4 py-2 bg-white rounded-full text-sm text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
              >
                {page}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
