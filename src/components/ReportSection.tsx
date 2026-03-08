import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Calendar, Eye, EyeOff } from 'lucide-react';
import { ImageAnalysis, Citation } from '../types';
import { SeverityGauge } from './SeverityGauge';
import { DefectHighlightViewer } from './DefectHighlightViewer';
import { ReportQA } from './ReportQA';
import { buildReportText, getSeverityClass } from '../utils';

interface CitationsPanelProps {
  citations: Citation[];
}

function CitationsPanel({ citations }: CitationsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div
      style={{
        marginTop: '16px',
        border: '1px solid rgba(255,255,255,0.6)',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.3)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>📚</span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#1a3a6b',
            }}
          >
            Standards & References
          </span>
          <span
            style={{
              fontSize: '10px',
              background: 'rgba(26,58,107,0.1)',
              color: '#1a3a6b',
              padding: '2px 8px',
              borderRadius: '20px',
              fontWeight: '600',
            }}
          >
            {citations.length}
          </span>
        </div>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {citations.map((cite, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(26,58,107,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#1a3a6b',
                  background: 'rgba(26,58,107,0.08)',
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  width: 'fit-content',
                  letterSpacing: '0.3px',
                }}
              >
                {cite.reference}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a2035' }}>{cite.title}</div>
              <div style={{ fontSize: '12px', color: '#4a5578', lineHeight: '1.5' }}>{cite.relevance}</div>
            </div>
          ))}
          <div
            style={{
              fontSize: '10px',
              color: '#9ca3af',
              fontStyle: 'italic',
              marginTop: '4px',
              letterSpacing: '0.2px',
            }}
          >
            References sourced from RICS guidance notes, British Standards, and UK Building Regulations. Always
            verify applicability with a qualified Chartered Surveyor.
          </div>
        </div>
      )}
    </div>
  );
}

interface ReportSectionProps {
  images: ImageAnalysis[];
}

export function ReportSection({ images }: ReportSectionProps) {
  const analyzedImages = images.filter((img) => img.report);
  const [overlayStates, setOverlayStates] = useState<{ [key: string]: boolean }>({});

  if (analyzedImages.length === 0) return null;

  const copyReport = (image: ImageAnalysis) => {
    if (!image.report) return;
    const text = buildReportText(image.report, image.reference);
    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  };

  const toggleOverlay = (imageId: string) => {
    setOverlayStates((prev) => ({
      ...prev,
      [imageId]: prev[imageId] === undefined ? false : !prev[imageId],
    }));
  };

  const getOverlayState = (imageId: string) => {
    return overlayStates[imageId] === undefined ? true : overlayStates[imageId];
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
              <div className="mb-6">
                <div className="flex flex-col gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-3">
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
                  {image.report?.defect_zones && image.report.defect_zones.length > 0 && (
                    <button
                      onClick={() => toggleOverlay(image.id)}
                      className="neu-button px-4 py-2 text-xs font-medium inline-flex items-center gap-2 self-start"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {getOverlayState(image.id) ? (
                        <>
                          <EyeOff size={14} />
                          Hide Overlay
                        </>
                      ) : (
                        <>
                          <Eye size={14} />
                          Show Defect Zones
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="w-full max-w-md mx-auto mb-6">
                  <DefectHighlightViewer
                    imageSrc={image.dataUrl}
                    defectZones={image.report?.defect_zones || []}
                    showOverlay={getOverlayState(image.id)}
                  />
                </div>
              </div>

              {image.report && (
                <>
                  {image.report.analysis_limitations && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginBottom: '14px',
                      fontSize: '12px',
                      color: '#92400e',
                      lineHeight: '1.5',
                    }}>
                      <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
                      <span><strong>Analysis note:</strong> {image.report.analysis_limitations}</span>
                    </div>
                  )}

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

                  <CitationsPanel citations={image.report.citations || []} />

                  <ReportQA
                    report={{
                      ref: image.reference,
                      severity: image.report.severity,
                      severityScore: image.report.severity_score,
                      urgency: image.report.urgency,
                      defectCategories: image.report.defect_categories,
                      surveyDescription: image.report.survey_description,
                      riskMatrix: image.report.risk_matrix,
                      costEstimate: image.report.cost_estimate,
                      recommendations: image.report.recommendations,
                      locationContextNotes: image.report.location_context_notes,
                      citations: image.report.citations,
                    }}
                  />

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
