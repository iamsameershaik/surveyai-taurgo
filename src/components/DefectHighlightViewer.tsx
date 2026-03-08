interface DefectZone {
  defect_name: string;
  x_percent: number;
  y_percent: number;
  w_percent: number;
  h_percent: number;
  color: string;
}

interface DefectHighlightViewerProps {
  imageSrc: string;
  defectZones: DefectZone[];
  showOverlay: boolean;
}

export function DefectHighlightViewer({ imageSrc, defectZones, showOverlay }: DefectHighlightViewerProps) {
  return (
    <div style={{
      position: 'relative',
      display: 'block',
      width: '100%',
      lineHeight: 0,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <img
        src={imageSrc}
        alt="Property with defect zones"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '12px',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />

      {showOverlay && defectZones && defectZones.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}>
          {defectZones.map((zone, i) => {
            const x = Math.max(0, Math.min(zone.x_percent, 95));
            const y = Math.max(0, Math.min(zone.y_percent, 95));
            const w = Math.max(2, Math.min(zone.w_percent, 100 - x));
            const h = Math.max(2, Math.min(zone.h_percent, 100 - y));

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                  border: `2px solid ${zone.color}`,
                  backgroundColor: `${zone.color}20`,
                  borderRadius: '3px',
                  boxSizing: 'border-box',
                  pointerEvents: 'auto',
                }}
                title={zone.defect_name}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  background: zone.color,
                  color: 'white',
                  fontSize: '9px',
                  fontWeight: '700',
                  padding: '2px 5px',
                  borderRadius: '2px 0 2px 0',
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                }}>
                  {zone.defect_name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
