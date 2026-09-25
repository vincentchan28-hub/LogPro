import type { CSSProperties } from 'react'

export type ProductTypeLike = string | undefined | null

export type ProductTypeColors = {
  border: string
  background: string
  color: string
}

const GREEN_COLORS: ProductTypeColors = {
  border: '1px solid #86b98a',
  background: '#e5f3e7',
  color: '#285c31',
}

const BURNT_COLORS: ProductTypeColors = {
  border: '1px solid #c49a72',
  background: '#f4e8dc',
  color: '#70451f',
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
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: 'calc(0.78rem - 1px)',
    fontWeight: 600,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    border: colors.border,
    backgroundColor: colors.background,
    color: colors.color,
  }
}