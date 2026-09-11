import { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { isChunkLoadError } from '@/utils/lazyWithRetry';

/**
 * ErrorBoundary - Catches errors in page components
 * When a page errors, shows a friendly message with retry option
 * instead of crashing the whole app.
 * ChunkLoadError: soft-reloads once automatically (stale deploy chunks).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, remountKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Page error caught:', error?.message, info?.componentStack?.slice(0, 200));

    if (typeof window !== 'undefined' && isChunkLoadError(error)) {
      const key = 'chunk_eb_soft_reload';
      let already = false;
      try {
        already = sessionStorage.getItem(key) === '1';
      } catch (_) { /* ignore */ }
      if (!already) {
        try {
          sessionStorage.setItem(key, '1');
        } catch (_) { /* ignore */ }
        window.location.reload();
      }
    }
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    // Remount children so lazy() retries the import without a full page reload.
    this.setState((s) => ({
      hasError: false,
      error: null,
      remountKey: s.remountKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm px-8">
            <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">
              Sahifa xatosi
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
              {this.state.error?.message || 'Noma\'lum xatolik'}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Qayta urinish
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={this.state.remountKey} className="contents">
        {this.props.children}
      </div>
    );
  }
}
