import { useState, useCallback } from 'react'

export type GradesColKey = 'species' | 'product' | 'grade' | 'offered' | 'agreed'

export const DEFAULT_GRADES_COL_WIDTHS: Record<GradesColKey, number> = {
  species: 150,
  product: 120,
  grade: 150,
  offered: 120,
  agreed: 130,
}

const STORAGE_KEY = 'logpro_grades_col_widths_v2'

export function useGradesColumnWidths() {
  const [widths, setWidths] = useState<Record<GradesColKey, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...DEFAULT_GRADES_COL_WIDTHS,
          ...parsed,
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_GRADES_COL_WIDTHS
  })

  const [activeResizingCol, setActiveResizingCol] = useState<GradesColKey | null>(null)

  const startResizing = useCallback(
    (colKey: GradesColKey, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setActiveResizingCol(colKey)

      const startX = e.clientX
      const initialWidth = widths[colKey] || DEFAULT_GRADES_COL_WIDTHS[colKey]

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        const newWidth = Math.max(75, initialWidth + delta)
        setWidths((prev) => ({
          ...prev,
          [colKey]: newWidth,
        }))
      }

      const onMouseUp = (upEvent: MouseEvent) => {
        const delta = upEvent.clientX - startX
        const finalWidth = Math.max(75, initialWidth + delta)
        setWidths((prev) => {
          const next = { ...prev, [colKey]: finalWidth }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          } catch {
            // ignore
          }
          return next
        })
        setActiveResizingCol(null)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [widths],
  )

  return {
    widths,
    activeResizingCol,
    startResizing,
  }
}
