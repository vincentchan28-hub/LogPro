import type { CSSProperties } from 'react'

export type ProductTypeLike = string | undefined | null

export type ProductTypeColors = {
  border: string
  background: string
  color: string
}

const GREEN_COLORS: ProductTypeColors = {
  border: '2px solid #15803d',
  background: '#86efac',
  color: '#14532d',
}

const BURNT_COLORS: ProductTypeColors = {
  border: '2px solid #92400e',
  background: '#e8c39e',
  color: '#5c2e0e',
}

const DEFAULT_COLORS: ProductTypeColors = {
  border: '1px solid #cbd5e1',
  background: '#f1f5f9',
  color: '#475569',
}

// Works out which colour set to use from any Product Type text
// ("Green", "Green Logs", "Burnt", "Burnt Logs" all match correctly).
export function productTypeColors(productType: ProductTypeLike): ProductTypeColors {
  const normalised = String(productType || '').trim().toLowerCase()
  if (normalised.startsWith('green')) return GREEN_COLORS
  if (normalised.startsWith('burnt')) return BURNT_COLORS
  return DEFAULT_COLORS
}

// A snug, pill-shaped "status tag" look for showing a Product Type as text.
export function productTypeTagStyle(productType: ProductTypeLike): CSSProperties {
  const colors = productTypeColors(productType)
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
    border: colors.border,
    backgroundColor: colors.background,
    color: colors.color,
  }
}