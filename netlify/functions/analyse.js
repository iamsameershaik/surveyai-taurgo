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

    const prompt = buildPrompt(context);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data)
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

Be technically precise. Use proper RICS surveying terminology. Cost estimates must reflect 2025 UK market rates.`;
}
