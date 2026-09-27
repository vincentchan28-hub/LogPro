import { useEffect } from 'react'
import { X, ZoomIn, Download } from 'lucide-react'

type ImageLightboxModalProps = {
  isOpen: boolean
  imageSrc: string | null
  title?: string
  onClose: () => void
}

export function ImageLightboxModal({
  isOpen,
  imageSrc,
  title = 'Enlarged Image',
  onClose,
}: ImageLightboxModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !imageSrc) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {/* Top action bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 600 }}>
          <ZoomIn size={18} style={{ color: '#38bdf8' }} />
          <span>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={imageSrc}
            download="procurement_note_image.png"
            title="Download image"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={14} /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main image container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          background: '#020617',
        }}
      >
        <img
          src={imageSrc}
          alt={title}
          style={{
            maxWidth: '92vw',
            maxHeight: '85vh',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#94a3b8' }}>
        Press <kbd style={{ background: '#334155', color: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> or click anywhere outside to close
      </div>
    </div>
  )
}
