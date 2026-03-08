import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, ChevronDown, Search } from 'lucide-react';
import { ImageAnalysis, PropertyContext } from '../types';

interface UploadSectionProps {
  images: ImageAnalysis[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onAnalyze: (context: PropertyContext) => void;
  isAnalyzing: boolean;
}

export function UploadSection({
  images,
  onAddImages,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
}: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [context, setContext] = useState<PropertyContext>({
    propertyType: 'Residential',
    buildingAge: 'Unknown',
    locationType: 'Standard',
    reportPurpose: 'General Inspection',
  });

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onAddImages(files);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onAddImages(files);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeClick = () => {
    onAnalyze(context);
  };

  const unanalyzedCount = images.filter((img) => !img.report && !img.error).length;

  return (
    <section id="upload" className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ color: 'var(--accent-primary)' }}
          >
            Upload Property Images
          </h2>
          <p
            className="text-center mb-8 max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Drop your images below or click to browse. Up to 5 images supported.
          </p>


          <div
            className={`glass-panel p-8 mb-6 cursor-pointer transition-all ${
              isDragging ? 'pulse-glow' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="text-center">
              <motion.div
                animate={{ y: isDragging ? -5 : [0, -10, 0] }}
                transition={{
                  duration: 2,
                  repeat: isDragging ? 0 : Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ background: 'var(--accent-secondary)', color: 'white' }}
              >
                <Upload size={28} />
              </motion.div>

              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {isDragging ? 'Drop images here' : 'Drop your property image here'}
              </h3>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                or tap to browse
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Accepted: JPG, PNG, WEBP, HEIC — up to 15MB
              </p>
            </div>
          </div>

          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6"
              >
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative neu-card overflow-hidden aspect-square"
                  >
                    <img
                      src={image.dataUrl}
                      alt="Property"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => onRemoveImage(image.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--severity-critical)', color: 'white' }}
                    >
                      <X size={14} />
                    </button>
                    {image.report && (
                      <div
                        className="absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-semibold text-center text-white"
                        style={{
                          background:
                            image.report.severity === 'Critical'
                              ? 'var(--severity-critical)'
                              : image.report.severity === 'High'
                              ? 'var(--severity-high)'
                              : image.report.severity === 'Medium'
                              ? 'var(--severity-medium)'
                              : image.report.severity === 'Low'
                              ? 'var(--severity-low)'
                              : 'var(--severity-monitor)',
                        }}
                      >
                        {image.report.severity.toUpperCase()}
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {images.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={() => setShowContext(!showContext)}
                className="neu-button w-full px-4 py-3 mb-4 flex items-center justify-between"
              >
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  Add Survey Context (Optional)
                </span>
                <ChevronDown
                  size={20}
                  className={`transition-transform ${showContext ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showContext && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-panel p-6 mb-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                          Property Type
                        </label>
                        <select
                          value={context.propertyType}
                          onChange={(e) =>
                            setContext({ ...context, propertyType: e.target.value })
                          }
                          className="neu-input w-full"
                        >
                          <option>Residential</option>
                          <option>Commercial</option>
                          <option>Industrial</option>
                          <option>Listed Building</option>
                          <option>New Build</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                          Building Age
                        </label>
                        <select
                          value={context.buildingAge}
                          onChange={(e) =>
                            setContext({ ...context, buildingAge: e.target.value })
                          }
                          className="neu-input w-full"
                        >
                          <option>Unknown</option>
                          <option>Pre-1900</option>
                          <option>1900-1945</option>
                          <option>1945-1980</option>
                          <option>1980-2000</option>
                          <option>Post-2000</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                          Location Type
                        </label>
                        <select
                          value={context.locationType}
                          onChange={(e) =>
                            setContext({ ...context, locationType: e.target.value })
                          }
                          className="neu-input w-full"
                        >
                          <option>Standard</option>
                          <option>Coastal</option>
                          <option>Urban</option>
                          <option>Rural</option>
                          <option>Flood Plain</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                          Report Purpose
                        </label>
                        <select
                          value={context.reportPurpose}
                          onChange={(e) =>
                            setContext({ ...context, reportPurpose: e.target.value })
                          }
                          className="neu-input w-full"
                        >
                          <option>General Inspection</option>
                          <option>Pre-Purchase Survey</option>
                          <option>Insurance Claim</option>
                          <option>Rental Compliance</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing || unanalyzedCount === 0}
                className="neu-button w-full px-8 py-4 text-white font-semibold inline-flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                style={{ background: 'var(--accent-primary)' }}
              >
                <Search size={20} />
                {isAnalyzing
                  ? 'Analyzing...'
                  : `Analyse ${unanalyzedCount} Image${unanalyzedCount !== 1 ? 's' : ''}`}
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
