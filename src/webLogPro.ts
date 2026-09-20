import * as XLSX from 'xlsx'
import {
  type Supplier,
  type SupplierContact,
  type Procurement,
  type ProcurementGrade,
  type PriceHistory,
  type CostingRecord,
  type SpeciesDefinition,
  type GradeDefinition,
  type WorkbookResult,
  STANDARD_GRADES,
} from './types'

export type SupplierInput = {
  name: string
  abn: string
  phone: string
  email: string
  notes: string
  address?: string
  paymentTerms?: string
}

export const WORKBOOK_SHEETS = [
  'Suppliers',
  'SupplierContacts',
  'Procurements',
  'ProcurementGrades',
  'PriceHistory',
  'Costings',
  'Resales',
  'Users',
  'Settings',
  'SpeciesDefinitions',
  'GradeDefinitions',
]

export const HEADERS: Record<string, string[]> = {
  Suppliers: [
    'SupplierID',
    'SupplierName',
    'Address',
    'ABN',
    'PaymentTerms',
    'Notes',
    'CreatedBy',
    'CreatedDate',
    'ChangedBy',
    'ChangedDate',
  ],
  SupplierContacts: [
    'ContactID',
    'SupplierID',
    'ContactName',
    'Role',
    'PhoneNumber',
    'MobileNumber',
    'Email',
    'Notes',
    'IsPrimary',
  ],
  Procurements: [
    'ProcurementID',
    'ProcurementRef',
    'SupplierID',
    'ContactID',
    'AgreementType',
    'AgreementDetail',
    'Plantation',
    'Species',
    'HarvestPeriodStart',
    'HarvestPeriodEnd',
    'StartDate',
    'EndDate',
    'Status',
    'AcceptanceDate',
    'AcceptanceTime',
    'AcceptanceMethod',
    'AcceptedByPerson',
    'AcceptanceNotes',
    'Notes',
    'CreatedBy',
    'CreatedDate',
    'ChangedBy',
    'ChangedDate',
  ],
  ProcurementGrades: [
    'ProcurementGradeID',
    'ProcurementRef',
    'Species',
    'ProductType',
    'GradeName',
    'OfferedPricePerTonne',
    'AgreedPricePerTonne',
    'AgreedTonnes',
    'DeliveredTonnes',
    'RemainingTonnes',
    'Notes',
  ],
  PriceHistory: [
    'PriceHistoryID',
    'ProcurementRef',
    'ProcurementGradeID',
    'ProductType',
    'GradeName',
    'PreviousPrice',
    'NewPrice',
    'ChangeType',
    'Reason',
    'EffectiveDateTime',
    'Notes',
    'RecordedBy',
    'RecordedDateTime',
  ],
  Costings: [
    'CostingID',
    'CostingRef',
    'DestinationCountry',
    'SellingPriceEntered',
    'SellingPriceCurrency',
    'SellingPriceAUD',
    'SellingPriceUSD',
    'SellingPriceRMB',
    'ExchangeRateAUD_USD',
    'ExchangeRateAUD_CNY',
    'RateSource',
    'RateDate',
    'CustomsClearanceRMB',
    'CustomsClearanceAUD',
    'SeaFreightAUD',
    'FumigationAUD',
    'PackingAUD',
    'TraderCommissionAUD',
    'TraderCommissionRate',
    'TraderCommissionType',
    'TotalDeductionsAUD',
    'MillDoorPriceAUD',
    'MillDoorPriceUSD',
    'MillDoorPriceRMB',
    'CustomerName',
    'GradeOrSpecies',
    'Notes',
    'CreatedBy',
    'CreatedDate',
  ],
  Resales: [
    'ResaleID',
    'ProcurementRef',
    'CustomerName',
    'SellingPricePerTonne',
    'BuyingPricePerTonne',
    'Margin',
    'DateSold',
    'Notes',
  ],
  Users: ['UserID', 'Username', 'PasswordHash', 'Role', 'IsActive'],
  Settings: ['SettingKey', 'SettingValue'],
  SpeciesDefinitions: ['SpeciesDefinitionID', 'SpeciesName', 'IsStandard', 'Notes'],
  GradeDefinitions: [
    'GradeDefinitionID',
    'SpeciesName',
    'ProductType',
    'GradeName',
    'IsStandard',
    'Notes',
  ],
}

const STORAGE_PREFIX = 'logpro.wb.'
const LAST_WORKBOOK_KEY = 'logpro.lastWorkbook'

// In-memory cache for open workbooks
const workbookCache = new Map<string, XLSX.WorkBook>()

function formatTimestamp(): string {
  const d = new Date()
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

function ensureSheetWithHeaders(
  workbook: XLSX.WorkBook,
  sheetName: string,
  headers: string[],
): XLSX.WorkSheet {
  let ws = workbook.Sheets[sheetName]
  if (!ws) {
    ws = XLSX.utils.aoa_to_sheet([headers])
    XLSX.utils.book_append_sheet(workbook, ws, sheetName)
  }
  return ws
}

function getRows<T>(workbook: XLSX.WorkBook, sheetName: string): T[] {
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<T>(ws, { defval: '' })
}

function setRows<T extends Record<string, unknown>>(
  workbook: XLSX.WorkBook,
  sheetName: string,
  headers: string[],
  rows: T[],
): void {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  ws['!cols'] = headers.map(() => ({ wch: 20 }))
  workbook.Sheets[sheetName] = ws
}

function createSupplierPrefix(supplierName: string): string {
  const lettersOnly = supplierName.replace(/[^a-zA-Z]/g, '').toUpperCase()
  return `${lettersOnly}___`.slice(0, 3)
}

export function readSuppliers(workbook: XLSX.WorkBook): Supplier[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'Suppliers')
  return rawRows
    .map((row, idx): Supplier => {
      const id = (row.SupplierID as string | number) || (row.SupplierReference as string) || idx + 1
      const ref = String(row.SupplierReference || row.SupplierID || `SUP-${idx + 1}`)
      return {
        SupplierID: id,
        SupplierReference: ref,
        SupplierName: String(row.SupplierName || ''),
        Address: String(row.Address || ''),
        ABN: String(row.ABN || ''),
        PaymentTerms: String(row.PaymentTerms || ''),
        Phone: String(row.Phone || row.PhoneNumber || ''),
        Email: String(row.Email || ''),
        Notes: String(row.Notes || ''),
        CreatedBy: String(row.CreatedBy || 'Current User'),
        CreatedAt: String(row.CreatedAt || row.CreatedDate || ''),
        CreatedDate: String(row.CreatedDate || row.CreatedAt || ''),
      }
    })
    .filter((s) => s.SupplierName.trim() !== '')
}

export function readSupplierContacts(
  workbook: XLSX.WorkBook,
  supplierId?: string | number,
): SupplierContact[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'SupplierContacts')
  const contacts: SupplierContact[] = rawRows
    .map((row, idx): SupplierContact => ({
      ContactID: (row.ContactID as string | number) || idx + 1,
      SupplierID: String(row.SupplierID || ''),
      ContactName: String(row.ContactName || ''),
      Role: String(row.Role || ''),
      PhoneNumber: String(row.PhoneNumber || ''),
      MobileNumber: String(row.MobileNumber || ''),
      Email: String(row.Email || ''),
      Notes: String(row.Notes || ''),
      IsPrimary: Boolean(row.IsPrimary === true || row.IsPrimary === 'true'),
    }))
    .filter((c) => c.ContactName.trim() !== '')

  if (supplierId !== undefined && supplierId !== '') {
    const sIdStr = String(supplierId).trim()
    return contacts.filter((c) => String(c.SupplierID).trim() === sIdStr)
  }
  return contacts
}

export function readProcurements(workbook: XLSX.WorkBook): Procurement[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'Procurements')
  return rawRows
    .map((row, idx): Procurement => ({
      ProcurementID: (row.ProcurementID as string | number) || idx + 1,
      ProcurementRef: String(row.ProcurementRef || `PROC-${String(idx + 1).padStart(4, '0')}`),
      SupplierID: String(row.SupplierID || ''),
      ContactID: String(row.ContactID || ''),
      AgreementType: String(row.AgreementType || 'Coupe'),
      AgreementDetail: String(row.AgreementDetail || ''),
      Plantation: String(row.Plantation || ''),
      Species: String(row.Species || ''),
      HarvestPeriodStart: String(row.HarvestPeriodStart || ''),
      HarvestPeriodEnd: String(row.HarvestPeriodEnd || ''),
      StartDate: String(row.StartDate || ''),
      EndDate: String(row.EndDate || ''),
      Status: String(row.Status || 'Draft'),
      AcceptanceDate: String(row.AcceptanceDate || ''),
      AcceptanceTime: String(row.AcceptanceTime || ''),
      AcceptanceMethod: String(row.AcceptanceMethod || 'In Person'),
      AcceptedByPerson: String(row.AcceptedByPerson || ''),
      AcceptanceNotes: String(row.AcceptanceNotes || ''),
      Notes: String(row.Notes || ''),
      CreatedBy: String(row.CreatedBy || 'Current User'),
      CreatedDate: String(row.CreatedDate || ''),
      ChangedBy: String(row.ChangedBy || ''),
      ChangedDate: String(row.ChangedDate || ''),
    }))
    .filter((p) => p.ProcurementRef.trim() !== '')
}

export function readProcurementGrades(
  workbook: XLSX.WorkBook,
  procurementRef?: string,
): ProcurementGrade[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'ProcurementGrades')
  const grades: ProcurementGrade[] = rawRows
    .map((row, idx): ProcurementGrade => {
      const agreedTonnes = Number(row.AgreedTonnes) || 0
      const deliveredTonnes = Number(row.DeliveredTonnes) || 0
      const remainingTonnes =
        row.RemainingTonnes !== undefined && row.RemainingTonnes !== ''
          ? Number(row.RemainingTonnes)
          : Math.max(0, agreedTonnes - deliveredTonnes)

      return {
        ProcurementGradeID: (row.ProcurementGradeID as string | number) || idx + 1,
        ProcurementRef: String(row.ProcurementRef || ''),
        Species: String(row.Species || ''),
        ProductType: String(row.ProductType || 'Fresh Logs'),
        GradeName: String(row.GradeName || ''),
        OfferedPricePerTonne: Number(row.OfferedPricePerTonne) || 0,
        AgreedPricePerTonne: Number(row.AgreedPricePerTonne) || 0,
        AgreedTonnes: agreedTonnes,
        DeliveredTonnes: deliveredTonnes,
        RemainingTonnes: remainingTonnes,
        Notes: String(row.Notes || ''),
      }
    })
    .filter((g) => g.ProcurementRef.trim() !== '')

  if (procurementRef) {
    return grades.filter(
      (g) => g.ProcurementRef.trim() === procurementRef.trim(),
    )
  }
  return grades
}

export function readSpeciesDefinitions(
  workbook: XLSX.WorkBook,
): SpeciesDefinition[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'SpeciesDefinitions')
  return rawRows
    .map((row, idx): SpeciesDefinition => ({
      SpeciesDefinitionID: (row.SpeciesDefinitionID as string | number) || idx + 1,
      SpeciesName: String(row.SpeciesName || ''),
      IsStandard: Boolean(row.IsStandard === true || row.IsStandard === 'true'),
      Notes: String(row.Notes || ''),
    }))
    .filter((s) => s.SpeciesName.trim() !== '')
}

export function readGradeDefinitions(
  workbook: XLSX.WorkBook,
): GradeDefinition[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'GradeDefinitions')
  return rawRows
    .map((row, idx): GradeDefinition => ({
      GradeDefinitionID: (row.GradeDefinitionID as string | number) || idx + 1,
      SpeciesName: String(row.SpeciesName || ''),
      ProductType: (String(row.ProductType || 'Fresh Logs') as 'Fresh Logs' | 'Burnt Logs'),
      GradeName: String(row.GradeName || ''),
      IsStandard: Boolean(row.IsStandard === true || row.IsStandard === 'true'),
      Notes: String(row.Notes || ''),
    }))
    .filter((g) => g.GradeName.trim() !== '')
}

export function readPriceHistory(
  workbook: XLSX.WorkBook,
  procurementRef?: string,
): PriceHistory[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'PriceHistory')
  const history: PriceHistory[] = rawRows
    .map((row, idx): PriceHistory => ({
      PriceHistoryID: (row.PriceHistoryID as string | number) || idx + 1,
      ProcurementRef: String(row.ProcurementRef || ''),
      ProcurementGradeID: row.ProcurementGradeID,
      ProductType: String(row.ProductType || 'Fresh Logs'),
      GradeName: String(row.GradeName || ''),
      PreviousPrice: Number(row.PreviousPrice) || 0,
      NewPrice: Number(row.NewPrice) || 0,
      ChangeType: String(row.ChangeType || 'Agreed Price Revision'),
      Reason: String(row.Reason || ''),
      EffectiveDateTime: String(row.EffectiveDateTime || ''),
      Notes: String(row.Notes || ''),
      RecordedBy: String(row.RecordedBy || 'Current User'),
      RecordedDateTime: String(row.RecordedDateTime || ''),
    }))
    .filter((h) => h.ProcurementRef.trim() !== '' || h.GradeName.trim() !== '')

  if (procurementRef) {
    return history.filter(
      (h) => h.ProcurementRef.trim().toLowerCase() === procurementRef.trim().toLowerCase(),
    )
  }
  return history
}

export function readCostings(workbook: XLSX.WorkBook): CostingRecord[] {
  const rawRows = getRows<Record<string, any>>(workbook, 'Costings')
  return rawRows
    .map((row, idx): CostingRecord => {
      const audUsd = Number(row.ExchangeRateAUD_USD || row.ExchangeRate) || 0.655
      const audCny = Number(row.ExchangeRateAUD_CNY) || 4.72
      const spEntered = Number(row.SellingPriceEntered || row.SellingPriceUSD) || 0
      const spCurr = (row.SellingPriceCurrency === 'RMB' ? 'RMB' : 'USD') as 'USD' | 'RMB'

      const crossRate = audCny / audUsd // USD to CNY
      const spUSD = Number(row.SellingPriceUSD) || (spCurr === 'USD' ? spEntered : spEntered / crossRate)
      const spAUD = Number(row.SellingPriceAUD) || (spUSD / audUsd)
      const spRMB = Number(row.SellingPriceRMB) || (spAUD * audCny)

      const customsRmb = Number(row.CustomsClearanceRMB) || 0
      const customsAud = Number(row.CustomsClearanceAUD) || (audCny > 0 ? customsRmb / audCny : 0)
      const seaFreightAud = Number(row.SeaFreightAUD) || 0
      const fumigationAud = Number(row.FumigationAUD) || 0
      const packingAud = Number(row.PackingAUD) || 0
      const commissionAud = Number(row.TraderCommissionAUD || row.ProcurementFeeAUD) || 0

      const totalDeductionsAud =
        Number(row.TotalDeductionsAUD) ||
        customsAud + seaFreightAud + fumigationAud + packingAud + commissionAud
      const millDoorAud =
        Number(row.MillDoorPriceAUD || row.MaxAffordableOfferAUD) ||
        spAUD - totalDeductionsAud
      const millDoorUsd =
        Number(row.MillDoorPriceUSD || row.MaxAffordableOfferUSD) ||
        millDoorAud * audUsd
      const millDoorRmb =
        Number(row.MillDoorPriceRMB) || millDoorAud * audCny

      return {
        CostingID: (row.CostingID as string | number) || idx + 1,
        CostingRef: String(row.CostingRef || `CST-${String(idx + 1).padStart(3, '0')}`),
        DestinationCountry: String(row.DestinationCountry || 'China'),
        SellingPriceEntered: spEntered,
        SellingPriceCurrency: spCurr,
        SellingPriceAUD: Number(spAUD.toFixed(2)),
        SellingPriceUSD: Number(spUSD.toFixed(2)),
        SellingPriceRMB: Number(spRMB.toFixed(2)),
        ExchangeRateAUD_USD: audUsd,
        ExchangeRateAUD_CNY: audCny,
        RateSource: String(row.RateSource || 'Reserve Bank of Australia (RBA) Reference'),
        RateDate: String(row.RateDate || ''),
        CustomsClearanceRMB: customsRmb,
        CustomsClearanceAUD: Number(customsAud.toFixed(2)),
        SeaFreightAUD: seaFreightAud,
        FumigationAUD: fumigationAud,
        PackingAUD: packingAud,
        TraderCommissionAUD: commissionAud,
        TraderCommissionRate: Number(row.TraderCommissionRate) || 0,
        TraderCommissionType: (row.TraderCommissionType === '%' ? '%' : '$') as '$' | '%',
        TotalDeductionsAUD: Number(totalDeductionsAud.toFixed(2)),
        MillDoorPriceAUD: Number(millDoorAud.toFixed(2)),
        MillDoorPriceUSD: Number(millDoorUsd.toFixed(2)),
        MillDoorPriceRMB: Number(millDoorRmb.toFixed(2)),
        CustomerName: String(row.CustomerName || ''),
        GradeOrSpecies: String(row.GradeOrSpecies || ''),
        Notes: String(row.Notes || ''),
        CreatedBy: String(row.CreatedBy || 'Vincent Chan'),
        CreatedDate: String(row.CreatedDate || ''),
      }
    })
    .filter((c) => c.SellingPriceEntered > 0 || c.CostingRef)
}

export function getNextProcurementRef(workbook: XLSX.WorkBook): string {
  const procurements = readProcurements(workbook)
  let highest = 0
  for (const p of procurements) {
    const ref = p.ProcurementRef || ''
    if (ref.startsWith('PROC-')) {
      const num = parseInt(ref.replace('PROC-', ''), 10)
      if (!isNaN(num) && num > highest) {
        highest = num
      }
    }
  }
  return `PROC-${String(highest + 1).padStart(4, '0')}`
}

function populateDefaultsIfEmpty(workbook: XLSX.WorkBook): void {
  // Ensure all 11 sheets exist with canonical headers
  for (const sheetName of WORKBOOK_SHEETS) {
    ensureSheetWithHeaders(workbook, sheetName, HEADERS[sheetName])
  }

  // Ensure SpeciesDefinitions has at least standard species
  const currentSpecies = readSpeciesDefinitions(workbook)
  if (currentSpecies.length === 0) {
    const defaultSpecies: SpeciesDefinition[] = [
      {
        SpeciesDefinitionID: 1,
        SpeciesName: 'Radiata Pine',
        IsStandard: true,
        Notes: 'Standard plantation softwood',
      },
      {
        SpeciesDefinitionID: 2,
        SpeciesName: 'Tasmanian Blue Gum',
        IsStandard: true,
        Notes: 'Eucalyptus globulus',
      },
      {
        SpeciesDefinitionID: 3,
        SpeciesName: 'Shining Gum',
        IsStandard: true,
        Notes: 'Eucalyptus nitens',
      },
    ]
    setRows(
      workbook,
      'SpeciesDefinitions',
      HEADERS.SpeciesDefinitions,
      defaultSpecies as any,
    )
  }

  // Ensure GradeDefinitions has standard PDF grades
  const currentGrades = readGradeDefinitions(workbook)
  if (currentGrades.length === 0) {
    const standardGradeRows: GradeDefinition[] = []
    let defId = 1
    for (const [prodType, gradeList] of Object.entries(STANDARD_GRADES)) {
      for (const grade of gradeList) {
        standardGradeRows.push({
          GradeDefinitionID: defId++,
          SpeciesName: '',
          ProductType: prodType as 'Fresh Logs' | 'Burnt Logs',
          GradeName: grade,
          IsStandard: true,
          Notes: 'Standard grade from Log Procurement reference PDF',
        })
      }
    }
    setRows(
      workbook,
      'GradeDefinitions',
      HEADERS.GradeDefinitions,
      standardGradeRows as any,
    )
  }

  // Ensure PriceHistory has initial audit records if procurements exist
  const currentHistory = readPriceHistory(workbook)
  if (currentHistory.length === 0) {
    const existingProcurements = readProcurements(workbook)
    const existingGrades = readProcurementGrades(workbook)
    if (existingProcurements.length > 0 && existingGrades.length > 0) {
      const p1 = existingProcurements[0]
      const p1Grades = existingGrades.filter(
        (g) => g.ProcurementRef.trim() === p1.ProcurementRef.trim(),
      )
      const g1 = p1Grades[0] || existingGrades[0]
      const g2 = p1Grades[1] || existingGrades[1]

      const seededHistory: PriceHistory[] = [
        {
          PriceHistoryID: 1,
          ProcurementRef: p1.ProcurementRef,
          ProcurementGradeID: g1?.ProcurementGradeID || 1,
          ProductType: g1?.ProductType || 'Fresh Logs',
          GradeName: g1?.GradeName || 'K Grade',
          PreviousPrice: Math.max(20, (Number(g1?.AgreedPricePerTonne) || 92) - 6.5),
          NewPrice: Number(g1?.AgreedPricePerTonne) || 92,
          ChangeType: 'Agreed Price Revision',
          Reason: 'Haulage distance allowance adjustment',
          EffectiveDateTime: '2025-01-15 09:30:00',
          Notes: 'Negotiated rate revision due to plantation access track upgrading',
          RecordedBy: 'Vincent Chan',
          RecordedDateTime: '2025-01-15 09:30:00',
        },
      ]

      if (g2) {
        seededHistory.push({
          PriceHistoryID: 2,
          ProcurementRef: p1.ProcurementRef,
          ProcurementGradeID: g2?.ProcurementGradeID || 2,
          ProductType: g2?.ProductType || 'Fresh Logs',
          GradeName: g2?.GradeName || 'A Grade',
          PreviousPrice: Math.max(20, (Number(g2?.AgreedPricePerTonne) || 105) - 8),
          NewPrice: Number(g2?.AgreedPricePerTonne) || 105,
          ChangeType: 'Agreed Price Revision',
          Reason: 'Export market benchmark quarterly indexation',
          EffectiveDateTime: '2025-02-01 14:15:00',
          Notes: 'Aligned with sawmill quarterly procurement rate card',
          RecordedBy: 'Vincent Chan',
          RecordedDateTime: '2025-02-01 14:15:00',
        })
      }

      setRows(workbook, 'PriceHistory', HEADERS.PriceHistory, seededHistory as any)
    }

    // Seed sample costing calculation if empty
    const currentCostings = readCostings(workbook)
    if (currentCostings.length === 0) {
      const seededCosting: CostingRecord = {
        CostingID: 1,
        CostingRef: 'CST-2026-001',
        DestinationCountry: 'China',
        SellingPriceEntered: 145,
        SellingPriceCurrency: 'USD',
        SellingPriceUSD: 145,
        SellingPriceAUD: 221.37,
        SellingPriceRMB: 1045.0,
        ExchangeRateAUD_USD: 0.655,
        ExchangeRateAUD_CNY: 4.72,
        RateSource: 'Reserve Bank of Australia (RBA) Reference Rates',
        RateDate: '2026-03-15',
        CustomsClearanceRMB: 35.0,
        CustomsClearanceAUD: 7.42,
        SeaFreightAUD: 42.0,
        FumigationAUD: 6.5,
        PackingAUD: 12.0,
        TraderCommissionAUD: 5.0,
        TraderCommissionRate: 5.0,
        TraderCommissionType: '$',
        TotalDeductionsAUD: 72.92,
        MillDoorPriceAUD: 148.45,
        MillDoorPriceUSD: 97.24,
        MillDoorPriceRMB: 700.68,
        CustomerName: 'Rizhao Forest Products Trading',
        GradeOrSpecies: 'Radiata Pine - A Grade',
        Notes: 'Export netback model from Lanshan Port CIF back to Australian mill gate',
        CreatedBy: 'Vincent Chan',
        CreatedDate: '2026-03-15 11:30:00',
      }
      setRows(workbook, 'Costings', HEADERS.Costings, [seededCosting] as any)
    }
  }
}

function saveWorkbookToStorage(path: string, workbook: XLSX.WorkBook): void {
  workbookCache.set(path, workbook)
  try {
    const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
    window.localStorage.setItem(`${STORAGE_PREFIX}${path}`, base64)
  } catch (error) {
    console.warn('Could not persist workbook to localStorage:', error)
  }
}

export function getWorkbook(path: string): XLSX.WorkBook | null {
  if (workbookCache.has(path)) {
    return workbookCache.get(path)!
  }

  try {
    const base64 = window.localStorage.getItem(`${STORAGE_PREFIX}${path}`)
    if (base64) {
      const workbook = XLSX.read(base64, { type: 'base64' })
      populateDefaultsIfEmpty(workbook)
      workbookCache.set(path, workbook)
      return workbook
    }
  } catch (error) {
    console.warn('Could not load workbook from localStorage:', error)
  }

  return null
}

async function fetchBundledWorkbook(path: string): Promise<XLSX.WorkBook | null> {
  const possibleUrls = [
    `/${path}`,
    `/public/${path}`,
    '/log_procurement.xlsx',
    '/logpro.xlsx',
  ]

  for (const url of possibleUrls) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        populateDefaultsIfEmpty(workbook)
        return workbook
      }
    } catch {
      // Continue searching
    }
  }

  return null
}

// ---------------- Exported API object for window.logPro ----------------

export const webLogPro = {
  async openWorkbook(): Promise<WorkbookResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.xlsx'
      input.style.display = 'none'
      document.body.appendChild(input)

      let isHandled = false

      const handleFile = async () => {
        if (isHandled) return
        isHandled = true

        try {
          const file = input.files?.[0]
          if (!file) {
            resolve(null)
            return
          }

          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          populateDefaultsIfEmpty(workbook)
          saveWorkbookToStorage(file.name, workbook)

          resolve({
            path: file.name,
            error: '',
            suppliers: readSuppliers(workbook),
            procurements: readProcurements(workbook),
            grades: readProcurementGrades(workbook),
            priceHistory: readPriceHistory(workbook),
            costings: readCostings(workbook),
          })
        } catch (error: any) {
          resolve({
            path: '',
            error: `LogPro could not read the workbook: ${error?.message || String(error)}`,
            suppliers: [],
          })
        } finally {
          if (input.parentNode) {
            document.body.removeChild(input)
          }
        }
      }

      input.addEventListener('change', handleFile)
      input.addEventListener('cancel', () => {
        if (isHandled) return
        isHandled = true
        if (input.parentNode) {
          document.body.removeChild(input)
        }
        resolve(null)
      })

      input.click()
    })
  },

  async createWorkbook(): Promise<WorkbookResult | null> {
    try {
      const workbook = XLSX.utils.book_new()
      populateDefaultsIfEmpty(workbook)

      const path = 'logpro.xlsx'
      saveWorkbookToStorage(path, workbook)

      return {
        path,
        error: '',
        suppliers: [],
        procurements: [],
        grades: [],
        costings: [],
      }
    } catch (error: any) {
      return {
        path: '',
        error: `LogPro could not create the workbook: ${error?.message || String(error)}`,
        suppliers: [],
      }
    }
  },

  async loadWorkbook(workbookPath: string): Promise<WorkbookResult> {
    let workbook = getWorkbook(workbookPath)

    if (!workbook) {
      workbook = await fetchBundledWorkbook(workbookPath)
      if (workbook) {
        saveWorkbookToStorage(workbookPath, workbook)
      }
    }

    if (!workbook) {
      return {
        path: '',
        error: 'LogPro could not find the workbook.',
        suppliers: [],
      }
    }

    populateDefaultsIfEmpty(workbook)

    return {
      path: workbookPath,
      error: '',
      suppliers: readSuppliers(workbook),
      procurements: readProcurements(workbook),
      grades: readProcurementGrades(workbook),
      priceHistory: readPriceHistory(workbook),
      costings: readCostings(workbook),
    }
  },

  exportWorkbookFile(workbookPath: string): void {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) {
      alert('No workbook data available to download.')
      return
    }

    const filename = workbookPath.endsWith('.xlsx')
      ? workbookPath
      : `${workbookPath}.xlsx`

    XLSX.writeFile(workbook, filename)
  },

  // ---- Suppliers & Contacts ----

  async saveSupplier(
    workbookPath: string,
    supplierInput: SupplierInput,
  ): Promise<{ suppliers: Supplier[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) {
      return { suppliers: [], error: 'No workbook is currently open.' }
    }

    const name = String(supplierInput?.name || '').trim()
    if (!name) {
      return { suppliers: [], error: 'Supplier name is required.' }
    }

    try {
      const suppliers = readSuppliers(workbook)
      const prefix = createSupplierPrefix(name)
      const usedNumbers = suppliers
        .map((r) => String(r.SupplierReference || ''))
        .filter((ref) => ref.startsWith(`${prefix}-`))
        .map((ref) => Number(ref.slice(4)))
        .filter((num) => Number.isInteger(num) && num > 0)

      const nextNum = usedNumbers.length === 0 ? 1 : Math.max(...usedNumbers) + 1
      const supplierRef = `${prefix}-${String(nextNum).padStart(4, '0')}`
      const newId = suppliers.length + 1

      const newSupplier: Supplier = {
        SupplierID: newId,
        SupplierReference: supplierRef,
        SupplierName: name,
        Address: String(supplierInput.address || '').trim(),
        ABN: String(supplierInput.abn || '').trim(),
        PaymentTerms: String(supplierInput.paymentTerms || '').trim(),
        Phone: String(supplierInput.phone || '').trim(),
        Email: String(supplierInput.email || '').trim(),
        Notes: String(supplierInput.notes || '').trim(),
        CreatedBy: 'Current User',
        CreatedDate: formatTimestamp(),
        CreatedAt: formatTimestamp(),
        ChangedBy: 'Current User',
        ChangedDate: formatTimestamp(),
      }

      suppliers.push(newSupplier)
      setRows(workbook, 'Suppliers', HEADERS.Suppliers, suppliers as any)
      saveWorkbookToStorage(workbookPath, workbook)

      return { suppliers, error: '' }
    } catch (e: any) {
      return { suppliers: [], error: e?.message || String(e) }
    }
  },

  async saveSupplierContact(
    workbookPath: string,
    contactInput: Partial<SupplierContact>,
  ): Promise<{ contacts: SupplierContact[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) {
      return { contacts: [], error: 'No workbook is open.' }
    }

    if (!contactInput.ContactName?.trim()) {
      return { contacts: [], error: 'Contact name is required.' }
    }
    if (!contactInput.SupplierID) {
      return { contacts: [], error: 'Please associate contact with a supplier.' }
    }

    try {
      const allContacts = readSupplierContacts(workbook)
      const nextId = allContacts.length + 1

      const newContact: SupplierContact = {
        ContactID: nextId,
        SupplierID: contactInput.SupplierID,
        ContactName: contactInput.ContactName.trim(),
        Role: contactInput.Role?.trim() || '',
        PhoneNumber: contactInput.PhoneNumber?.trim() || '',
        MobileNumber: contactInput.MobileNumber?.trim() || '',
        Email: contactInput.Email?.trim() || '',
        Notes: contactInput.Notes?.trim() || '',
        IsPrimary: Boolean(contactInput.IsPrimary),
      }

      allContacts.push(newContact)
      setRows(workbook, 'SupplierContacts', HEADERS.SupplierContacts, allContacts as any)
      saveWorkbookToStorage(workbookPath, workbook)

      return { contacts: allContacts, error: '' }
    } catch (e: any) {
      return { contacts: [], error: e?.message || String(e) }
    }
  },

  getSupplierContacts(
    workbookPath: string,
    supplierId?: string | number,
  ): SupplierContact[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readSupplierContacts(workbook, supplierId)
  },

  // ---- Procurements & Grades ----

  getProcurements(workbookPath: string): Procurement[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readProcurements(workbook)
  },

  getProcurementGrades(
    workbookPath: string,
    procurementRef?: string,
  ): ProcurementGrade[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readProcurementGrades(workbook, procurementRef)
  },

  async saveProcurement(
    workbookPath: string,
    data: Partial<Procurement>,
    grades: Partial<ProcurementGrade>[],
  ): Promise<{ procurement: Procurement; grades: ProcurementGrade[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) {
      return { procurement: null as any, grades: [], error: 'No workbook is open.' }
    }

    try {
      const procurements = readProcurements(workbook)
      const ref = getNextProcurementRef(workbook)
      const now = formatTimestamp()

      const newProcurement: Procurement = {
        ProcurementID: procurements.length + 1,
        ProcurementRef: ref,
        SupplierID: String(data.SupplierID || ''),
        ContactID: String(data.ContactID || ''),
        AgreementType: data.AgreementType || 'Coupe',
        AgreementDetail: String(data.AgreementDetail || '').trim(),
        Plantation: String(data.Plantation || '').trim(),
        Species: String(data.Species || '').trim(),
        HarvestPeriodStart: String(data.HarvestPeriodStart || '').trim(),
        HarvestPeriodEnd: String(data.HarvestPeriodEnd || '').trim(),
        StartDate: String(data.StartDate || '').trim(),
        EndDate: String(data.EndDate || '').trim(),
        Status: data.Status || 'Draft',
        AcceptanceDate: String(data.AcceptanceDate || '').trim(),
        AcceptanceTime: String(data.AcceptanceTime || '').trim(),
        AcceptanceMethod: data.AcceptanceMethod || 'In Person',
        AcceptedByPerson: String(data.AcceptedByPerson || '').trim(),
        AcceptanceNotes: String(data.AcceptanceNotes || '').trim(),
        Notes: String(data.Notes || '').trim(),
        CreatedBy: 'Current User',
        CreatedDate: now,
        ChangedBy: 'Current User',
        ChangedDate: now,
      }

      procurements.push(newProcurement)
      setRows(workbook, 'Procurements', HEADERS.Procurements, procurements as any)

      // Add Grade Rows
      const existingAllGrades = readProcurementGrades(workbook)
      let nextGradeId = existingAllGrades.length + 1

      const savedGrades: ProcurementGrade[] = []
      for (const g of grades) {
        const agreed = Number(g.AgreedTonnes) || 0
        const delivered = Number(g.DeliveredTonnes) || 0
        const remaining = Math.max(0, agreed - delivered)

        const newGrade: ProcurementGrade = {
          ProcurementGradeID: nextGradeId++,
          ProcurementRef: ref,
          Species: String(g.Species || newProcurement.Species || ''),
          ProductType: g.ProductType || 'Fresh Logs',
          GradeName: String(g.GradeName || ''),
          OfferedPricePerTonne: Number(g.OfferedPricePerTonne) || 0,
          AgreedPricePerTonne: Number(g.AgreedPricePerTonne) || 0,
          AgreedTonnes: agreed,
          DeliveredTonnes: delivered,
          RemainingTonnes: remaining,
          Notes: String(g.Notes || ''),
        }
        savedGrades.push(newGrade)
        existingAllGrades.push(newGrade)
      }

      setRows(
        workbook,
        'ProcurementGrades',
        HEADERS.ProcurementGrades,
        existingAllGrades as any,
      )

      saveWorkbookToStorage(workbookPath, workbook)

      return {
        procurement: newProcurement,
        grades: savedGrades,
        error: '',
      }
    } catch (e: any) {
      return {
        procurement: null as any,
        grades: [],
        error: e?.message || String(e),
      }
    }
  },

  async updateProcurement(
    workbookPath: string,
    procurementRef: string,
    data: Partial<Procurement>,
    grades: Partial<ProcurementGrade>[],
  ): Promise<{ procurement: Procurement; grades: ProcurementGrade[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) {
      return { procurement: null as any, grades: [], error: 'No workbook is open.' }
    }

    try {
      const procurements = readProcurements(workbook)
      const targetIndex = procurements.findIndex(
        (p) => p.ProcurementRef.trim() === procurementRef.trim(),
      )

      if (targetIndex === -1) {
        return {
          procurement: null as any,
          grades: [],
          error: `Procurement ${procurementRef} was not found.`,
        }
      }

      const now = formatTimestamp()
      const existing = procurements[targetIndex]

      const updatedProcurement: Procurement = {
        ...existing,
        SupplierID: data.SupplierID !== undefined ? String(data.SupplierID) : existing.SupplierID,
        ContactID: data.ContactID !== undefined ? String(data.ContactID) : existing.ContactID,
        AgreementType: data.AgreementType || existing.AgreementType,
        AgreementDetail: data.AgreementDetail !== undefined ? String(data.AgreementDetail) : existing.AgreementDetail,
        Plantation: data.Plantation !== undefined ? String(data.Plantation) : existing.Plantation,
        Species: data.Species !== undefined ? String(data.Species) : existing.Species,
        HarvestPeriodStart: data.HarvestPeriodStart !== undefined ? String(data.HarvestPeriodStart) : existing.HarvestPeriodStart,
        HarvestPeriodEnd: data.HarvestPeriodEnd !== undefined ? String(data.HarvestPeriodEnd) : existing.HarvestPeriodEnd,
        StartDate: data.StartDate !== undefined ? String(data.StartDate) : existing.StartDate,
        EndDate: data.EndDate !== undefined ? String(data.EndDate) : existing.EndDate,
        Status: data.Status || existing.Status,
        AcceptanceDate: data.AcceptanceDate !== undefined ? String(data.AcceptanceDate) : existing.AcceptanceDate,
        AcceptanceTime: data.AcceptanceTime !== undefined ? String(data.AcceptanceTime) : existing.AcceptanceTime,
        AcceptanceMethod: data.AcceptanceMethod || existing.AcceptanceMethod,
        AcceptedByPerson: data.AcceptedByPerson !== undefined ? String(data.AcceptedByPerson) : existing.AcceptedByPerson,
        AcceptanceNotes: data.AcceptanceNotes !== undefined ? String(data.AcceptanceNotes) : existing.AcceptanceNotes,
        Notes: data.Notes !== undefined ? String(data.Notes) : existing.Notes,
        ChangedBy: 'Current User',
        ChangedDate: now,
      }

      procurements[targetIndex] = updatedProcurement
      setRows(workbook, 'Procurements', HEADERS.Procurements, procurements as any)

      // Replace grades for this procurementRef
      const allGrades = readProcurementGrades(workbook)
      const otherGrades = allGrades.filter(
        (g) => g.ProcurementRef.trim() !== procurementRef.trim(),
      )

      let nextGradeId = Math.max(0, ...allGrades.map((g) => Number(g.ProcurementGradeID) || 0)) + 1
      const updatedGradesList: ProcurementGrade[] = []

      for (const g of grades) {
        const agreed = Number(g.AgreedTonnes) || 0
        const delivered = Number(g.DeliveredTonnes) || 0
        const remaining = Math.max(0, agreed - delivered)

        const newGrade: ProcurementGrade = {
          ProcurementGradeID: g.ProcurementGradeID || nextGradeId++,
          ProcurementRef: procurementRef,
          Species: String(g.Species || updatedProcurement.Species || ''),
          ProductType: g.ProductType || 'Fresh Logs',
          GradeName: String(g.GradeName || ''),
          OfferedPricePerTonne: Number(g.OfferedPricePerTonne) || 0,
          AgreedPricePerTonne: Number(g.AgreedPricePerTonne) || 0,
          AgreedTonnes: agreed,
          DeliveredTonnes: delivered,
          RemainingTonnes: remaining,
          Notes: String(g.Notes || ''),
        }
        updatedGradesList.push(newGrade)
      }

      const combinedGrades = [...otherGrades, ...updatedGradesList]
      setRows(
        workbook,
        'ProcurementGrades',
        HEADERS.ProcurementGrades,
        combinedGrades as any,
      )

      // Audit Price History for any price changes
      const existingRefGrades = allGrades.filter(
        (g) => g.ProcurementRef.trim().toLowerCase() === procurementRef.trim().toLowerCase(),
      )
      const currentHistory = readPriceHistory(workbook)
      let historyAdded = false

      for (const newG of updatedGradesList) {
        const oldG = existingRefGrades.find(
          (og) =>
            (og.ProcurementGradeID && og.ProcurementGradeID === newG.ProcurementGradeID) ||
            (og.GradeName.trim().toLowerCase() === newG.GradeName.trim().toLowerCase() &&
              og.ProductType === newG.ProductType),
        )
        if (
          oldG &&
          Number(oldG.AgreedPricePerTonne) > 0 &&
          Number(newG.AgreedPricePerTonne) > 0 &&
          Math.abs(Number(oldG.AgreedPricePerTonne) - Number(newG.AgreedPricePerTonne)) > 0.001
        ) {
          const reason =
            (data as any).priceChangeReason?.trim() ||
            'Agreed price renegotiation / update'
          const effectiveDate =
            (data as any).priceChangeEffectiveDate?.trim() || now
          const notes = (data as any).priceChangeNotes?.trim() || ''

          currentHistory.push({
            PriceHistoryID: currentHistory.length + 1,
            ProcurementRef: procurementRef,
            ProcurementGradeID: newG.ProcurementGradeID || oldG.ProcurementGradeID,
            ProductType: newG.ProductType,
            GradeName: newG.GradeName,
            PreviousPrice: Number(oldG.AgreedPricePerTonne),
            NewPrice: Number(newG.AgreedPricePerTonne),
            ChangeType: 'Agreed Price Revision',
            Reason: reason,
            EffectiveDateTime: effectiveDate,
            Notes: notes,
            RecordedBy: 'Current User',
            RecordedDateTime: now,
          })
          historyAdded = true
        }
      }

      if (historyAdded) {
        setRows(workbook, 'PriceHistory', HEADERS.PriceHistory, currentHistory as any)
      }

      saveWorkbookToStorage(workbookPath, workbook)

      return {
        procurement: updatedProcurement,
        grades: updatedGradesList,
        error: '',
      }
    } catch (e: any) {
      return {
        procurement: null as any,
        grades: [],
        error: e?.message || String(e),
      }
    }
  },

  // ---- Price History ----

  getPriceHistory(
    workbookPath: string,
    procurementRef?: string,
  ): PriceHistory[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readPriceHistory(workbook, procurementRef)
  },

  async recordPriceHistory(
    workbookPath: string,
    record: Partial<PriceHistory>,
    updateGradePrice = true,
  ): Promise<{ priceHistory: PriceHistory[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return { priceHistory: [], error: 'No workbook is open.' }

    try {
      const history = readPriceHistory(workbook)
      const now = formatTimestamp()
      const newRecord: PriceHistory = {
        PriceHistoryID: history.length + 1,
        ProcurementRef: String(record.ProcurementRef || '').trim(),
        ProcurementGradeID: record.ProcurementGradeID,
        ProductType: String(record.ProductType || 'Fresh Logs'),
        GradeName: String(record.GradeName || '').trim(),
        PreviousPrice: Number(record.PreviousPrice) || 0,
        NewPrice: Number(record.NewPrice) || 0,
        ChangeType: String(record.ChangeType || 'Agreed Price Revision'),
        Reason: String(record.Reason || 'Price adjustment').trim(),
        EffectiveDateTime: String(record.EffectiveDateTime || now).trim(),
        Notes: String(record.Notes || '').trim(),
        RecordedBy: String(record.RecordedBy || 'Current User').trim(),
        RecordedDateTime: now,
      }

      history.push(newRecord)
      setRows(workbook, 'PriceHistory', HEADERS.PriceHistory, history as any)

      if (updateGradePrice && newRecord.ProcurementRef && newRecord.GradeName) {
        const allGrades = readProcurementGrades(workbook)
        let gradeUpdated = false
        for (const g of allGrades) {
          if (
            g.ProcurementRef.trim().toLowerCase() === newRecord.ProcurementRef.trim().toLowerCase() &&
            g.GradeName.trim().toLowerCase() === newRecord.GradeName.trim().toLowerCase() &&
            (!newRecord.ProductType || g.ProductType.trim().toLowerCase() === newRecord.ProductType.trim().toLowerCase())
          ) {
            g.AgreedPricePerTonne = newRecord.NewPrice
            gradeUpdated = true
          }
        }
        if (gradeUpdated) {
          setRows(workbook, 'ProcurementGrades', HEADERS.ProcurementGrades, allGrades as any)
        }
      }

      saveWorkbookToStorage(workbookPath, workbook)
      return { priceHistory: history, error: '' }
    } catch (e: any) {
      return { priceHistory: [], error: e?.message || String(e) }
    }
  },

  // ---- Species & Grade Settings ----

  getSpecies(workbookPath: string): SpeciesDefinition[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readSpeciesDefinitions(workbook)
  },

  getGrades(workbookPath: string): GradeDefinition[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readGradeDefinitions(workbook)
  },

  async addSpecies(
    workbookPath: string,
    speciesName: string,
    notes = 'User-added species',
  ): Promise<{ species: SpeciesDefinition[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return { species: [], error: 'No workbook is open.' }

    const clean = speciesName.trim()
    if (!clean) return { species: [], error: 'Species name is required.' }

    const species = readSpeciesDefinitions(workbook)
    if (species.some((s) => s.SpeciesName.toLowerCase() === clean.toLowerCase())) {
      return { species, error: 'Species already exists.' }
    }

    const newSpecies: SpeciesDefinition = {
      SpeciesDefinitionID: species.length + 1,
      SpeciesName: clean,
      IsStandard: false,
      Notes: notes,
    }

    species.push(newSpecies)
    setRows(workbook, 'SpeciesDefinitions', HEADERS.SpeciesDefinitions, species as any)

    // Also populate standard grades for this species
    const grades = readGradeDefinitions(workbook)
    let nextGradeId = grades.length + 1
    for (const [prodType, gradeList] of Object.entries(STANDARD_GRADES)) {
      for (const grade of gradeList) {
        grades.push({
          GradeDefinitionID: nextGradeId++,
          SpeciesName: clean,
          ProductType: prodType as 'Fresh Logs' | 'Burnt Logs',
          GradeName: grade,
          IsStandard: true,
          Notes: 'Standard grade from Log Procurement reference PDF',
        })
      }
    }
    setRows(workbook, 'GradeDefinitions', HEADERS.GradeDefinitions, grades as any)
    saveWorkbookToStorage(workbookPath, workbook)

    return { species, error: '' }
  },

  async addGrade(
    workbookPath: string,
    speciesName: string,
    productType: 'Fresh Logs' | 'Burnt Logs',
    gradeName: string,
    notes = 'User-added grade',
  ): Promise<{ grades: GradeDefinition[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return { grades: [], error: 'No workbook is open.' }

    const clean = gradeName.trim()
    if (!clean) return { grades: [], error: 'Grade name is required.' }

    const grades = readGradeDefinitions(workbook)
    const exists = grades.some(
      (g) =>
        g.ProductType === productType &&
        g.GradeName.toLowerCase() === clean.toLowerCase() &&
        (!speciesName || !g.SpeciesName || g.SpeciesName.toLowerCase() === speciesName.toLowerCase()),
    )
    if (exists) {
      return { grades, error: 'This grade already exists for the selected category.' }
    }

    grades.push({
      GradeDefinitionID: grades.length + 1,
      SpeciesName: speciesName.trim(),
      ProductType: productType,
      GradeName: clean,
      IsStandard: false,
      Notes: notes,
    })

    setRows(workbook, 'GradeDefinitions', HEADERS.GradeDefinitions, grades as any)
    saveWorkbookToStorage(workbookPath, workbook)

    return { grades, error: '' }
  },

  // ---- Costings & Reverse Netback ----

  getCostings(workbookPath: string): CostingRecord[] {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return []
    return readCostings(workbook)
  },

  async saveCosting(
    workbookPath: string,
    costing: Partial<CostingRecord>,
  ): Promise<{ costings: CostingRecord[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return { costings: [], error: 'No workbook is open.' }

    try {
      const costings = readCostings(workbook)
      const now = formatTimestamp()

      const newRecord: CostingRecord = {
        CostingID: costing.CostingID || costings.length + 1,
        CostingRef:
          costing.CostingRef || `CST-${String(costings.length + 1).padStart(3, '0')}`,
        DestinationCountry: costing.DestinationCountry || 'China',
        SellingPriceEntered: Number(costing.SellingPriceEntered) || 0,
        SellingPriceCurrency: costing.SellingPriceCurrency || 'USD',
        SellingPriceAUD: Number(costing.SellingPriceAUD) || 0,
        SellingPriceUSD: Number(costing.SellingPriceUSD) || 0,
        SellingPriceRMB: Number(costing.SellingPriceRMB) || 0,
        ExchangeRateAUD_USD: Number(costing.ExchangeRateAUD_USD) || 0.655,
        ExchangeRateAUD_CNY: Number(costing.ExchangeRateAUD_CNY) || 4.72,
        RateSource:
          costing.RateSource ||
          'Reserve Bank of Australia (RBA) Reference Rates',
        RateDate: costing.RateDate || now.split(' ')[0],
        CustomsClearanceRMB: Number(costing.CustomsClearanceRMB) || 0,
        CustomsClearanceAUD: Number(costing.CustomsClearanceAUD) || 0,
        SeaFreightAUD: Number(costing.SeaFreightAUD) || 0,
        FumigationAUD: Number(costing.FumigationAUD) || 0,
        PackingAUD: Number(costing.PackingAUD) || 0,
        TraderCommissionAUD: Number(costing.TraderCommissionAUD) || 0,
        TraderCommissionRate: Number(costing.TraderCommissionRate) || 0,
        TraderCommissionType: costing.TraderCommissionType || '$',
        TotalDeductionsAUD: Number(costing.TotalDeductionsAUD) || 0,
        MillDoorPriceAUD: Number(costing.MillDoorPriceAUD) || 0,
        MillDoorPriceUSD: Number(costing.MillDoorPriceUSD) || 0,
        MillDoorPriceRMB: Number(costing.MillDoorPriceRMB) || 0,
        CustomerName: String(costing.CustomerName || '').trim(),
        GradeOrSpecies: String(costing.GradeOrSpecies || '').trim(),
        Notes: String(costing.Notes || '').trim(),
        CreatedBy: costing.CreatedBy || 'Vincent Chan',
        CreatedDate: costing.CreatedDate || now,
      }

      const existingIndex = costings.findIndex(
        (c) =>
          c.CostingID === newRecord.CostingID ||
          (newRecord.CostingRef && c.CostingRef === newRecord.CostingRef),
      )

      if (existingIndex >= 0) {
        costings[existingIndex] = newRecord
      } else {
        costings.unshift(newRecord)
      }

      setRows(workbook, 'Costings', HEADERS.Costings, costings as any)
      saveWorkbookToStorage(workbookPath, workbook)

      return { costings, error: '' }
    } catch (e: any) {
      return { costings: [], error: e?.message || String(e) }
    }
  },

  async deleteCosting(
    workbookPath: string,
    costingId: string | number,
  ): Promise<{ costings: CostingRecord[]; error: string }> {
    const workbook = getWorkbook(workbookPath)
    if (!workbook) return { costings: [], error: 'No workbook is open.' }

    try {
      const costings = readCostings(workbook).filter(
        (c) =>
          String(c.CostingID) !== String(costingId) &&
          String(c.CostingRef) !== String(costingId),
      )
      setRows(workbook, 'Costings', HEADERS.Costings, costings as any)
      saveWorkbookToStorage(workbookPath, workbook)
      return { costings, error: '' }
    } catch (e: any) {
      return { costings: [], error: e?.message || String(e) }
    }
  },
}

export function initWebLogPro(): void {
  try {
    if (window.localStorage.getItem(LAST_WORKBOOK_KEY) === null) {
      // Default to the rich log_procurement.xlsx file
      window.localStorage.setItem(LAST_WORKBOOK_KEY, 'log_procurement.xlsx')
    }
  } catch {
    // Ignore storage errors
  }

  // Bind to window.logPro
  ;(window as any).logPro = webLogPro
}
