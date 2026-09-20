import type {
  CostingInput,
  CostingListResult,
  RatesResult,
} from './costing'

type Supplier = {
  SupplierReference: string
  SupplierName: string
  ABN: string
  Phone: string
  Email: string
  Notes: string
  CreatedAt: string
}

type SupplierInput = {
  name: string
  abn: string
  phone: string
  email: string
  notes: string
}

type WorkbookResult = {
  path: string
  error: string
  suppliers: Supplier[]
}

declare global {
  interface Window {
    logPro: {
      openWorkbook: () => Promise<WorkbookResult | null>
      createWorkbook: () => Promise<WorkbookResult | null>
      loadWorkbook: (workbookPath: string) => Promise<WorkbookResult>
      saveSupplier: (
        workbookPath: string,
        supplier: SupplierInput,
      ) => Promise<{
        suppliers: Supplier[]
        error: string
      }>
      getRates: () => Promise<RatesResult>
      listCostings: (workbookPath: string) => Promise<CostingListResult>
      saveCosting: (
        workbookPath: string,
        costing: CostingInput,
      ) => Promise<CostingListResult>
    }
  }
}