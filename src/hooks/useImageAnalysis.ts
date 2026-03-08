import { useState, useRef } from 'react';
import { ImageAnalysis, PropertyContext, ImageProgress } from '../types';
import { compressImage, generateRef, analyzeImage } from '../utils';
import heic2any from 'heic2any';

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  const progressRef = useRef<ImageProgress[]>([]);
  const [analysisProgressSnapshot, setAnalysisProgressSnapshot] = useState<ImageProgress[]>([]);

  const updateStage = (index: number, stage: ImageProgress['stage']) => {
    progressRef.current = progressRef.current.map((p, i) =>
      i === index ? { ...p, stage } : p
    );
    setAnalysisProgressSnapshot([...progressRef.current]);
  };

  const addImages = async (files: File[]) => {
    const newImages: ImageAnalysis[] = [];

    for (const file of files) {
      const id = Math.random().toString(36).substring(7);
      const isHeic =
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif');

      // Create placeholder with loading state for HEIC files
      const newImage: ImageAnalysis = {
        id,
        file,
        dataUrl: '', // Will be set after conversion
        reference: generateRef(),
        timestamp: new Date(),
        isAnalyzing: false,
        isLoadingThumbnail: isHeic,
      };
      newImages.push(newImage);

      // Convert HEIC to JPEG for thumbnail preview
      if (isHeic) {
        (async () => {
          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.85,
            });

            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

            const dataUrl = await blobToDataURL(blob);

            setImages((prev) =>
              prev.map((img) =>
                img.id === id
                  ? { ...img, dataUrl, isLoadingThumbnail: false }
                  : img
              )
            );
          } catch (err) {
            console.error('HEIC thumbnail conversion failed:', err);
            setImages((prev) =>
              prev.map((img) =>
                img.id === id
                  ? {
                      ...img,
                      isLoadingThumbnail: false,
                      error: 'Could not convert HEIC image',
                    }
                  : img
              )
            );
          }
        })();
      } else {
        // For non-HEIC files, create preview URL immediately
        newImage.dataUrl = URL.createObjectURL(file);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const analyzeImageById = async (id: string, context: PropertyContext, index: number) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, isAnalyzing: true, error: undefined } : img
      )
    );

    try {
      const image = images.find((img) => img.id === id);
      if (!image) throw new Error('Image not found');

      updateStage(index, 'preprocessing');

      const base64 = await compressImage(image.file);

      updateStage(index, 'classifying');

      const report = await analyzeImage(base64, context);

      updateStage(index, 'generating');

      await new Promise(resolve => setTimeout(resolve, 200));

      updateStage(index, 'scoring');

      await new Promise(resolve => setTimeout(resolve, 200));

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, report, isAnalyzing: false } : img
        )
      );

      updateStage(index, 'complete');

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Analysis failed';

      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? { ...img, isAnalyzing: false, error: errorMessage }
            : img
        )
      );

      updateStage(index, 'error');

      return null;
    }
  };

  const analyzeAllImages = async (context: PropertyContext) => {
    const unanalyzedImages = images.filter((img) => !img.report && !img.error);

    const initial: ImageProgress[] = unanalyzedImages.map((img, i) => ({
      fileName: img.file.name,
      previewUrl: img.dataUrl,
      stage: 'queued' as const,
      index: i,
      total: unanalyzedImages.length,
    }));
    progressRef.current = initial;
    setAnalysisProgressSnapshot([...initial]);

    const imagesToProcess = [...unanalyzedImages];

    const results = await Promise.all(
      imagesToProcess.map((image, index) =>
        analyzeImageById(image.id, context, index)
          .catch(err => {
            console.error(`Failed to analyze ${image.file.name}:`, err);
            return null;
          })
      )
    );

    setTimeout(() => {
      progressRef.current = [];
      setAnalysisProgressSnapshot([]);
    }, 1200);
  };

  const clearAll = () => {
    setImages([]);
  };

  return {
    images,
    analysisProgress: analysisProgressSnapshot,
    addImages,
    removeImage,
    analyzeImageById,
    analyzeAllImages,
    clearAll,
  };
}
