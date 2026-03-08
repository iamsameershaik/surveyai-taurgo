import { useState } from 'react';

interface ReportQAProps {
  report: any;
}

interface QAEntry {
  question: string;
  answer: string;
  timestamp: string;
}

export function ReportQA({ report }: ReportQAProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<QAEntry[]>([]);

  const SUGGESTED_QUESTIONS = [
    'Is this structurally dangerous?',
    'Should I pull out of the purchase?',
    'What specialist do I need first?',
    'Is this covered by home insurance?',
  ];

  async function askQuestion(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          reportContext: {
            ref: report.ref,
            severity: report.severity,
            severityScore: report.severityScore,
            urgency: report.urgency,
            defectCategories: report.defectCategories,
            surveyDescription: report.surveyDescription,
            riskMatrix: report.riskMatrix,
            costEstimate: report.costEstimate,
            recommendations: report.recommendations,
            locationContextNotes: report.locationContextNotes,
            citations: report.citations,
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setHistory(prev => [{
          question: trimmed,
          answer: data.answer,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        }, ...prev]);
        setQuestion('');
      }
    } catch (err) {
      setError('Failed to get answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      marginTop: '16px',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: '12px',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.3)',
      padding: '18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '18px' }}>💬</span>
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: '#1a3a6b',
        }}>
          Ask About This Report
        </span>
      </div>

      {history.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => askQuestion(q)}
              disabled={loading}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: '#1a3a6b',
                background: 'rgba(26,58,107,0.07)',
                border: '1px solid rgba(26,58,107,0.2)',
                borderRadius: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px', maxHeight: '300px', overflowY: 'auto' }}>
          {history.map((entry, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  background: '#1a3a6b',
                  color: 'white',
                  padding: '10px 14px',
                  borderRadius: '12px 12px 4px 12px',
                  fontSize: '13px',
                  maxWidth: '80%',
                  lineHeight: '1.5',
                }}>
                  {entry.question}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(26,58,107,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  🏠
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(26,58,107,0.12)',
                  color: '#1a2035',
                  padding: '10px 14px',
                  borderRadius: '4px 12px 12px 12px',
                  fontSize: '13px',
                  maxWidth: '85%',
                  lineHeight: '1.6',
                }}>
                  {entry.answer}
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px' }}>{entry.timestamp}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '12px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion(question)}
          placeholder="Ask a question about this report..."
          maxLength={500}
          disabled={loading}
          style={{
            flex: 1,
            padding: '11px 14px',
            fontSize: '13px',
            fontFamily: 'inherit',
            border: '1px solid rgba(26,58,107,0.2)',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.6)',
            color: '#1a2035',
            outline: 'none',
          }}
        />
        <button
          onClick={() => askQuestion(question)}
          disabled={loading || !question.trim()}
          style={{
            padding: '11px 18px',
            background: loading ? '#9ca3af' : '#1a3a6b',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '...' : 'Ask →'}
        </button>
      </div>

      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', fontStyle: 'italic' }}>
        Answers are scoped to this report only. Always consult a qualified RICS Chartered Surveyor before making legal or financial decisions.
      </div>
    </div>
  );
}
