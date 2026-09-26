import type {
  Supplier,
  SupplierContact,
  Procurement,
  ProcurementGrade,
  PriceHistory,
  CostingRecord as LegacyCostingRecord,
  SpeciesDefinition,
  GradeDefinition,
  WorkbookResult,
  TimelineEvent,
} from './types'

import type {
  CostingInput,
  CostingListResult,
  RatesResult,
} from './costing'

export type SupplierInput = {
  name: string
  abn: string
  phone: string
  email: string
  notes: string
  address?: string
  paymentTerms?: string
}

declare global {
  interface Window {
    logPro: {
      openWorkbook: () => Promise<WorkbookResult | null>
      createWorkbook: () => Promise<WorkbookResult | null>
      loadWorkbook: (workbookPath: string) => Promise<WorkbookResult>
      exportWorkbookFile: (workbookPath: string) => void

      saveSupplier: (
        workbookPath: string,
        supplier: SupplierInput,
        suppliers?: Supplier[],
      ) => Promise<{
        suppliers: Supplier[]
        error: string
      }>

      updateSupplier: (
        workbookPath: string,
        supplierId: string | number,
        supplier: Partial<SupplierInput> & {
          SupplierName?: string
          Address?: string
          ABN?: string
          PaymentTerms?: string
          Phone?: string
          Email?: string
          Notes?: string
        },
      ) => Promise<{
        suppliers: Supplier[]
        error: string
      }>

      deleteSupplier: (
        workbookPath: string,
        supplierId: string | number,
      ) => Promise<{
        suppliers: Supplier[]
        error: string
      }>

      saveSupplierContact: (
        workbookPath: string,
        contactInput: Partial<SupplierContact>,
      ) => Promise<{
        contacts: SupplierContact[]
        error: string
      }>

      updateSupplierContact: (
        workbookPath: string,
        contactId: string | number,
        contactInput: Partial<SupplierContact>,
      ) => Promise<{
        contacts: SupplierContact[]
        error: string
      }>

      deleteSupplierContact: (
        workbookPath: string,
        contactId: string | number,
      ) => Promise<{
        contacts: SupplierContact[]
        error: string
      }>

      getSupplierContacts: (
        workbookPath: string,
        supplierId?: string | number,
      ) => SupplierContact[]

      getProcurements: (workbookPath: string) => Procurement[]

      getProcurementGrades: (
        workbookPath: string,
        procurementRef?: string,
      ) => ProcurementGrade[]

      saveProcurement: (
        workbookPath: string,
        data: Partial<Procurement>,
        grades: Partial<ProcurementGrade>[],
      ) => Promise<{
        procurement: Procurement
        grades: ProcurementGrade[]
        error: string
      }>

      updateProcurement: (
        workbookPath: string,
        procurementRef: string,
        data: Partial<Procurement> & {
          priceChangeReason?: string
          priceChangeEffectiveDate?: string
          priceChangeNotes?: string
        },
        grades: Partial<ProcurementGrade>[],
      ) => Promise<{
        procurement: Procurement
        grades: ProcurementGrade[]
        error: string
      }>

      deleteProcurement: (
        workbookPath: string,
        procurementRef: string,
      ) => Promise<{ error: string }>

      getProcurementTimeline: (
        workbookPath: string,
        procurementRef: string,
      ) => TimelineEvent[]

      addProcurementNote: (
        workbookPath: string,
        procurementRef: string,
        noteText: string,
      ) => Promise<{ error: string }>

      getPriceHistory: (
        workbookPath: string,
        procurementRef?: string,
      ) => PriceHistory[]

      recordPriceHistory: (
        workbookPath: string,
        record: Partial<PriceHistory>,
        updateGradePrice?: boolean,
      ) => Promise<{
        priceHistory: PriceHistory[]
        error: string
      }>

      getSpecies: (workbookPath: string) => SpeciesDefinition[]

      getGrades: (workbookPath: string) => GradeDefinition[]

      addSpecies: (
        workbookPath: string,
        speciesName: string,
        notes?: string,
      ) => Promise<{
        species: SpeciesDefinition[]
        error: string
      }>

      updateSpecies: (
        workbookPath: string,
        speciesId: string | number,
        data: {
          speciesName: string
          notes?: string
        },
      ) => Promise<{
        species: SpeciesDefinition[]
        error: string
      }>

      deleteSpecies: (
        workbookPath: string,
        speciesId: string | number,
      ) => Promise<{
        species: SpeciesDefinition[]
        error: string
      }>

      addGrade: (
        workbookPath: string,
        speciesName: string,
        productType: 'Green Logs' | 'Burnt Logs',
        gradeName: string,
        notes?: string,
        supplierId?: string | number,
        supplierName?: string,
      ) => Promise<{
        grades: GradeDefinition[]
        error: string
      }>

      updateGrade: (
        workbookPath: string,
        gradeId: string | number,
        data: {
          gradeName: string
          speciesName?: string
          productType?: 'Green Logs' | 'Burnt Logs'
          supplierId?: string | number
          supplierName?: string
          notes?: string
        },
      ) => Promise<{
        grades: GradeDefinition[]
        error: string
      }>

      deleteGrade: (
        workbookPath: string,
        gradeId: string | number,
      ) => Promise<{
        grades: GradeDefinition[]
        error: string
      }>

      getCostings: (
        workbookPath: string,
      ) => LegacyCostingRecord[]

      saveCosting: {
        (
          workbookPath: string,
          costing: Partial<LegacyCostingRecord>,
        ): Promise<{
          costings: LegacyCostingRecord[]
          error: string
        }>

        (
          workbookPath: string,
          costing: CostingInput,
        ): Promise<CostingListResult>

        (
          workbookPath: string,
          costing: any,
        ): Promise<any>
      }

      deleteCosting: (
        workbookPath: string,
        costingId: string | number,
      ) => Promise<{
        costings: LegacyCostingRecord[]
        error: string
      }>

      getRates: () => Promise<RatesResult>

      listCostings: (
        workbookPath: string,
      ) => Promise<CostingListResult>
    }
  }
}

export {}