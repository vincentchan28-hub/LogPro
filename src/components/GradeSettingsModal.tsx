import { useState, type FormEvent } from 'react'
import { Settings, Plus, X, Tag } from 'lucide-react'
import {
  type SpeciesDefinition,
  type GradeDefinition,
  PRODUCT_TYPES,
} from '../types'

type GradeSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  speciesList: SpeciesDefinition[]
  gradesList: GradeDefinition[]
  onRefresh: () => void
}

export function GradeSettingsModal({
  isOpen,
  onClose,
  workbookPath,
  speciesList,
  gradesList,
  onRefresh,
}: GradeSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'species' | 'grades'>('species')
  const [newSpeciesName, setNewSpeciesName] = useState('')
  const [newSpeciesNotes, setNewSpeciesNotes] = useState('')
  const [selectedProductType, setSelectedProductType] = useState<
    'Fresh Logs' | 'Burnt Logs'
  >('Fresh Logs')
  const [selectedSpeciesForGrade, setSelectedSpeciesForGrade] = useState('')
  const [newGradeName, setNewGradeName] = useState('')
  const [newGradeNotes, setNewGradeNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

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
      newSpeciesName,
      newSpeciesNotes || 'User-added species',
    )
    setIsSubmitting(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`Added species "${newSpeciesName}" with standard grades.`)
      setNewSpeciesName('')
      setNewSpeciesNotes('')
      onRefresh()
    }
  }

  async function handleAddGrade(e: FormEvent) {
    e.preventDefault()
    if (!newGradeName.trim()) {
      setErrorMsg('Please enter a grade name.')
      return
    }
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    const res = await window.logPro.addGrade(
      workbookPath,
      selectedSpeciesForGrade,
      selectedProductType,
      newGradeName,
      newGradeNotes || 'User-added grade',
    )
    setIsSubmitting(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(
        `Added grade "${newGradeName}" for ${selectedProductType}.`,
      )
      setNewGradeName('')
      setNewGradeNotes('')
      onRefresh()
    }
  }

  const filteredGrades = gradesList.filter(
    (g) =>
      g.ProductType === selectedProductType &&
      (!selectedSpeciesForGrade ||
        !g.SpeciesName ||
        g.SpeciesName === selectedSpeciesForGrade),
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 'min(100%, 720px)' }}
        onClick={(e) => e.stopPropagation()}
      >
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
            style={{
              width: 'auto',
              padding: '6px 10px',
              background: 'transparent',
              borderColor: 'transparent',
              color: 'var(--muted)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && <div className="error-message">{errorMsg}</div>}
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

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
                  Species Name
                  <input
                    type="text"
                    placeholder="e.g. Radiata Pine"
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
                    placeholder="e.g. Pinus radiata"
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
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Species Name</th>
                    <th>Notes</th>
                    <th>Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {speciesList.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No species defined yet.
                      </td>
                    </tr>
                  ) : (
                    speciesList.map((s) => (
                      <tr key={String(s.SpeciesDefinitionID || s.SpeciesName)}>
                        <td style={{ fontWeight: 600 }}>{s.SpeciesName}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                          {s.Notes || '—'}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              background: s.IsStandard ? '#e0f2fe' : '#f3f4f6',
                              color: s.IsStandard ? '#0369a1' : '#4b5563',
                            }}
                          >
                            {s.IsStandard ? 'Standard' : 'Custom'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Product:
                </span>
                {PRODUCT_TYPES.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    className={selectedProductType === pt ? '' : 'secondary-button'}
                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }}
                    onClick={() => setSelectedProductType(pt as any)}
                  >
                    {pt}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Species Filter:
                </span>
                <select
                  value={selectedSpeciesForGrade}
                  onChange={(e) => setSelectedSpeciesForGrade(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                  }}
                >
                  <option value="">All / Global Standard</option>
                  {speciesList.map((s) => (
                    <option key={s.SpeciesName} value={s.SpeciesName}>
                      {s.SpeciesName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleAddGrade} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '10px',
                  alignItems: 'end',
                }}
              >
                <label style={{ margin: 0, fontWeight: 600 }}>
                  Grade Name
                  <input
                    type="text"
                    placeholder="e.g. Export Grade A"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </label>
                <label style={{ margin: 0, fontWeight: 600 }}>
                  Notes
                  <input
                    type="text"
                    placeholder="e.g. Spec requirement"
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
                    gap: '6px',
                    padding: '10px 16px',
                  }}
                >
                  <Plus size={16} /> Add Grade
                </button>
              </div>
            </form>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Grade Name</th>
                    <th>Product Type</th>
                    <th>Species</th>
                    <th>Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No grades found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredGrades.map((g, idx) => (
                      <tr key={String(g.GradeDefinitionID || idx)}>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Tag size={14} color="var(--primary)" />
                            {g.GradeName}
                          </span>
                        </td>
                        <td>{g.ProductType}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                          {g.SpeciesName || 'All Species'}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              background: g.IsStandard ? '#e0f2fe' : '#fef3c7',
                              color: g.IsStandard ? '#0369a1' : '#92400e',
                            }}
                          >
                            {g.IsStandard ? 'PDF Standard' : 'Custom'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
      </div>
    </div>
  )
}
