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

function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  const progressRef = useRef<ImageProgress[]>([]);
  const [analysisProgressSnapshot, setAnalysisProgressSnapshot] = useState<ImageProgress[]>([]);

  // Use a ref to always read latest images in async callbacks (avoids stale closure)
  const imagesRef = useRef<ImageAnalysis[]>([]);
  // Keep imagesRef in sync with state
  const setImagesAndRef = (updater: (prev: ImageAnalysis[]) => ImageAnalysis[]) => {
    setImages((prev) => {
      const next = updater(prev);
      imagesRef.current = next;
      return next;
    });
  };

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
      const isHeic = isHeicFile(file);

      const newImage: ImageAnalysis = {
        id,
        file,
        dataUrl: '',
        reference: generateRef(),
        timestamp: new Date(),
        isAnalyzing: false,
        isLoadingThumbnail: isHeic,
      };
      newImages.push(newImage);

      if (isHeic) {
        // Convert HEIC once — result stored as data URL on the image object
        (async () => {
          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.85,
            });
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const dataUrl = await blobToDataURL(blob);

            setImagesAndRef((prev) =>
              prev.map((img) =>
                img.id === id ? { ...img, dataUrl, isLoadingThumbnail: false } : img
              )
            );
          } catch (err) {
            console.error('HEIC conversion failed:', err);
            setImagesAndRef((prev) =>
              prev.map((img) =>
                img.id === id
                  ? { ...img, isLoadingThumbnail: false, error: 'Could not convert HEIC image' }
                  : img
              )
            );
          }
        })();
      } else {
        // Non-HEIC: create data URL directly from file
        const dataUrl = await blobToDataURL(file);
        newImage.dataUrl = dataUrl;
      }
    }

    setImagesAndRef((prev) => {
      const next = [...prev, ...newImages];
      return next;
    });
  };

  const removeImage = (id: string) => {
    setImagesAndRef((prev) => prev.filter((img) => img.id !== id));
  };

  const analyzeImageById = async (id: string, context: PropertyContext, index: number) => {
    setImagesAndRef((prev) =>
      prev.map((img) => img.id === id ? { ...img, isAnalyzing: true, error: undefined } : img)
    );

    try {
      // CRITICAL: Read from imagesRef, not the stale `images` closure
      const image = imagesRef.current.find((img) => img.id === id);
      if (!image) throw new Error('Image not found');

      // For HEIC images, wait up to 15s for conversion to complete
      if (image.isLoadingThumbnail) {
        let waited = 0;
        while (waited < 15000) {
          await new Promise(r => setTimeout(r, 300));
          waited += 300;
          const updated = imagesRef.current.find((img) => img.id === id);
          if (!updated?.isLoadingThumbnail) break;
        }
      }

      // Re-read after potential wait
      const readyImage = imagesRef.current.find((img) => img.id === id);
      if (!readyImage?.dataUrl) {
        throw new Error('Image conversion failed or timed out. Please try again.');
      }

      updateStage(index, 'preprocessing');

      // compressImage now takes a data URL, not a File
      const base64 = await compressImage(readyImage.dataUrl);

      updateStage(index, 'classifying');

      const report = await analyzeImage(base64, context);

      updateStage(index, 'generating');
      await new Promise(resolve => setTimeout(resolve, 200));

      updateStage(index, 'scoring');
      await new Promise(resolve => setTimeout(resolve, 200));

      setImagesAndRef((prev) =>
        prev.map((img) => img.id === id ? { ...img, report, isAnalyzing: false } : img)
      );

      updateStage(index, 'complete');
      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error(`analyzeImageById error [${id}]:`, errorMessage);

      setImagesAndRef((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, isAnalyzing: false, error: errorMessage } : img
        )
      );

      updateStage(index, 'error');
      return null;
    }
  };

  const analyzeAllImages = async (context: PropertyContext) => {
    const unanalyzedImages = imagesRef.current.filter((img) => !img.report && !img.error);
    if (unanalyzedImages.length === 0) return;

    const initial: ImageProgress[] = unanalyzedImages.map((img, i) => ({
      fileName: img.file.name,
      previewUrl: img.dataUrl,
      stage: 'queued' as const,
      index: i,
      total: unanalyzedImages.length,
    }));
    progressRef.current = initial;
    setAnalysisProgressSnapshot([...initial]);

    await Promise.all(
      unanalyzedImages.map((image, index) =>
        analyzeImageById(image.id, context, index).catch((err) => {
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
    imagesRef.current = [];
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
