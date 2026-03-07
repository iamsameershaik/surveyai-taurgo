import { motion } from 'framer-motion';
import { SeverityLevel } from '../types';
import { getSeverityColor } from '../utils';

interface SeverityGaugeProps {
  severity: SeverityLevel;
  score: number;
  urgency: string;
}

export function SeverityGauge({ severity, score, urgency }: SeverityGaugeProps) {
  const radius = 120;
  const strokeWidth = 20;
  const centerX = 150;
  const centerY = 150;

  const getSeverityAngle = (score: number) => {
    return -90 + (score / 100) * 180;
  };

  const angle = getSeverityAngle(score);

  const needleLength = radius - strokeWidth / 2 - 10;
  const needleX = centerX + needleLength * Math.cos((angle * Math.PI) / 180);
  const needleY = centerY + needleLength * Math.sin((angle * Math.PI) / 180);

  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }

  const zones = [
    { start: -90, end: -54, color: 'var(--severity-monitor)', label: 'Monitor' },
    { start: -54, end: -18, color: 'var(--severity-low)', label: 'Low' },
    { start: -18, end: 18, color: 'var(--severity-medium)', label: 'Medium' },
    { start: 18, end: 54, color: 'var(--severity-high)', label: 'High' },
    { start: 54, end: 90, color: 'var(--severity-critical)', label: 'Critical' },
  ];

  return (
    <div className="flex flex-col items-center py-8">
      <svg
        width="300"
        height="200"
        viewBox="0 0 300 200"
        className="mb-4"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {zones.map((zone, index) => (
          <path
            key={index}
            d={createArc(zone.start, zone.end)}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.3}
          />
        ))}

        {zones.map((zone, index) => (
          <motion.path
            key={`active-${index}`}
            d={createArc(zone.start, zone.end)}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{
              pathLength:
                angle >= zone.start && angle <= zone.end
                  ? (angle - zone.start) / (zone.end - zone.start)
                  : angle > zone.end
                  ? 1
                  : 0,
            }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
          />
        ))}

        <motion.line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={getSeverityColor(severity)}
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ x2: centerX, y2: centerY - needleLength }}
          animate={{ x2: needleX, y2: needleY }}
          transition={{
            type: 'spring',
            stiffness: 50,
            damping: 10,
            delay: 0.5,
          }}
          filter="url(#glow)"
        />

        <circle cx={centerX} cy={centerY} r={8} fill={getSeverityColor(severity)} />

        {zones.map((zone, index) => {
          const labelAngle = (zone.start + zone.end) / 2;
          const labelRadius = radius + 30;
          const labelPos = polarToCartesian(centerX, centerY, labelRadius, labelAngle);
          return (
            <text
              key={`label-${index}`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={zone.color}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {zone.label.toUpperCase()}
            </text>
          );
        })}
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="text-center"
      >
        <div
          className="text-4xl font-bold mb-2"
          style={{ color: getSeverityColor(severity) }}
        >
          {severity.toUpperCase()} RISK
        </div>
        <div className="glass-panel-sm inline-block px-6 py-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {urgency}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
