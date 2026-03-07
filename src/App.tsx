import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HeroSection } from './components/HeroSection';
import { UploadSection } from './components/UploadSection';
import { LoadingPanel } from './components/LoadingPanel';
import { ReportSection } from './components/ReportSection';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { PropertyContext } from './types';

function App() {
  const {
    images,
    apiKey,
    setApiKey,
    addImages,
    removeImage,
    analyzeAllImages,
  } = useImageAnalysis();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalyzingImage, setCurrentAnalyzingImage] = useState<string | undefined>();

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
      alert('Analysis failed. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
      setCurrentAnalyzingImage(undefined);
    }
  };

  return (
    <div className="scroll-smooth">
      <HeroSection onGetStarted={handleGetStarted} />
      <UploadSection
        images={images}
        onAddImages={addImages}
        onRemoveImage={removeImage}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
      />
      <ReportSection images={images} />
      <ComparisonDashboard images={images} />

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
