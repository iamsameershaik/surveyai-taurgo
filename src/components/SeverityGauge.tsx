import { useEffect, useRef } from 'react';

interface SeverityGaugeProps {
  severity: 'Monitor' | 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
  urgency: string;
}

const SEVERITY_CONFIG = {
  Monitor:  { angle: -90, color: '#2563eb', label: 'MONITOR RISK' },
  Low:      { angle: -45, color: '#16a34a', label: 'LOW RISK' },
  Medium:   { angle: 0,   color: '#d97706', label: 'MEDIUM RISK' },
  High:     { angle: 45,  color: '#ea580c', label: 'HIGH RISK' },
  Critical: { angle: 90,  color: '#dc2626', label: 'CRITICAL RISK' },
};

export function SeverityGauge({ severity, urgency }: SeverityGaugeProps) {
  const needleRef = useRef<SVGLineElement>(null);
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Monitor;

  const cx = 150;
  const cy = 150;
  const r = 100;

  const targetSVGAngle = 90 - config.angle;

  const segments = [
    { color: '#2563eb', startDeg: 180, endDeg: 144, label: 'MONITOR' },
    { color: '#16a34a', startDeg: 144, endDeg: 108, label: 'LOW'     },
    { color: '#d97706', startDeg: 108, endDeg: 72,  label: 'MEDIUM'  },
    { color: '#ea580c', startDeg: 72,  endDeg: 36,  label: 'HIGH'    },
    { color: '#dc2626', startDeg: 36,  endDeg: 0,   label: 'CRITICAL'},
  ];

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy - radius * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const start = polarToXY(startDeg, radius);
    const end = polarToXY(endDeg, radius);
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  }

  const needleLength = 80;
  const needleRad = (targetSVGAngle * Math.PI) / 180;
  const needleX = cx + needleLength * Math.cos(needleRad);
  const needleY = cy - needleLength * Math.sin(needleRad);

  useEffect(() => {
    if (!needleRef.current) return;
    needleRef.current.style.transformOrigin = `${cx}px ${cy}px`;
    needleRef.current.style.transform = `rotate(${270 - targetSVGAngle}deg)`;
    needleRef.current.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!needleRef.current) return;
        needleRef.current.style.transition = 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        needleRef.current.style.transform = 'rotate(0deg)';
      });
    });
  }, [severity, targetSVGAngle]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <svg
        viewBox="0 0 300 170"
        style={{ width: '100%', maxWidth: '360px', overflow: 'visible' }}
      >
        <path
          d={describeArc(180, 0, r)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {segments.map((seg, i) => (
          <path
            key={i}
            d={describeArc(seg.startDeg, seg.endDeg, r)}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.9"
          />
        ))}

        <line
          ref={needleRef}
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={config.color}
          strokeWidth="3"
          strokeLinecap="round"
        />

        <circle cx={cx} cy={cy} r="7" fill={config.color} />
        <circle cx={cx} cy={cy} r="3.5" fill="white" />

        {[162, 126, 90, 54, 18].map((deg, i) => {
          const pos = polarToXY(deg, r);
          return <circle key={i} cx={pos.x} cy={pos.y} r="4" fill={segments[i].color} />;
        })}

        {segments.map((seg, i) => {
          const midDeg = (seg.startDeg + seg.endDeg) / 2;
          const pos = polarToXY(midDeg, r + 26);
          return (
            <text
              key={i}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8.5"
              fontWeight="700"
              letterSpacing="0.3"
              fill={seg.color}
            >
              {seg.label}
            </text>
          );
        })}
      </svg>

      <div style={{
        fontSize: '26px',
        fontWeight: '800',
        color: config.color,
        letterSpacing: '-0.5px',
      }}>
        {config.label}
      </div>

      <div className="glass-panel-sm inline-block px-6 py-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {urgency}
        </span>
      </div>
    </div>
  );
}
