import { useEffect, useMemo, useState } from 'react'
import { Save, Pencil, X } from 'lucide-react'
import type {
  Procurement,
  ProcurementGrade,
  Supplier,
} from '../types'
import { ProductTypeBadge } from './ProductTypeBadge'

type PriceListTabProps = {
  workbookPath: string
  procurements: Procurement[]
  suppliers: Supplier[]
  onRefresh: () => void
}

// A short name that identifies one grade row.
function getGradeKey(grade: ProcurementGrade): string {
  return String(
    grade.ProcurementGradeID ||
      `${grade.ProcurementRef}-${grade.ProductType}-${grade.GradeName}`,
  )
}

// The resale price that is saved for a grade, as text. Empty text means "no price yet".
function savedPriceText(grade: ProcurementGrade): string {
  const price = Number(grade.ResalePrice) || 0
  return price > 0 ? String(price) : ''
}

export function PriceListTab({
  workbookPath,
  procurements,
  suppliers,
  onRefresh,
}: PriceListTabProps) {
  const [selectedProcurementRef, setSelectedProcurementRef] = useState('')
  const [selectedGrades, setSelectedGrades] = useState<ProcurementGrade[]>([])
  const [resalePrices, setResalePrices] = useState<Record<string, string>>({})
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({})
  const [savingKey, setSavingKey] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

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

  useEffect(() => {
    if (!selectedProcurementRef) {
      setSelectedGrades([])
      setResalePrices({})
      setEditingKeys({})
      return
    }

    try {
      const procurementGrades = window.logPro.getProcurementGrades(
        workbookPath,
        selectedProcurementRef,
      )

      setSelectedGrades(procurementGrades)

      const priceValues: Record<string, string> = {}
      procurementGrades.forEach((grade) => {
        priceValues[getGradeKey(grade)] = savedPriceText(grade)
      })

      setResalePrices(priceValues)
      setEditingKeys({})
      setMessage('')
      setErrorMessage('')
    } catch (error) {
      setSelectedGrades([])
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load the procurement grades.',
      )
    }
  }, [workbookPath, selectedProcurementRef])

  function updateResalePrice(grade: ProcurementGrade, value: string) {
    setResalePrices((current) => ({
      ...current,
      [getGradeKey(grade)]: value,
    }))
    setMessage('')
    setErrorMessage('')
  }

  // Unlocks a saved price so it can be changed.
  function startEditing(grade: ProcurementGrade) {
    setEditingKeys((current) => ({
      ...current,
      [getGradeKey(grade)]: true,
    }))
    setMessage('')
    setErrorMessage('')
  }

  // Puts the saved price back and locks the box again.
  function cancelEditing(grade: ProcurementGrade) {
    const key = getGradeKey(grade)
    setResalePrices((current) => ({
      ...current,
      [key]: savedPriceText(grade),
    }))
    setEditingKeys((current) => ({
      ...current,
      [key]: false,
    }))
    setMessage('')
    setErrorMessage('')
  }

  // Saves the resale price for ONE grade row only.
  async function handleSaveRow(grade: ProcurementGrade) {
    if (!selectedProcurement) {
      setErrorMessage('Please select a procurement first.')
      return
    }

    const key = getGradeKey(grade)
    const typedText = (resalePrices[key] ?? '').trim()
    const newPrice = typedText === '' ? 0 : Number(typedText)

    if (Number.isNaN(newPrice) || newPrice < 0) {
      setErrorMessage('Please enter a valid price (0 or more).')
      return
    }

    setSavingKey(key)
    setMessage('')
    setErrorMessage('')

    try {
      // Only this row changes. Every other row keeps its saved price.
      const updatedGrades = selectedGrades.map((item) =>
        getGradeKey(item) === key ? { ...item, ResalePrice: newPrice } : item,
      )

      const result = await window.logPro.updateProcurement(
        workbookPath,
        selectedProcurement.ProcurementRef,
        {},
        updatedGrades,
      )

      if (result.error) {
        setErrorMessage(result.error)
        return
      }

      const freshGrades = window.logPro.getProcurementGrades(
        workbookPath,
        selectedProcurement.ProcurementRef,
      )
      setSelectedGrades(freshGrades)

      setResalePrices((current) => ({
        ...current,
        [key]: newPrice > 0 ? String(newPrice) : '',
      }))
      setEditingKeys((current) => ({
        ...current,
        [key]: false,
      }))

      setMessage(
        newPrice > 0
          ? `Resale price saved for ${grade.GradeName}.`
          : `Resale price cleared for ${grade.GradeName}.`,
      )
      onRefresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the resale price.',
      )
    } finally {
      setSavingKey('')
    }
  }

  function formatDate(value: string): string {
    if (!value) return 'Not entered'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleDateString('en-AU')
  }

  return (
    <section className="page-content" style={{ maxWidth: '1200px' }}>
      <div className="page-heading">
        <div>
          <h2>Price List</h2>
          <p>
            View agreed purchase prices and enter the resale price for each
            procurement grade. Each resale price is saved on its own.
          </p>
        </div>
      </div>

      <section className="form-card" style={{ marginTop: '20px' }}>
        <label htmlFor="price-list-procurement">
          Select Procurement
          <select
            id="price-list-procurement"
            value={selectedProcurementRef}
            onChange={(event) =>
              setSelectedProcurementRef(event.target.value)
            }
          >
            <option value="">Select a procurement</option>
            {procurements.map((procurement) => (
              <option
                key={procurement.ProcurementRef}
                value={procurement.ProcurementRef}
              >
                {procurement.ProcurementRef} — {procurement.AgreementDetail}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedProcurement && (
        <>
          <section
            className="table-card"
            style={{
              marginTop: '20px',
              padding: '12px 20px',
              background: '#f0f9ff',
              border: '1px solid #e0f2fe',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'max-content minmax(0, 1fr) max-content minmax(0, 1fr) max-content minmax(0, 1fr)',
                columnGap: '12px',
                rowGap: '8px',
                alignItems: 'baseline',
                fontSize: '0.92rem',
              }}
            >
              {[
                ['Supplier', selectedSupplier?.SupplierName || 'Not available'],
                ['Plantation', selectedProcurement.Plantation || 'Not entered'],
                [
                  'Harvest Start',
                  formatDate(selectedProcurement.HarvestPeriodStart),
                ],
                [
                  'Agreement',
                  `${selectedProcurement.AgreementType} ${selectedProcurement.AgreementDetail}`.trim() ||
                    'Not entered',
                ],
                ['Species', selectedProcurement.Species || 'Not entered'],
                [
                  'Harvest Ends',
                  formatDate(selectedProcurement.HarvestPeriodEnd),
                ],
              ].map(([label, value], index) => (
                <div key={label} style={{ display: 'contents' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: '#000000',
                      whiteSpace: 'nowrap',
                      paddingLeft: index % 3 === 0 ? 0 : '40px',
                    }}
                  >
                    {label}:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: '#0f172a',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>



          {selectedGrades.length === 0 ? (
            <section className="empty-state" style={{ marginTop: '20px' }}>
              <h3>No grades found</h3>
              <p>
                This procurement does not contain any saved procurement-grade
                rows.
              </p>
            </section>
          ) : (
            <section className="table-card" style={{ marginTop: '20px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Product Type</th>
                    <th>Agreed Purchase Price / t</th>
                    <th>Resale Price / t</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGrades.map((grade) => {
                    const key = getGradeKey(grade)
                    const hasSavedPrice = (Number(grade.ResalePrice) || 0) > 0
                    const isEditing = editingKeys[key] === true
                    const isLocked = hasSavedPrice && !isEditing
                    const isSavingThisRow = savingKey === key
                    const typedValue = resalePrices[key] ?? ''
                    const saveDisabled =
                      isSavingThisRow ||
                      (!hasSavedPrice && typedValue.trim() === '')

                    return (
                      <tr key={key}>
                        <td>{grade.GradeName}</td>
                        <td><ProductTypeBadge productType={grade.ProductType} /></td>
                        <td>
                          {typeof grade.AgreedPricePerTonne === 'string' &&
                          grade.AgreedPricePerTonne.trim().toLowerCase().startsWith('c') ? (
                            <span style={{ color: '#b91c1c', fontStyle: 'italic', fontWeight: 600 }}>
                              Cancelled
                            </span>
                          ) : (
                            `AUD $${Number(grade.AgreedPricePerTonne || 0).toFixed(2)}`
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={typedValue}
                              disabled={isLocked || isSavingThisRow}
                              onChange={(event) =>
                                updateResalePrice(grade, event.target.value)
                              }
                              aria-label={`Resale price for ${grade.GradeName}`}
                              placeholder="0.00"
                              style={{
                                width: '90px',
                                backgroundColor: isLocked ? '#f1f5f9' : '#ffffff',
                                color: isLocked ? '#475569' : '#0f172a',
                                cursor: isLocked ? 'not-allowed' : 'text',
                              }}
                            />

                            {isLocked ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => startEditing(grade)}
                                title="Edit resale price"
                                aria-label={`Edit resale price for ${grade.GradeName}`}
                                style={{
                                  width: 'auto',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '6px 10px',
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveRow(grade)}
                                  disabled={saveDisabled}
                                  style={{
                                    width: 'auto',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    background: 'var(--primary)',
                                    border: '1px solid var(--primary)',
                                    borderRadius: '6px',
                                    opacity: saveDisabled ? 0.5 : 1,
                                    cursor: saveDisabled
                                      ? 'not-allowed'
                                      : 'pointer',
                                  }}
                                >
                                  <Save size={14} />
                                  {isSavingThisRow ? 'Saving…' : 'Save'}
                                </button>

                                {hasSavedPrice && (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => cancelEditing(grade)}
                                    disabled={isSavingThisRow}
                                    style={{
                                      width: 'auto',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.82rem',
                                    }}
                                  >
                                    <X size={14} />
                                    Cancel
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}

          {message && <p className="success-message">{message}</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </>
      )}
    </section>
  )
}