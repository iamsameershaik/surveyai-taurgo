import { useMemo } from 'react';
import { ImageAnalysis } from '../types';

interface ComparisonResult {
  analyzedImages: ImageAnalysis[];
  shouldShowComparison: boolean;
  defectFrequency: { [key: string]: { [imageId: string]: number } };
  totalCostRange: { low: number; mid: number; high: number };
  mostUrgentIssue: { defect: string; count: number } | null;
}

export function useComparison(images: ImageAnalysis[]): ComparisonResult {
  const analyzedImages = useMemo(() => {
    return images.filter((img) => img.report !== undefined);
  }, [images]);

  const shouldShowComparison = analyzedImages.length >= 2;

  const CLEAN_RESULT_NAMES = [
    'no significant defects identified',
    'no defects identified',
    'no significant defects',
    'satisfactory condition',
  ];

  const isCleanResult = (name: string) =>
    CLEAN_RESULT_NAMES.includes(name.toLowerCase().trim());

  const defectFrequency = useMemo(() => {
    const frequency: { [key: string]: { [imageId: string]: number } } = {};

    analyzedImages.forEach((image) => {
      if (!image.report) return;

      image.report.defect_categories.forEach((defect) => {
        if (isCleanResult(defect.name)) return;
        if (!frequency[defect.name]) {
          frequency[defect.name] = {};
        }
        frequency[defect.name][image.id] = defect.confidence;
      });
    });

    return frequency;
  }, [analyzedImages]);

  const totalCostRange = useMemo(() => {
    let low = 0;
    let mid = 0;
    let high = 0;

    analyzedImages.forEach((image) => {
      if (image.report?.cost_estimate?.low != null) {
        low += image.report.cost_estimate.low;
        mid += image.report.cost_estimate.mid;
        high += image.report.cost_estimate.high;
      }
    });

    return { low, mid, high };
  }, [analyzedImages]);

  const SEVERITY_WEIGHT: Record<string, number> = {
    Critical: 1000,
    High:     500,
    Medium:   200,
    Low:      50,
    Monitor:  10,
  };

  const mostUrgentIssue = useMemo(() => {
    let maxScore = 0;
    let mostUrgent: { defect: string; count: number } | null = null;

    // Build a map of defect name -> highest severity seen across all images
    const defectSeverity: Record<string, string> = {};
    analyzedImages.forEach((image) => {
      if (!image.report) return;
      image.report.defect_categories.forEach((defect) => {
        if (isCleanResult(defect.name)) return;
        const current = defectSeverity[defect.name];
        const currentWeight = SEVERITY_WEIGHT[current] ?? 0;
        const newWeight = SEVERITY_WEIGHT[defect.severity] ?? 0;
        if (newWeight > currentWeight) {
          defectSeverity[defect.name] = defect.severity;
        }
      });
    });

    Object.entries(defectFrequency).forEach(([defect, imageMap]) => {
      const count = Object.keys(imageMap).length;
      const avgConfidence =
        Object.values(imageMap).reduce((sum, conf) => sum + conf, 0) / count;
      const severityWeight = SEVERITY_WEIGHT[defectSeverity[defect]] ?? 10;
      // Severity is the primary key — a single Critical always beats many Mediums.
      // Count and confidence are tiebreakers only, kept well below the severity gap.
      const score = severityWeight * 10000 + count * 100 + avgConfidence;

      if (score > maxScore) {
        maxScore = score;
        mostUrgent = { defect, count };
      }
    });

    return mostUrgent;
  }, [defectFrequency, analyzedImages]);

  return {
    analyzedImages,
    shouldShowComparison,
    defectFrequency,
    totalCostRange,
    mostUrgentIssue,
  };
}
