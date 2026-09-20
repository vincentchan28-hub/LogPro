export type Page =
  | 'home'
  | 'procurements'
  | 'priceHistory'
  | 'suppliers'
  | 'costing'
  | 'reports'
  | 'resales'
  | 'settings'

export type Supplier = {
  SupplierID?: number | string
  SupplierReference?: string
  SupplierName: string
  Address?: string
  ABN?: string
  PaymentTerms?: string
  Phone?: string
  Email?: string
  Notes?: string
  CreatedBy?: string
  CreatedAt?: string
  CreatedDate?: string
  ChangedBy?: string
  ChangedDate?: string
}

export type SupplierContact = {
  ContactID?: number | string
  SupplierID: number | string
  ContactName: string
  Role: string
  PhoneNumber: string
  MobileNumber: string
  Email: string
  Notes: string
  IsPrimary: boolean
}

export type Procurement = {
  ProcurementID?: number | string
  ProcurementRef: string
  SupplierID: number | string
  ContactID: number | string
  AgreementType: 'Block' | 'Coupe' | 'Harvest' | 'Contract Number' | string
  AgreementDetail: string
  Plantation: string
  Species: string
  HarvestPeriodStart: string
  HarvestPeriodEnd: string
  StartDate: string
  EndDate: string
  Status: 'Draft' | 'Waiting for Acceptance' | 'Accepted' | 'Active' | 'Completed' | 'Cancelled' | string
  AcceptanceDate: string
  AcceptanceTime: string
  AcceptanceMethod: 'Email' | 'Phone' | 'In Person' | string
  AcceptedByPerson: string
  AcceptanceNotes: string
  Notes: string
  CreatedBy?: string
  CreatedDate?: string
  ChangedBy?: string
  ChangedDate?: string
}

export type ProcurementGrade = {
  ProcurementGradeID?: number | string
  ProcurementRef: string
  Species: string
  ProductType: 'Fresh Logs' | 'Burnt Logs' | string
  GradeName: string
  OfferedPricePerTonne: number
  AgreedPricePerTonne: number
  AgreedTonnes: number
  DeliveredTonnes: number
  RemainingTonnes: number
  Notes?: string
}

export type SpeciesDefinition = {
  SpeciesDefinitionID?: number | string
  SpeciesName: string
  IsStandard: boolean
  Notes: string
}

export type GradeDefinition = {
  GradeDefinitionID?: number | string
  SpeciesName?: string
  ProductType: 'Fresh Logs' | 'Burnt Logs' | string
  GradeName: string
  IsStandard: boolean
  Notes: string
}

export type PriceHistory = {
  PriceHistoryID?: number | string
  ProcurementRef: string
  ProcurementGradeID?: number | string
  ProductType: string
  GradeName: string
  PreviousPrice: number
  NewPrice: number
  ChangeType: string
  Reason: string
  EffectiveDateTime: string
  Notes: string
  RecordedBy: string
  RecordedDateTime: string
}

export const AGREEMENT_TYPES = [
  'Block',
  'Coupe',
  'Harvest',
  'Contract Number',
] as const

export const STATUSES = [
  'Draft',
  'Waiting for Acceptance',
  'Accepted',
  'Active',
  'Completed',
  'Cancelled',
] as const

export const ACCEPTANCE_METHODS = [
  'Email',
  'Phone',
  'In Person',
  'Signed Contract',
] as const

export const PRODUCT_TYPES = ['Fresh Logs', 'Burnt Logs'] as const

export const STANDARD_GRADES: Record<string, string[]> = {
  'Fresh Logs': [
    'SA Grade',
    'A Grade',
    'K Grade',
    'KI Grade',
    'MP Grade',
    'Big MP',
    'Pulp',
  ],
  'Burnt Logs': ['SA Grade', 'A Grade', 'K Grade', 'KI Grade', 'MP Grade'],
}

export type CostingRecord = {
  CostingID?: number | string
  CostingRef?: string
  DestinationCountry: string
  SellingPriceEntered: number
  SellingPriceCurrency: 'USD' | 'RMB'
  SellingPriceAUD: number
  SellingPriceUSD: number
  SellingPriceRMB: number
  ExchangeRateAUD_USD: number
  ExchangeRateAUD_CNY: number
  RateSource: string
  RateDate?: string
  CustomsClearanceRMB: number
  CustomsClearanceAUD: number
  SeaFreightAUD: number
  FumigationAUD: number
  PackingAUD: number
  TraderCommissionAUD: number
  TraderCommissionRate?: number
  TraderCommissionType?: '$' | '%'
  TotalDeductionsAUD: number
  MillDoorPriceAUD: number
  MillDoorPriceUSD: number
  MillDoorPriceRMB: number
  CustomerName?: string
  GradeOrSpecies?: string
  Notes?: string
  CreatedBy?: string
  CreatedDate?: string
}

export type WorkbookResult = {
  path: string
  error: string
  suppliers: Supplier[]
  procurements?: Procurement[]
  grades?: ProcurementGrade[]
  priceHistory?: PriceHistory[]
  costings?: CostingRecord[]
}
