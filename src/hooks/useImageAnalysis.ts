import { useState, useEffect } from 'react';
import { ImageAnalysis, PropertyContext, ImageProgress } from '../types';
import { compressImage, generateRef, analyzeImage } from '../utils';
import heic2any from 'heic2any';

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState<ImageProgress[]>([]);

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
            const convertedBlob = (await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.85,
            })) as Blob;

            const dataUrl = URL.createObjectURL(convertedBlob);

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
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove?.dataUrl) {
        URL.revokeObjectURL(imageToRemove.dataUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
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

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'preprocessing' as const } : p
      ));

      const base64 = await compressImage(image.file);

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'classifying' as const } : p
      ));

      const report = await analyzeImage(base64, context);

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'generating' as const } : p
      ));

      await new Promise(resolve => setTimeout(resolve, 200));

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'scoring' as const } : p
      ));

      await new Promise(resolve => setTimeout(resolve, 200));

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, report, isAnalyzing: false } : img
        )
      );

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'complete' as const } : p
      ));
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

      setAnalysisProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, stage: 'error' as const } : p
      ));

      throw error;
    }
  };

  const analyzeAllImages = async (context: PropertyContext) => {
    const unanalyzedImages = images.filter((img) => !img.report && !img.error);

    setAnalysisProgress(unanalyzedImages.map((img, i) => ({
      fileName: img.file.name,
      previewUrl: img.dataUrl,
      stage: 'queued' as const,
      index: i,
      total: unanalyzedImages.length,
    })));

    const results = await Promise.all(
      unanalyzedImages.map((image, index) =>
        analyzeImageById(image.id, context, index)
          .catch(err => {
            console.error(`Failed to analyze ${image.file.name}:`, err);
            return null;
          })
      )
    );

    setAnalysisProgress([]);
  };

  const clearAll = () => {
    images.forEach((img) => {
      if (img.dataUrl) {
        URL.revokeObjectURL(img.dataUrl);
      }
    });
    setImages([]);
  };

  return {
    images,
    analysisProgress,
    addImages,
    removeImage,
    analyzeImageById,
    analyzeAllImages,
    clearAll,
  };
}
