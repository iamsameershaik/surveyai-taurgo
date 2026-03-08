import { DefectZone } from '../types';

interface DefectHighlightViewerProps {
  imageSrc: string;
  defectZones: DefectZone[];
  showOverlay: boolean;
}

export function DefectHighlightViewer({
  imageSrc,
  defectZones,
  showOverlay,
}: DefectHighlightViewerProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <img
        src={imageSrc}
        alt="Property with defect zones"
        style={{ width: '100%', display: 'block', borderRadius: '12px' }}
      />
      {showOverlay &&
        defectZones &&
        defectZones.map((zone, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${zone.x_percent}%`,
              top: `${zone.y_percent}%`,
              width: `${zone.w_percent}%`,
              height: `${zone.h_percent}%`,
              border: `2px solid ${zone.color}`,
              backgroundColor: `${zone.color}22`,
              borderRadius: '4px',
              boxShadow: `0 0 0 1px ${zone.color}44`,
              transition: 'opacity 0.3s',
              cursor: 'pointer',
            }}
            title={zone.defect_name}
          >
            <div
              style={{
                position: 'absolute',
                top: '-1px',
                left: '-1px',
                background: zone.color,
                color: 'white',
                fontSize: '9px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '3px 0 3px 0',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {zone.defect_name}
            </div>
          </div>
        ))}
    </div>
  );
}
