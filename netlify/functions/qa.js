const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: 'eu-west-2',
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
  },
});

const MODEL_ID = 'amazon.nova-pro-v1:0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { question, reportContext } = JSON.parse(event.body);

    if (!question || question.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Question is required.' }),
      };
    }

    if (question.trim().length > 500) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Question too long. Please keep it under 500 characters.' }),
      };
    }

    const systemPrompt = `You are SurveyAI, an expert RICS-qualified building surveyor assistant.
You are answering a question about a specific property defect report.
Your answers must be:
- Grounded ONLY in the report data provided. Do not introduce defects, costs, or risks not present in the report.
- Written in plain, accessible English (not technical surveying jargon unless asked).
- Honest about uncertainty — if the report does not contain enough information to answer confidently, say so clearly.
- Concise: 3–6 sentences maximum unless a longer answer is clearly warranted.
- Professionally cautious: always recommend consulting a qualified Chartered Surveyor for decisions involving legal completion or significant expenditure.

If the question is entirely unrelated to the property report (e.g. general knowledge, personal advice unrelated to property), respond:
"I can only answer questions related to this specific property report. Please ask me about the defects, risks, costs, or recommended actions identified in this survey."`;

    const userMessage = `PROPERTY REPORT CONTEXT:
Reference: ${reportContext.ref}
Severity: ${reportContext.severity} (Score: ${reportContext.severityScore}/100)
Urgency: ${reportContext.urgency}
Defects identified: ${reportContext.defectCategories.map(d => `${d.name} (${d.confidence}% confidence, ${d.severity} severity)`).join(', ')}
Survey description: ${reportContext.surveyDescription}
Risk matrix — Likelihood: ${reportContext.riskMatrix?.likelihood}, Impact: ${reportContext.riskMatrix?.impact}
Indicative repair costs: £${reportContext.costEstimate?.low?.toLocaleString()} – £${reportContext.costEstimate?.high?.toLocaleString()} (GBP, 2025 UK rates)
Recommendations: ${reportContext.recommendations?.map(r => `[${r.priority}] ${r.action} (${r.timeframe})`).join('; ')}
${reportContext.locationContextNotes ? `Location context: ${reportContext.locationContextNotes}` : ''}
${reportContext.citations?.length ? `Referenced standards: ${reportContext.citations.map(c => c.reference).join(', ')}` : ''}

USER QUESTION: ${question}`;

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: 'user',
          content: [{ text: userMessage }],
        },
      ],
      inferenceConfig: {
        maxTokens: 400,
      },
    });

    const response = await client.send(command);

    const answer = response.output.message.content
      .filter(b => b.text)
      .map(b => b.text)
      .join('');

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ answer }),
    };

  } catch (err) {
    console.error('[qa] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
