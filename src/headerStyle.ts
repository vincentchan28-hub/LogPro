import type { CSSProperties } from 'react'

export type TextStyleSettings = {
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  underline: boolean
  fillEnabled: boolean
  fillColor: string
}

export type HeaderStyleSettings = {
  title: TextStyleSettings
  description: TextStyleSettings
}

export const MIN_FONT_SIZE = 8
export const MAX_FONT_SIZE = 60

export const FONT_CHOICES = [
  { label: 'Default (LogPro font)', value: '' },
  { label: 'Segoe UI', value: "'Segoe UI', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: "Calibri, 'Segoe UI', sans-serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Impact', value: 'Impact, sans-serif' },
]

export const DEFAULT_HEADER_STYLE: HeaderStyleSettings = {
  title: {
    fontFamily: '',
    fontSize: 22,
    color: '#ffffff',
    bold: true,
    underline: false,
    fillEnabled: false,
    fillColor: '#1e3a8a',
  },
  description: {
    fontFamily: '',
    fontSize: 13,
    color: '#94a3b8',
    bold: false,
    underline: false,
    fillEnabled: false,
    fillColor: '#1e3a8a',
  },
}

const HEADER_STYLE_KEY = 'logpro.headerStyle'

function cleanText(
  saved: Partial<TextStyleSettings> | undefined,
  fallback: TextStyleSettings,
): TextStyleSettings {
  const size = Number(saved?.fontSize)
  const colorIsValid =
    typeof saved?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.color)

  return {
    fontFamily:
      typeof saved?.fontFamily === 'string' ? saved.fontFamily : fallback.fontFamily,
    fontSize:
      Number.isFinite(size) && size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE
        ? size
        : fallback.fontSize,
    color: colorIsValid ? (saved!.color as string) : fallback.color,
    bold: typeof saved?.bold === 'boolean' ? saved.bold : fallback.bold,
    underline:
      typeof saved?.underline === 'boolean' ? saved.underline : fallback.underline,
    fillEnabled:
      typeof saved?.fillEnabled === 'boolean' ? saved.fillEnabled : fallback.fillEnabled,
    fillColor:
      typeof saved?.fillColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved.fillColor)
        ? saved.fillColor
        : fallback.fillColor,
  }
}

// Reads the saved look. Uses the standard look if nothing was saved.
export function loadHeaderStyle(): HeaderStyleSettings {
  try {
    const text = window.localStorage.getItem(HEADER_STYLE_KEY)
    if (text) {
      const saved = JSON.parse(text)
      return {
        title: cleanText(saved?.title, DEFAULT_HEADER_STYLE.title),
        description: cleanText(saved?.description, DEFAULT_HEADER_STYLE.description),
      }
    }
  } catch {
    // If the browser blocks reading, use the standard look.
  }
  return DEFAULT_HEADER_STYLE
}

export function saveHeaderStyle(settings: HeaderStyleSettings) {
  try {
    window.localStorage.setItem(HEADER_STYLE_KEY, JSON.stringify(settings))
  } catch {
    // If the browser blocks saving, carry on without it.
  }
}

// Turns the settings into the style used by the "LogPro" title.
export function titleCss(settings: TextStyleSettings): CSSProperties {
  return {
    fontFamily: settings.fontFamily || undefined,
    fontSize: `${settings.fontSize}px`,
    color: settings.color,
    fontWeight: settings.bold ? 800 : 400,
    textDecoration: settings.underline ? 'underline' : 'none',
  }
}

// Same, plus the tight pill-shaped border around the whole description.
export function descriptionCss(settings: TextStyleSettings): CSSProperties {
  return {
    ...titleCss(settings),
    display: 'inline-block',
    margin: '4px 0 0',
    padding: '1px 10px',
    lineHeight: 1.3,
    border: `1px solid ${settings.color}`,
    borderRadius: '9999px',
    background: settings.fillEnabled ? settings.fillColor : 'transparent',
  }
}