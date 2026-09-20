// Costing maths and shared types. No screen code lives in this file.
// Everything is "per tonne".

export type CurrencyCode = 'AUD' | 'USD' | 'CNY' | 'JPY' | 'KRW'

// How many units of each currency equal 1 AUD. AUD itself is always 1.
// Example: { AUD: 1, USD: 0.65, CNY: 4.7, ... }
export type Rates = Record<CurrencyCode, number>

export type Country = {
  name: string
  // The country's own currency. Vietnam and India use USD for now.
  currency: CurrencyCode
}

export const COUNTRIES: Country[] = [
  { name: 'China', currency: 'CNY' },
  { name: 'Japan', currency: 'JPY' },
  { name: 'South Korea', currency: 'KRW' },
  { name: 'Vietnam', currency: 'USD' },
  { name: 'India', currency: 'USD' },
]

// What we call each currency on screen (China's currency is shown as RMB).
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  AUD: 'AUD',
  USD: 'USD',
  CNY: 'RMB',
  JPY: 'JPY',
  KRW: 'KRW',
}

const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  AUD: 2,
  USD: 2,
  CNY: 2,
  JPY: 0,
  KRW: 0,
}

export type RatesResult = {
  ok: boolean
  error: string
  sourceName: string
  sourceUrl: string
  rateDate: string
  perAud: Rates | null
  problems: string[]
}

// One saved costing, exactly as it is stored on the Costings sheet.
export type CostingRecord = {
  CostingReference: string
  CreatedAt: string
  Label: string
  DestinationCountry: string
  LocalCurrency: string
  SellingPriceUSD: number
  SellingPriceLocal: number
  SellingPriceAUD: number
  ClearanceAUD: number
  SeaFreightAUD: number
  TransportAUD: number
  FumigationAUD: number
  PackingAUD: number
  TotalCostsAUD: number
  MaxAffordableOfferAUD: number
  MaxAffordableOfferUSD: number
  TraderCommissionAUD: number
  RecommendedOfferAUD: number
  RecommendedOfferUSD: number
  AudPerUsd: number
  LocalPerUsd: number
  RateSource: string
  RateDate: string
}

// What the screen sends when saving. LogPro adds the reference and date.
export type CostingInput = Omit<CostingRecord, 'CostingReference' | 'CreatedAt'>

export type CostingListResult = {
  costings: CostingRecord[]
  error: string
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (!Number.isFinite(amount)) {
    return '—'
  }

  const decimals = CURRENCY_DECIMALS[currency]

  return amount.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Text for putting a converted number back into a yellow box.
export function amountToText(amount: number, currency: CurrencyCode): string {
  return amount.toFixed(CURRENCY_DECIMALS[currency])
}

// Turns what the user typed into a number. Blank or invalid becomes 0.
export function parseAmount(text: string): number {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Rates,
): number {
  return (amount / rates[from]) * rates[to]
}

// The two "own rate" boxes, worked out from the live rates:
//   1 USD = ? AUD    and    1 USD = ? local currency
export function ownRatesFromLive(
  live: Rates,
  local: CurrencyCode,
): { audPerUsd: number; localPerUsd: number } {
  return {
    audPerUsd: 1 / live.USD,
    localPerUsd: local === 'USD' ? 1 : live[local] / live.USD,
  }
}

// The reverse: build a full set of rates from the user's two own-rate boxes.
// Returns null if a box is empty or zero.
export function ratesFromOwn(
  base: Rates,
  local: CurrencyCode,
  audPerUsd: number,
  localPerUsd: number,
): Rates | null {
  if (!(audPerUsd > 0)) {
    return null
  }

  if (local !== 'USD' && !(localPerUsd > 0)) {
    return null
  }

  const usdPerAud = 1 / audPerUsd
  const result: Rates = { ...base, AUD: 1, USD: usdPerAud }

  if (local !== 'USD') {
    result[local] = localPerUsd * usdPerAud
  }

  return result
}

export type CalcInput = {
  localCurrency: CurrencyCode
  sellingCurrency: CurrencyCode
  selling: number // typed in sellingCurrency
  clearance: number // typed in the local currency
  seaFreight: number // typed in AUD
  transport: number // typed in AUD
  fumigation: number // typed in AUD
  packing: number // typed in AUD
  commission: number // typed in AUD
}

export type CalcResult = {
  sellingAud: number
  clearanceAud: number
  seaFreightAud: number
  transportAud: number
  fumigationAud: number
  packingAud: number
  totalCostsAud: number
  // Selling price minus all costs = the most that could be paid at the mill door.
  breakEvenAud: number
  commissionAud: number
  // Break-even minus the trader commission.
  recommendedAud: number
}

export function calculate(input: CalcInput, rates: Rates): CalcResult {
  const sellingAud = convert(input.selling, input.sellingCurrency, 'AUD', rates)
  const clearanceAud = convert(input.clearance, input.localCurrency, 'AUD', rates)

  const totalCostsAud =
    clearanceAud +
    input.seaFreight +
    input.transport +
    input.fumigation +
    input.packing

  const breakEvenAud = sellingAud - totalCostsAud

  return {
    sellingAud,
    clearanceAud,
    seaFreightAud: input.seaFreight,
    transportAud: input.transport,
    fumigationAud: input.fumigation,
    packingAud: input.packing,
    totalCostsAud,
    breakEvenAud,
    commissionAud: input.commission,
    recommendedAud: breakEvenAud - input.commission,
  }
}

export function formatDateTime(isoText: string): string {
  const date = new Date(isoText)

  if (Number.isNaN(date.getTime())) {
    return isoText
  }

  return date.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}