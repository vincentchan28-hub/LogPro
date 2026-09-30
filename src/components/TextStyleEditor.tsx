import type { CSSProperties } from 'react'
import {
  FONT_CHOICES,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  type TextStyleSettings,
} from '../headerStyle'

type TextStyleEditorProps = {
  title: string
  hint: string
  value: TextStyleSettings
  onChan  value: TextStyleSettings
  onChange: (changes: Partial<TextStyleSettings>) => void
  showFill?: boolean
onChange: (changes: Partial<TextStyleSettings>) => void;
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontSize: '0.82rem',
  fontWeight: 600,
}

function styleButton(isActive: boolean, extra: CSSProperties = {}): CSSProperties {
  return {
    width: 'auto',
    padding: '7px 14px',
    fontSize: '0.85rem',
    borderRadius: '6px',
    cursor: 'pointer',
    border: isActive ? '1px solid #0284c7' : '1px solid #cbd5e1',
    background: isActive ? '#0284c7' : '#ffffff',
    color: isActive ? '#ffffff' : '#334155',
    ...extra,
  }
}

export function TextStyleEditor({
  title,
  hint,
  value,
  onChange,
  showFill = false,
}: TextStyleEditorProps) {
  const isNormal = !value.bold && !value.underline

  return (
    <div className="tool-card">
      <div className="tool-card-body">
        <h5>{title}</h5>
        <p>{hint}</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '14px',
            marginTop: '12px',
          }}
        >
          <label style={fieldStyle}>
            Font
            <select
              value={value.fontFamily}
              onChange={(event) => onChange({ fontFamily: event.target.value })}
            >
              {FONT_CHOICES.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            Font size: {value.fontSize} px
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              value={value.fontSize}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              style={{ padding: 0 }}
            />
          </label>

          <label style={fieldStyle}>
            Colour
            <input
              type="color"
              value={value.color}
              onChange={(event) => onChange({ color: event.target.value })}
              style={{ height: '36px', padding: '2px', cursor: 'pointer' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onChange({ bold: false, underline: false })}
            style={styleButton(isNormal)}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onChange({ bold: !value.bold })}
            style={styleButton(value.bold, { fontWeight: 800 })}
          >
            Bold
          </button>
          <button
            type="button"
            onClick={() => onChange({ underline: !value.underline })}
            style={styleButton(value.underline, { textDecoration: 'underline' })}
          >
            Underline
          </button>
        </div>

        {showFill && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '14px',
              flexWrap: 'wrap',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={value.fillEnabled}
                onChange={(event) => onChange({ fillEnabled: event.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Fill the pill with a colour
            </label>

            <input
              type="color"
              value={value.fillColor}
              onChange={(event) =>
                onChange({ fillColor: event.target.value, fillEnabled: true })
              }
              title="Pill infill colour"
              style={{ width: '56px', height: '34px', padding: '2px', cursor: 'pointer' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}