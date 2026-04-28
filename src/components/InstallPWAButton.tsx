import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MonitorDown, X, Smartphone, Tablet } from 'lucide-react';

export function InstallPWAButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'android' | 'ios'>('android');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="fixed top-4 right-4 z-50" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Install app"
        className="neu-button w-10 h-10 flex items-center justify-center rounded-full"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--accent-primary)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px var(--glass-shadow)',
        }}
      >
        <MonitorDown size={18} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-80"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px var(--glass-shadow)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--glass-border)' }}
            >
              <div className="flex items-center gap-2">
                <MonitorDown size={16} style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Install SurveyAI
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-4 pt-3 pb-1">
              <button
                onClick={() => setTab('android')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === 'android' ? 'var(--accent-primary)' : 'transparent',
                  color: tab === 'android' ? 'white' : 'var(--text-secondary)',
                  border: tab === 'android' ? 'none' : '1px solid var(--glass-border)',
                }}
              >
                <Smartphone size={13} />
                Android
              </button>
              <button
                onClick={() => setTab('ios')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === 'ios' ? 'var(--accent-primary)' : 'transparent',
                  color: tab === 'ios' ? 'white' : 'var(--text-secondary)',
                  border: tab === 'ios' ? 'none' : '1px solid var(--glass-border)',
                }}
              >
                <Tablet size={13} />
                iPhone / iPad
              </button>
            </div>

            {/* Steps */}
            <div className="px-4 py-3 space-y-2.5">
              {tab === 'android' ? (
                <>
                  <Step n={1} text="Open this page in Chrome on your Android device." />
                  <Step n={2} text="Tap the three vertical dots in the top-right corner of Chrome." />
                  <Step n={3} text='Select "Add to Home screen".' />
                  <Step n={4} text="Optionally rename the shortcut, then tap Add." />
                </>
              ) : (
                <>
                  <Step n={1} text="Open this page in Safari on your iPhone or iPad." />
                  <Step n={2} text='Tap the Share button (square with an upward arrow) at the bottom of the screen.' />
                  <Step n={3} text='Scroll down and tap "Add to Home Screen".' />
                  <Step n={4} text="Rename the app if desired, then tap Add." />
                </>
              )}

              <p
                className="text-xs pt-1 pb-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                One-tap access to SurveyAI directly from your home screen — no app store needed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'var(--accent-secondary)', color: 'white' }}
      >
        {n}
      </span>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {text}
      </p>
    </div>
  );
}
