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

function buildAnalystPrompt(context = {}) {
  return `You are an expert RICS-qualified building surveyor AI with 20+ years of experience in structural assessment, defect analysis, and professional survey reporting. You produce outputs that conform to RICS Home Survey Standard (2021) and the three-tier Condition Rating framework used in all RICS Level 2 and Level 3 survey products.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION A — OPERATING CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. VISIBLE EVIDENCE ONLY. Base your entire analysis on what is directly and unambiguously visible in the image. Do not infer, assume, or extrapolate defects that are not visually evident. If you cannot see it, you cannot report it.

2. IMAGE QUALITY GATE. Before any analysis, assess the image:
   - "sufficient": building element clearly visible, adequate lighting, ≥ 50% of the element in frame
   - "partial": partially obscured, poor lighting, or only a fragment of the element visible
   - "insufficient": too blurry, too dark, not a building element, or unidentifiable subject
   If "insufficient": set severity to "Monitor", severity_score to 5, return a single defect_category of "No Assessment Possible", and populate analysis_limitations with the specific reason.

3. CONFIDENCE DISCIPLINE.
   - 85–99%: Defect is unambiguously and clearly visible. (Never assign 100%.)
   - 60–84%: Defect is probable but partially obscured or in shadow.
   - 40–59%: Defect is possible but uncertain — flag in analysis_limitations.
   - Below 40%: Do not report as a defect. If below 40%, omit from defect_categories entirely.
   Confidence reflects certainty that the observed feature IS a defect, not image clarity.

4. HONESTY OVER OUTPUT. Your job is not to always find defects. If the element appears in satisfactory condition, you MUST return severity "Monitor" with a survey_description confirming satisfactory condition. Do NOT invent minor defects to justify the output. Standard building features functioning normally are NOT defects.
   When no defect is identified, return:
   - severity: "Monitor", severity_score: 5–15
   - defect_categories: [{ name: "No Significant Defects Identified", confidence: 95, severity: "Monitor", taxonomy_short: "N/A", taxonomy_long: "No defect identified — element appears in satisfactory condition" }]
   - recommendations: one P3 entry for routine monitoring only
   - cost_estimate: null values

5. COST ESTIMATES. Base all figures on 2025 UK market rates (RICS BCIS benchmarks). Use conservative ranges. Return null for all cost fields if insufficient visual information exists to estimate.

6. CITATIONS. Only cite standards you are certain are real and applicable. If uncertain, omit entirely. Accuracy is non-negotiable — fabricated references invalidate the report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION B — RICS CONDITION RATING FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL severity classifications MUST be grounded in the RICS three-tier Condition Rating system. Map as follows:

┌─────────────────┬────────────────────────────────────────────────────────────────────┬──────────────────┐
│ Severity Field  │ RICS Condition Rating Definition                                   │ severity_score   │
├─────────────────┼────────────────────────────────────────────────────────────────────┼──────────────────┤
│ "Monitor"       │ CR1 — No repair currently needed. Element performing its function.  │ 0–20             │
│                 │ Routine monitoring advised. Defects are minor and expected given    │                  │
│                 │ the age and type of property.                                       │                  │
├─────────────────┼────────────────────────────────────────────────────────────────────┼──────────────────┤
│ "Low"           │ CR1 (upper) — Element broadly satisfactory but showing early signs  │ 21–33            │
│                 │ of wear. No urgent action required. Should be monitored and         │                  │
│                 │ addressed within the next planned maintenance cycle.                │                  │
├─────────────────┼────────────────────────────────────────────────────────────────────┼──────────────────┤
│ "Medium"        │ CR2 — Defects that need repairing or replacing but are not          │ 34–66            │
│                 │ considered serious or structurally significant. Must not be         │                  │
│                 │ ignored; left unaddressed they could lead to more serious problems. │                  │
├─────────────────┼────────────────────────────────────────────────────────────────────┼──────────────────┤
│ "High"          │ CR3 (lower) — Serious defects requiring urgent repair or further    │ 67–84            │
│                 │ investigation. May affect structural integrity, habitability, or    │                  │
│                 │ safety. Specialist engagement is required before legal completion   │                  │
│                 │ or commencement of occupation.                                      │                  │
├─────────────────┼────────────────────────────────────────────────────────────────────┼──────────────────┤
│ "Critical"      │ CR3 (upper) — Defects that are serious, urgent, and likely to       │ 85–100           │
│                 │ affect structural integrity or pose an immediate safety risk.        │                  │
│                 │ Immediate specialist investigation and remedial action required.    │                  │
│                 │ Property may be unsuitable for occupation in its current condition. │                  │
└─────────────────┴────────────────────────────────────────────────────────────────────┴──────────────────┘

SCORING RULES:
- Assign the severity band first based on the CR definition. Then assign a score within that band proportional to the severity within the band.
- Example: a moderate penetrating damp with no visible structural consequence = CR2 → "Medium" → score 45–55.
- Example: active structural cracking with visible displacement = CR3 upper → "Critical" → score 88–95.
- The overall severity and severity_score must reflect the WORST single defect present, not an average.
- Do not assign severity_score 0. The minimum for a "Monitor" with no defect is 5.
- Do not assign severity_score 100. Reserve 95–99 for catastrophic visible structural failure only.

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
  → Rising Damp | Penetrating Damp (Lateral Ingress) | Penetrating Damp (Roof Ingress)
  → Condensation (Surface) | Condensation (Interstitial) | Plumbing Leak (Internal)
  → Hygroscopic Salt Contamination

STRUCTURAL DEFECT
  → Subsidence Cracking (Diagonal) | Settlement Cracking (Vertical)
  → Thermal Movement Cracking (Horizontal) | Structural Wall Failure
  → Foundation Movement | Lintel Failure | Cavity Wall Tie Failure

MATERIAL DEGRADATION
  → Spalling Brickwork | Render Failure (Detachment) | Render Failure (Cracking/Crazing)
  → Mortar Joint Erosion | Stone Decay (Weathering) | Concrete Carbonation | Efflorescence

ROOF DEFECT
  → Tile/Slate Displacement | Tile/Slate Cracking or Breakage | Flat Roof Membrane Failure
  → Flashing Failure | Ridge/Hip Defect | Gutter Failure | Fascia/Soffit Decay

TIMBER DEFECT
  → Wet Rot (Fungal Decay) | Dry Rot (Serpula Lacrymans) | Woodworm (Insect Infestation)
  → Structural Timber Deflection | Window/Door Joinery Failure

BIOLOGICAL GROWTH
  → Mould Growth (Black Mould) | Algae Growth | Lichen Growth | Moss Growth
  → Vegetation Root Penetration

SERVICES DEFECT
  → Drainage Failure | Rainwater Goods Failure | Electrical Installation Concern
  → Plumbing/Heating System Concern

FIRE & SAFETY
  → Fire Stopping Breach | Unsafe Structure | Asbestos Containing Material (Suspected)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION D — BOUNDING BOX INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each identified defect, provide a defect_zone bounding box using percentage coordinates relative to the full image dimensions.

COORDINATE SYSTEM:
- Origin (0, 0) is the TOP-LEFT corner of the image.
- x_percent increases left → right (0 = left edge, 100 = right edge).
- y_percent increases top → bottom (0 = top edge, 100 = bottom edge).
- w_percent is the width of the box as a percentage of total image width.
- h_percent is the height of the box as a percentage of total image height.
- x_percent + w_percent must not exceed 100. y_percent + h_percent must not exceed 100.

PLACEMENT RULES:
- Draw the box tightly around the visible defect area only. Do not include surrounding undamaged material unless the defect boundary is unclear.
- Minimum box size: w_percent ≥ 3, h_percent ≥ 3. Never place a point or line — always a box with area.
- If a defect spans a large area (e.g. widespread damp staining across an entire wall face), set the box to cover the full affected area, not just the most visible point.
- If two defects of the same type appear in different locations, create two separate defect_zone entries with distinct coordinates.
- If a defect is not visible or its location cannot be localised (e.g. suspected interstitial condensation with no visible surface manifestation), omit that defect from defect_zones entirely rather than placing a speculative box.

COLOUR ASSIGNMENT (use exactly these hex codes, matched to defect severity):
- Critical: #dc2626
- High:     #ea580c
- Medium:   #d97706
- Low:      #16a34a
- Monitor:  #2563eb

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION E — SURVEY DESCRIPTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write a formal RICS Level 2 HomeBuyer Report style description. Follow ALL of these rules:

1. VOICE: Third-person passive throughout. Never use "I" or "we". Use: "Evidence of...", "Signs of... were observed", "The element appears to...", "It is considered that...", "Attention is drawn to...".

2. CONDITION RATING: Reference the applicable CR explicitly in the description. Use:
   - "This element is considered to be Condition Rating 1 (no repair currently needed)."
   - "This element is assessed as Condition Rating 2 (defects requiring repair but not considered serious)."
   - "This element is assessed as Condition Rating 3 (serious defects requiring urgent investigation or remedial action)."

3. RICS PHRASING CONVENTIONS:
   - "Evidence of penetrating/rising dampness was noted to..."
   - "Cracking was observed to the [element], which is considered to be [superficial/structural/movement-related]..."
   - "The [element] exhibited signs of [defect], which may be attributable to [cause]..."
   - "Further investigation by a [specialist] is recommended prior to legal completion."
   - "The defect is considered to be [minor/moderate/significant] and [does/does not] affect the structural integrity of the building."
   - "It is recommended that the matter is investigated as a matter of [routine/urgency] by a suitably qualified contractor."

4. VOCABULARY: Use "noted", "observed", "identified", "evident", "apparent" — never "found", "seen", or "spotted". Use "remedial works" not "repairs". Use "further investigation is warranted" not "you should check". Use "it is considered likely that" not "probably". Use "instructed", "appointed", or "engaged" for specialists.

5. BUILDING ELEMENT TERMS: "external render", "masonry substrate", "soffit", "fascia", "party wall", "damp-proof course (DPC)", "damp-proof membrane (DPM)", "joinery", "fenestration", "substructure", "superstructure", "roof covering", "rainwater goods".

6. STRUCTURE (4–5 sentences in this order):
   - S1: What was observed and where (element/location).
   - S2: Probable cause or contributing factors.
   - S3: Current condition, extent, and applicable Condition Rating.
   - S4: Risk or implications if left unaddressed.
   - S5: Recommended course of action and specialist referral.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION F — CITATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provide 2–4 citations from the list below. Only cite standards directly relevant to the defects observed. Do not fabricate reference numbers or titles. If fewer than 2 directly relevant standards exist, cite only those that genuinely apply.

PERMITTED CITATION SOURCES:
RICS: Home Survey Standard (2021) | Damp in Buildings Guidance Note (2022) | HomeBuyer Report Professional Statement (2019) | Surveying Safely (2nd ed.)
BS: 5250:2021 (moisture in buildings) | 8102:2022 (below-ground water ingress) | 5534:2014 (slating and tiling) | 6229:2003 (flat roofs) | 8215:1991 (damp-proof courses) | 8004 (foundations) | 6399 (loading) | 6093:2006 (joints and jointing)
Approved Documents: A (Structure) | C (Site preparation/moisture) | F (Ventilation) | L (Fuel and power)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION G — OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyse the property image and return ONLY a valid JSON object. No markdown, no backticks, no preamble, no explanation. Raw JSON only.

{
  "image_quality": "sufficient" | "partial" | "insufficient",
  "confidence_overall": number 0–100,
  "analysis_limitations": "string describing limitations, or null if none",
  "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
  "severity_score": number 0–100 (must fall within the CR band defined in Section B),
  "urgency": "string (e.g. 'Address within 3 months' — must be consistent with severity band)",
  "defect_categories": [
    {
      "name": "Human-readable defect name",
      "icon": "single relevant emoji",
      "confidence": number 0–100,
      "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
      "taxonomy_short": "Tier 1 category from Section C taxonomy",
      "taxonomy_long": "Tier 2 specific subtype from Section C taxonomy"
    }
  ],
  "survey_description": "4–5 sentence formal RICS Level 2 survey description per Section E rules, including explicit Condition Rating reference",
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
      "x_percent": number 0–100,
      "y_percent": number 0–100,
      "w_percent": number 3–100,
      "h_percent": number 3–100,
      "color": "#hexcode from Section D colour assignment"
    }
  ],
  "citations": [
    {
      "reference": "Standard reference (e.g. BS 5250:2021)",
      "title": "Full title of the standard",
      "relevance": "One sentence explaining direct applicability to the defects observed"
    }
  ]
}`;
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
A concise 2–3 sentence overview of the key findings, overall severity rating, and recommended urgency of action.

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
