import {
  Supplier,
  SupplierContact,
  Procurement,
  ProcurementGrade,
  PriceHistory,
  CostingRecord,
  SpeciesDefinition,
  GradeDefinition,
  WorkbookResult,
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
      ) => Promise<{ species: SpeciesDefinition[]; error: string }>
      addGrade: (
        workbookPath: string,
        speciesName: string,
        productType: 'Fresh Logs' | 'Burnt Logs',
        gradeName: string,
        notes?: string,
      ) => Promise<{ grades: GradeDefinition[]; error: string }>

      getCostings: (workbookPath: string) => CostingRecord[]
      saveCosting: (
        workbookPath: string,
        costing: Partial<CostingRecord>,
      ) => Promise<{ costings: CostingRecord[]; error: string }>
      deleteCosting: (
        workbookPath: string,
        costingId: string | number,
      ) => Promise<{ costings: CostingRecord[]; error: string }>
    }
  }
}
