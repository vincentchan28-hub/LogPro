export type Page =
  | 'home'
  | 'procurements'
  | 'contacts'
  | 'priceHistory'
  | 'suppliers'
  | 'costing'
  | 'reports'
  | 'priceList'
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

export type ProcurementHeaderMode =
  | 'auto'
  | 'contract-number'
  | 'harvest'
  | 'coupe'
  | 'block'
  | 'plantation'
  | 'custom'

export type Procurement = {
  ProcurementID?: number | string
  ProcurementRef: string
  SupplierID: number | string
  ContactID: number | string
  AgreementType: 'Block' | 'Coupe' | 'Harvest' | 'Contract Number' | string
  AgreementDetail: string
  ContractNumber?: string
  Plantation: string
  Species: string
  HarvestPeriodStart: string
  HarvestPeriodEnd: string
  StartDate: string
  EndDate: string
  WeeklyEstimatedTonnes?: number | string
  Status: 'Draft' | 'Waiting for Acceptance' | 'Accepted' | 'Active' | 'Completed' | 'Cancelled' | string
  AcceptanceDate: string
  AcceptanceTime: string
  AcceptanceMethod: 'Email' | 'Phone' | 'In Person' | string
  AcceptedByPerson: string
  AcceptanceNotes: string
  LogSpecFileID?: string
  LogSpecFileName?: string
  LogSpecFileType?: string
  Notes: string
  CreatedBy?: string
  CreatedDate?: string
  ChangedBy?: string
  ChangedDate?: string
  ForceWeeklyForecast?: boolean
  ActivityLog?: string
  CustomHeader?: string
  HeaderDisplayMode?: ProcurementHeaderMode | ''
}

export type ProcurementGrade = {
  ProcurementGradeID?: number | string
  ProcurementRef: string
  Species: string
  ProductType: 'Green' | 'Burnt' | string
  GradeName: string
  OfferedPricePerTonne: number
  AgreedPricePerTonne: number
  ResalePrice: number
  AgreedTonnes: number
  DeliveredTonnes: number
  RemainingTonnes: number
  Notes?: string
  CreatedAt?: string
}

export type SpeciesDefinition = {
  SpeciesDefinitionID?: number | string
  SpeciesName: string
  IsStandard: boolean
  Notes: string
}

export type GradeDefinition = {
  GradeDefinitionID?: number | string
  SupplierID?: number | string
  SupplierName?: string
  SpeciesName?: string
  ProductType: 'Green' | 'Burnt' | string
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

export type TimelineEvent = {
  id: string
  date: string
  type: 'created' | 'grades_added' | 'price_change' | 'note'
  title: string
  body: string
  html?: boolean
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

export const PRODUCT_TYPES = ['Green', 'Burnt'] as const

export const STANDARD_GRADES: Record<string, string[]> = {
  'Green': [
    'SA Grade',
    'A Grade',
    'K Grade',
    'KI Grade',
    'MP Grade',
    'Big MP',
    'Pulp',
  ],
  'Burnt': ['SA Grade', 'A Grade', 'K Grade', 'KI Grade', 'MP Grade'],
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
