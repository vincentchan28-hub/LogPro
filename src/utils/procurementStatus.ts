export function isGradeCancelled(price: string | number | undefined): boolean {
  if (price === undefined || price === null || price === '') return false
  if (typeof price === 'string') {
    const lower = price.trim().toLowerCase()
    return lower === 'cancelled' || lower === 'cancel' || lower === 'c'
  }
  return false
}

export function isProcurementAgreed(
  grades: { OfferedPricePerTonne?: string | number; AgreedPricePerTonne?: string | number }[],
): boolean {
  if (!grades || grades.length === 0) return false
  for (const grade of grades) {
    if (isGradeCancelled(grade.AgreedPricePerTonne)) continue
    const agreedPrice = Number(grade.AgreedPricePerTonne)
    if (Number.isNaN(agreedPrice) || agreedPrice <= 0) return false
  }
  return true
}