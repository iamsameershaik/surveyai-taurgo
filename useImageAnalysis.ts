import { useState, useRef } from 'react';
import { ImageAnalysis, PropertyContext, ImageProgress } from '../types';
import { generateRef, analyzeImage } from '../utils';
import heic2any from 'heic2any';

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

// Compress a JPEG data URL to base64 via canvas — never receives a raw HEIC file
function compressDataUrl(dataUrl: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  // imagesRef always holds the latest images — used inside async callbacks to avoid stale closure
  const imagesRef = useRef<ImageAnalysis[]>([]);
  const progressRef = useRef<ImageProgress[]>([]);
  const [analysisProgressSnapshot, setAnalysisProgressSnapshot] = useState<ImageProgress[]>([]);

  function setImagesSync(updater: (prev: ImageAnalysis[]) => ImageAnalysis[]) {
    setImages((prev) => {
      const next = updater(prev);
      imagesRef.current = next;
      return next;
    });
  }

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
        // Convert HEIC once — result stored as data URL, used everywhere downstream
        (async () => {
          try {
            const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const dataUrl = await blobToDataURL(blob);
            setImagesSync((prev) =>
              prev.map((img) => img.id === id ? { ...img, dataUrl, isLoadingThumbnail: false } : img)
            );
          } catch (err) {
            console.error('HEIC conversion failed:', err);
            setImagesSync((prev) =>
              prev.map((img) =>
                img.id === id ? { ...img, isLoadingThumbnail: false, error: 'Could not convert HEIC image' } : img
              )
            );
          }
        })();
      } else {
        // Non-HEIC: convert to data URL immediately (stable, no blob URL expiry risk)
        newImage.dataUrl = await blobToDataURL(file);
      }
    }

    setImagesSync((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImagesSync((prev) => prev.filter((img) => img.id !== id));
  };

  const analyzeImageById = async (id: string, context: PropertyContext, index: number) => {
    setImagesSync((prev) =>
      prev.map((img) => img.id === id ? { ...img, isAnalyzing: true, error: undefined } : img)
    );

    try {
      // Read from imagesRef — never from the stale `images` closure
      let image = imagesRef.current.find((img) => img.id === id);
      if (!image) throw new Error('Image not found');

      // If HEIC conversion is still running, wait up to 20s for it to finish
      if (image.isLoadingThumbnail || image.dataUrl === '') {
        for (let waited = 0; waited < 20000; waited += 300) {
          await new Promise(r => setTimeout(r, 300));
          image = imagesRef.current.find((img) => img.id === id);
          if (!image?.isLoadingThumbnail && image?.dataUrl) break;
        }
      }

      if (!image?.dataUrl) throw new Error('Image conversion timed out. Please try again.');

      updateStage(index, 'preprocessing');

      // Compress using data URL — no HEIC file ever touches the canvas
      const base64 = await compressDataUrl(image.dataUrl);

      updateStage(index, 'classifying');

      const report = await analyzeImage(base64, context);

      updateStage(index, 'generating');
      await new Promise(resolve => setTimeout(resolve, 200));

      updateStage(index, 'scoring');
      await new Promise(resolve => setTimeout(resolve, 200));

      setImagesSync((prev) =>
        prev.map((img) => img.id === id ? { ...img, report, isAnalyzing: false } : img)
      );

      updateStage(index, 'complete');
      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error(`Analysis failed [${id}]:`, errorMessage);

      setImagesSync((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, isAnalyzing: false, error: errorMessage } : img
        )
      );

      updateStage(index, 'error');
      return null;
    }
  };

  const analyzeAllImages = async (context: PropertyContext) => {
    // Read from ref — not stale `images` state
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

    // Sequential — avoids parallel state race conditions and API rate limits
    for (let i = 0; i < unanalyzedImages.length; i++) {
      await analyzeImageById(unanalyzedImages[i].id, context, i).catch((err) => {
        console.error(`Failed: ${unanalyzedImages[i].file.name}`, err);
      });
    }

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
