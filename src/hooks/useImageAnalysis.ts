import { useState } from 'react';
import { ImageAnalysis, PropertyContext } from '../types';
import { compressImage, generateRef, analyzeImage } from '../utils';

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  const [apiKey, setApiKey] = useState<string>('');

  const addImages = async (files: File[]) => {
    const newImages: ImageAnalysis[] = [];

    for (const file of files) {
      const dataUrl = URL.createObjectURL(file);
      const newImage: ImageAnalysis = {
        id: Math.random().toString(36).substring(7),
        file,
        dataUrl,
        reference: generateRef(),
        timestamp: new Date(),
        isAnalyzing: false,
      };
      newImages.push(newImage);
    }

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const analyzeImageById = async (id: string, context: PropertyContext) => {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, isAnalyzing: true, error: undefined } : img
      )
    );

    try {
      const image = images.find((img) => img.id === id);
      if (!image) throw new Error('Image not found');

      const base64 = await compressImage(image.file);
      const report = await analyzeImage(base64, context, apiKey);

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, report, isAnalyzing: false } : img
        )
      );
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

      throw error;
    }
  };

  const analyzeAllImages = async (context: PropertyContext) => {
    const unanalyzedImages = images.filter((img) => !img.report && !img.error);

    for (const image of unanalyzedImages) {
      await analyzeImageById(image.id, context);
    }
  };

  const clearAll = () => {
    setImages([]);
  };

  return {
    images,
    apiKey,
    setApiKey,
    addImages,
    removeImage,
    analyzeImageById,
    analyzeAllImages,
    clearAll,
  };
}
