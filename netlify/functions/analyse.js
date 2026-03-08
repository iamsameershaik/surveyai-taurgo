async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Analysis timed out. Please try again with a smaller or clearer image.');
    }
    throw err;
  }
}

function validateReport(report) {
  const errors = [];

  // Required fields
  const required = ['severity', 'severity_score', 'urgency', 'defect_categories', 'survey_description', 'recommendations'];
  required.forEach(field => {
    if (!report[field]) errors.push(`Missing required field: ${field}`);
  });

  // Severity must be one of the allowed values
  const validSeverities = ['Monitor', 'Low', 'Medium', 'High', 'Critical'];
  if (!validSeverities.includes(report.severity)) {
    errors.push(`Invalid severity value: ${report.severity}`);
  }

  // Severity score must be 0–100
  if (typeof report.severity_score !== 'number' || report.severity_score < 0 || report.severity_score > 100) {
    errors.push('severity_score must be a number between 0 and 100');
  }

  // defect_categories must be an array with at least 1 item
  if (!Array.isArray(report.defect_categories) || report.defect_categories.length === 0) {
    errors.push('defect_categories must be a non-empty array');
  }

  // recommendations must be array
  if (!Array.isArray(report.recommendations)) {
    errors.push('recommendations must be an array');
  }

  // confidence values must be 0–100
  if (report.defect_categories) {
    report.defect_categories.forEach((d, i) => {
      if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 100) {
        errors.push(`defect_categories[${i}].confidence must be 0–100`);
      }
    });
  }

  // Cost estimates must be positive numbers if present
  if (report.cost_estimate) {
    const { low, mid, high } = report.cost_estimate;
    if (low !== null && (typeof low !== 'number' || low < 0)) errors.push('cost_estimate.low must be a positive number or null');
    if (mid !== null && (typeof mid !== 'number' || mid < 0)) errors.push('cost_estimate.mid must be a positive number or null');
    if (high !== null && (typeof high !== 'number' || high < 0)) errors.push('cost_estimate.high must be a positive number or null');
    if (low && mid && high && !(low <= mid && mid <= high)) errors.push('cost_estimate values must be in ascending order: low ≤ mid ≤ high');
  }

  return errors;
}

async function analyseWithRetry(imageBase64, mediaType, context, apiKey) {
  const makeRequest = async (isRetry = false) => {
    const retryPrefix = isRetry
      ? 'CRITICAL: Your previous response failed JSON validation. Return ONLY raw JSON. No markdown, no backticks, no explanation. The JSON must exactly match the schema provided.\n\n'
      : '';

    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: retryPrefix + buildPrompt(context) },
          ],
        }],
      }),
    }, 25000);

    return response.json();
  };

  // First attempt
  let data = await makeRequest(false);
  if (data.error) throw new Error(data.error.message);

  let rawText = data.content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('');
  let clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  let report;
  try {
    report = JSON.parse(clean);
  } catch {
    // JSON parse failed — retry
    data = await makeRequest(true);
    rawText = data.content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('');
    clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    report = JSON.parse(clean);
  }

  const validationErrors = validateReport(report);
  if (validationErrors.length > 0 && !report.severity) {
    // Only fail hard if critical fields are missing
    data = await makeRequest(true);
    rawText = data.content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('');
    clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    report = JSON.parse(clean);
  }

  return report;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType, context } = JSON.parse(event.body);

    // Input validation
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'imageBase64 is required and must be a string.' }) };
    }

    if (imageBase64.length > 10 * 1024 * 1024) { // ~7.5MB base64 ≈ ~10MB image
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Image too large. Please compress to under 10MB.' }) };
    }

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const resolvedMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const report = await analyseWithRetry(imageBase64, resolvedMediaType, context, process.env.ANTHROPIC_API_KEY);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(report) }] })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};

function buildPrompt(context = {}) {
  // SCHEMA VERSION: 2.1 — Updated for RICS citation support, defect zones, and hallucination constraints
  // Last updated: March 2026

  return `You are an expert RICS-qualified building surveyor AI with 20+ years of experience in structural assessment, defect analysis, and professional survey reporting.

IMPORTANT CONSTRAINTS — READ BEFORE RESPONDING:

1. BASE YOUR ANALYSIS ONLY ON WHAT IS DIRECTLY VISIBLE IN THE IMAGE. Do not infer, assume, or extrapolate defects that are not visually evident.

2. IMAGE QUALITY CHECK: If the image is too blurry, too dark, too small, or does not clearly show a building/property element, set "image_quality" to "insufficient" and populate the report with conservative placeholder values. Do not fabricate defects from a poor image.

3. CONFIDENCE DISCIPLINE: Only assign confidence scores above 80% when the defect is unambiguously visible. Assign 60–79% for probable but partially obscured defects. Assign below 60% for possible but uncertain observations. Never assign 100% confidence.

4. COST ESTIMATES: Base all cost estimates on published 2025 UK market rates from RICS Building Cost Information Service (BCIS) benchmarks. Do not invent figures. Use conservative ranges. If insufficient visual information exists to estimate cost, return null for cost fields.

5. SEVERITY DISCIPLINE: Default to the more conservative severity rating when evidence is ambiguous. Do not upgrade severity beyond what the visible evidence supports.

6. CITATIONS: Only cite standards you are certain are real and applicable. If uncertain, omit the citation entirely rather than risk fabricating a reference number.

PROPERTY CONTEXT:
- Type: ${context.propertyType || 'Unknown'}
- Age: ${context.buildingAge || 'Unknown'}
- Location: ${context.locationType || 'Standard'}
- Report Purpose: ${context.reportPurpose || 'General Inspection'}

Analyse this property image and return ONLY a valid JSON object. No markdown, no backticks, no explanation. Raw JSON only.

Return this exact structure:
{
  "image_quality": "sufficient" | "partial" | "insufficient",
  "confidence_overall": number between 0-100,
  "analysis_limitations": "string describing any limitations in the analysis due to image quality, angle, lighting, or partial visibility — or null if no limitations",
  "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical",
  "severity_score": number between 0-100,
  "urgency": string (e.g. "Address within 3 months"),
  "defect_categories": [
    {
      "name": "Defect type",
      "icon": "single relevant emoji",
      "confidence": number 0-100,
      "severity": "Monitor" | "Low" | "Medium" | "High" | "Critical"
    }
  ],
  "survey_description": "Formal RICS HomeBuyer Report / Level 2 Survey style description conforming to UK RICS surveying standards.",
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
  "location_context_notes": "Any specific notes given the property context provided",
  "citations": [
    {
      "reference": "Standard or guidance note reference (e.g. BS 5250:2021)",
      "title": "Full title of the standard or guidance",
      "relevance": "One sentence explaining why this standard applies to the identified defect"
    }
  ],
  "defect_zones": [
    {
      "defect_name": "name matching a defect_category",
      "x_percent": number,
      "y_percent": number,
      "w_percent": number,
      "h_percent": number,
      "color": "#hexcode"
    }
  ]
}

"defect_zones": Estimate approximate bounding boxes for each visible defect area. Use percentage coordinates relative to the full image dimensions (0-100). Be as accurate as possible based on the visible damage in the image. Each zone should correspond to a named defect in defect_categories, and use the appropriate severity color for that defect (#dc2626 for Critical, #ea580c for High, #d97706 for Medium, #16a34a for Low, #2563eb for Monitor).

"survey_description": Write a formal RICS HomeBuyer Report / Level 2 Survey style description of the observed defect(s). The language must conform to UK RICS surveying standards and conventions. Follow these rules precisely:

1. Use third-person passive voice throughout. Never use "I" or "we". Use constructions such as "Evidence of...", "Signs of... were observed", "The element appears to...", "It is considered that...", "Attention is drawn to...".

2. Use RICS condition ratings where appropriate. Reference "Condition Rating 1 (no repair currently needed)", "Condition Rating 2 (defects that need repairing or replacing but are not considered serious)", or "Condition Rating 3 (defects that are serious and/or need to be repaired, replaced or investigated urgently)" as fits the severity.

3. Use standard RICS terminology and phrasing conventions:
   - "Evidence of penetrating/rising dampness was noted to..."
   - "Cracking was observed to the [element], which is considered to be [superficial/structural/movement-related]..."
   - "The [element] exhibited signs of [defect], which may be attributable to [cause]..."
   - "Further investigation by a [specialist] is recommended prior to legal completion."
   - "This matter should be referred to a [relevant specialist] for further assessment and remedial advice."
   - "The defect is considered to be [minor/moderate/significant] and [does/does not] affect the structural integrity of the building."
   - "It is recommended that the matter is investigated as a matter of [routine/urgency] by a suitably qualified contractor."

4. Structure the description in this order:
   - Sentence 1: What was observed and where (element/location)
   - Sentence 2: Probable cause or contributing factors
   - Sentence 3: Current condition and extent of the defect
   - Sentence 4: Risk or implications if left unaddressed
   - Sentence 5: Recommended course of action and specialist referral

5. Use precise building surveying vocabulary:
   - Refer to building elements correctly: "external render", "masonry substrate", "soffit", "fascia", "party wall", "damp-proof course (DPC)", "damp-proof membrane (DPM)", "joinery", "fenestration", "substructure", "superstructure", "roof covering", "rainwater goods", etc.
   - Use "noted", "observed", "identified", "evident", "apparent" — not "found", "seen", or "spotted"
   - Use "remedial works", not "repairs"
   - Use "further investigation is warranted", not "you should check"
   - Use "it is considered likely that", not "probably"
   - Use "instructed", "appointed", or "engaged" when referring to specialists

6. Do NOT use colloquial language, bullet points, first-person voice, or consumer-facing simplifications. The output must read as if written by a qualified RICS Chartered Surveyor for inclusion in a formal Level 2 HomeBuyer Report.

The survey_description must be 4–5 sentences only.

"citations": Provide 2–4 relevant UK building standards, RICS guidance notes, or British Standards that apply to the defects identified in this image. Use only real, verifiable references. Format each citation precisely as a qualified RICS surveyor would in a formal report. Acceptable reference sources include:

RICS Guidance Notes and Practice Statements:
- RICS Guidance Note: Damp in Buildings (2022)
- RICS HomeBuyer Report (Survey) — Professional Statement (2019)
- RICS Condition Report — Professional Statement
- RICS Surveying Safely (2nd edition)
- RICS Valuation — Global Standards (Red Book)

British Standards (BS) and ISO Standards:
- BS 5250:2021 — Management of moisture in buildings
- BS 8102:2022 — Protection of below-ground structures against water ingress
- BS 6399 — Loading for buildings
- BS 8004 — Code of practice for foundations
- BS 5534:2014 — Code of practice for slating and tiling
- BS 6229:2003 — Flat roofs with continuously supported flexible waterproof coverings
- BS 8215:1991 — Design and installation of damp-proof courses in masonry construction
- BS 6093:2006 — Design of joints and jointing in building construction

Building Regulations (England):
- Approved Document C — Site preparation and resistance to contaminants and moisture
- Approved Document A — Structure
- Approved Document F — Ventilation
- Approved Document L — Conservation of fuel and power

ONLY cite standards that are directly relevant to the defects observed. Do NOT fabricate reference numbers or titles. If fewer than 2 directly relevant standards exist, cite only those that genuinely apply. Accuracy is essential.

Be technically precise. Use proper RICS surveying terminology. Cost estimates must reflect 2025 UK market rates.`;
}
