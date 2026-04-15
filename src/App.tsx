import { useState, Component } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HeroSection } from './components/HeroSection';
import { UploadSection } from './components/UploadSection';
import { AnalysisProgressModal } from './components/AnalysisProgressModal';
import { ReportSection } from './components/ReportSection';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { ReportHistory } from './components/ReportHistory';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { PropertyContext } from './types';
import { Download } from 'lucide-react';
import { generatePDF } from './utils/generatePDF';

class ReportErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Report card render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          textAlign: 'center',
          color: '#dc2626',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '4px' }}>Report could not be displayed</p>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            The image may not have processed correctly. Please try uploading again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const {
    images,
    analysisProgress,
    addImages,
    removeImage,
    analyzeAllImages,
  } = useImageAnalysis();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copyButtonLabel, setCopyButtonLabel] = useState('📋 Copy Entire Report');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [surveyContext, setSurveyContext] = useState<PropertyContext>({
    propertyType: 'Residential',
    buildingAge: 'Unknown',
    locationType: 'Standard',
    reportPurpose: 'General Inspection',
  });

  const handleGetStarted = () => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAnalyze = async (context: PropertyContext) => {
    setSurveyContext(context);
    setIsAnalyzing(true);

    try {
      await analyzeAllImages(context);
      setTimeout(() => {
        document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyEntireReport = () => {
    const analyzedImages = images.filter((img) => img.report);
    if (analyzedImages.length === 0) return;

    const text = analyzedImages.map((image, index) => {
      if (!image.report) return '';

      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROPERTY REPORT ${index + 1} OF ${analyzedImages.length}
Reference: ${image.reference}
Date: ${image.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEVERITY: ${image.report.severity.toUpperCase()} (Score: ${image.report.severity_score}/100)
URGENCY: ${image.report.urgency}

DEFECTS IDENTIFIED:
${image.report.defect_categories.map(d => `  • ${d.icon} ${d.name} — ${d.confidence}% confidence [${d.severity}]`).join('\n')}

SURVEY DESCRIPTION:
${image.report.survey_description}

RISK ASSESSMENT:
  Likelihood: ${image.report.risk_matrix.likelihood}
  Impact:     ${image.report.risk_matrix.impact}

INDICATIVE REPAIR COSTS (2025 UK rates):
  Conservative estimate: £${image.report.cost_estimate.low.toLocaleString()}
  Mid-range estimate:    £${image.report.cost_estimate.mid.toLocaleString()}
  Full scope estimate:   £${image.report.cost_estimate.high.toLocaleString()}

RECOMMENDED ACTIONS:
${image.report.recommendations.map(r => `  [${r.priority}] ${r.action}\n        Specialist: ${r.specialist} | Timeframe: ${r.timeframe}`).join('\n\n')}

${image.report.location_context_notes ? `CONTEXT NOTES:\n${image.report.location_context_notes}` : ''}
`.trim();
    }).join('\n\n');

    const fullText = `SURVEYAI — FULL PORTFOLIO REPORT
Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
Total Properties Analysed: ${analyzedImages.length}
Powered by Claude AI (Anthropic) + Nova Pro (Amazon) · Built by Team 8 · Taurgo × Cardiff University Hackathon 2026

${text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    navigator.clipboard.writeText(fullText);
    setCopyButtonLabel('✓ Copied!');
    setTimeout(() => {
      setCopyButtonLabel('📋 Copy Entire Report');
    }, 2000);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const analyzedImages = images.filter((img) => img.report);
      const reports = analyzedImages.map((image) => ({
        ref: image.reference,
        date: image.timestamp.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        previewUrl: image.dataUrl,
        severity: image.report!.severity,
        severityScore: image.report!.severity_score,
        urgency: image.report!.urgency,
        defectCategories: image.report!.defect_categories,
        surveyDescription: image.report!.survey_description,
        riskMatrix: image.report!.risk_matrix,
        costEstimate: image.report!.cost_estimate,
        recommendations: image.report!.recommendations,
        citations: image.report!.citations || [],
        analysisLimitations: image.report!.analysis_limitations || undefined,
      }));
      await generatePDF(reports, surveyContext);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const analyzedImages = images.filter((img) => img.report);

  return (
    <div className="scroll-smooth">
      <HeroSection onGetStarted={handleGetStarted} />
      <UploadSection
        images={images}
        onAddImages={addImages}
        onRemoveImage={removeImage}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
      />

      <ReportHistory images={images} />

      <ReportErrorBoundary>
        <ReportSection images={images} />
      </ReportErrorBoundary>
      <ComparisonDashboard images={images} />

      {analyzedImages.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={copyEntireReport}
              className="neu-button px-8 py-4 text-white font-semibold inline-flex items-center justify-center gap-3 text-base sm:text-lg"
              style={{ background: 'var(--accent-primary)' }}
            >
              {copyButtonLabel}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="neu-button px-8 py-4 text-white font-semibold inline-flex items-center justify-center gap-3 text-base sm:text-lg"
              style={{ background: 'var(--accent-primary)', opacity: isGeneratingPDF ? 0.6 : 1 }}
            >
              <Download size={20} />
              {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </section>
      )}

      {isAnalyzing && analysisProgress.length > 0 && (
        <AnalysisProgressModal progress={analysisProgress} />
      )}

      <footer className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <div className="glass-panel-sm inline-block px-6 py-3">
          <p className="text-sm">
            Built by Team 8 · Taurgo × Cardiff University AI Hackathon · March 2026
          </p>
          <p className="text-xs mt-1">
            Powered by Claude AI (Anthropic) + Nova Pro (Amazon)
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
