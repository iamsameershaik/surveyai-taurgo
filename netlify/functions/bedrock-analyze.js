const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const client = new BedrockRuntimeClient({
  region: 'eu-west-2',
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
  },
});

const MODEL_ID = 'amazon.nova-pro-v1:0';
const DAILY_LIMIT = parseInt(process.env.BEDROCK_DAILY_LIMIT || '30', 10);

let dailyCount = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

function checkAndIncrementCounter() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    dailyCount = 0;
    lastResetDate = today;
  }
  if (dailyCount >= DAILY_LIMIT) return false;
  dailyCount++;
  return true;
}

function validateReport(report) {
  const errors = [];

  const required = ['severity', 'severity_score', 'urgency', 'defect_categories', 'survey_description', 'recommendations'];
  required.forEach(field => {
    if (!report[field]) errors.push(`Missing required field: ${field}`);
  });

  const validSeverities = ['Monitor', 'Low', 'Medium', 'High', 'Critical'];
  if (!validSeverities.includes(report.severity)) {
    errors.push(`Invalid severity value: ${report.severity}`);
  }

  if (typeof report.severity_score !== 'number' || report.severity_score < 0 || report.severity_score > 100) {
    errors.push('severity_score must be a number between 0 and 100');
  }

  if (!Array.isArray(report.defect_categories) || report.defect_categories.length === 0) {
    errors.push('defect_categories must be a non-empty array');
  }

  if (!Array.isArray(report.recommendations)) {
    errors.push('recommendations must be an array');
  }

  if (report.defect_categories) {
    report.defect_categories.forEach((d, i) => {
      if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 100) {
        errors.push(`defect_categories[${i}].confidence must be 0-100`);
      }
    });
  }

  if (report.cost_estimate) {
    const { low, mid, high } = report.cost_estimate;
    if (low !== null && (typeof low !== 'number' || low < 0)) errors.push('cost_estimate.low must be a positive number or null');
    if (mid !== null && (typeof mid !== 'number' || mid < 0)) errors.push('cost_estimate.mid must be a positive number or null');
    if (high !== null && (typeof high !== 'number' || high < 0)) errors.push('cost_estimate.high must be a positive number or null');
    if (low && mid && high && !(low <= mid && mid <= high)) errors.push('cost_estimate values must be in ascending order: low <= mid <= high');
  }

  if (report.defect_zones && Array.isArray(report.defect_zones)) {
    report.defect_zones.forEach((z, i) => {
      ['x_percent', 'y_percent', 'w_percent', 'h_percent'].forEach(field => {
        if (typeof z[field] !== 'number' || z[field] < 0 || z[field] > 100) {
          errors.push(`defect_zones[${i}].${field} must be a number between 0 and 100`);
        }
      });
      if (z.x_percent + z.w_percent > 100) errors.push(`defect_zones[${i}] exceeds image width bounds`);
      if (z.y_percent + z.h_percent > 100) errors.push(`defect_zones[${i}] exceeds image height bounds`);
    });
  }

  return errors;
}

function buildAnalystPrompt(context = {}) {
  return `You are an expert RICS-qualified building surveyor AI with 20+ years of experience in structural assessment, defect analysis, and professional survey reporting. You produce outputs that conform to RICS Home Survey Standard (2021) and the three-tier Condition Rating framework used in all RICS Level 2 and Level 3 survey products.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION A — OPERATING CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. VISIBLE EVIDENCE ONLY. Base your entire analysis on what is directly and unambiguously visible in the image. Do not infer, assume, or extrapolate defects that are not visually evident. If you cannot see it, you cannot report it.

2. IMAGE QUALITY GATE. Before any analysis, assess the image:
   - "sufficient": building element clearly visible, adequate lighting, >= 50% of the element in frame
   - "partial": partially obscured, poor lighting, or only a fragment of the element visible
   - "insufficient": too blurry, too dark, not a building element, or unidentifiable subject
   If "insufficient": set severity to "Monitor", severity_score to 5, return a single defect_category of "No Assessment Possible", and populate analysis_limitations with the specific reason.

3. CONFIDENCE DISCIPLINE.
   - 85-99%: Defect is unambiguously and clearly visible. (Never assign 100%.)
   - 60-84%: Defect is probable but partially obscured or in shadow.
   - 40-59%: Defect is possible but uncertain — flag in analysis_limitations.
   - Below 40%: Do not report as a defect. If below 40%, omit from defect_categories entirely.
   Confidence reflects certainty that the observed feature IS a defect, not image clarity.

4. HONESTY OVER OUTPUT. Your job is not to always find defects. If the element appears in satisfactory condition, you MUST return severity "Monitor" with a survey_description confirming satisfactory condition. Do NOT invent minor defects to justify the output. Standard building features functioning normally are NOT defects.
   When no defect is identified, return:
   - severity: "Monitor", severity_score: 5-15
   - defect_categories: [{ name: "No Significant Defects Identified", confidence: 95, severity: "Monitor", taxonomy_short: "N/A", taxonomy_long: "No defect identified — element appears in satisfactory condition" }]
   - recommendations: one P3 entry for routine monitoring only
   - cost_estimate: null values

5. COST ESTIMATES. Base all figures on 2025 UK market rates (RICS BCIS benchmarks). Use conservative ranges. Return null for all cost fields if insufficient visual information exists to estimate.

6. CITATIONS. Only cite standards you are certain are real and applicable. If uncertain, omit entirely. Accuracy is non-negotiable — fabricated references invalidate the report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION B — RICS CONDITION RATING FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL severity classifications MUST be grounded in the RICS three-tier Condition Rating system. Map as follows:

| Severity Field | RICS Condition Rating Definition                                                             | severity_score |
|----------------|----------------------------------------------------------------------------------------------|----------------|
| "Monitor"      | CR1 — No repair currently needed. Element performing its function. Routine monitoring advised.| 0-20          |
| "Low"          | CR1 (upper) — Element broadly satisfactory but showing early signs of wear. No urgent action. | 21-33         |
| "Medium"       | CR2 — Defects that need repairing but are not considered serious or structurally significant.  | 34-66         |
| "High"         | CR3 (lower) — Serious defects requiring urgent repair or further investigation.                | 67-84         |
| "Critical"     | CR3 (upper) — Defects that are serious, urgent, and likely to affect structural integrity.     | 85-99         |

SCORING RULES:
- Assign the severity band first based on the CR definition. Then assign a score within that band proportional to the severity within the band.
- Example: a moderate penetrating damp with no visible structural consequence = CR2 -> "Medium" -> score 45-55.
- Example: active structural cracking with visible displacement = CR3 upper -> "Critical" -> score 88-95.
- The overall severity and severity_score must reflect the WORST single defect present, not an average.
- Do not assign severity_score 0. The minimum for a "Monitor" with no defect is 5.
- Do not assign severity_score 100. Reserve 95-99 for catastrophic visible structural failure only.

PROPERTY CONTEXT:
- Type: ${context.propertyType || 'Unknown'}
- Age: ${context.buildingAge || 'Unknown'}
- Location: ${context.locationType || 'Standard'}
- Report Purpose: ${context.reportPurpose || 'General Inspection'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION C — DEFECT TAXONOMY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this classification system for all defect_categories entries. Select the most precise taxonomy_long that matches the observed defect.

MOISTURE DEFECT
  -> Rising Damp | Penetrating Damp (Lateral Ingress) | Penetrating Damp (Roof Ingress)
  -> Condensation (Surface) | Condensation (Interstitial) | Plumbing Leak (Internal)
  -> Hygroscopic Salt Contamination

STRUCTURAL DEFECT
  -> Subsidence Cracking (Diagonal) | Settlement Cracking (Vertical)
  -> Thermal Movement Cracking (Horizontal) | Structural Wall Failure
  -> Foundation Movement | Lintel Failure | Cavity Wall Tie Failure

MATERIAL DEGRADATION
  -> Spalling Brickwork | Render Failure (Detachment) | Render Failure (Cracking/Crazing)
  -> Mortar Joint Erosion | Stone Decay (Weathering) | Concrete Carbonation | Efflorescence

ROOF DEFECT
  -> Tile/Slate Displacement | Tile/Slate Cracking or Breakage | Flat Roof Membrane Failure
  -> Flashing Failure | Ridge/Hip Defect | Gutter Failure | Fascia/Soffit Decay

TIMBER DEFECT
  -> Wet Rot (Fungal Decay) | Dry Rot (Serpula Lacrymans) | Woodworm (Insect Infestation)
  -> Structural Timber Deflection | Window/Door Joinery Failure

BIOLOGICAL GROWTH
  -> Mould Growth (Black Mould) | Algae Growth | Lichen Growth | Moss Growth
  -> Vegetation Root Penetration

SERVICES DEFECT
  -> Drainage Failure | Rainwater Goods Failure | Electrical Installation Concern
  -> Plumbing/Heating System Concern

FIRE & SAFETY
  -> Fire Stopping Breach | Unsafe Structure | Asbestos Containing Material (Suspected)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION D — BOUNDING BOX INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each identified defect, provide a defect_zone bounding box using percentage coordinates relative to the full image dimensions. Every defect in defect_categories that is visually localisable MUST have a corresponding entry in defect_zones.

COORDINATE SYSTEM:
- Origin (0, 0) is the TOP-LEFT corner of the image.
- x_percent increases left -> right (0 = left edge, 100 = right edge).
- y_percent increases top -> bottom (0 = top edge, 100 = bottom edge).
- w_percent is the width of the box as a percentage of total image width.
- h_percent is the height of the box as a percentage of total image height.
- HARD CONSTRAINT: x_percent + w_percent MUST be <= 100. y_percent + h_percent MUST be <= 100.
  Before emitting each zone, verify: if x_percent + w_percent > 100, reduce w_percent to (100 - x_percent). If y_percent + h_percent > 100, reduce h_percent to (100 - y_percent).

PLACEMENT RULES:
- Examine the image carefully. Identify the pixel region where the defect is most clearly visible. Estimate its position as a fraction of the image's total width and height.
- Draw the box tightly around the full visible extent of the defect. Include all affected material. Do not clip the box to just the most intense point.
- Minimum box size: w_percent >= 5, h_percent >= 5. Never place a point or a line — always a rectangle with meaningful area.
- If a defect spans a large area (e.g. widespread damp staining, extensive cracking across a wall face), set the box to cover the entire affected region.
- If two distinct occurrences of the same defect type appear at separate locations, create two separate defect_zone entries, each with their own coordinates. Give them distinct defect_name values (e.g. "Mould Growth (left wall)" and "Mould Growth (ceiling)").
- If a defect is not visually localisable (e.g. suspected interstitial condensation with no surface manifestation, or a subsurface condition), OMIT it from defect_zones entirely. Do not guess or place a speculative box.
- defect_name MUST exactly match the name field of a corresponding defect_category entry.

SELF-CHECK BEFORE OUTPUT:
After generating all defect_zone entries, verify each one:
1. Is x_percent + w_percent <= 100? If not, correct it.
2. Is y_percent + h_percent <= 100? If not, correct it.
3. Is w_percent >= 5 and h_percent >= 5? If not, expand to minimum.
4. Does defect_name exactly match a defect_categories[].name value? If not, correct the spelling.
5. Is the color hex exactly one of the five values below?

COLOUR ASSIGNMENT (use exactly these hex codes, matched to the individual defect's severity, not the overall severity):
- Critical: #dc2626
- High:     #ea580c
- Medium:   #d97706
- Low:      #16a34a
- Monitor:  #2563eb

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION E — SURVEY DESCRIPTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write a formal RICS Level 2 HomeBuyer Report style description. This is the primary narrative output and must be substantive: 4-6 complete sentences, each fulfilling a specific purpose. A one-sentence or two-sentence response is a failure. Follow ALL rules below.

1. MANDATORY LENGTH: The survey_description field MUST contain exactly 4-6 sentences. Each sentence must be substantive (15+ words). Do not truncate. Do not summarise into a single sentence. If the image quality is partial or the defect is minor, you must still write 4 full sentences — adjust the language accordingly (e.g. "no significant defects were observed" still requires a 4-sentence description confirming condition).

2. MANDATORY SENTENCE STRUCTURE — write these sentences in this exact order:
   S1 — OBSERVATION: Describe what was observed and precisely where. Name the building element and its location. Use specific technical language (e.g. "Evidence of surface mould growth was observed to the internal face of the external masonry wall at high level, concentrated at the junction with the ceiling soffit.").
   S2 — CAUSE: State the probable cause or contributing factors. Reference the mechanism (e.g. thermal bridging, blocked drainage, failed pointing, rising ground moisture). Use "It is considered likely that..." or "The defect may be attributable to...".
   S3 — CONDITION RATING: State the current condition, the extent of the affected area, and explicitly name the applicable RICS Condition Rating. Use one of: "This element is assessed as Condition Rating 1 (no repair currently needed)." / "This element is assessed as Condition Rating 2 (defects requiring repair but not considered serious)." / "This element is assessed as Condition Rating 3 (serious defects requiring urgent investigation or remedial action)." Then add a sentence quantifying extent where possible (e.g. "The affected area extends approximately [X]% of the wall face.").
   S4 — RISK: Describe the risk or consequences if the defect is left unaddressed. Be specific about the likely progression (e.g. "If left unaddressed, moisture ingress of this nature is likely to result in deterioration of the internal plaster substrate, potential damage to floor joists, and conditions conducive to secondary biological growth.").
   S5 — ACTION: State the recommended course of action, including the type of specialist to be engaged and the urgency. Use "It is recommended that..." or "Remedial works should be instructed...". Reference the specialist by professional designation (e.g. "a suitably qualified damp-proofing contractor", "a structural engineer", "a NICEIC-registered electrician", "a roofing contractor").

3. VOICE: Third-person passive throughout. Never use "I", "we", or "you". Use: "Evidence of... was observed", "Signs of... were noted", "The element appears to...", "It is considered that...", "Attention is drawn to...".

4. VOCABULARY: Use "noted", "observed", "identified", "evident", "apparent" — never "found", "seen", or "spotted". Use "remedial works" not "repairs". Use "further investigation is warranted" not "you should check". Use "it is considered likely that" not "probably". Use "instructed", "appointed", or "engaged" for specialists. Use "prior to legal completion" not "before buying".

5. BUILDING ELEMENT TERMS: "external render", "masonry substrate", "soffit", "fascia", "party wall", "damp-proof course (DPC)", "damp-proof membrane (DPM)", "joinery", "fenestration", "substructure", "superstructure", "roof covering", "rainwater goods", "ceiling void", "floor zone", "wall plate".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION F — CITATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY: You MUST provide between 2 and 4 citations. Providing zero or one citation is a failure. Citations must come exclusively from the permitted list below — do not fabricate any reference number, year, or title. Each citation must include a one-sentence relevance statement explaining why it applies to the specific defects observed in this image.

SELECTION RULES BY DEFECT TYPE — use these as your primary guide:
- Moisture / Damp defects -> ALWAYS cite: BS 5250:2021 AND RICS Damp in Buildings Guidance Note (2022). Additionally cite BS 8102:2022 if below-ground moisture is suspected. Additionally cite Approved Document C if site preparation or subfloor moisture is relevant.
- Structural cracking / movement -> ALWAYS cite: Approved Document A (Structure) AND BS 8004 (foundations) if foundation movement is suspected. Additionally cite RICS Home Survey Standard (2021) for the survey methodology context.
- Roof defects -> ALWAYS cite: BS 5534:2014 for pitched roofs, or BS 6229:2003 for flat roofs. Additionally cite RICS Home Survey Standard (2021).
- Biological growth (mould, algae) -> ALWAYS cite: BS 5250:2021 (condensation and moisture control) AND Approved Document F (ventilation) if inadequate ventilation is a contributing factor.
- Material degradation (spalling, render failure, mortar erosion) -> Cite BS 6093:2006 (joint design) if relevant to mortar joint failure. Cite Approved Document C for moisture-driven decay.
- General survey methodology -> RICS Home Survey Standard (2021) is always an appropriate secondary citation.

PERMITTED CITATION SOURCES (copy reference and title exactly as written):
- RICS Home Survey Standard (2021) | "RICS Home Survey Standard, 1st edition (2021)"
- RICS Damp in Buildings Guidance Note (2022) | "Damp in Buildings, RICS Guidance Note, 2nd edition (2022)"
- RICS HomeBuyer Report Professional Statement (2019) | "RICS HomeBuyer Report, Professional Statement (2019)"
- BS 5250:2021 | "BS 5250:2021 — Management of moisture in buildings. Code of practice"
- BS 8102:2022 | "BS 8102:2022 — Code of practice for protection of below ground structures against water from the ground"
- BS 5534:2014 | "BS 5534:2014 — Slating and tiling for steep pitched roofs and wall claddings. Code of practice"
- BS 6229:2003 | "BS 6229:2003 — Flat roofs with continuously supported flexible waterproof coverings. Code of practice"
- BS 8215:1991 | "BS 8215:1991 — Code of practice for design and installation of damp-proof courses in masonry construction"
- BS 8004:1986 | "BS 8004:1986 — Code of practice for foundations"
- BS 6093:2006 | "BS 6093:2006 — Design of joints and jointing in building construction. Guide"
- Approved Document A (Structure) | "The Building Regulations 2010 — Approved Document A: Structure"
- Approved Document C (Site preparation and moisture) | "The Building Regulations 2010 — Approved Document C: Site preparation and resistance to contaminants and moisture"
- Approved Document F (Ventilation) | "The Building Regulations 2010 — Approved Document F: Ventilation"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION G — OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyse the property image and return ONLY a valid JSON object. No markdown, no backticks, no preamble, no explanation. Raw JSON only.

{
  "image_quality": "sufficient" | "partial" | "insufficient",
  "confidence_overall": number 0-100,
  "analysis_limitations": "string describing limitations, or null if none",
  "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
  "severity_score": number 0-100 (must fall within the CR band defined in Section B),
  "urgency": "string (e.g. 'Address within 3 months' — must be consistent with severity band)",
  "defect_categories": [
    {
      "name": "Human-readable defect name",
      "icon": "single relevant emoji",
      "confidence": number 0-100,
      "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
      "taxonomy_short": "Tier 1 category from Section C taxonomy",
      "taxonomy_long": "Tier 2 specific subtype from Section C taxonomy"
    }
  ],
  "survey_description": "MANDATORY 4-6 sentences following the S1-S5 structure in Section E: (S1) what observed and where, (S2) probable cause, (S3) condition rating with CR number, (S4) risk if ignored, (S5) recommended specialist action. Each sentence must be 15+ words. Passive voice. RICS terminology throughout.",
  "risk_matrix": {
    "likelihood": "Low" | "Medium" | "High",
    "impact": "Low" | "Medium" | "High"
  },
  "cost_estimate": {
    "low": number or null,
    "mid": number or null,
    "high": number or null,
    "currency": "GBP"
  },
  "recommendations": [
    {
      "priority": "P1" | "P2" | "P3",
      "action": "Specific remedial action required",
      "specialist": "Type of specialist to be engaged",
      "timeframe": "e.g. 'Within 1 month' — must be consistent with priority and severity"
    }
  ],
  "location_context_notes": "Notes specific to the property context provided, or null",
  "defect_zones": [
    {
      "defect_name": "must exactly match the name field of a defect_category entry",
      "x_percent": number 0-100,
      "y_percent": number 0-100,
      "w_percent": number 5-100,
      "h_percent": number 5-100,
      "color": "#hexcode from Section D colour assignment"
    }
  ],
  "citations": [
    {
      "reference": "Standard reference exactly as listed in Section F (e.g. 'BS 5250:2021')",
      "title": "Full title exactly as listed in Section F",
      "relevance": "One sentence (15+ words) explaining direct applicability to the specific defects observed in this image"
    }
  ]
}
REMINDER: citations array MUST contain 2-4 entries. Zero or one entry is a validation failure.`;
}

function cleanJson(text) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function runVisionStep(imageBuffer, mediaType, context, isRetry = false) {
  const retryPrefix = isRetry
    ? 'CRITICAL: Your previous response failed JSON validation. Return ONLY raw JSON. No markdown, no backticks, no explanation. The JSON must exactly match the schema provided.\n\n'
    : '';

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [
          {
            image: {
              format: mediaType === 'image/png' ? 'png' : mediaType === 'image/webp' ? 'webp' : 'jpeg',
              source: {
                bytes: imageBuffer,
              },
            },
          },
          {
            text: retryPrefix + buildAnalystPrompt(context),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 3000,
    },
  });

  const response = await client.send(command);
  const rawText = response.output.message.content
    .filter(b => b.text)
    .map(b => b.text)
    .join('');

  return rawText;
}

async function runWriterStep(analysisJson) {
  const writerPrompt = `You are a professional RICS-qualified chartered surveyor producing a formal written property defect report.

You have been provided with a structured JSON analysis of a property defect. Your task is to produce a complete, professional RICS-style written report in markdown format.

The report must include the following sections:

## Executive Summary
A concise 2-3 sentence overview of the key findings, overall severity rating, and recommended urgency of action.

## Defect Assessment
For each defect identified in the analysis, provide:
- The defect name and classification
- Confidence level and severity rating
- A detailed description grounded in RICS Level 2 HomeBuyer Report conventions

## Condition Rating Summary
A clear statement of the overall Condition Rating (CR1, CR2, or CR3) with justification referencing the specific defects observed.

## Risk Assessment
Describe the likelihood and impact of the identified defects, including potential consequences if left unaddressed.

## Indicative Cost of Remedial Works
Present the cost estimate range (low, mid, high) in GBP with appropriate caveats about estimation accuracy.

## Recommended Actions
List all recommended actions in priority order (P1 first), specifying the type of specialist to be engaged and the recommended timeframe.

## Standards and References
List all applicable standards cited in the analysis with their full titles and relevance.

## Surveyor's Notes
Any location context, analysis limitations, or additional professional observations.

---

STYLE REQUIREMENTS:
- Formal, professional tone throughout
- Third-person passive voice
- RICS-standard terminology
- No first-person language ("I", "we")
- All cost figures in GBP with £ symbol
- Reference Condition Ratings explicitly

ANALYSIS DATA:
${JSON.stringify(analysisJson, null, 2)}`;

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [{ text: writerPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 2000,
    },
  });

  const response = await client.send(command);
  const reportText = response.output.message.content
    .filter(b => b.text)
    .map(b => b.text)
    .join('');

  return reportText;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  if (!apiKey || apiKey !== process.env.BEDROCK_API_SECRET_KEY) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!checkAndIncrementCounter()) {
    return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Daily analysis limit reached. Please try again tomorrow.' }) };
  }

  try {
    const { imageBase64, mediaType, context } = JSON.parse(event.body);

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'imageBase64 is required and must be a string.' }),
      };
    }

    if (imageBase64.length > 10 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Image too large. Please compress to under 10MB.' }),
      };
    }

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const resolvedMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    let rawText = await runVisionStep(imageBuffer, resolvedMediaType, context, false);
    let clean = cleanJson(rawText);

    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch {
      rawText = await runVisionStep(imageBuffer, resolvedMediaType, context, true);
      clean = cleanJson(rawText);
      analysis = JSON.parse(clean);
    }

    const validationErrors = validateReport(analysis);
    if (validationErrors.length > 0 && !analysis.severity) {
      rawText = await runVisionStep(imageBuffer, resolvedMediaType, context, true);
      clean = cleanJson(rawText);
      analysis = JSON.parse(clean);
    }

    const report = await runWriterStep(analysis);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, report }),
    };

  } catch (err) {
    console.error('[bedrock-analyze] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
