export type SeverityLevel = 'Monitor' | 'Low' | 'Medium' | 'High' | 'Critical';

export type Priority = 'P1' | 'P2' | 'P3';

export interface DefectCategory {
  name: string;
  icon: string;
  confidence: number;
  severity: SeverityLevel;
}

export interface RiskMatrix {
  likelihood: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
}

export interface CostEstimate {
  low: number;
  mid: number;
  high: number;
  currency: string;
}

export interface Recommendation {
  priority: Priority;
  action: string;
  specialist: string;
  timeframe: string;
}

export interface Citation {
  reference: string;
  title: string;
  relevance: string;
}

export interface DefectZone {
  defect_name: string;
  x_percent: number;
  y_percent: number;
  w_percent: number;
  h_percent: number;
  color: string;
}

export interface AnalysisReport {
  severity: SeverityLevel;
  severity_score: number;
  urgency: string;
  defect_categories: DefectCategory[];
  survey_description: string;
  risk_matrix: RiskMatrix;
  cost_estimate: CostEstimate;
  recommendations: Recommendation[];
  location_context_notes?: string;
  defect_zones?: DefectZone[];
  citations?: Citation[];
}

export interface PropertyContext {
  propertyType: string;
  buildingAge: string;
  locationType: string;
  reportPurpose: string;
}

export interface ImageAnalysis {
  id: string;
  file: File;
  dataUrl: string;
  report?: AnalysisReport;
  reference: string;
  timestamp: Date;
  isAnalyzing: boolean;
  isLoadingThumbnail?: boolean;
  error?: string;
}
