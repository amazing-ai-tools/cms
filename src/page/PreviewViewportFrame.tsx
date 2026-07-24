import type { ReactNode } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

export const PREVIEW_VIEWPORTS: Array<{
  id: PreviewViewport;
  label: string;
  width: number;
  Icon: typeof Monitor;
}> = [
  { id: 'desktop', label: 'Desktop', width: 1440, Icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: 768, Icon: Tablet },
  { id: 'mobile', label: 'Mobile', width: 390, Icon: Smartphone },
];

export function PreviewViewportControls({
  onViewportChange,
  viewport,
}: {
  onViewportChange: (viewport: PreviewViewport) => void;
  viewport: PreviewViewport;
}) {
  return (
    <div className="preview-viewport-controls" role="group" aria-label="Preview viewport">
      {PREVIEW_VIEWPORTS.map(({ Icon, id, label, width }) => (
        <button
          aria-label={`${label} ${width}`}
          aria-pressed={viewport === id}
          className="preview-viewport-button"
          key={id}
          type="button"
          onClick={() => onViewportChange(id)}
        >
          <Icon size={16} />
          <span>{label}</span>
          <small>{width}</small>
        </button>
      ))}
    </div>
  );
}

export function PreviewViewportFrame({
  children,
  viewport,
}: {
  children: ReactNode;
  viewport: PreviewViewport;
}) {
  const selectedViewport =
    PREVIEW_VIEWPORTS.find((option) => option.id === viewport) ?? PREVIEW_VIEWPORTS[0];

  return (
    <div className="preview-viewport-stage">
      <div
        className={`preview-viewport-frame ${selectedViewport.id}`}
        data-testid="preview-viewport-frame"
        data-viewport={selectedViewport.id}
        style={{ maxWidth: `${selectedViewport.width}px` }}
      >
        {children}
      </div>
    </div>
  );
}
