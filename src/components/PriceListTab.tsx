import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import type {
  Procurement,
  ProcurementGrade,
  Supplier,
} from '../types'

type PriceListTabProps = {
  workbookPath: string
  procurements: Procurement[]
  suppliers: Supplier[]
  onRefresh: () => void
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
  const [isSaving, setIsSaving] = useState(false)
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
        const key = String(
          grade.ProcurementGradeID ||
            `${grade.ProcurementRef}-${grade.ProductType}-${grade.GradeName}`,
        )

        priceValues[key] =
          grade.ResalePrice === undefined ||
          grade.ResalePrice === null ||
          Number(grade.ResalePrice) === 0
            ? ''
            : String(grade.ResalePrice)
      })

      setResalePrices(priceValues)
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

  function getGradeKey(grade: ProcurementGrade): string {
    return String(
      grade.ProcurementGradeID ||
        `${grade.ProcurementRef}-${grade.ProductType}-${grade.GradeName}`,
    )
  }

  function updateResalePrice(grade: ProcurementGrade, value: string) {
    setResalePrices((current) => ({
      ...current,
      [getGradeKey(grade)]: value,
    }))
    setMessage('')
  }

  async function handleSave() {
    if (!selectedProcurement) {
      setErrorMessage('Please select a procurement first.')
      return
    }

    setIsSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      const updatedGrades = selectedGrades.map((grade) => ({
        ...grade,
        ResalePrice: Number(resalePrices[getGradeKey(grade)]) || 0,
      }))

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

      setMessage('Price List saved successfully.')
      onRefresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the Price List.',
      )
    } finally {
      setIsSaving(false)
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
            procurement grade.
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
            style={{ marginTop: '20px', padding: '20px' }}
          >
            <h3 style={{ marginTop: 0 }}>
              {selectedProcurement.ProcurementRef}
            </h3>

            <p style={{ marginBottom: '6px' }}>
              <strong>Supplier:</strong>{' '}
              {selectedSupplier?.SupplierName || 'Not available'}
              {' | '}
              <strong>Agreement:</strong>{' '}
              {selectedProcurement.AgreementType}{' '}
              {selectedProcurement.AgreementDetail}
              {' | '}
              <strong>Plantation:</strong>{' '}
              {selectedProcurement.Plantation || 'Not entered'}
            </p>

            <p style={{ marginTop: 0 }}>
              <strong>Species:</strong>{' '}
              {selectedProcurement.Species || 'Not entered'}
              {' | '}
              <strong>Status:</strong> {selectedProcurement.Status}
              {' | '}
              <strong>Harvest period:</strong>{' '}
              {formatDate(selectedProcurement.HarvestPeriodStart)} to{' '}
              {formatDate(selectedProcurement.HarvestPeriodEnd)}
            </p>
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
                  {selectedGrades.map((grade) => (
                    <tr key={getGradeKey(grade)}>
                      <td>{grade.GradeName}</td>
                      <td>{grade.ProductType}</td>
                      <td>
                        AUD $
                        {Number(grade.AgreedPricePerTonne || 0).toFixed(2)}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={resalePrices[getGradeKey(grade)] || ''}
                          onChange={(event) =>
                            updateResalePrice(grade, event.target.value)
                          }
                          aria-label={`Resale price for ${grade.GradeName}`}
                          placeholder="Enter price"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                className="modal-actions"
                style={{ marginTop: '20px' }}
              >
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save size={16} />
                  {isSaving ? 'Saving…' : 'Save Price List'}
                </button>
              </div>
            </section>
          )}

          {message && <p className="success-message">{message}</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </>
      )}
    </section>
  )
}