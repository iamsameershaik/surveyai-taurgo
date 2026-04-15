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
  return `You are an expert RICS-qualified building surveyor AI. Analyse the property image and return ONLY a valid JSON object. No markdown, no backticks, no preamble. Raw JSON only.

PROPERTY CONTEXT:
- Type: ${context.propertyType || 'Unknown'}
- Age: ${context.buildingAge || 'Unknown'}
- Location: ${context.locationType || 'Standard'}
- Report Purpose: ${context.reportPurpose || 'General Inspection'}

SEVERITY BANDS (RICS Condition Rating):
- "Monitor" = CR1, score 0–20. No repair needed.
- "Low"     = CR1 upper, score 21–33. Early wear, monitor.
- "Medium"  = CR2, score 34–66. Repair needed, not serious.
- "High"    = CR3 lower, score 67–84. Urgent repair, specialist required.
- "Critical"= CR3 upper, score 85–99. Immediate action, safety risk.
Overall severity = worst single defect. Never assign score 0 or 100.

SURVEY DESCRIPTION — MANDATORY RULES:
- MUST be exactly 4–6 complete sentences, each 15+ words. A shorter response is a failure.
- Write in this exact order:
  S1: What was observed and where (name the building element and location).
  S2: Probable cause or contributing factor. Use "It is considered likely that..." or "The defect may be attributable to...".
  S3: Current condition and the RICS Condition Rating. State "This element is assessed as Condition Rating [1/2/3] ([description])."
  S4: Risk if left unaddressed — describe specific likely consequences.
  S5: Recommended action and specialist to engage. Use "It is recommended that remedial works are instructed by a [specialist]."
- Third-person passive voice throughout. Never use "I", "we", or "you".
- Use RICS vocabulary: "noted"/"observed"/"identified" (never "found"/"seen"/"spotted"), "remedial works" (not "repairs"), "prior to legal completion" (not "before buying").

BOUNDING BOXES (defect_zones):
- Every visually localisable defect MUST have a defect_zone entry.
- Coordinates are percentages of image dimensions. Origin (0,0) = top-left.
- HARD CONSTRAINT: x_percent + w_percent ≤ 100. y_percent + h_percent ≤ 100. Minimum w_percent = 5, h_percent = 5.
- Box must cover the full visible extent of the defect, not just its centre point.
- defect_name must exactly match a defect_categories[].name value.
- Color hex by defect severity: Critical=#dc2626, High=#ea580c, Medium=#d97706, Low=#16a34a, Monitor=#2563eb.
- If defect is not visually localisable, omit it from defect_zones entirely.

CITATIONS — MANDATORY RULES:
- MUST provide 2–4 citations. Zero or one is a failure.
- Only cite from this permitted list (copy reference and title exactly):
  * BS 5250:2021 | "BS 5250:2021 — Management of moisture in buildings. Code of practice" → use for any moisture/damp/mould defect
  * RICS Damp in Buildings Guidance Note (2022) | "Damp in Buildings, RICS Guidance Note, 2nd edition (2022)" → use for damp defects
  * Approved Document A (Structure) | "The Building Regulations 2010 — Approved Document A: Structure" → use for structural/cracking defects
  * Approved Document C (Site preparation and moisture) | "The Building Regulations 2010 — Approved Document C: Site preparation and resistance to contaminants and moisture" → use for moisture ingress
  * Approved Document F (Ventilation) | "The Building Regulations 2010 — Approved Document F: Ventilation" → use for mould/condensation
  * BS 5534:2014 | "BS 5534:2014 — Slating and tiling for steep pitched roofs and wall claddings. Code of practice" → use for pitched roof defects
  * BS 6229:2003 | "BS 6229:2003 — Flat roofs with continuously supported flexible waterproof coverings. Code of practice" → use for flat roof defects
  * BS 8004:1986 | "BS 8004:1986 — Code of practice for foundations" → use for foundation/subsidence defects
  * RICS Home Survey Standard (2021) | "RICS Home Survey Standard, 1st edition (2021)" → always valid as a methodology citation
- Each citation must include a relevance sentence (15+ words) specific to the defects observed.

Return this exact JSON structure:
{
  "image_quality": "sufficient" | "partial" | "insufficient",
  "confidence_overall": number 0–100,
  "analysis_limitations": "string or null",
  "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
  "severity_score": number 0–100,
  "urgency": "string consistent with severity band",
  "defect_categories": [
    {
      "name": "Human-readable defect name",
      "icon": "single emoji",
      "confidence": number 0–100,
      "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
      "taxonomy_short": "Tier 1 category (e.g. MOISTURE DEFECT)",
      "taxonomy_long": "Tier 2 subtype (e.g. Penetrating Damp (Lateral Ingress))"
    }
  ],
  "survey_description": "MANDATORY 4–6 sentences: S1 observation, S2 cause, S3 condition rating, S4 risk, S5 action. Passive voice. RICS terminology.",
  "risk_matrix": { "likelihood": "Low" | "Medium" | "High", "impact": "Low" | "Medium" | "High" },
  "cost_estimate": { "low": number or null, "mid": number or null, "high": number or null, "currency": "GBP" },
  "recommendations": [
    { "priority": "P1" | "P2" | "P3", "action": "Specific remedial action", "specialist": "Specialist type", "timeframe": "Timeframe consistent with priority" }
  ],
  "location_context_notes": "string or null",
  "defect_zones": [
    { "defect_name": "must match defect_categories[].name exactly", "x_percent": number, "y_percent": number, "w_percent": number (min 5), "h_percent": number (min 5), "color": "#hexcode" }
  ],
  "citations": [
    { "reference": "exact reference from permitted list", "title": "exact title from permitted list", "relevance": "15+ word sentence specific to defects observed" }
  ]
}

Cost estimates: 2025 UK market rates (RICS BCIS benchmarks). Return null if insufficient visual data.`;
}

export async function analyzeImage(
  base64Image: string,
  context: PropertyContext
): Promise<AnalysisReport> {
  const response = await fetch('/.netlify/functions/bedrock-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_SECRET_KEY || '',
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
  return data.analysis as AnalysisReport;
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
 