import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

type Supplier = {
  SupplierReference: string
  SupplierName: string
  ABN: string
  Phone: string
  Email: string
  Notes: string
  CreatedAt: string
}

type WorkbookResult = {
  path: string
  error: string
  suppliers: Supplier[]
}

type SupplierForm = {
  name: string
  abn: string
  phone: string
  email: string
  notes: string
}

type Page =
  | 'home'
  | 'procurements'
  | 'priceHistory'
  | 'suppliers'
  | 'costing'
  | 'reports'
  | 'resales'
  | 'settings'

const emptySupplierForm: SupplierForm = {
  name: '',
  abn: '',
  phone: '',
  email: '',
  notes: '',
}

const lastWorkbookKey = 'logpro.lastWorkbook'

const desktopMissingMessage =
  'LogPro cannot reach the desktop side of the app. Close this window, press Ctrl+C in the VS Code terminal, then start again with: npm run dev'

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
    id: 'suppliers',
    label: 'Suppliers',
    description: 'Manage businesses and people who supply logs.',
  },
  {
    id: 'costing',
    label: 'Costing',
    description: 'Work out the most you can afford to offer a supplier, per tonne.',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Summaries of your procurements and tonnes.',
  },
  {
    id: 'resales',
    label: 'Resales',
    description: 'A small record of logs sold on (optional).',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Users, species, grades and other settings.',
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
    // Remembering the workbook is a convenience only, so ignore problems.
  }
}

function App() {
  const [isStarting, setIsStarting] = useState(true)
  const [selectedWorkbook, setSelectedWorkbook] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false)
  const [supplierForm, setSupplierForm] =
    useState<SupplierForm>(emptySupplierForm)
  const [supplierError, setSupplierError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const lastWorkbook = readLastWorkbook()

    if (!lastWorkbook) {
      setIsStarting(false)
      return
    }

    if (typeof window.logPro?.loadWorkbook !== 'function') {
      setErrorMessage(desktopMissingMessage)
      setIsStarting(false)
      return
    }

    window.logPro
      .loadWorkbook(lastWorkbook)
      .then((result) => applyWorkbookResult(result))
      .catch(() => setErrorMessage(desktopMissingMessage))
      .finally(() => setIsStarting(false))
  }, [])

  function applyWorkbookResult(result: WorkbookResult | null) {
    if (!result) {
      return
    }

    if (result.error) {
      setSelectedWorkbook('')
      setErrorMessage(result.error)
      return
    }

    setSelectedWorkbook(result.path)
    setSuppliers(result.suppliers)
    setErrorMessage('')
    setCurrentPage('home')
    rememberWorkbook(result.path)
  }

  async function handleOpenWorkbook() {
    if (typeof window.logPro === 'undefined') {
      setErrorMessage(desktopMissingMessage)
      return
    }

    try {
      applyWorkbookResult(await window.logPro.openWorkbook())
    } catch {
      setErrorMessage(desktopMissingMessage)
    }
  }

  async function handleCreateWorkbook() {
    if (typeof window.logPro === 'undefined') {
      setErrorMessage(desktopMissingMessage)
      return
    }

    try {
      applyWorkbookResult(await window.logPro.createWorkbook())
    } catch {
      setErrorMessage(desktopMissingMessage)
    }
  }

  function handleCloseWorkbook() {
    setSelectedWorkbook('')
    setSuppliers([])
    setErrorMessage('')
    setCurrentPage('home')
    setIsSupplierFormOpen(false)
    setSupplierForm(emptySupplierForm)
    setSupplierError('')
    rememberWorkbook('')
  }

  function openSupplierForm() {
    setSupplierForm(emptySupplierForm)
    setSupplierError('')
    setIsSupplierFormOpen(true)
  }

  function closeSupplierForm() {
    setIsSupplierFormOpen(false)
    setSupplierForm(emptySupplierForm)
    setSupplierError('')
  }

  function updateSupplierField(field: keyof SupplierForm, value: string) {
    setSupplierForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSaveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (typeof window.logPro === 'undefined') {
      setSupplierError(desktopMissingMessage)
      return
    }

    setIsSaving(true)
    setSupplierError('')

    try {
      const result = await window.logPro.saveSupplier(
        selectedWorkbook,
        supplierForm,
      )

      if (result.error) {
        setSupplierError(result.error)
        return
      }

      setSuppliers(result.suppliers)
      closeSupplierForm()
    } catch {
      setSupplierError(desktopMissingMessage)
    } finally {
      setIsSaving(false)
    }
  }

  function renderSuppliersPage() {
    return (
      <section className="page-content">
        <div className="page-heading">
          <div>
            <h2>Suppliers</h2>
            <p>Manage businesses and people who supply logs.</p>
          </div>

          <button type="button" onClick={openSupplierForm}>
            Add Supplier
          </button>
        </div>

        {suppliers.length === 0 ? (
          <section className="empty-state">
            <h3>No suppliers yet</h3>
            <p>Click Add Supplier to create your first supplier.</p>
          </section>
        ) : (
          <section className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>ABN</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.SupplierReference}>
                    <td>{supplier.SupplierReference}</td>
                    <td>{supplier.SupplierName}</td>
                    <td>{supplier.ABN || '—'}</td>
                    <td>{supplier.Phone || '—'}</td>
                    <td>{supplier.Email || '—'}</td>
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
    if (currentPage === 'suppliers') {
      return renderSuppliersPage()
    }

    if (currentPage === 'home') {
      return (
        <section className="home-content">
          <h2>Home</h2>
          <p>Choose an area to begin managing your log procurement records.</p>

          <div className="navigation-grid">
            {pageList
              .filter((page) => page.id !== 'home')
              .map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="nav-card"
                  onClick={() => setCurrentPage(page.id)}
                >
                  <strong>{page.label}</strong>
                  <span>{page.description}</span>
                </button>
              ))}
          </div>
        </section>
      )
    }

    const page = pageList.find((item) => item.id === currentPage)

    return (
      <section className="page-content">
        <div className="page-heading">
          <div>
            <h2>{page?.label}</h2>
            <p>{page?.description}</p>
          </div>
        </div>

        <section className="empty-state">
          <h3>Coming soon</h3>
          <p>This page will be built in a later step.</p>
        </section>
      </section>
    )
  }

  if (isStarting) {
    return (
      <main className="app">
        <section className="setup-card">
          <h1>LogPro</h1>
          <p className="subtitle">Opening your last workbook…</p>
        </section>
      </main>
    )
  }

  if (selectedWorkbook) {
    return (
      <main className="home-page">
        <header className="top-bar">
          <div>
            <h1>LogPro</h1>
            <p>Log Procurement Tracker</p>
          </div>

          <button
            type="button"
            className="close-workbook-button"
            onClick={handleCloseWorkbook}
          >
            Close Workbook
          </button>
        </header>

        <nav className="main-navigation">
          {pageList.map((page) => (
            <button
              key={page.id}
              type="button"
              className={currentPage === page.id ? 'nav-active' : ''}
              onClick={() => setCurrentPage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>

        <section className="workbook-banner">
          <strong>Current workbook:</strong> {selectedWorkbook}
        </section>

        {renderPage()}

        {isSupplierFormOpen && (
          <div className="modal-backdrop">
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-form-title"
            >
              <h2 id="supplier-form-title">Add Supplier</h2>

              <form onSubmit={handleSaveSupplier}>
                <label htmlFor="supplier-name">
                  Supplier name
                  <input
                    id="supplier-name"
                    type="text"
                    value={supplierForm.name}
                    onChange={(event) =>
                      updateSupplierField('name', event.target.value)
                    }
                    placeholder="Example: Sunshine Timber Pty Ltd"
                    required
                  />
                </label>

                <label htmlFor="supplier-abn">
                  ABN
                  <input
                    id="supplier-abn"
                    type="text"
                    value={supplierForm.abn}
                    onChange={(event) =>
                      updateSupplierField('abn', event.target.value)
                    }
                    placeholder="Example: 12 345 678 901"
                  />
                </label>

                <label htmlFor="supplier-phone">
                  Phone
                  <input
                    id="supplier-phone"
                    type="tel"
                    value={supplierForm.phone}
                    onChange={(event) =>
                      updateSupplierField('phone', event.target.value)
                    }
                    placeholder="Example: 03 9000 0000"
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
                    placeholder="Example: contact@example.com"
                  />
                </label>

                <label htmlFor="supplier-notes">
                  Notes
                  <textarea
                    id="supplier-notes"
                    value={supplierForm.notes}
                    onChange={(event) =>
                      updateSupplierField('notes', event.target.value)
                    }
                    placeholder="Optional notes about this supplier"
                    rows={4}
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
                    {isSaving ? 'Saving…' : 'Save Supplier'}
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
          Important: Do not open or edit the same workbook in LogPro on more than
          one computer at the same time.
        </p>
      </section>
    </main>
  )
}

export default App