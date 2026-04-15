import { motion } from 'framer-motion';
import { Zap, Building2, BarChart3, ArrowRight, Upload, Sparkles, FileCheck } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 md:py-10">
      <div className="max-w-5xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 glass-panel-sm px-4 py-2 mb-6 text-xs md:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            <span>TAURGO × CARDIFF UNIVERSITY</span>
            <span className="w-1 h-1 rounded-full bg-current"></span>
            <span>AI HACKATHON 2026</span>
          </div>

          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: 'var(--accent-primary)' }}
          >
            Defect Intelligence,
            <br />
            Delivered Instantly.
          </h1>

          <p
            className="text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Upload any property image. SurveyAI identifies structural defects,
            classifies damage severity, and generates a professional
            RICS-standard survey report — in under 30 seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel-sm badge-pill"
              style={{ color: 'var(--accent-secondary)' }}
            >
              <Zap size={16} />
              <span>30-second analysis</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel-sm badge-pill"
              style={{ color: 'var(--accent-secondary)' }}
            >
              <Building2 size={16} />
              <span>RICS-standard output</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-panel-sm badge-pill"
              style={{ color: 'var(--accent-secondary)' }}
            >
              <BarChart3 size={16} />
              <span>Multi-image comparison</span>
            </motion.div>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onGetStarted}
            className="neu-button px-8 py-4 text-white font-semibold inline-flex items-center gap-3 text-lg"
            style={{ background: 'var(--accent-primary)' }}
          >
            Start Analysis
            <ArrowRight size={20} />
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16"
        >
          <div className="neu-card p-6 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'var(--accent-secondary)', color: 'white' }}
            >
              <Upload size={24} />
            </div>
            <div className="glass-panel-sm inline-block px-3 py-1 mb-3">
              <span className="text-sm font-bold" style={{ color: 'var(--accent-secondary)' }}>
                Step 1
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Upload Image
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Drop a photo of property damage or building issue
            </p>
          </div>

          <div className="neu-card p-6 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'var(--accent-secondary)', color: 'white' }}
            >
              <Sparkles size={24} />
            </div>
            <div className="glass-panel-sm inline-block px-3 py-1 mb-3">
              <span className="text-sm font-bold" style={{ color: 'var(--accent-secondary)' }}>
                Step 2
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              AI Analyses
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Nova Pro identifies all defects & risks
            </p>
          </div>

          <div className="neu-card p-6 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'var(--accent-secondary)', color: 'white' }}
            >
              <FileCheck size={24} />
            </div>
            <div className="glass-panel-sm inline-block px-3 py-1 mb-3">
              <span className="text-sm font-bold" style={{ color: 'var(--accent-secondary)' }}>
                Step 3
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Get Report
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Severity rating, defect categories, and action plan
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
