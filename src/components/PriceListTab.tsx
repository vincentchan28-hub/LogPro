import { Fragment, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type {
  Procurement,
  ProcurementGrade,
  Supplier,
} from '../types'
import { getProcurementHeaderDisplay } from '../utils/procurementHeader'
import { isProcurementAgreed } from '../utils/procurementStatus'
import { ProductTypeBadge } from './ProductTypeBadge'

type PriceListTabProps = {
  workbookPath: string
  procurements: Procurement[]
  suppliers: Supplier[]
  onRefresh: () => void
}

type PriceListColumnKey = 'species' | 'grade' | 'product' | 'agreed' | 'compare' | 'difference'
type PriceListColumnWidths = Record<PriceListColumnKey, number>
type ProductTypeFilter = 'All' | 'Green' | 'Burnt'
type PriceListComparisonRow = {
  key: string
  species: string
  gradeName: string
  productType: string
  selectedGrade?: ProcurementGrade
  comparisonGrade?: ProcurementGrade
}

const PRICE_LIST_COLUMN_WIDTHS_KEY = 'logpro.priceListColumnWidths'
const DEFAULT_PRICE_LIST_COLUMN_WIDTHS: PriceListColumnWidths = {
  species: 130,
  grade: 140,
  product: 120,
  agreed: 190,
  compare: 190,
  difference: 130,
}

const EMPTY_PROCUREMENT_GRADES: ProcurementGrade[] = []

function normalizeSpecies(species: string): string {
  return species.trim().toLocaleLowerCase()
}

function getProcurementSpecies(
  procurement: Procurement | null,
  grades: ProcurementGrade[],
): string[] {
  const speciesByKey = new Map<string, string>()
  ;[procurement?.Species || '', ...grades.map((grade) => grade.Species || '')].forEach((species) => {
    const trimmedSpecies = species.trim()
    const key = normalizeSpecies(trimmedSpecies)
    if (key && !speciesByKey.has(key)) speciesByKey.set(key, trimmedSpecies)
  })
  return Array.from(speciesByKey.values())
}

function getAgreementIdentifier(procurement: Procurement): string {
  const contractNumber = String(procurement.ContractNumber || '').trim()
  if (contractNumber) return contractNumber

  const agreementType = String(procurement.AgreementType || '').trim().toLowerCase()
  const agreementDetail = String(procurement.AgreementDetail || '').trim()
  if (agreementType === 'coupe' && agreementDetail) return `Coupe ${agreementDetail}`
  if (agreementType === 'contract number' && agreementDetail) return agreementDetail
  return getProcurementHeaderDisplay(procurement).text || 'Not entered'
}

function getComparisonGradeKey(grade: ProcurementGrade, fallbackSpecies: string): string {
  return JSON.stringify([
    String(grade.Species || fallbackSpecies || '').trim(),
    String(grade.GradeName || '').trim(),
    String(grade.ProductType || '').trim(),
  ])
}

function getComparablePurchasePrice(grade?: ProcurementGrade): number | null {
  if (!grade || String(grade.AgreedPricePerTonne).trim().toLowerCase().startsWith('c')) {
    return null
  }
  const price = Number(grade.AgreedPricePerTonne)
  return Number.isFinite(price) && price > 0 ? price : null
}

function displayPurchasePrice(grade?: ProcurementGrade): string {
  if (!grade) return '—'
  if (String(grade.AgreedPricePerTonne).trim().toLowerCase().startsWith('c')) {
    return 'Cancelled'
  }
  return `AUD $${Number(grade.AgreedPricePerTonne || 0).toFixed(2)}`
}

function readPriceListColumnWidths(): PriceListColumnWidths {
  try {
    const saved = localStorage.getItem(PRICE_LIST_COLUMN_WIDTHS_KEY)
    if (saved) {
      return {
        ...DEFAULT_PRICE_LIST_COLUMN_WIDTHS,
        ...JSON.parse(saved),
      }
    }
  } catch {
    // Ignore unavailable or invalid saved widths.
  }
  return { ...DEFAULT_PRICE_LIST_COLUMN_WIDTHS }
}

export function PriceListTab({
  workbookPath,
  procurements,
  suppliers,
}: PriceListTabProps) {
  const [selectedProcurementRef, setSelectedProcurementRef] = useState('')
  const [compareProcurementRef, setCompareProcurementRef] = useState('')
  const [columnWidths, setColumnWidths] = useState(readPriceListColumnWidths)
  const [activeResizingColumn, setActiveResizingColumn] = useState<PriceListColumnKey | null>(null)
  const [productTypeFilter, setProductTypeFilter] = useState<ProductTypeFilter>('All')
  const [isProcurementListCollapsed, setIsProcurementListCollapsed] = useState(false)

  const selectedProcurement = useMemo(
    () =>
      procurements.find(
        (procurement) =>
          procurement.ProcurementRef === selectedProcurementRef,
      ) ?? null,
    [procurements, selectedProcurementRef],
  )

  const selectedSupplier = useMemo(
    () =>
      suppliers.find(
        (supplier) =>
          String(supplier.SupplierID) ===
            String(selectedProcurement?.SupplierID) ||
          String(supplier.SupplierReference) ===
            String(selectedProcurement?.SupplierID),
      ) ?? null,
    [suppliers, selectedProcurement],
  )

  const comparisonProcurement = useMemo(
    () => procurements.find((procurement) => procurement.ProcurementRef === compareProcurementRef) ?? null,
    [compareProcurementRef, procurements],
  )
  const comparisonSupplier = useMemo(
    () => suppliers.find(
      (supplier) =>
        String(supplier.SupplierID) === String(comparisonProcurement?.SupplierID) ||
        String(supplier.SupplierReference) === String(comparisonProcurement?.SupplierID),
    ) ?? null,
    [comparisonProcurement, suppliers],
  )

  const procurementGradesByRef = useMemo(() => {
    const gradesByRef: Record<string, ProcurementGrade[]> = {}
    procurements.forEach((procurement) => {
      try {
        gradesByRef[procurement.ProcurementRef] = window.logPro.getProcurementGrades(
          workbookPath,
          procurement.ProcurementRef,
        )
      } catch {
        gradesByRef[procurement.ProcurementRef] = []
      }
    })
    return gradesByRef
  }, [procurements, workbookPath])

  const selectedGrades = procurementGradesByRef[selectedProcurementRef] || EMPTY_PROCUREMENT_GRADES
  const comparisonGrades = procurementGradesByRef[compareProcurementRef] || EMPTY_PROCUREMENT_GRADES
  const selectedSpecies = useMemo(
    () => getProcurementSpecies(selectedProcurement, selectedGrades),
    [selectedGrades, selectedProcurement],
  )
  const selectedSpeciesKeys = useMemo(
    () => new Set(selectedSpecies.map(normalizeSpecies)),
    [selectedSpecies],
  )
  const procurementSpeciesByRef = useMemo(
    () => Object.fromEntries(
      procurements.map((procurement) => [
        procurement.ProcurementRef,
        getProcurementSpecies(
          procurement,
          procurementGradesByRef[procurement.ProcurementRef] || EMPTY_PROCUREMENT_GRADES,
        ),
      ]),
    ),
    [procurements, procurementGradesByRef],
  )
  const comparableProcurements = useMemo(
    () => procurements.filter((procurement) =>
      procurement.ProcurementRef !== selectedProcurementRef &&
      (procurementSpeciesByRef[procurement.ProcurementRef] || []).some((species) =>
        selectedSpeciesKeys.has(normalizeSpecies(species)),
      ),
    ),
    [procurements, procurementSpeciesByRef, selectedProcurementRef, selectedSpeciesKeys],
  )
  const sharedSpeciesKeys = useMemo(
    () => new Set(
      (procurementSpeciesByRef[compareProcurementRef] || [])
        .map(normalizeSpecies)
        .filter((species) => selectedSpeciesKeys.has(species)),
    ),
    [compareProcurementRef, procurementSpeciesByRef, selectedSpeciesKeys],
  )
  const sharedSpecies = selectedSpecies.filter((species) =>
    sharedSpeciesKeys.has(normalizeSpecies(species)),
  )

  const gradeGroups = useMemo(() => {
    const comparisonGradesByKey = new Map<string, ProcurementGrade>()
    comparisonGrades
      .filter((grade) =>
        (productTypeFilter === 'All' || grade.ProductType === productTypeFilter) &&
        (!compareProcurementRef || sharedSpeciesKeys.has(normalizeSpecies(grade.Species || comparisonProcurement?.Species || ''))),
      )
      .forEach((grade) => {
        comparisonGradesByKey.set(
          getComparisonGradeKey(grade, comparisonProcurement?.Species || ''),
          grade,
        )
      })

    const rowsByKey = new Map<string, PriceListComparisonRow>()
    selectedGrades
      .filter((grade) =>
        (productTypeFilter === 'All' || grade.ProductType === productTypeFilter) &&
        (!compareProcurementRef || sharedSpeciesKeys.has(normalizeSpecies(grade.Species || selectedProcurement?.Species || ''))),
      )
      .forEach((grade) => {
        const species = String(grade.Species || selectedProcurement?.Species || '').trim()
        const key = getComparisonGradeKey(grade, selectedProcurement?.Species || '')
        rowsByKey.set(key, {
          key,
          species,
          gradeName: grade.GradeName,
          productType: grade.ProductType,
          selectedGrade: grade,
          comparisonGrade: comparisonGradesByKey.get(key),
        })
      })

    comparisonGrades
      .filter((grade) =>
        (productTypeFilter === 'All' || grade.ProductType === productTypeFilter) &&
        (!compareProcurementRef || sharedSpeciesKeys.has(normalizeSpecies(grade.Species || comparisonProcurement?.Species || ''))),
      )
      .forEach((grade) => {
        const species = String(grade.Species || comparisonProcurement?.Species || '').trim()
        const key = getComparisonGradeKey(grade, comparisonProcurement?.Species || '')
        if (!rowsByKey.has(key)) {
          rowsByKey.set(key, {
            key,
            species,
            gradeName: grade.GradeName,
            productType: grade.ProductType,
            comparisonGrade: grade,
          })
        }
      })

    const groups = new Map<string, PriceListComparisonRow[]>()
    rowsByKey.forEach((row) => {
      const groupKey = JSON.stringify([row.species, row.gradeName])
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), row])
    })

    return Array.from(groups, ([key, rows]) => ({
      key,
      rows: [...rows].sort((left, right) => {
        const productOrder = (productType: string) =>
          productType === 'Green' ? 0 : productType === 'Burnt' ? 1 : 2
        return productOrder(left.productType) - productOrder(right.productType)
      }),
    }))
  }, [compareProcurementRef, comparisonGrades, comparisonProcurement, productTypeFilter, selectedGrades, selectedProcurement, sharedSpeciesKeys])

  const tableColumns: { key: PriceListColumnKey; label: string; supplier?: string; source?: 'purchase' | 'compare' }[] = [
    { key: 'species', label: 'Species' },
    { key: 'grade', label: 'Grade' },
    { key: 'product', label: 'Product' },
    {
      key: 'agreed',
      label: 'Purchase',
      ...(compareProcurementRef
        ? { supplier: selectedSupplier?.SupplierName || selectedProcurement?.ProcurementRef || 'Selected', source: 'purchase' as const }
        : {}),
    },
    ...(compareProcurementRef
      ? [
          {
            key: 'compare' as const,
            label: 'Compare',
            supplier: comparisonSupplier?.SupplierName || comparisonProcurement?.ProcurementRef || 'Comparison',
            source: 'compare' as const,
          },
          { key: 'difference' as const, label: 'Difference' },
        ]
      : []),
  ]

  const procurementAgreedByRef = useMemo(() => {
    const agreementStatuses: Record<string, boolean> = {}
    procurements.forEach((procurement) => {
      agreementStatuses[procurement.ProcurementRef] = isProcurementAgreed(
        procurementGradesByRef[procurement.ProcurementRef] || EMPTY_PROCUREMENT_GRADES,
      )
    })
    return agreementStatuses
  }, [procurements, procurementGradesByRef])

  function startColumnResize(column: PriceListColumnKey, event: ReactMouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    setActiveResizingColumn(column)

    const startX = event.clientX
    const initialWidth = columnWidths[column]
    const getNextWidth = (clientX: number) =>
      Math.max(80, Math.min(600, initialWidth + clientX - startX))

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = getNextWidth(moveEvent.clientX)
      setColumnWidths((current) => ({ ...current, [column]: nextWidth }))
    }

    const onMouseUp = (upEvent: MouseEvent) => {
      const nextWidths = { ...columnWidths, [column]: getNextWidth(upEvent.clientX) }
      setColumnWidths(nextWidths)
      setActiveResizingColumn(null)
      try {
        localStorage.setItem(PRICE_LIST_COLUMN_WIDTHS_KEY, JSON.stringify(nextWidths))
      } catch {
        // Keep the new widths for this session if storage is unavailable.
      }
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function selectProcurement(procurement: Procurement) {
    setSelectedProcurementRef(procurement.ProcurementRef)
    if (!compareProcurementRef) return

    const selectedSpeciesKeys = new Set(
      (procurementSpeciesByRef[procurement.ProcurementRef] || []).map(normalizeSpecies),
    )
    const comparisonStillMatches = (procurementSpeciesByRef[compareProcurementRef] || []).some(
      (species) => selectedSpeciesKeys.has(normalizeSpecies(species)),
    )

    if (compareProcurementRef === procurement.ProcurementRef || !comparisonStillMatches) {
      setCompareProcurementRef('')
    }
  }

  return (
    <section className="page-content price-list-page">
      <div className="page-heading">
        <div>
          <h2>Price List</h2>
          <p>Compare agreed purchase prices by species, grade, and product.</p>
        </div>
      </div>

      <div className={`price-list-layout${isProcurementListCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="price-list-sidebar" aria-label="Procurement list">
          <h3>Procurements</h3>
          {procurements.length === 0 ? (
            <p className="price-list-sidebar-empty">No procurements available.</p>
          ) : (
            <div className="price-list-procurement-list">
              {procurements.map((procurement) => {
                const title = getProcurementHeaderDisplay(procurement).text
                const supplierName = suppliers.find(
                  (supplier) =>
                    String(supplier.SupplierID) === String(procurement.SupplierID) ||
                    String(supplier.SupplierReference) === String(procurement.SupplierID),
                )?.SupplierName
                const isSelected = procurement.ProcurementRef === selectedProcurementRef
                const isNegotiating = procurementAgreedByRef[procurement.ProcurementRef] === false

                return (
                  <button
                    key={procurement.ProcurementRef}
                    type="button"
                    className={`price-list-procurement-button${isNegotiating ? ' is-negotiating' : ''}${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => selectProcurement(procurement)}
                    title={`${title} - ${supplierName || procurement.ProcurementRef}`}
                  >
                    <span>{title}</span>
                    <div className="price-list-procurement-meta">
                      <small>{supplierName || procurement.ProcurementRef}</small>
                      {isNegotiating && <small className="price-list-procurement-status">In Negotiation</small>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="price-list-content">
          {selectedProcurement ? (
            <>
          <div className="price-list-content-toolbar">
            <button
              type="button"
              className="price-list-sidebar-toggle"
              onClick={() => setIsProcurementListCollapsed((collapsed) => !collapsed)}
              title={isProcurementListCollapsed ? 'Show procurement list' : 'Hide procurement list'}
              aria-label={isProcurementListCollapsed ? 'Show procurement list' : 'Hide procurement list'}
            >
              {isProcurementListCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
          </div>
          <div className={`price-list-source-summary${comparisonProcurement ? ' is-comparing' : ''}`}>
            <section className="price-list-source-panel price-list-source-panel--purchase">
              <span className="price-list-source-label">Purchase</span>
              <strong>{selectedSupplier?.SupplierName || 'Supplier not available'}</strong>
              <span>{getAgreementIdentifier(selectedProcurement)}</span>
              <small>Species: {selectedSpecies.join(', ') || 'Not entered'}</small>
            </section>
            {comparisonProcurement && (
              <section className="price-list-source-panel price-list-source-panel--compare">
                <span className="price-list-source-label">Compare</span>
                <strong>{comparisonSupplier?.SupplierName || 'Supplier not available'}</strong>
                <span>{getAgreementIdentifier(comparisonProcurement)}</span>
                <small>Species: {sharedSpecies.join(', ') || 'No matching species'}</small>
              </section>
            )}
          </div>

          {selectedGrades.length === 0 && comparisonGrades.length === 0 ? (
            <section className="empty-state" style={{ marginTop: '20px' }}>
              <h3>No grades found</h3>
              <p>
                This procurement does not contain any saved procurement-grade
                rows.
              </p>
            </section>
          ) : (
            <section className="table-card price-list-table-card">
              <div className="price-list-table-toolbar">
                <strong>Price List</strong>
                <label htmlFor="price-list-product-filter">Product</label>
                <select
                  id="price-list-product-filter"
                  value={productTypeFilter}
                  onChange={(event) => setProductTypeFilter(event.target.value as ProductTypeFilter)}
                >
                  <option value="All">All</option>
                  <option value="Green">Green</option>
                  <option value="Burnt">Burnt</option>
                </select>
                <label htmlFor="price-list-compare-procurement">Compare with</label>
                <select
                  id="price-list-compare-procurement"
                  value={compareProcurementRef}
                  onChange={(event) => setCompareProcurementRef(event.target.value)}
                >
                  <option value="">None</option>
                  {procurements
                    .filter((procurement) =>
                      comparableProcurements.some((candidate) => candidate.ProcurementRef === procurement.ProcurementRef),
                    )
                    .map((procurement) => {
                      const title = getProcurementHeaderDisplay(procurement).text
                      const supplierName = suppliers.find(
                        (supplier) =>
                          String(supplier.SupplierID) === String(procurement.SupplierID) ||
                          String(supplier.SupplierReference) === String(procurement.SupplierID),
                      )?.SupplierName
                      return (
                        <option key={procurement.ProcurementRef} value={procurement.ProcurementRef}>
                          {title} - {supplierName || procurement.ProcurementRef}
                        </option>
                      )
                    })}
                </select>
                {compareProcurementRef && (
                  <button
                    type="button"
                    className="price-list-clear-compare"
                    onClick={() => setCompareProcurementRef('')}
                    title="Clear comparison"
                    aria-label="Clear comparison"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {gradeGroups.length === 0 ? (
                <div className="price-list-filter-empty">
                  No grades for this product type.
                </div>
              ) : (
              <div className="price-list-table-scroll">
              <table className="price-list-table">
                <colgroup>
                  {tableColumns.map((column) => (
                    <col key={column.key} style={{ width: `${columnWidths[column.key]}px` }} />
                  ))}
                </colgroup>
                <thead>
                  {comparisonProcurement && (
                    <tr className="price-list-source-header-row">
                      <th colSpan={3} aria-hidden="true" />
                      <th className="price-list-source-header price-list-source-header--purchase">
                        {selectedSupplier?.SupplierName || selectedProcurement.ProcurementRef}
                      </th>
                      <th className="price-list-source-header price-list-source-header--compare">
                        {comparisonSupplier?.SupplierName || comparisonProcurement.ProcurementRef}
                      </th>
                      <th aria-hidden="true" />
                    </tr>
                  )}
                  <tr>
                    {tableColumns.map(({ key, label }) => (
                      <th
                        key={key}
                        className={key === 'species' ? 'price-list-species-header' : undefined}
                        title={
                          key === 'compare'
                            ? `Agreed purchase price from ${comparisonSupplier?.SupplierName || comparisonProcurement?.ProcurementRef || 'the comparison supplier'}`
                            : key === 'difference'
                            ? 'Selected purchase price minus comparison purchase price; positive means the selected procurement is higher.'
                            : undefined
                        }
                      >
                        <span className="price-list-column-heading">{label}</span>
                        <span
                          className={`price-list-column-resizer${activeResizingColumn === key ? ' is-resizing' : ''}`}
                          onMouseDown={(event) => startColumnResize(key, event)}
                          title={`Drag to resize ${label.toLowerCase()} column`}
                          aria-hidden="true"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradeGroups.map((group, groupIndex) => (
                    <Fragment key={group.key}>
                      {groupIndex > 0 && (
                        <tr className="price-list-group-gap" aria-hidden="true">
                          <td colSpan={tableColumns.length} />
                        </tr>
                      )}
                      {group.rows.map((row) => {
                    const grade = row.selectedGrade
                    const comparisonGrade = row.comparisonGrade
                    const selectedPurchasePrice = getComparablePurchasePrice(grade)
                    const comparisonPurchasePrice = getComparablePurchasePrice(comparisonGrade)
                    const purchaseDifference =
                      selectedPurchasePrice === null || comparisonPurchasePrice === null
                        ? null
                        : selectedPurchasePrice - comparisonPurchasePrice

                    return (
                      <tr key={row.key}>
                        <td className="price-list-species-cell">{row.species || '—'}</td>
                        <td className="price-list-grade-cell">{row.gradeName}</td>
                        <td className="price-list-product-cell"><ProductTypeBadge productType={row.productType} /></td>
                        <td className="price-list-price-cell">{displayPurchasePrice(grade)}</td>
                        {compareProcurementRef && (
                          <>
                            <td className="price-list-price-cell">{displayPurchasePrice(comparisonGrade)}</td>
                            <td className={`price-list-price-cell price-list-difference${purchaseDifference === null ? '' : purchaseDifference > 0 ? ' is-higher' : purchaseDifference < 0 ? ' is-lower' : ''}`}>
                              {purchaseDifference === null
                                ? '—'
                                : `${purchaseDifference > 0 ? '+' : purchaseDifference < 0 ? '−' : ''}$${Math.abs(purchaseDifference).toFixed(2)}`}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              </div>
              )}
            </section>
          )}

            </>
          ) : (
            <section className="empty-state price-list-selection-empty">
              <h3>{procurements.length ? 'Select a procurement' : 'No procurements found'}</h3>
              <p>
                {procurements.length
                  ? 'Choose an agreement from the list to view its price list.'
                  : 'Add a procurement agreement before viewing prices.'}
              </p>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}