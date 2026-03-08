import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HeroSection } from './components/HeroSection';
import { UploadSection } from './components/UploadSection';
import { LoadingPanel } from './components/LoadingPanel';
import { ReportSection } from './components/ReportSection';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { PropertyContext } from './types';
import { Download } from 'lucide-react';

function App() {
  const {
    images,
    addImages,
    removeImage,
    analyzeAllImages,
  } = useImageAnalysis();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalyzingImage, setCurrentAnalyzingImage] = useState<string | undefined>();
  const [copyButtonLabel, setCopyButtonLabel] = useState('📋 Copy Entire Report');

  const handleGetStarted = () => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAnalyze = async (context: PropertyContext) => {
    setIsAnalyzing(true);
    const unanalyzedImages = images.filter((img) => !img.report && !img.error);
    if (unanalyzedImages.length > 0) {
      setCurrentAnalyzingImage(unanalyzedImages[0].dataUrl);
    }

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
      setCurrentAnalyzingImage(undefined);
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
Powered by Claude AI (Anthropic) · Built by Team 8 · Taurgo × Cardiff University Hackathon 2026

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

  const downloadPDF = () => {
    document.body.classList.add('print-report-mode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-report-mode');
    }, 1000);
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

      <div className="report-printable-area">
        <ReportSection images={images} />
        <ComparisonDashboard images={images} />

        {analyzedImages.length > 0 && (
          <section className="py-8 px-4 no-print">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={copyEntireReport}
                className="neu-button px-8 py-4 text-white font-semibold inline-flex items-center justify-center gap-3 text-base sm:text-lg"
                style={{ background: 'var(--accent-primary)' }}
              >
                {copyButtonLabel}
              </button>
              <button
                onClick={downloadPDF}
                className="neu-button px-8 py-4 text-white font-semibold inline-flex items-center justify-center gap-3 text-base sm:text-lg"
                style={{ background: 'var(--accent-primary)' }}
              >
                <Download size={20} />
                Download PDF
              </button>
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {isAnalyzing && <LoadingPanel currentImage={currentAnalyzingImage} />}
      </AnimatePresence>

      <footer className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <div className="glass-panel-sm inline-block px-6 py-3">
          <p className="text-sm">
            Built by Team 8 · Taurgo × Cardiff University AI Hackathon · March 2026
          </p>
          <p className="text-xs mt-1">
            Powered by Claude AI (Anthropic)
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
