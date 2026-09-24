import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import CostingPage from './CostingPage'
import {
  type Supplier,
  type Procurement,
  type ProcurementGrade,
  type PriceHistory,
  type Page,
  type WorkbookResult,
} from './types'
import { ProcurementsTab } from './components/ProcurementsTab'
import { HomeOverview } from './components/HomeOverview'
import { PriceHistoryTab } from './components/PriceHistoryTab'
import { PriceListTab } from './components/PriceListTab'
import { SettingsModal } from './components/SettingsModal'
import { Building, Plus, Trees, Settings as SettingsIcon, Pencil } from 'lucide-react'
import './App.css'

type SupplierForm = {
  name: string
  abn: string
  address: string
  paymentTerms: string
  phone: string
  email: string
  notes: string
}

const emptySupplierForm: SupplierForm = {
  name: '',
  abn: '',
  address: '',
  paymentTerms: '',
  phone: '',
  email: '',
  notes: '',
}

const lastWorkbookKey = 'logpro.lastWorkbook'

const pageList: { id: Page; label: string; description: string }[] = [
  { id: 'home', label: 'Home', description: 'Overview of your work.' },
  {
    id: 'procurements',
    label: 'Procurements',
    description: 'Track each negotiation or agreement, from Draft to Completed.',
  },
  {
    id: 'priceHistory',
    label: 'Price History',
    description: 'Every price change, with the reason, date and who made it.',
  },
  {
    id: 'costing',
    label: 'Costing',
    description: 'Work out the most you can afford to offer a supplier, per tonne.',
  },
  {
    id: 'priceList',
    label: 'Price List',
    description: 'View purchase prices and enter resale prices for each procurement.',
  },
]

function readLastWorkbook(): string {
  try {
    return window.localStorage.getItem(lastWorkbookKey) ?? ''
  } catch {
    return ''
  }
}

function rememberWorkbook(workbookPath: string) {
  try {
    if (workbookPath) {
      window.localStorage.setItem(lastWorkbookKey, workbookPath)
    } else {
      window.localStorage.removeItem(lastWorkbookKey)
    }
  } catch {
    // Ignore storage issues
  }
}

function App() {
  const [isStarting, setIsStarting] = useState(true)
  const [selectedWorkbook, setSelectedWorkbook] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [currentPage, setCurrentPage] = useState<Page>('procurements')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [grades, setGrades] = useState<ProcurementGrade[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | number | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm)
  const [supplierError, setSupplierError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    // Default to log_procurement.xlsx if nothing is saved
    const lastWorkbook = readLastWorkbook() || 'log_procurement.xlsx'

    if (typeof window.logPro?.loadWorkbook !== 'function') {
      Promise.resolve().then(() => setIsStarting(false))
      return
    }

    window.logPro
      .loadWorkbook(lastWorkbook)
      .then((result) => applyWorkbookResult(result))
      .catch((err) => {
        console.warn('Initial workbook load error:', err)
        // Fallback to logpro.xlsx if needed
        window.logPro
          .loadWorkbook('logpro.xlsx')
          .then((r) => applyWorkbookResult(r))
          .catch(() => setErrorMessage('Could not load workbook.'))
      })
      .finally(() => setIsStarting(false))
  }, [])

  function applyWorkbookResult(result: WorkbookResult | null) {
    if (!result) return

    if (result.error) {
      setSelectedWorkbook('')
      setErrorMessage(result.error)
      return
    }

    setSelectedWorkbook(result.path)
    setSuppliers(result.suppliers)
    if (result.procurements) setProcurements(result.procurements)
    if (result.grades) setGrades(result.grades)
    if (result.priceHistory) setPriceHistory(result.priceHistory)
    setErrorMessage('')
    rememberWorkbook(result.path)
  }

  async function handleOpenWorkbook() {
    try {
      applyWorkbookResult(await window.logPro.openWorkbook())
    } catch {
      setErrorMessage('Could not open workbook.')
    }
  }

  async function handleCreateWorkbook() {
    try {
      applyWorkbookResult(await window.logPro.createWorkbook())
    } catch {
      setErrorMessage('Could not create workbook.')
    }
  }

  function refreshWorkbookData() {
    if (!selectedWorkbook) return
    window.logPro.loadWorkbook(selectedWorkbook).then((res) => {
      if (res && !res.error) {
        setSuppliers(res.suppliers)
        if (res.procurements) setProcurements(res.procurements)
        if (res.grades) setGrades(res.grades)
        if (res.priceHistory) setPriceHistory(res.priceHistory)
      }
    })
  }

  function openSupplierForm(supplier?: Supplier) {
    if (supplier) {
      setEditingSupplierId(supplier.SupplierID || supplier.SupplierReference || null)
      setSupplierForm({
        name: supplier.SupplierName || '',
        abn: supplier.ABN || '',
        address: supplier.Address || '',
        paymentTerms: supplier.PaymentTerms || '',
        phone: supplier.Phone || '',
        email: supplier.Email || '',
        notes: supplier.Notes || '',
      })
    } else {
      setEditingSupplierId(null)
      setSupplierForm(emptySupplierForm)
    }
    setSupplierError('')
    setIsSupplierFormOpen(true)
  }

  function closeSupplierForm() {
    setIsSupplierFormOpen(false)
    setEditingSupplierId(null)
    setSupplierForm(emptySupplierForm)
    setSupplierError('')
  }

  function updateSupplierField(field: keyof SupplierForm, value: string) {
    setSupplierForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSaveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setSupplierError('')

    try {
      const result = editingSupplierId
        ? await window.logPro.updateSupplier(
            selectedWorkbook,
            editingSupplierId,
            supplierForm,
          )
        : await window.logPro.saveSupplier(
            selectedWorkbook,
            supplierForm,
          )

      if (result.error) {
        setSupplierError(result.error)
        return
      }

      setSuppliers(result.suppliers)
      closeSupplierForm()
    } catch (e: any) {
      setSupplierError(e?.message || 'Error saving supplier')
    } finally {
      setIsSaving(false)
    }
  }

  function renderSuppliersPage() {
    return (
      <section className="page-content" style={{ maxWidth: '1200px' }}>
        <div className="page-heading">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={24} color="var(--primary)" />
              <h2 style={{ margin: 0 }}>Suppliers Register</h2>
            </div>
            <p>Manage businesses, plantation growers and timber contractors.</p>
          </div>

          <button
            type="button"
            onClick={() => openSupplierForm()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Add Supplier
          </button>
        </div>

        {suppliers.length === 0 ? (
          <section className="empty-state">
            <h3>No suppliers yet</h3>
            <p>Click Add Supplier to create your first supplier.</p>
          </section>
        ) : (
          <section className="table-card" style={{ marginTop: '20px' }}>
            <table>
              <thead>
                <tr>
                  <th>ID / Ref</th>
                  <th>Supplier Name</th>
                  <th>Address</th>
                  <th>ABN</th>
                  <th>Payment Terms</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={String(supplier.SupplierID || supplier.SupplierReference)}>
                    <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                      {supplier.SupplierReference || supplier.SupplierID}
                    </td>
                    <td style={{ fontWeight: 600 }}>{supplier.SupplierName}</td>
                    <td style={{ color: 'var(--muted)' }}>{supplier.Address || '—'}</td>
                    <td>{supplier.ABN || '—'}</td>
                    <td>{supplier.PaymentTerms || '—'}</td>
                    <td>{supplier.Phone || '—'}</td>
                    <td>{supplier.Email || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openSupplierForm(supplier)}
                        title={`Edit ${supplier.SupplierName}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    )
  }

  function renderPage() {
    if (currentPage === 'procurements') {
      return (
        <ProcurementsTab
          workbookPath={selectedWorkbook}
          suppliers={suppliers}
          onDataChanged={refreshWorkbookData}
        />
      )
    }

    if (currentPage === 'home') {
      return (
        <HomeOverview
          workbookPath={selectedWorkbook}
          suppliers={suppliers}
          onNavigate={(p) => setCurrentPage(p)}
        />
      )
    }

    if (currentPage === 'priceHistory') {
      return (
        <PriceHistoryTab
          workbookPath={selectedWorkbook}
          priceHistory={priceHistory}
          procurements={procurements}
          grades={grades}
          suppliers={suppliers}
          onRefresh={refreshWorkbookData}
          onNavigateToProcurement={() => {
            setCurrentPage('procurements')
          }}
        />
      )
    }

    if (currentPage === 'suppliers') {
      return renderSuppliersPage()
    }

    if (currentPage === 'costing') {
      return (
        <CostingPage
          workbookPath={selectedWorkbook}
        />
      )
    }

    if (currentPage === 'priceList') {
      return (
        <PriceListTab
          workbookPath={selectedWorkbook}
          procurements={procurements}
          suppliers={suppliers}
          onRefresh={refreshWorkbookData}
        />
      )
    }

    const page = pageList.find((item) => item.id === currentPage)

    return (
      <section className="page-content" style={{ maxWidth: '1000px' }}>
        <div className="page-heading">
          <div>
            <h2>{page?.label}</h2>
            <p>{page?.description}</p>
          </div>
        </div>

        <section className="empty-state">
          <h3>Phase {page?.id === 'priceHistory' ? '2' : '3'} Development</h3>
          <p>
            {page?.label} will connect directly to this procurement engine in the upcoming implementation phases.
          </p>
        </section>
      </section>
    )
  }

  if (isStarting) {
    return (
      <main className="app">
        <section className="setup-card">
          <h1>LogPro</h1>
          <p className="subtitle">Opening your Log Procurement workbook…</p>
        </section>
      </main>
    )
  }

  if (selectedWorkbook) {
    return (
      <main className="home-page">
        <div className="sticky-header-container">
          <header className="top-bar">
            <div className="brand-group">
              <div className="brand-logo-badge">
                <Trees size={20} />
              </div>
              <div>
                <div className="brand-title-wrap">
                  <h1>LogPro</h1>
                </div>
                <p>Timber & Log Procurement Management System</p>
              </div>
            </div>

            <div className="top-bar-actions">
              <button
                type="button"
                className="settings-header-button"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings & Administration"
              >
                <SettingsIcon size={16} />
                <span>Settings</span>
              </button>
            </div>
          </header>

          <nav className="main-navigation">
            <div className="nav-container">
              {pageList.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={`nav-button ${currentPage === page.id ? 'nav-active' : ''}`}
                  onClick={() => setCurrentPage(page.id)}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {renderPage()}

        {/* Unified Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          workbookPath={selectedWorkbook}
          suppliers={suppliers}
          onOpenAddSupplier={() => openSupplierForm()}
          onRefresh={refreshWorkbookData}
          onWorkbookChanged={applyWorkbookResult}
        />

        {/* Version footer */}
        <footer className="app-version-footer">
          LogPro v0.1.0
        </footer>

        {isSupplierFormOpen && (
          <div className="modal-backdrop">
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-form-title"
              style={{ width: 'min(100%, 640px)' }}
            >
              <h2 id="supplier-form-title" style={{ margin: '0 0 16px' }}>
                {editingSupplierId ? 'Edit Supplier' : 'Add Supplier'}
              </h2>

              <form onSubmit={handleSaveSupplier}>
                <label htmlFor="supplier-name">
                  Supplier Name *
                  <input
                    id="supplier-name"
                    type="text"
                    value={supplierForm.name}
                    onChange={(event) =>
                      updateSupplierField('name', event.target.value)
                    }
                    placeholder="e.g. Hancock Victorian Plantations (HVP)"
                    required
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <label htmlFor="supplier-abn">
                    ABN
                    <input
                      id="supplier-abn"
                      type="text"
                      value={supplierForm.abn}
                      onChange={(event) =>
                        updateSupplierField('abn', event.target.value)
                      }
                      placeholder="e.g. 12 345 678 901"
                    />
                  </label>

                  <label htmlFor="supplier-payment-terms">
                    Payment Terms
                    <input
                      id="supplier-payment-terms"
                      type="text"
                      value={supplierForm.paymentTerms}
                      onChange={(event) =>
                        updateSupplierField('paymentTerms', event.target.value)
                      }
                      placeholder="e.g. 30 Days EOM"
                    />
                  </label>
                </div>

                <label htmlFor="supplier-address">
                  Physical / Depot Address
                  <input
                    id="supplier-address"
                    type="text"
                    value={supplierForm.address}
                    onChange={(event) =>
                      updateSupplierField('address', event.target.value)
                    }
                    placeholder="e.g. 14 Forest Road, Mount Gambier SA"
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <label htmlFor="supplier-phone">
                    Phone
                    <input
                      id="supplier-phone"
                      type="tel"
                      value={supplierForm.phone}
                      onChange={(event) =>
                        updateSupplierField('phone', event.target.value)
                      }
                      placeholder="e.g. 03 9000 0000"
                    />
                  </label>

                  <label htmlFor="supplier-email">
                    Email
                    <input
                      id="supplier-email"
                      type="email"
                      value={supplierForm.email}
                      onChange={(event) =>
                        updateSupplierField('email', event.target.value)
                      }
                      placeholder="e.g. contact@supplier.com"
                    />
                  </label>
                </div>

                <label htmlFor="supplier-notes">
                  Notes
                  <textarea
                    id="supplier-notes"
                    value={supplierForm.notes}
                    onChange={(event) =>
                      updateSupplierField('notes', event.target.value)
                    }
                    placeholder="Optional details or delivery specifications"
                    rows={3}
                  />
                </label>

                {supplierError && (
                  <p className="error-message">{supplierError}</p>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeSupplierForm}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving…' : (editingSupplierId ? 'Save Changes' : 'Save Supplier')}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="app">
      <section className="setup-card">
        <h1>LogPro</h1>
        <p className="subtitle">Log Procurement Tracker</p>

        <h2>Welcome</h2>
        <p>
          Create a new Excel workbook, or select an existing LogPro workbook to
          continue.
        </p>

        <div className="button-group">
          <button type="button" onClick={handleCreateWorkbook}>
            Create New Workbook
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleOpenWorkbook}
          >
            Open Existing Workbook
          </button>
        </div>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <p className="warning">
          Important: LogPro persists your data in Excel format with automatic browser backup.
          Use the Download .xlsx button anytime to save files to your local drive.
        </p>
      </section>
    </main>
  )
}

export default App
