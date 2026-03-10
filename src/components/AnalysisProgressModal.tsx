interface ImageProgress {
  fileName: string;
  previewUrl: string;
  stage: 'queued' | 'preprocessing' | 'classifying' | 'generating' | 'scoring' | 'complete' | 'error';
  index: number;
  total: number;
}

interface Props {
  progress: ImageProgress[];
}

const STAGE_LABELS: Record<string, string> = {
  queued:        'Waiting...',
  preprocessing: 'Preprocessing image',
  classifying:   'Running defect classification',
  generating:    'Generating RICS survey language',
  scoring:       'Calculating severity scores',
  complete:      'Complete',
  error:         'Failed',
};

const STAGE_ORDER = ['queued', 'preprocessing', 'classifying', 'generating', 'scoring', 'complete'];

export function AnalysisProgressModal({ progress }: Props) {
  if (!progress || progress.length === 0) return null;

  const completed = progress.filter(p => p.stage === 'complete').length;
  const total = progress.length;
  const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        width: '480px',
        maxWidth: '90vw',
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg, #1a3a6b, #2563eb)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '22px',
          }}>
            🏠
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a2035', margin: 0 }}>
            Analysing {total} {total === 1 ? 'Image' : 'Images'}
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
            {completed} of {total} complete
          </p>
        </div>

        <div style={{
          background: '#f1f5f9', borderRadius: '99px',
          height: '6px', marginBottom: '24px', overflow: 'hidden',
        }}>
          <div style={{
            background: 'linear-gradient(90deg, #1a3a6b, #2563eb)',
            height: '100%',
            width: `${overallPct}%`,
            borderRadius: '99px',
            transition: 'width 0.4s ease',
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {progress.map((item, i) => {
            const isActive = item.stage !== 'complete' && item.stage !== 'error' && item.stage !== 'queued';
            const isDone = item.stage === 'complete';
            const isError = item.stage === 'error';
            const stageIdx = STAGE_ORDER.indexOf(item.stage);
            const stagePct = Math.round((stageIdx / (STAGE_ORDER.length - 1)) * 100);

            return (
              <div key={i} style={{
                background: isDone ? '#f0fdf4' : isActive ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${isDone ? '#bbf7d0' : isActive ? '#bfdbfe' : '#e2e8f0'}`,
                borderRadius: '12px',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    overflow: 'hidden', flexShrink: 0,
                    background: '#e2e8f0',
                  }}>
                    {item.previewUrl && (
                      <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '12px', fontWeight: '600', color: '#1a2035',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '200px',
                      }}>
                        {item.fileName}
                      </span>
                      <span style={{ fontSize: '12px', marginLeft: '8px' }}>
                        {isDone ? '✅' : isError ? '❌' : isActive ? '⏳' : '⏸'}
                      </span>
                    </div>

                    <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 5px' }}>
                      {STAGE_LABELS[item.stage]}
                    </p>

                    {!isDone && !isError && (
                      <div style={{
                        background: '#e2e8f0', borderRadius: '99px',
                        height: '3px', overflow: 'hidden',
                      }}>
                        <div style={{
                          background: '#2563eb',
                          height: '100%',
                          width: `${stagePct}%`,
                          borderRadius: '99px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{
          textAlign: 'center', fontSize: '11px', color: '#9ca3af',
          marginTop: '20px', marginBottom: 0,
        }}>
          Claude AI is examining each image against RICS defect criteria
        </p>
      </div>
    </div>
  );
}
