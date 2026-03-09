import { PropertyContext, AnalysisReport } from './types';
import heic2any from 'heic2any';

async function compressAndEncode(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file: File, maxWidth = 1200): Promise<string> {
  let processedFile = file;

  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');

  if (isHeic) {
    try {
      const convertedBlob = (await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      })) as Blob;

      processedFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
        type: 'image/jpeg',
      });
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      throw new Error(
        'Could not convert HEIC image. Please try exporting as JPG from your Photos app.'
      );
    }
  }

  return compressAndEncode(processedFile, maxWidth);
}

export function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomChars = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `SVY-2026-${randomChars}`;
}

export function buildPrompt(context: PropertyContext): string {
  return `You are an expert RICS-qualified building surveyor AI with 20+ years of experience in structural assessment, defect analysis, and professional survey reporting.

PROPERTY CONTEXT:
- Type: ${context.propertyType || 'Unknown'}
- Age: ${context.buildingAge || 'Unknown'}
- Location: ${context.locationType || 'Standard'}
- Report Purpose: ${context.reportPurpose || 'General Inspection'}

Analyse this property image and return ONLY a valid JSON object. No markdown, no backticks, no explanation. Raw JSON only.

Return this exact structure:
{
  "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
  "severity_score": number between 0-100,
  "urgency": "string (e.g. Address within 3 months)",
  "defect_categories": [
    {
      "name": "Defect type",
      "icon": "single relevant emoji",
      "confidence": number 0-100,
      "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical"
    }
  ],
  "survey_description": "Professional 4-5 sentence RICS-standard description...",
  "risk_matrix": {
    "likelihood": "Low" | "Medium" | "High",
    "impact": "Low" | "Medium" | "High"
  },
  "cost_estimate": {
    "low": number,
    "mid": number,
    "high": number,
    "currency": "GBP"
  },
  "recommendations": [
    {
      "priority": "P1" | "P2" | "P3",
      "action": "Description of action required",
      "specialist": "Type of specialist required",
      "timeframe": "e.g. Within 1 month"
    }
  ],
  "location_context_notes": "Any specific notes given the property context provided"
}

Be technically precise. Use proper surveying terminology. Cost estimates should reflect 2025 UK market rates.`;
}

export async function analyzeImage(
  base64Image: string,
  context: PropertyContext
): Promise<AnalysisReport> {
  const response = await fetch('/.netlify/functions/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64Image,
      mediaType: 'image/jpeg',
      context: {
        propertyType: context.propertyType || '',
        buildingAge: context.buildingAge || '',
        locationType: context.locationType || '',
        reportPurpose: context.reportPurpose || '',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  const data = await response.json();
  const rawText = data.content
    .map((block: { type: string; text?: string }) =>
      block.type === 'text' ? block.text : ''
    )
    .filter(Boolean)
    .join('');

  const clean = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const report = JSON.parse(clean);
    return report;
  } catch (error) {
    console.error('JSON parse error:', error);
    console.error('Raw text:', rawText);
    throw new Error('Failed to parse AI response');
  }
}

export function buildReportText(report: AnalysisReport, ref: string): string {
  let text = `
SURVEYAI — PROPERTY DEFECT REPORT
Reference: ${ref}
Date: ${new Date().toLocaleDateString('en-GB')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEVERITY ASSESSMENT: ${report.severity.toUpperCase()} (${report.severity_score}/100)
URGENCY: ${report.urgency}

DEFECTS IDENTIFIED:
${report.defect_categories.map(d => `• ${d.name} [${d.confidence}% confidence] — ${d.severity}`).join('\n')}

SURVEY DESCRIPTION:
${report.survey_description}

INDICATIVE REPAIR COSTS:
${report.cost_estimate?.low != null ? `  Conservative: £${report.cost_estimate.low.toLocaleString()}
  Mid-range:    £${report.cost_estimate.mid.toLocaleString()}
  Full scope:   £${report.cost_estimate.high.toLocaleString()}` : '  Insufficient data — specialist assessment required'}

RECOMMENDED ACTIONS:
${report.recommendations.map((r) => `[${r.priority}] ${r.action}\n    Specialist: ${r.specialist} | Timeframe: ${r.timeframe}`).join('\n\n')}`;

  if (report.citations && report.citations.length > 0) {
    text += `\n\nSTANDARDS & REFERENCES:\n`;
    text += report.citations
      .map(
        (c) =>
          `  [${c.reference}] ${c.title}\n  Relevance: ${c.relevance}`
      )
      .join('\n\n');
  }

  if (report.location_context_notes) {
    text += `\n\nLOCATION CONTEXT:\n${report.location_context_notes}`;
  }

  text += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by SurveyAI · Taurgo × Cardiff University Hackathon 2026
Powered by Claude AI (Anthropic)`;

  return text.trim();
}

export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'var(--severity-critical)';
    case 'high':
      return 'var(--severity-high)';
    case 'medium':
      return 'var(--severity-medium)';
    case 'low':
      return 'var(--severity-low)';
    case 'monitor':
      return 'var(--severity-monitor)';
    default:
      return 'var(--text-muted)';
  }
}

export function getSeverityClass(severity: string): string {
  return `severity-${severity.toLowerCase()}`;
}
 