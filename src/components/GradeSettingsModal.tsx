import { useState, useMemo, type FormEvent } from 'react'
import {
  Settings,
  Plus,
  X,
  Tag,
  Pencil,
  Trash2,
  Filter,
  Building,
  Save,
  Trees,
} from 'lucide-react'
import {
  type SpeciesDefinition,
  type GradeDefinition,
  type Supplier,
  PRODUCT_TYPES,
} from '../types'

type GradeSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  speciesList: SpeciesDefinition[]
  gradesList: GradeDefinition[]
  suppliers?: Supplier[]
  onRefresh: () => void
}

export function GradeSettingsModal({
  isOpen,
  onClose,
  workbookPath,
  speciesList,
  gradesList,
  suppliers = [],
  onRefresh,
}: GradeSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'species' | 'grades'>('species')
  const [newSpeciesName, setNewSpeciesName] = useState('')
  const [newSpeciesNotes, setNewSpeciesNotes] = useState('')
  const [selectedProductType, setSelectedProductType] = useState<
    'Fresh Logs' | 'Burnt Logs'
  >('Fresh Logs')
  const [selectedSpeciesForGrade, setSelectedSpeciesForGrade] = useState('')
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('')
  const [selectedGradeForDetails, setSelectedGradeForDetails] = useState<GradeDefinition | null>(null)

  // Add Grade Form State
  const [newGradeName, setNewGradeName] = useState('')
  const [newGradeSupplierId, setNewGradeSupplierId] = useState('')
  const [newGradeSpeciesName, setNewGradeSpeciesName] = useState('')
  const [newGradeNotes, setNewGradeNotes] = useState('')

  // Edit / Delete Species State
  const [editingSpecies, setEditingSpecies] = useState<SpeciesDefinition | null>(null)
  const [editSpeciesName, setEditSpeciesName] = useState('')
  const [editSpeciesNotes, setEditSpeciesNotes] = useState('')
  const [isSavingSpecies, setIsSavingSpecies] = useState(false)
  const [deletingSpecies, setDeletingSpecies] = useState<SpeciesDefinition | null>(null)
  const [isDeletingSpecies, setIsDeletingSpecies] = useState(false)

  // Edit / Delete Grade State
  const [editingGrade, setEditingGrade] = useState<GradeDefinition | null>(null)
  const [editGradeName, setEditGradeName] = useState('')
  const [editGradeSupplierId, setEditGradeSupplierId] = useState('')
  const [editGradeSpeciesName, setEditGradeSpeciesName] = useState('')
  const [editGradeProductType, setEditGradeProductType] = useState<'Fresh Logs' | 'Burnt Logs'>('Fresh Logs')
  const [editGradeNotes, setEditGradeNotes] = useState('')
  const [isSavingGrade, setIsSavingGrade] = useState(false)
  const [deletingGrade, setDeletingGrade] = useState<GradeDefinition | null>(null)
  const [isDeletingGrade, setIsDeletingGrade] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false)

  // Active supplier object from filter
  const activeFilteredSupplier = useMemo(() => {
    if (!selectedSupplierFilter) return null
    return (
      suppliers.find(
        (s) =>
          String(s.SupplierID) === selectedSupplierFilter ||
          String(s.SupplierReference) === selectedSupplierFilter,
      ) || null
    )
  }, [suppliers, selectedSupplierFilter])

  // Filtered grades based on product type, species, and supplier filter
  const filteredGrades = useMemo(() => {
    return gradesList.filter((g) => {
      if (g.ProductType !== selectedProductType) return false
      if (selectedSpeciesForGrade && g.SpeciesName && g.SpeciesName !== selectedSpeciesForGrade) {
        return false
      }
      if (selectedSupplierFilter) {
        const gSuppId = g.SupplierID ? String(g.SupplierID) : ''
        if (gSuppId !== selectedSupplierFilter) {
          return false
        }
      }
      return true
    })
  }, [gradesList, selectedProductType, selectedSpeciesForGrade, selectedSupplierFilter])

  // Active grade for details panel
  const activeGradeForDetails = useMemo(() => {
    if (selectedGradeForDetails) {
      const refreshed = gradesList.find(
        (g) => String(g.GradeDefinitionID) === String(selectedGradeForDetails.GradeDefinitionID),
      )
      return refreshed || selectedGradeForDetails
    }
    if (selectedSupplierFilter && filteredGrades.length > 0) {
      return filteredGrades[0]
    }
    return null
  }, [selectedGradeForDetails, gradesList, selectedSupplierFilter, filteredGrades])

  if (!isOpen) return null

  // ---------------- Species Actions ----------------

  async function handleAddSpecies(e: FormEvent) {
    e.preventDefault()
    if (!newSpeciesName.trim()) {
      setErrorMsg('Please enter a species name.')
      return
    }
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    const res = await window.logPro.addSpecies(
      workbookPath,
      newSpeciesName.trim(),
      newSpeciesNotes.trim() || 'User-added species',
    )
    setIsSubmitting(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Added species "${newSpeciesName.trim()}" with standard grades.`)
      setNewSpeciesName('')
      setNewSpeciesNotes('')
      onRefresh()
    }
  }

  function handleStartEditSpecies(sp: SpeciesDefinition) {
    setEditingSpecies(sp)
    setEditSpeciesName(sp.SpeciesName)
    setEditSpeciesNotes(sp.Notes || '')
    setErrorMsg('')
    setSuccessMsg('')
  }

  async function handleSaveSpeciesEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingSpecies) return
    if (!editSpeciesName.trim()) {
      setErrorMsg('Species name cannot be empty.')
      return
    }

    setIsSavingSpecies(true)
    setErrorMsg('')
    const res = await window.logPro.updateSpecies(
      workbookPath,
      Number(editingSpecies.SpeciesDefinitionID),
      {
        speciesName: editSpeciesName.trim(),
        notes: editSpeciesNotes.trim(),
      },
    )
    setIsSavingSpecies(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Successfully updated species "${editSpeciesName.trim()}".`)
      setEditingSpecies(null)
      onRefresh()
    }
  }

  function handleStartDeleteSpecies(sp: SpeciesDefinition) {
    setDeletingSpecies(sp)
    setErrorMsg('')
    setSuccessMsg('')
  }

  async function handleConfirmDeleteSpecies() {
    if (!deletingSpecies) return
    setIsDeletingSpecies(true)
    setErrorMsg('')

    const res = await window.logPro.deleteSpecies(
      workbookPath,
      Number(deletingSpecies.SpeciesDefinitionID),
    )
    setIsDeletingSpecies(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Deleted species "${deletingSpecies.SpeciesName}".`)
      setDeletingSpecies(null)
      onRefresh()
    }
  }

  // ---------------- Grade Actions ----------------

  async function handleAddGrade(e: FormEvent) {
    e.preventDefault()
    if (!newGradeName.trim()) {
      setErrorMsg('Please enter a grade name.')
      return
    }
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    const suppId = newGradeSupplierId || (selectedSupplierFilter || undefined)
    const suppObj = suppId
      ? suppliers.find(
          (s) =>
            String(s.SupplierID) === suppId ||
            String(s.SupplierReference) === suppId,
        )
      : undefined

    const res = await window.logPro.addGrade(
      workbookPath,
      newGradeSpeciesName || selectedSpeciesForGrade,
      selectedProductType,
      newGradeName.trim(),
      newGradeNotes.trim() || 'User-added grade',
      suppId,
      suppObj?.SupplierName,
    )
    setIsSubmitting(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(
        `Added grade "${newGradeName.trim()}" for ${selectedProductType}${
          suppObj ? ` (${suppObj.SupplierName})` : ''
        }.`,
      )
      setNewGradeName('')
      setNewGradeNotes('')
      onRefresh()
    }
  }

  function handleStartEditGrade(g: GradeDefinition) {
    setEditingGrade(g)
    setEditGradeName(g.GradeName)
    setEditGradeSupplierId(g.SupplierID ? String(g.SupplierID) : '')
    setEditGradeSpeciesName(g.SpeciesName || '')
    setEditGradeProductType(g.ProductType === 'Burnt Logs' ? 'Burnt Logs' : 'Fresh Logs')
    setEditGradeNotes(g.Notes || '')
    setErrorMsg('')
    setSuccessMsg('')
  }

  async function handleSaveGradeEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingGrade) return
    if (!editGradeName.trim()) {
      setErrorMsg('Grade name cannot be empty.')
      return
    }

    setIsSavingGrade(true)
    setErrorMsg('')

    const suppObj = editGradeSupplierId
      ? suppliers.find(
          (s) =>
            String(s.SupplierID) === editGradeSupplierId ||
            String(s.SupplierReference) === editGradeSupplierId,
        )
      : undefined

    const res = await window.logPro.updateGrade(
      workbookPath,
      Number(editingGrade.GradeDefinitionID),
      {
        gradeName: editGradeName.trim(),
        productType: editGradeProductType,
        speciesName: editGradeSpeciesName || '',
        supplierId: editGradeSupplierId ? editGradeSupplierId : undefined,
        supplierName: suppObj ? suppObj.SupplierName : undefined,
        notes: editGradeNotes.trim(),
      },
    )
    setIsSavingGrade(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Successfully updated grade "${editGradeName.trim()}".`)
      setEditingGrade(null)
      onRefresh()
    }
  }

  function handleStartDeleteGrade(g: GradeDefinition) {
    setDeletingGrade(g)
    setErrorMsg('')
    setSuccessMsg('')
  }

  async function handleConfirmDeleteGrade() {
    if (!deletingGrade) return
    setIsDeletingGrade(true)
    setErrorMsg('')

    const res = await window.logPro.deleteGrade(
      workbookPath,
      Number(deletingGrade.GradeDefinitionID),
    )
    setIsDeletingGrade(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Deleted grade "${deletingGrade.GradeName}".`)
      if (
        selectedGradeForDetails &&
        String(selectedGradeForDetails.GradeDefinitionID) ===
          String(deletingGrade.GradeDefinitionID)
      ) {
        setSelectedGradeForDetails(null)
      }
      setDeletingGrade(null)
      onRefresh()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-card"
        style={{ width: 'min(100%, 820px)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
              Species & Grade Definitions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 'auto',
              padding: '6px 10px',
              background: 'transparent',
              borderColor: 'transparent',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && <div className="error-message" style={{ marginBottom: '12px' }}>{errorMsg}</div>}
        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: '14px',
              borderRadius: '8px',
              background: '#ecfdf5',
              color: '#065f46',
              fontSize: '0.9rem',
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Tab Selector & Delete Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={activeTab === 'species' ? '' : 'secondary-button'}
              style={{ width: 'auto', padding: '8px 18px' }}
              onClick={() => {
                setActiveTab('species')
                setErrorMsg('')
                setSuccessMsg('')
              }}
            >
              Species List ({speciesList.length})
            </button>
            <button
              type="button"
              className={activeTab === 'grades' ? '' : 'secondary-button'}
              style={{ width: 'auto', padding: '8px 18px' }}
              onClick={() => {
                setActiveTab('grades')
                setErrorMsg('')
                setSuccessMsg('')
              }}
            >
              Grade Definitions ({gradesList.length})
            </button>
          </div>

          <label
            htmlFor="grade-settings-delete-toggle"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '6px',
              background: isDeleteEnabled ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${isDeleteEnabled ? '#f87171' : '#cbd5e1'}`,
              color: isDeleteEnabled ? '#991b1b' : '#64748b',
              fontSize: '0.78rem',
              fontWeight: 600,
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              id="grade-settings-delete-toggle"
              type="checkbox"
              checked={isDeleteEnabled}
              onChange={(e) => setIsDeleteEnabled(e.target.checked)}
              style={{ accentColor: '#dc2626', cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <Trash2 size={13} color={isDeleteEnabled ? '#dc2626' : '#64748b'} />
            <span>{isDeleteEnabled ? 'Delete Mode Active' : 'Enable Deletions'}</span>
          </label>
        </div>

        {/* Tab 1: Species */}
        {activeTab === 'species' ? (
          <div>
            <form onSubmit={handleAddSpecies} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '10px',
                  alignItems: 'end',
                }}
              >
                <label style={{ margin: 0, fontWeight: 600 }}>
                  Species Name *
                  <input
                    type="text"
                    placeholder="e.g. Radiata Pine, Douglas Fir"
                    value={newSpeciesName}
                    onChange={(e) => setNewSpeciesName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </label>
                <label style={{ margin: 0, fontWeight: 600 }}>
                  Notes / Botanical
                  <input
                    type="text"
                    placeholder="e.g. Pinus radiata, softwood"
                    value={newSpeciesNotes}
                    onChange={(e) => setNewSpeciesNotes(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 16px',
                  }}
                >
                  <Plus size={16} /> Add Species
                </button>
              </div>
            </form>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <table style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Species Name</th>
                    <th>Standard</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {speciesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No species defined yet.
                      </td>
                    </tr>
                  ) : (
                    speciesList.map((s, idx) => (
                      <tr key={String(s.SpeciesDefinitionID || idx)}>
                        <td style={{ fontWeight: 600 }}>{s.SpeciesName}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              background: s.IsStandard ? '#e0f2fe' : '#fef3c7',
                              color: s.IsStandard ? '#0369a1' : '#92400e',
                            }}
                          >
                            {s.IsStandard ? 'Standard' : 'Custom'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                          {s.Notes || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleStartEditSpecies(s)}
                              title={`Edit ${s.SpeciesName}`}
                              style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            {isDeleteEnabled && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStartDeleteSpecies(s)}
                                title={`Delete ${s.SpeciesName}`}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.78rem',
                                  color: '#dc2626',
                                  borderColor: '#fca5a5',
                                  background: '#fef2f2',
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Tab 2: Grades */
          <div>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Product:
                </span>
                {PRODUCT_TYPES.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    className={selectedProductType === pt ? '' : 'secondary-button'}
                    style={{ width: 'auto', padding: '5px 12px', fontSize: '0.82rem' }}
                    onClick={() => {
                      setSelectedProductType(pt as any)
                      setSelectedGradeForDetails(null)
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trees size={14} className="muted" />
                <select
                  value={selectedSpeciesForGrade}
                  onChange={(e) => {
                    setSelectedSpeciesForGrade(e.target.value)
                    setSelectedGradeForDetails(null)
                  }}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">All Species</option>
                  {speciesList.map((s) => (
                    <option key={s.SpeciesName} value={s.SpeciesName}>
                      {s.SpeciesName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} className="muted" />
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => {
                    setSelectedSupplierFilter(e.target.value)
                    setSelectedGradeForDetails(null)
                  }}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: '0.85rem',
                    minWidth: '160px',
                  }}
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option
                      key={String(s.SupplierID || s.SupplierReference)}
                      value={String(s.SupplierID || s.SupplierReference)}
                    >
                      {s.SupplierName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Supplier / Grade Details Card */}
            {(selectedSupplierFilter || activeGradeForDetails) && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}
              >
                {selectedSupplierFilter && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: activeGradeForDetails ? '10px' : '0',
                      borderBottom: activeGradeForDetails ? '1px solid #e2e8f0' : 'none',
                      paddingBottom: activeGradeForDetails ? '8px' : '0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={16} color="var(--primary)" />
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                          {activeFilteredSupplier?.SupplierName || 'Supplier'}
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>
                          ({filteredGrades.length} {filteredGrades.length === 1 ? 'grade' : 'grades'} available)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setNewGradeSupplierId(selectedSupplierFilter)
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        fontSize: '0.78rem',
                      }}
                    >
                      <Plus size={12} /> Add for this Supplier
                    </button>
                  </div>
                )}

                {activeGradeForDetails && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Tag size={14} color="var(--primary)" />
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                          {activeGradeForDetails.GradeName}
                        </strong>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            background: activeGradeForDetails.IsStandard ? '#e0f2fe' : '#fef3c7',
                            color: activeGradeForDetails.IsStandard ? '#0369a1' : '#92400e',
                          }}
                        >
                          {activeGradeForDetails.IsStandard ? 'PDF Standard' : 'Custom'}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            background: '#ecfdf5',
                            color: '#065f46',
                          }}
                        >
                          {activeGradeForDetails.ProductType}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleStartEditGrade(activeGradeForDetails)}
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        {isDeleteEnabled && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleStartDeleteGrade(activeGradeForDetails)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              color: '#dc2626',
                              borderColor: '#fca5a5',
                              background: '#fef2f2',
                            }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '8px',
                        fontSize: '0.8rem',
                        background: '#ffffff',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>
                          Supplier
                        </span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {activeGradeForDetails.SupplierName || 'Universal / All Suppliers'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>
                          Species
                        </span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {activeGradeForDetails.SpeciesName || 'All Species (Universal)'}
                        </span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>
                          Notes / Specs
                        </span>
                        <span style={{ color: '#334155' }}>
                          {activeGradeForDetails.Notes || 'No specific notes recorded.'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Grade Form */}
            <form onSubmit={handleAddGrade} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr auto',
                  gap: '8px',
                  alignItems: 'end',
                }}
              >
                <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
                  Grade Name *
                  <input
                    type="text"
                    placeholder="e.g. Export A"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </label>

                <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
                  Supplier
                  <select
                    value={newGradeSupplierId || (selectedSupplierFilter || '')}
                    onChange={(e) => setNewGradeSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px' }}
                  >
                    <option value="">All Suppliers</option>
                    {suppliers.map((s) => (
                      <option
                        key={String(s.SupplierID || s.SupplierReference)}
                        value={String(s.SupplierID || s.SupplierReference)}
                      >
                        {s.SupplierName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
                  Species
                  <select
                    value={newGradeSpeciesName || selectedSpeciesForGrade}
                    onChange={(e) => setNewGradeSpeciesName(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px' }}
                  >
                    <option value="">All Species</option>
                    {speciesList.map((s) => (
                      <option key={s.SpeciesName} value={s.SpeciesName}>
                        {s.SpeciesName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
                  Spec / Notes
                  <input
                    type="text"
                    placeholder="SED, length, defect"
                    value={newGradeNotes}
                    onChange={(e) => setNewGradeNotes(e.target.value)}
                    disabled={isSubmitting}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={14} /> Add Grade
                </button>
              </div>
            </form>

            {/* Grades Table */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                maxHeight: '340px',
                overflowY: 'auto',
              }}
            >
              <table style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Grade Name</th>
                    <th>Supplier</th>
                    <th>Product Type</th>
                    <th>Species</th>
                    <th>Standard</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No grades found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((g, idx) => {
                      const isSelected =
                        activeGradeForDetails &&
                        String(activeGradeForDetails.GradeDefinitionID) ===
                          String(g.GradeDefinitionID)
                      return (
                        <tr
                          key={String(g.GradeDefinitionID || idx)}
                          onClick={() => setSelectedGradeForDetails(g)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : undefined,
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Tag size={13} color="var(--primary)" />
                              {g.GradeName}
                            </span>
                          </td>
                          <td>
                            {g.SupplierName ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  fontSize: '0.75rem',
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                }}
                              >
                                <Building size={10} /> {g.SupplierName}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Universal</span>
                            )}
                          </td>
                          <td>{g.ProductType}</td>
                          <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                            {g.SpeciesName || 'All Species'}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                background: g.IsStandard ? '#e0f2fe' : '#fef3c7',
                                color: g.IsStandard ? '#0369a1' : '#92400e',
                              }}
                            >
                              {g.IsStandard ? 'PDF Standard' : 'Custom'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', gap: '3px' }}>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStartEditGrade(g)}
                                title={`Edit ${g.GradeName}`}
                                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              >
                                <Pencil size={11} />
                              </button>
                              {isDeleteEnabled && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleStartDeleteGrade(g)}
                                  title={`Delete ${g.GradeName}`}
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '0.75rem',
                                    color: '#dc2626',
                                    borderColor: '#fca5a5',
                                    background: '#fef2f2',
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Done Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="button"
            className="secondary-button"
            style={{ width: 'auto', padding: '8px 24px' }}
            onClick={onClose}
          >
            Done
          </button>
        </div>

        {/* Sub-Modal: Edit Species */}
        {editingSpecies && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={() => !isSavingSpecies && setEditingSpecies(null)}
          >
            <div
              className="modal-card"
              style={{ width: 'min(100%, 460px)', background: '#fff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Edit Species</h3>
              <form onSubmit={handleSaveSpeciesEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Species Name *
                  <input
                    type="text"
                    required
                    value={editSpeciesName}
                    onChange={(e) => setEditSpeciesName(e.target.value)}
                  />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Notes / Botanical
                  <input
                    type="text"
                    value={editSpeciesNotes}
                    onChange={(e) => setEditSpeciesNotes(e.target.value)}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditingSpecies(null)}
                    disabled={isSavingSpecies}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingSpecies} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Save size={14} />
                    {isSavingSpecies ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-Modal: Delete Species */}
        {deletingSpecies && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={() => !isDeletingSpecies && setDeletingSpecies(null)}
          >
            <div
              className="modal-card"
              style={{ width: 'min(100%, 420px)', background: '#fff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', color: '#991b1b' }}>Delete Species</h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#334155' }}>
                Are you sure you want to delete <strong>{deletingSpecies.SpeciesName}</strong>?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeletingSpecies(null)}
                  disabled={isDeletingSpecies}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSpecies}
                  disabled={isDeletingSpecies}
                  style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                >
                  {isDeletingSpecies ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Modal: Edit Grade */}
        {editingGrade && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={() => !isSavingGrade && setEditingGrade(null)}
          >
            <div
              className="modal-card"
              style={{ width: 'min(100%, 500px)', background: '#fff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>Edit Grade Definition</h3>
              <form onSubmit={handleSaveGradeEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Grade Name *
                    <input
                      type="text"
                      required
                      value={editGradeName}
                      onChange={(e) => setEditGradeName(e.target.value)}
                    />
                  </label>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Product Type
                    <select
                      value={editGradeProductType}
                      onChange={(e) => setEditGradeProductType(e.target.value as any)}
                    >
                      {PRODUCT_TYPES.map((pt) => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Linked Supplier
                    <select
                      value={editGradeSupplierId}
                      onChange={(e) => setEditGradeSupplierId(e.target.value)}
                    >
                      <option value="">All Suppliers (General)</option>
                      {suppliers.map((s) => (
                        <option
                          key={String(s.SupplierID || s.SupplierReference)}
                          value={String(s.SupplierID || s.SupplierReference)}
                        >
                          {s.SupplierName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Target Species
                    <select
                      value={editGradeSpeciesName}
                      onChange={(e) => setEditGradeSpeciesName(e.target.value)}
                    >
                      <option value="">All Species</option>
                      {speciesList.map((s) => (
                        <option key={s.SpeciesName} value={s.SpeciesName}>{s.SpeciesName}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Specifications / Notes
                  <textarea
                    rows={2}
                    value={editGradeNotes}
                    onChange={(e) => setEditGradeNotes(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditingGrade(null)}
                    disabled={isSavingGrade}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSavingGrade} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Save size={14} />
                    {isSavingGrade ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sub-Modal: Delete Grade */}
        {deletingGrade && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={() => !isDeletingGrade && setDeletingGrade(null)}
          >
            <div
              className="modal-card"
              style={{ width: 'min(100%, 420px)', background: '#fff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', color: '#991b1b' }}>Delete Grade</h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#334155' }}>
                Are you sure you want to delete grade <strong>{deletingGrade.GradeName}</strong> ({deletingGrade.ProductType})?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeletingGrade(null)}
                  disabled={isDeletingGrade}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGrade}
                  disabled={isDeletingGrade}
                  style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                >
                  {isDeletingGrade ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
