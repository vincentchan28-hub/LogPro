import { useState } from 'react'
import { X } from 'lucide-react'
import type { TimelineEvent } from '../types'
import { ImageLightboxModal } from './ImageLightboxModal'

type ProcurementTimelineModalProps = {
  isOpen: boolean
  onClose: () => void
  procurementRef: string
  events: TimelineEvent[]
}

function formatEventDate(dateText: string): string {
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return dateText
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
}

const BUBBLE_FILL: Record<TimelineEvent['type'], string> = {
  created: 'rgba(2, 132, 199, 0.08)',
  grades_added: 'rgba(22, 163, 74, 0.08)',
  price_change: 'rgba(217, 119, 6, 0.1)',
  note: 'rgba(100, 116, 139, 0.08)',
}

const BUBBLE_BORDER: Record<TimelineEvent['type'], string> = {
  created: '#7dd3fc',
  grades_added: '#86efac',
  price_change: '#fcd34d',
  note: '#cbd5e1',
}

export function ProcurementTimelineModal({
  isOpen,
  onClose,
  procurementRef,
  events,
}: ProcurementTimelineModalProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  if (!isOpen) return null

  function handleBubbleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.tagName === 'IMG') {
      setLightboxSrc((target as HTMLImageElement).src)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-card"
        style={{ width: 'min(100%, 640px)', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Timeline — {procurementRef}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 'auto', padding: '6px', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {events.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No timeline events recorded yet.</p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '22px' }}>
            <div
              style={{
                position: 'absolute',
                left: '5px',
                top: '6px',
                bottom: '6px',
                width: '2px',
                background: '#e2e8f0',
              }}
            />
            {events.map((event, idx) => (
              <div key={event.id} style={{ position: 'relative', marginBottom: idx === events.length - 1 ? 0 : '22px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-22px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: BUBBLE_BORDER[event.type],
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 1px #cbd5e1',
                  }}
                />
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                  {formatEventDate(event.date)} — {event.title}
                </div>
                <div
                  className="note-html"
                  onClick={handleBubbleClick}
                  style={{
                    background: BUBBLE_FILL[event.type],
                    border: `1px solid ${BUBBLE_BORDER[event.type]}`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.86rem',
                    color: '#1e293b',
                    whiteSpace: event.type === 'grades_added' ? 'pre' : 'pre-line',
                    fontFamily:
                      event.type === 'grades_added'
                        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                        : 'inherit',
                    overflowX: event.type === 'grades_added' ? 'auto' : undefined,
                  }}
                  {...(event.html ? { dangerouslySetInnerHTML: { __html: event.body } } : {})}
                >
                  {event.html ? null : event.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ImageLightboxModal
        isOpen={Boolean(lightboxSrc)}
        imageSrc={lightboxSrc}
        title="Note picture"
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  )
}