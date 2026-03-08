import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, History } from 'lucide-react';
import { ImageAnalysis } from '../types';

interface ReportHistoryProps {
  images: ImageAnalysis[];
}

export function ReportHistory({ images }: ReportHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const analyzedImages = images.filter((img) => img.report);

  if (analyzedImages.length === 0) return null;

  const scrollToReport = (imageId: string) => {
    const reportElement = document.getElementById(`report-${imageId}`);
    if (reportElement) {
      reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      reportElement.style.animation = 'pulse-highlight 1.5s ease-out';
      setTimeout(() => {
        reportElement.style.animation = '';
      }, 1500);
    }
  };

  return (
    <section className="py-8 px-4 no-print">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="neu-button w-full max-w-2xl mx-auto px-6 py-4 flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-3">
            <History size={20} style={{ color: 'var(--accent-primary)' }} />
            <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              Report History ({analyzedImages.length})
            </span>
          </div>
          <ChevronDown
            size={20}
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-panel p-6">
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {analyzedImages.map((image, index) => (
                    <motion.div
                      key={image.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => scrollToReport(image.id)}
                      className="flex-shrink-0 w-64 neu-card p-4 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <div className="relative mb-3 rounded-lg overflow-hidden">
                        {image.dataUrl ? (
                          <img
                            src={image.dataUrl}
                            alt={`Report ${index + 1}`}
                            className="w-full h-40 object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-40 flex items-center justify-center text-4xl"
                            style={{ background: '#f3f4f6' }}
                          >
                            🏠
                          </div>
                        )}
                        <div
                          className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-bold text-white"
                          style={{
                            background:
                              image.report?.severity === 'Critical'
                                ? 'var(--severity-critical)'
                                : image.report?.severity === 'High'
                                ? 'var(--severity-high)'
                                : image.report?.severity === 'Medium'
                                ? 'var(--severity-medium)'
                                : image.report?.severity === 'Low'
                                ? 'var(--severity-low)'
                                : 'var(--severity-monitor)',
                          }}
                        >
                          {image.report?.severity.toUpperCase()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div
                          className="text-sm font-semibold mono"
                          style={{ color: 'var(--accent-secondary)' }}
                        >
                          {image.reference}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {image.timestamp.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {image.report && (
                          <div className="flex flex-wrap gap-1">
                            {image.report.defect_categories.slice(0, 2).map((defect, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-1 rounded glass-panel-sm"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {defect.icon} {defect.name}
                              </span>
                            ))}
                            {image.report.defect_categories.length > 2 && (
                              <span
                                className="text-xs px-2 py-1 rounded glass-panel-sm"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                +{image.report.defect_categories.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
