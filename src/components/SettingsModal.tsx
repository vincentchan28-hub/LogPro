import { useState, useMemo, type FormEvent } from 'react'
import {
  Settings,
  Building,
  BarChart3,
  Download,
  MapPin,
  X,
  Plus,
  Copy,
  Check,
  Tag,
  Trees,
  FileSpreadsheet,
} from 'lucide-react'
import {
  type Supplier,
  type SpeciesDefinition,
  type GradeDefinition,
  PRODUCT_TYPES,
} from '../types'

type SettingsTab = 'speciesGrades' | 'suppliers' | 'reports' | 'workbook'

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  suppliers: Supplier[]
  onOpenAddSupplier: () => void
  onRefresh: () => void
}

export function SettingsModal({
  isOpen,
  onClose,
  workbookPath,
  suppliers,
  onOpenAddSupplier,
  onRefresh,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('speciesGrades')
  const [hasCopiedLocation, setHasCopiedLocation] = useState(false)

  // Species & Grade definition state
  const [speciesSubTab, setSpeciesSubTab] = useState<'species' | 'grades'>('species')
  const [newSpeciesName, setNewSpeciesName] = useState('')
  const [newSpeciesNotes, setNewSpeciesNotes] = useState('')
  const [selectedProductType, setSelectedProductType] = useState<'Fresh Logs' | 'Burnt Logs'>('Fresh Logs')
  const [selectedSpeciesForGrade, setSelectedSpeciesForGrade] = useState('')
  const [newGradeName, setNewGradeName] = useState('')
  const [newGradeNotes, setNewGradeNotes] = useState('')
  const [speciesError, setSpeciesError] = useState('')
  const [speciesSuccess, setSpeciesSuccess] = useState('')
  const [isSubmittingSpecies, setIsSubmittingSpecies] = useState(false)

  // Load species & grades from logPro
  const speciesList: SpeciesDefinition[] = useMemo(() => {
    if (!workbookPath) return []
    try {
      return window.logPro.getSpecies(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath, speciesSuccess])

  const gradesList: GradeDefinition[] = useMemo(() => {
    if (!workbookPath) return []
    try {
      return window.logPro.getGrades(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath, speciesSuccess])

  // Reports data computed from procurements & grades
  const reportData = useMemo(() => {
    if (!workbookPath) {
      return {
        procurementsCount: 0,
        activeCount: 0,
        draftCount: 0,
        completedCount: 0,
        totalAgreed: 0,
        totalDelivered: 0,
        totalRemaining: 0,
        speciesBreakdown: {} as Record<string, { agreed: number; delivered: number }>,
        supplierBreakdown: {} as Record<string, { agreed: number; delivered: number; deals: number }>,
      }
    }

    try {
      const procurements = window.logPro.getProcurements(workbookPath)
      let activeCount = 0
      let draftCount = 0
      let completedCount = 0
      let totalAgreed = 0
      let totalDelivered = 0
      let totalRemaining = 0
      const speciesBreakdown: Record<string, { agreed: number; delivered: number }> = {}
      const supplierBreakdown: Record<string, { agreed: number; delivered: number; deals: number }> = {}

      for (const p of procurements) {
        if (p.Status === 'Active') activeCount++
        else if (p.Status === 'Draft' || p.Status === 'Waiting for Acceptance') draftCount++
        else if (p.Status === 'Completed') completedCount++

        const matchedSupplier = suppliers.find(
          (s) => String(s.SupplierID) === String(p.SupplierID) || String(s.SupplierReference) === String(p.SupplierID)
        )
        const sName = matchedSupplier?.SupplierName || `Supplier #${p.SupplierID}`
        if (!supplierBreakdown[sName]) {
          supplierBreakdown[sName] = { agreed: 0, delivered: 0, deals: 0 }
        }
        supplierBreakdown[sName].deals++

        const grades = window.logPro.getProcurementGrades(workbookPath, p.ProcurementRef)
        for (const g of grades) {
          const agreed = Number(g.AgreedTonnes) || 0
          const delivered = Number(g.DeliveredTonnes) || 0
          totalAgreed += agreed
          totalDelivered += delivered
          totalRemaining += Math.max(0, agreed - delivered)

          const spName = g.Species || p.Species || 'Radiata Pine'
          if (!speciesBreakdown[spName]) {
            speciesBreakdown[spName] = { agreed: 0, delivered: 0 }
          }
          speciesBreakdown[spName].agreed += agreed
          speciesBreakdown[spName].delivered += delivered

          supplierBreakdown[sName].agreed += agreed
          supplierBreakdown[sName].delivered += delivered
        }
      }

      return {
        procurementsCount: procurements.length,
        activeCount,
        draftCount,
        completedCount,
        totalAgreed,
        totalDelivered,
        totalRemaining,
        speciesBreakdown,
        supplierBreakdown,
      }
    } catch {
      return {
        procurementsCount: 0,
        activeCount: 0,
        draftCount: 0,
        completedCount: 0,
        totalAgreed: 0,
        totalDelivered: 0,
        totalRemaining: 0,
        speciesBreakdown: {} as Record<string, { agreed: number; delivered: number }>,
        supplierBreakdown: {} as Record<string, { agreed: number; delivered: number; deals: number }>,
      }
    }
  }, [workbookPath, suppliers])

  if (!isOpen) return null

  // Species handlers
  async function handleAddSpecies(e: FormEvent) {
    e.preventDefault()
    if (!newSpeciesName.trim()) {
      setSpeciesError('Please enter a species name.')
      return
    }
    setSpeciesError('')
    setSpeciesSuccess('')
    setIsSubmittingSpecies(true)

    const res = await window.logPro.addSpecies(
      workbookPath,
      newSpeciesName,
      newSpeciesNotes || 'User-added species',
    )
    setIsSubmittingSpecies(false)

    if (res.error) {
      setSpeciesError(res.error)
    } else {
      setSpeciesSuccess(`Added species "${newSpeciesName}" with standard grades.`)
      setNewSpeciesName('')
      setNewSpeciesNotes('')
      onRefresh()
    }
  }

  async function handleAddGrade(e: FormEvent) {
    e.preventDefault()
    if (!newGradeName.trim()) {
      setSpeciesError('Please enter a grade name.')
      return
    }
    setSpeciesError('')
    setSpeciesSuccess('')
    setIsSubmittingSpecies(true)

    const res = await window.logPro.addGrade(
      workbookPath,
      selectedSpeciesForGrade,
      selectedProductType,
      newGradeName,
      newGradeNotes || 'User-added grade',
    )
    setIsSubmittingSpecies(false)

    if (res.error) {
      setSpeciesError(res.error)
    } else {
      setSpeciesSuccess(`Added grade "${newGradeName}" for ${selectedProductType}.`)
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
      <section
        className="modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <Settings size={22} className="settings-icon-primary" />
            <div>
              <h3>Settings & Tools</h3>
              <p>Configure species, manage suppliers, view reports and export workbook data</p>
            </div>
          </div>
          <button
            type="button"
            className="settings-modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="settings-tabs-bar">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'speciesGrades' ? 'active' : ''}`}
            onClick={() => setActiveTab('speciesGrades')}
          >
            <Trees size={15} />
            <span>Species & Grades</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <Building size={15} />
            <span>Suppliers ({suppliers.length})</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={15} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'workbook' ? 'active' : ''}`}
            onClick={() => setActiveTab('workbook')}
          >
            <FileSpreadsheet size={15} />
            <span>Workbook & Export</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="settings-tab-content">
          {/* TAB 1: SPECIES & GRADES */}
          {activeTab === 'speciesGrades' && (
            <div className="settings-tab-pane">
              <div className="species-subtab-switch">
                <button
                  type="button"
                  className={`subtab-pill ${speciesSubTab === 'species' ? 'active' : ''}`}
                  onClick={() => setSpeciesSubTab('species')}
                >
                  Species ({speciesList.length})
                </button>
                <button
                  type="button"
                  className={`subtab-pill ${speciesSubTab === 'grades' ? 'active' : ''}`}
                  onClick={() => setSpeciesSubTab('grades')}
                >
                  Grades ({gradesList.length})
                </button>
              </div>

              {speciesError && <p className="notice notice-error">{speciesError}</p>}
              {speciesSuccess && <p className="notice notice-ok">{speciesSuccess}</p>}

              {speciesSubTab === 'species' ? (
                <div>
                  <form onSubmit={handleAddSpecies} className="settings-inline-form">
                    <div className="form-grid-3">
                      <div>
                        <label htmlFor="new-species-name">Species Name *</label>
                        <input
                          id="new-species-name"
                          type="text"
                          placeholder="e.g. Douglas Fir, Blue Gum"
                          value={newSpeciesName}
                          onChange={(e) => setNewSpeciesName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="new-species-notes">Notes</label>
                        <input
                          id="new-species-notes"
                          type="text"
                          placeholder="Standard or plantation notes"
                          value={newSpeciesNotes}
                          onChange={(e) => setNewSpeciesNotes(e.target.value)}
                        />
                      </div>
                      <div className="form-submit-cell">
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={isSubmittingSpecies}
                        >
                          <Plus size={15} /> Add Species
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="settings-table-wrapper">
                    <table className="settings-table">
                      <thead>
                        <tr>
                          <th>Species Name</th>
                          <th>Standard</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {speciesList.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center muted">
                              No species registered yet.
                            </td>
                          </tr>
                        ) : (
                          speciesList.map((sp, idx) => (
                            <tr key={String(sp.SpeciesDefinitionID || idx)}>
                              <td className="font-semibold">{sp.SpeciesName}</td>
                              <td>
                                <span className={`badge-pill ${sp.IsStandard ? 'badge-blue' : 'badge-amber'}`}>
                                  {sp.IsStandard ? 'Standard' : 'Custom'}
                                </span>
                              </td>
                              <td className="muted">{sp.Notes || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grades-filter-bar">
                    <div className="product-type-toggle">
                      {PRODUCT_TYPES.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          className={`pt-pill ${selectedProductType === pt ? 'active' : ''}`}
                          onClick={() => setSelectedProductType(pt)}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>

                    <select
                      value={selectedSpeciesForGrade}
                      onChange={(e) => setSelectedSpeciesForGrade(e.target.value)}
                      className="species-dropdown-filter"
                    >
                      <option value="">All Species</option>
                      {speciesList.map((s) => (
                        <option key={s.SpeciesName} value={s.SpeciesName}>
                          {s.SpeciesName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <form onSubmit={handleAddGrade} className="settings-inline-form">
                    <div className="form-grid-3">
                      <div>
                        <label htmlFor="new-grade-name">New Grade Name *</label>
                        <input
                          id="new-grade-name"
                          type="text"
                          placeholder="e.g. Export A, Super Peel"
                          value={newGradeName}
                          onChange={(e) => setNewGradeName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="new-grade-notes">Description / Spec</label>
                        <input
                          id="new-grade-notes"
                          type="text"
                          placeholder="Dimensions, sed, defect allowance"
                          value={newGradeNotes}
                          onChange={(e) => setNewGradeNotes(e.target.value)}
                        />
                      </div>
                      <div className="form-submit-cell">
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={isSubmittingSpecies}
                        >
                          <Plus size={15} /> Add Grade
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="settings-table-wrapper">
                    <table className="settings-table">
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
                            <td colSpan={4} className="text-center muted">
                              No grades found for this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredGrades.map((g, idx) => (
                            <tr key={String(g.GradeDefinitionID || idx)}>
                              <td className="font-semibold">
                                <span className="cell-flex">
                                  <Tag size={13} className="text-primary" />
                                  {g.GradeName}
                                </span>
                              </td>
                              <td>{g.ProductType}</td>
                              <td className="muted">{g.SpeciesName || 'All Species'}</td>
                              <td>
                                <span className={`badge-pill ${g.IsStandard ? 'badge-blue' : 'badge-amber'}`}>
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
            </div>
          )}

          {/* TAB 2: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="settings-tab-pane">
              <div className="pane-header-actions">
                <div>
                  <h4 className="pane-title">Suppliers Register</h4>
                  <p className="pane-subtitle">Manage timber growers, forest managers and transport partners</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    onOpenAddSupplier()
                  }}
                >
                  <Plus size={15} /> Add Supplier
                </button>
              </div>

              {suppliers.length === 0 ? (
                <div className="empty-panel">
                  <Building size={32} className="muted" />
                  <h5>No suppliers registered</h5>
                  <p>Click Add Supplier to add your first plantation owner or timber supplier.</p>
                </div>
              ) : (
                <div className="settings-table-wrapper">
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>ID / Ref</th>
                        <th>Supplier Name</th>
                        <th>Address</th>
                        <th>ABN</th>
                        <th>Payment Terms</th>
                        <th>Phone</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => (
                        <tr key={String(s.SupplierID || s.SupplierReference)}>
                          <td className="font-bold text-primary">
                            {s.SupplierReference || s.SupplierID}
                          </td>
                          <td className="font-semibold">{s.SupplierName}</td>
                          <td className="muted">{s.Address || '—'}</td>
                          <td>{s.ABN || '—'}</td>
                          <td>{s.PaymentTerms || '—'}</td>
                          <td>{s.Phone || '—'}</td>
                          <td>{s.Email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REPORTS */}
          {activeTab === 'reports' && (
            <div className="settings-tab-pane">
              <div className="reports-kpi-grid">
                <div className="kpi-box">
                  <span className="kpi-label">Total Procurements</span>
                  <strong className="kpi-value">{reportData.procurementsCount}</strong>
                  <span className="kpi-sub">{reportData.activeCount} Active • {reportData.draftCount} Draft • {reportData.completedCount} Completed</span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Agreed Tonnes</span>
                  <strong className="kpi-value">{reportData.totalAgreed.toLocaleString()} t</strong>
                  <span className="kpi-sub">Total contracted volume</span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Delivered Tonnes</span>
                  <strong className="kpi-value text-emerald">{reportData.totalDelivered.toLocaleString()} t</strong>
                  <span className="kpi-sub">
                    {reportData.totalAgreed > 0
                      ? Math.round((reportData.totalDelivered / reportData.totalAgreed) * 100)
                      : 0}% fulfillment rate
                  </span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Remaining to Deliver</span>
                  <strong className="kpi-value text-blue">{reportData.totalRemaining.toLocaleString()} t</strong>
                  <span className="kpi-sub">Outstanding balance</span>
                </div>
              </div>

              <div className="reports-section-title">
                <h5>Volume by Species</h5>
              </div>
              <div className="settings-table-wrapper" style={{ marginBottom: '20px' }}>
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Species</th>
                      <th>Agreed (Tonnes)</th>
                      <th>Delivered (Tonnes)</th>
                      <th>Remaining (Tonnes)</th>
                      <th>Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(reportData.speciesBreakdown).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center muted">No procurement deliveries recorded yet.</td>
                      </tr>
                    ) : (
                      Object.entries(reportData.speciesBreakdown).map(([sp, data]) => {
                        const pct = data.agreed > 0 ? Math.round((data.delivered / data.agreed) * 100) : 0
                        return (
                          <tr key={sp}>
                            <td className="font-semibold">{sp}</td>
                            <td>{data.agreed.toLocaleString()} t</td>
                            <td className="text-emerald font-semibold">{data.delivered.toLocaleString()} t</td>
                            <td className="text-blue font-semibold">{Math.max(0, data.agreed - data.delivered).toLocaleString()} t</td>
                            <td>
                              <span className={`badge-pill ${pct >= 100 ? 'badge-emerald' : 'badge-blue'}`}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="reports-section-title">
                <h5>Volume by Supplier</h5>
              </div>
              <div className="settings-table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Deals</th>
                      <th>Agreed Volume</th>
                      <th>Delivered Volume</th>
                      <th>Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(reportData.supplierBreakdown).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center muted">No supplier volume data available.</td>
                      </tr>
                    ) : (
                      Object.entries(reportData.supplierBreakdown).map(([supp, data]) => {
                        const pct = data.agreed > 0 ? Math.round((data.delivered / data.agreed) * 100) : 0
                        return (
                          <tr key={supp}>
                            <td className="font-semibold">{supp}</td>
                            <td>{data.deals}</td>
                            <td>{data.agreed.toLocaleString()} t</td>
                            <td className="text-emerald font-semibold">{data.delivered.toLocaleString()} t</td>
                            <td>
                              <span className={`badge-pill ${pct >= 100 ? 'badge-emerald' : 'badge-blue'}`}>
                                {pct}%
                              </span>
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

          {/* TAB 4: WORKBOOK & EXPORT (Includes Export Workbook and Display Workbook Location) */}
          {activeTab === 'workbook' && (
            <div className="settings-tab-pane">
              <div className="workbook-tools-grid">
                {/* Export Card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-blue-light">
                    <Download size={22} className="text-blue" />
                  </div>
                  <div className="tool-card-body">
                    <h5>Export Workbook (.xlsx)</h5>
                    <p>
                      Download the updated Microsoft Excel workbook file containing all 11 core sheets,
                      suppliers, procurement agreements, price history revisions, and costings.
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => window.logPro.exportWorkbookFile(workbookPath)}
                      style={{ marginTop: '12px' }}
                    >
                      <Download size={15} /> Download .xlsx Workbook
                    </button>
                  </div>
                </div>

                {/* Location Card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-amber-light">
                    <MapPin size={22} className="text-amber" />
                  </div>
                  <div className="tool-card-body">
                    <h5>Display Workbook Location</h5>
                    <p>
                      The current database location used by LogPro to persist all transactions and procurement records:
                    </p>
                    <div className="location-box" style={{ marginTop: '12px' }}>
                      <code>{workbookPath}</code>
                      <button
                        type="button"
                        className="location-copy-btn"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(workbookPath)
                            setHasCopiedLocation(true)
                            setTimeout(() => setHasCopiedLocation(false), 2000)
                          }
                        }}
                        title="Copy file path"
                      >
                        {hasCopiedLocation ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        <span>{hasCopiedLocation ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  )
}
