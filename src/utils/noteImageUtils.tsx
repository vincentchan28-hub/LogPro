import React from 'react'
import { ZoomIn, Trash2, Image as ImageIcon } from 'lucide-react'

// Pattern matching markdown image: ![alt](data:image/...) or HTML <img src="data:image/..." />
const MD_IMAGE_REGEX = /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+)\)/g
const HTML_IMAGE_REGEX = /<img[^>]+src=["'](data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+)["'][^>]*\/?>/g

export function extractImagesFromNote(text: string): {
  cleanText: string
  images: { id: string; alt: string; src: string }[]
} {
  if (!text) return { cleanText: '', images: [] }

  const images: { id: string; alt: string; src: string }[] = []
  let index = 0

  // 1. Extract markdown images
  let cleaned = text.replace(MD_IMAGE_REGEX, (_match, alt, src) => {
    index += 1
    images.push({
      id: `img-${index}`,
      alt: alt || `Image ${index}`,
      src,
    })
    return ''
  })

  // 2. Extract HTML images
  cleaned = cleaned.replace(HTML_IMAGE_REGEX, (_match, src) => {
    index += 1
    images.push({
      id: `img-${index}`,
      alt: `Image ${index}`,
      src,
    })
    return ''
  })

  return {
    cleanText: cleaned.trim(),
    images,
  }
}

export function removeImageFromNote(text: string, imageSrc: string): string {
  if (!text || !imageSrc) return text

  // Remove markdown pattern containing this src
  const escapedSrc = imageSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mdPattern = new RegExp(`!\\s*\\[[^\\]]*\\]\\(${escapedSrc}\\)`, 'g')
  const htmlPattern = new RegExp(`<img[^>]+src=["']${escapedSrc}["'][^>]*\\/?>`, 'g')

  let updated = text.replace(mdPattern, '').replace(htmlPattern, '')
  // Clean up excessive blank lines
  updated = updated.replace(/\n{3,}/g, '\n\n').trim()
  return updated
}

/**
 * Clipboard paste handler for textareas
 * Intercepts pasted image data, compresses if needed, and inserts markdown image syntax
 */
export function handleImagePaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  currentText: string,
  onUpdate: (newText: string) => void,
): boolean {
  const clipboardItems = e.clipboardData?.items
  if (!clipboardItems) return false

  let hasImage = false

  for (let i = 0; i < clipboardItems.length; i++) {
    const item = clipboardItems[i]
    if (item.type.indexOf('image') !== -1) {
      hasImage = true
      e.preventDefault()

      const file = item.getAsFile()
      if (!file) continue

      const reader = new FileReader()
      reader.onload = (readEvent) => {
        const rawBase64 = readEvent.target?.result as string
        if (!rawBase64) return

        // Optimize dimensions to avoid huge storage bloat
        const img = new Image()
        img.onload = () => {
          const MAX_DIM = 1200
          let width = img.width
          let height = img.height

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width)
              width = MAX_DIM
            } else {
              width = Math.round((width * MAX_DIM) / height)
              height = MAX_DIM
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const compressed = canvas.toDataURL('image/jpeg', 0.85)
            insertImage(compressed)
          } else {
            insertImage(rawBase64)
          }
        }

        img.onerror = () => {
          insertImage(rawBase64)
        }

        img.src = rawBase64
      }

      reader.readAsDataURL(file)
      break
    }
  }

  function insertImage(dataUrl: string) {
    const tag = `\n![Pasted Image](${dataUrl})\n`
    const updated = currentText ? `${currentText.trimEnd()}${tag}` : tag
    onUpdate(updated)
  }

  return hasImage
}

/**
 * Component that displays note text and any embedded images with click-to-enlarge
 */
export function NoteWithImagesView({
  text,
  onImageClick,
}: {
  text: string
  onImageClick: (src: string) => void
}) {
  const { cleanText, images } = extractImagesFromNote(text)

  if (!cleanText && images.length === 0) {
    return <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {cleanText && (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, wordBreak: 'break-word' }}>
          {cleanText}
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: cleanText ? '4px' : '0' }}>
          {images.map((img) => (
            <div
              key={img.id}
              onClick={() => onImageClick(img.src)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                flexDirection: 'column',
                cursor: 'pointer',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              title="Click to enlarge image"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}
            >
              <img
                src={img.src}
                alt={img.alt}
                style={{
                  maxHeight: '160px',
                  maxWidth: '240px',
                  objectFit: 'contain',
                  display: 'block',
                  background: '#ffffff',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#0369a1',
                  background: '#f0f9ff',
                  borderTop: '1px solid #e0f2fe',
                }}
              >
                <ZoomIn size={12} />
                <span>Enlarge</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Thumbnail manager for note editors in edit mode
 * Allows previewing pasted images and deleting them cleanly
 */
export function ImageAttachmentThumbnails({
  text,
  onUpdateText,
  onImageClick,
}: {
  text: string
  onUpdateText: (newText: string) => void
  onImageClick: (src: string) => void
}) {
  const { images } = extractImagesFromNote(text)

  if (images.length === 0) return null

  return (
    <div
      style={{
        marginTop: '8px',
        padding: '8px 10px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#475569',
          marginBottom: '6px',
        }}
      >
        <ImageIcon size={14} color="#0284c7" />
        <span>Pasted Images ({images.length})</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {images.map((img, idx) => (
          <div
            key={img.id}
            style={{
              position: 'relative',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              onClick={() => onImageClick(img.src)}
              title="Click to preview full size"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src={img.src}
                alt={`Image ${idx + 1}`}
                style={{
                  height: '70px',
                  width: '90px',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const updated = removeImageFromNote(text, img.src)
                onUpdateText(updated)
              }}
              title="Remove this image"
              style={{
                width: '100%',
                padding: '3px 0',
                border: 'none',
                borderTop: '1px solid #fee2e2',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.72rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
