import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface LoadingStep {
  label: string;
  completed: boolean;
}

interface LoadingPanelProps {
  currentImage?: string;
}

export function LoadingPanel({ currentImage }: LoadingPanelProps) {
  const [steps, setSteps] = useState<LoadingStep[]>([
    { label: 'Image preprocessing complete', completed: false },
    { label: 'Running defect classification', completed: false },
    { label: 'Generating RICS survey language', completed: false },
    { label: 'Calculating severity scores', completed: false },
    { label: 'Building recommendations', completed: false },
  ]);

  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];

    steps.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, i) => (i === index ? { ...step, completed: true } : step))
        );
      }, 800 * (index + 1));
      intervals.push(timeout);
    });

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(240, 242, 247, 0.95)' }}
    >
      <div className="glass-panel p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ background: 'var(--accent-secondary)', color: 'white' }}
          >
            <Loader2 size={32} />
          </motion.div>

          <h3
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--accent-primary)' }}
          >
            Analyzing Property...
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Our AI is examining your image for defects and damage
          </p>
        </div>

        {currentImage && (
          <div className="relative mb-6 rounded-lg overflow-hidden neu-card">
            <img src={currentImage} alt="Analyzing" className="w-full h-48 object-cover" />
            <div className="scanning-line"></div>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  step.completed ? 'scale-100' : 'scale-95'
                }`}
                style={{
                  background: step.completed
                    ? 'var(--severity-low)'
                    : 'var(--glass-bg)',
                  color: step.completed ? 'white' : 'var(--text-muted)',
                }}
              >
                {step.completed ? (
                  <Check size={14} />
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 size={14} />
                  </motion.div>
                )}
              </div>
              <span
                className={`text-sm ${
                  step.completed ? 'font-medium' : 'font-normal'
                }`}
                style={{
                  color: step.completed
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                }}
              >
                {step.label}
                {!step.completed && '...'}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 4, ease: 'easeInOut' }}
            className="h-full"
            style={{ background: 'var(--accent-secondary)' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
