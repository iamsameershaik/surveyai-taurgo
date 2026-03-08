import { useState, useEffect } from 'react';
import { ImageAnalysis, PropertyContext } from '../types';
import { compressImage, generateRef, analyzeImage } from '../utils';
import heic2any from 'heic2any';

export function useImageAnalysis() {
  const [images, setImages] = useState<ImageAnalysis[]>([]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.dataUrl) {
          URL.revokeObjectURL(img.dataUrl);
        }
      });
    };
  }, [images]);

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
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const analyzeImageById = async (id: string, context: PropertyContext) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, isAnalyzing: true, error: undefined } : img
      )
    );

    try {
      const image = images.find((img) => img.id === id);
      if (!image) throw new Error('Image not found');

      const base64 = await compressImage(image.file);
      const report = await analyzeImage(base64, context);

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
    addImages,
    removeImage,
    analyzeImageById,
    analyzeAllImages,
    clearAll,
  };
}
