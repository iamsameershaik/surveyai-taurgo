import { motion } from 'framer-motion';
import { Copy, Calendar } from 'lucide-react';
import { ImageAnalysis } from '../types';
import { SeverityGauge } from './SeverityGauge';
import { buildReportText, getSeverityClass } from '../utils';

interface ReportSectionProps {
  images: ImageAnalysis[];
}

export function ReportSection({ images }: ReportSectionProps) {
  const analyzedImages = images.filter((img) => img.report);

  if (analyzedImages.length === 0) return null;

  const copyReport = (image: ImageAnalysis) => {
    if (!image.report) return;
    const text = buildReportText(image.report, image.reference);
    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  };

  return (
    <section id="reports" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
          style={{ color: 'var(--accent-primary)' }}
        >
          Analysis Reports
        </motion.h2>

        <div className="space-y-12">
          {analyzedImages.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="glass-panel p-6 md:p-8"
              id={`report-${image.id}`}
            >
              <div className="flex flex-col md:flex-row items-start gap-4 mb-6 pb-6 border-b border-white/40">
                <img
                  src={image.dataUrl}
                  alt="Property"
                  className="w-20 h-20 rounded-lg object-cover neu-card"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span
                      className="mono text-sm font-semibold"
                      style={{ color: 'var(--accent-secondary)' }}
                    >
                      {image.reference}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={12} className="inline mr-1" />
                      {image.timestamp.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {image.report && (
                <>
                  <SeverityGauge
                    severity={image.report.severity}
                    score={image.report.severity_score}
                    urgency={image.report.urgency}
                  />

                  <div className="flex flex-wrap gap-2 mb-8 justify-center">
                    {image.report.defect_categories.map((defect, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className={`glass-panel-sm px-4 py-2 flex items-center gap-2 border-2 ${getSeverityClass(
                          defect.severity
                        )}`}
                      >
                        <span className="text-lg">{defect.icon}</span>
                        <div className="text-left">
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {defect.name}
                          </div>
                          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                            {defect.confidence}% confidence
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="neu-card p-6">
                      <h4
                        className="text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--glass-border)' }}
                      >
                        RICS Survey Notes
                      </h4>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {image.report.survey_description}
                      </p>
                    </div>

                    <div className="neu-card p-6">
                      <h4
                        className="text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--glass-border)' }}
                      >
                        Risk Matrix
                      </h4>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {['High', 'Medium', 'Low'].map((impact) => (
                          <div key={impact} className="text-center">
                            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                              {impact}
                            </div>
                            <div className="space-y-1">
                              {['Low', 'Medium', 'High'].map((likelihood) => {
                                const isActive =
                                  image.report?.risk_matrix.impact === impact &&
                                  image.report?.risk_matrix.likelihood === likelihood;
                                return (
                                  <div
                                    key={likelihood}
                                    className={`h-8 rounded ${
                                      isActive ? 'ring-2 ring-offset-2 ring-blue-600' : ''
                                    }`}
                                    style={{
                                      background: isActive
                                        ? 'var(--accent-secondary)'
                                        : 'var(--glass-bg)',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                        Likelihood →
                      </div>
                    </div>

                    <div className="neu-card p-6">
                      <h4
                        className="text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--glass-border)' }}
                      >
                        Indicative Repair Cost
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Low estimate:
                          </span>
                          <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                            £{image.report.cost_estimate.low.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Mid estimate:
                          </span>
                          <span className="mono font-semibold text-lg" style={{ color: 'var(--accent-primary)' }}>
                            £{image.report.cost_estimate.mid.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            High estimate:
                          </span>
                          <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                            £{image.report.cost_estimate.high.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4
                      className="text-sm font-bold uppercase tracking-wider mb-4"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Recommended Actions
                    </h4>
                    <div className="space-y-3">
                      {image.report.recommendations.map((rec, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.1 }}
                          className="neu-card p-4 flex gap-4"
                        >
                          <div
                            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                            style={{
                              background:
                                rec.priority === 'P1'
                                  ? 'var(--severity-critical)'
                                  : rec.priority === 'P2'
                                  ? 'var(--severity-medium)'
                                  : 'var(--severity-low)',
                              color: 'white',
                            }}
                          >
                            {rec.priority}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                              {rec.action}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <span>Specialist: {rec.specialist}</span>
                              <span>•</span>
                              <span>Timeframe: {rec.timeframe}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 no-print">
                    <button
                      onClick={() => copyReport(image)}
                      className="neu-button px-6 py-3 font-medium inline-flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Copy size={18} />
                      Copy Report
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
