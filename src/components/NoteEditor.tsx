import { useRef, useEffect, useCallback } from 'react'

type NoteEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

// A notes box that works like plain text, but also lets the user paste a
// picture straight in (copy an image, click here, Ctrl+V).
export function NoteEditor({ value, onChange, placeholder, minHeight = 80 }: NoteEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)

  // Only overwrite what's on screen if the value changed from OUTSIDE this
  // box (e.g. switching to a different procurement). This stops the cursor
  // jumping around while the user is typing.
  useEffect(() => {
    if (ref.current && value !== lastValueRef.current) {
      ref.current.innerHTML = value || ''
      lastValueRef.current = value
    }
  }, [value])

  function fireChange() {
    if (!ref.current) return
    const html = ref.current.innerHTML
    lastValueRef.current = html
    onChange(html)
  }

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result || '')
          document.execCommand('insertImage', false, dataUrl)
          fireChange()
        }
        reader.readAsDataURL(file)
        return
      }
    }
    // Not a picture - let the normal text paste happen, then save it.
    setTimeout(fireChange, 0)
  }, [])

  return (
    <div
      ref={ref}
      className="note-editor note-html"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ''}
      onInput={fireChange}
      onPaste={handlePaste}
      onBlur={fireChange}
      style={{
        width: '100%',
        minHeight: `${minHeight}px`,
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: '#fff',
        fontSize: '0.85rem',
        overflowY: 'auto',
        lineHeight: 1.5,
      }}
    />
  )
}