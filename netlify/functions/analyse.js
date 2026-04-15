async function fetchWithTimeout(url, options, timeoutMs = 20000) {
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
        errors.push(`defect_categories[${i}].confidence must be 0–100`);
      }
    });
  }

  if (report.cost_estimate) {
    const { low, mid, high } = report.cost_estimate;
    if (low !== null && (typeof low !== 'number' || low < 0)) errors.push('cost_estimate.low must be a positive number or null');
    if (mid !== null && (typeof mid !== 'number' || mid < 0)) errors.push('cost_estimate.mid must be a positive number or null');
    if (high !== null && (typeof high !== 'number' || high < 0)) errors.push('cost_estimate.high must be a positive number or null');
    if (low && mid && high && !(low <= mid && mid <= high)) errors.push('cost_estimate values must be in ascending order: low ≤ mid ≤ high');
  }

  // Validate defect_zones if present
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

async function analyseWithRetry(imageBase64, mediaType, context, apiKey) {
  const makeRequest = async (isRetry = false, timeoutMs = 20000) => {
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
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: retryPrefix + buildPrompt(context) },
          ],
        }],
      }),
    }, timeoutMs);

    return response.json();
  };

  // First attempt — 20s budget
  let data = await makeRequest(false, 20000);
  if (data.error) throw new Error(data.error.message);

  let rawText = data.content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('');
  let clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  let report;
  try {
    report = JSON.parse(clean);
  } catch {
    // JSON parse failed — retry with 18s budget
    data = await makeRequest(true, 18000);
    rawText = data.content.map(b => b.type === 'text' ? b.text : '').filter(Boolean).join('');
    clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    report = JSON.parse(clean);
  }

  const validationErrors = validateReport(report);
  if (validationErrors.length > 0 && !report.severity) {
    // Only fail hard if critical fields are missing — retry with 18s budget
    data = await makeRequest(true, 18000);
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

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'imageBase64 is required and must be a string.' }) };
    }

    if (imageBase64.length > 10 * 1024 * 1024) {
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
  return `You are an expert RICS building surveyor. Analyse the property image and return ONLY valid JSON (no markdown, no extra text).

PROPERTY: ${context.propertyType || 'Unknown'} | ${context.buildingAge || 'Unknown'} | ${context.locationType || 'Standard'} | ${context.reportPurpose || 'General Inspection'}

RICS CONDITION RATING (use exactly these):
- Monitor (CR1): No repair needed, routine monitoring.
- Low (CR1 upper): Early wear, monitor, address within planned maintenance.
- Medium (CR2): Defects needing repair but not serious. Address within 6 months.
- High (CR3 lower): Serious defects requiring urgent investigation. Address within 1-3 months.
- Critical (CR3 upper): Immediate risk to structure or safety. Address within 2-4 weeks.

DEFECT TAXONOMY (short list):
Moisture: Rising Damp, Penetrating Damp (Lateral/Roof), Condensation, Plumbing Leak
Structural: Subsidence Cracking, Settlement Cracking, Thermal Movement, Wall Failure
Material: Spalling Brickwork, Render Failure, Mortar Erosion
Roof: Tile/Slate Displacement, Membrane Failure, Flashing Failure
Timber: Wet Rot, Dry Rot, Woodworm
Biological: Mould Growth (Black Mould), Algae, Moss
Services: Drainage Failure, Electrical Concern

BOUNDING BOX (defect_zones):
- x_percent, y_percent = top-left corner (0-100, 0=top-left)
- w_percent, h_percent = width/height percentage (minimum 3 each)
- Color hex: Critical #dc2626, High #ea580c, Medium #d97706, Low #16a34a, Monitor #2563eb

OUTPUT SCHEMA (return this exact structure):
{
  "image_quality": "sufficient/partial/insufficient",
  "confidence_overall": 0-100,
  "analysis_limitations": "string or null",
  "severity": "Monitor/Low/Medium/High/Critical",
  "severity_score": 0-100,
  "urgency": "string (e.g. 'Address within 3 months')",
  "defect_categories": [{"name": "string", "icon": "emoji", "confidence": 0-100, "severity": "string", "taxonomy_short": "string", "taxonomy_long": "string"}],
  "survey_description": "4-5 sentence formal RICS description. Include Condition Rating (e.g., 'This element is assessed as Condition Rating 2...'). Use third-person passive.",
  "risk_matrix": {"likelihood": "Low/Medium/High", "impact": "Low/Medium/High"},
  "cost_estimate": {"low": number or null, "mid": number or null, "high": number or null, "currency": "GBP"},
  "recommendations": [{"priority": "P1/P2/P3", "action": "string", "specialist": "string", "timeframe": "string"}],
  "location_context_notes": "string or null",
  "defect_zones": [{"defect_name": "string", "x_percent": number, "y_percent": number, "w_percent": number, "h_percent": number, "color": "#hex"}],
  "citations": [{"reference": "string", "title": "string", "relevance": "string"}]
}

IMPORTANT: If image quality is insufficient, return image_quality="insufficient", severity="Monitor", severity_score=5, defect_categories with name="No Assessment Possible", and populate analysis_limitations. If no defect found, return severity="Monitor", severity_score=5-15, defect_categories name="No Significant Defects Identified". Cost estimates based on 2025 UK market rates. Do not fabricate citations – only use real RICS/BS standards.`;
}