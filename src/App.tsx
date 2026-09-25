import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import CostingPage from './CostingPage'
import {
  type Supplier,
  type SupplierContact,
  type Procurement,
  type ProcurementGrade,
  type PriceHistory,
  type Page,
  type WorkbookResult,
} from './types'
import { ProcurementsTab } from './components/ProcurementsTab'
import { HomeOverview } from './components/HomeOverview'
import { ContactsTab } from './components/ContactsTab'
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

type SupplierContactForm = {
  tempId: string
  name: string
  phone: string
  email: string
  isPrimary: boolean
}

let contactRowCounter = 0
function nextContactRowId(): string {
  contactRowCounter += 1
  return `contact-row-${contactRowCounter}`
}

function makeEmptyContactRow(): SupplierContactForm {
  return { tempId: nextContactRowId(), name: '', phone: '', email: '', isPrimary: true }
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
    id: 'contacts',
    label: 'Contacts',
    description: 'Directory of all supplier contacts across all growers and contractors.',
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
  const [targetProcurementSupplierId, setTargetProcurementSupplierId] = useState<string | undefined>()
  const [targetProcurementContactId, setTargetProcurementContactId] = useState<string | undefined>()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [grades, setGrades] = useState<ProcurementGrade[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | number | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm)
  const [supplierContactForms, setSupplierContactForms] = useState<SupplierContactForm[]>([
    makeEmptyContactRow(),
  ])
  const [supplierError, setSupplierError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // DEBUG: test physical attachment save
async function testSaveAttachment() {
  if (!selectedWorkbook) {
    alert('No workbook open yet.');
    return;
  }

  const desktop = (window as any).logProDesktop;
  if (!desktop || typeof desktop.saveAttachmentFile !== 'function') {
    alert('Desktop attachment API not available.');
    return;
  }

  const dummyText = 'Test attachment for PROC-0001';
  const blob = new Blob([dummyText], { type: 'text/plain' });
  const file = new File([blob], 'test_attachment.txt', { type: 'text/plain' });

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1] || reader.result;

    const supplierName = 'HVP';
    const procurementRef = 'PROC-0001';

    try {
      const result = await desktop.saveAttachmentFile(
        selectedWorkbook,
        supplierName,
        procurementRef,
        file.name,
        base64,
      );

      if (!result || !result.ok) {
        alert('Save failed: ' + (result?.error || 'Unknown error'));
      } else {
        alert('Saved OK:\n' + result.relativePath);
      }
    } catch (e: any) {
      alert('Save error: ' + (e?.message || String(e)));
    }
  };
  reader.onerror = () => {
    alert('Could not read test file.');
  };
  reader.readAsDataURL(file);
}

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const lastWorkbook = readLastWorkbook()

    if (typeof window.logPro?.loadWorkbook !== 'function') {
      Promise.resolve().then(() => setIsStarting(false))
      return
    }

    if (!lastWorkbook) {
      setIsStarting(false)
      return
    }

    window.logPro
      .loadWorkbook(lastWorkbook)
      .then((result) => {
        if (!result || result.error || !result.path) {
          rememberWorkbook('')
          setSelectedWorkbook('')
          setErrorMessage(
            'Your previously selected workbook could not be found. Please create a new workbook or open an existing one.',
          )
          return
        }

        applyWorkbookResult(result)
      })
      .catch((error) => {
        console.warn('Initial workbook load error:', error)
        rememberWorkbook('')
        setSelectedWorkbook('')
        setErrorMessage(
          'Your previously selected workbook could not be opened. Please create a new workbook or open an existing one.',
        )
      })
      .finally(() => setIsStarting(false))

    // Cleanup: clear cached workbook path when app closes
    return () => {
      try {
        window.localStorage.removeItem(lastWorkbookKey)
        console.log('[App] Cleared workbook path cache on close')
      } catch (error) {
        console.warn('[App] Could not clear cache on close:', error)
      }
    }
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
    try {
      const c = window.logPro.getSupplierContacts(result.path)
      setContacts(c || [])
    } catch {
      // ignore
    }
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

async function testCreateWorkbookDirect() {
  const desktop = (window as any).logProDesktop;
  if (!desktop || typeof desktop.createWorkbook !== 'function') {
    alert('Desktop API not available.');
    return;
  }

  try {
    const result = await desktop.createWorkbook();
    if (!result || !result.path) {
      alert('Create workbook failed: no path returned.');
      return;
    }
    alert('Workbook created at:\n' + result.path);
  } catch (e: any) {
    alert('Create workbook error: ' + (e?.message || String(e)));
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
    try {
      const c = window.logPro.getSupplierContacts(selectedWorkbook)
      setContacts(c || [])
    } catch {
      // ignore
    }
  }

  function openSupplierForm(supplier?: Supplier) {
    if (supplier) {
      const sIdStr = String(supplier.SupplierID || '').trim()
      const sRefStr = String(supplier.SupplierReference || '').trim()
      const suppContacts = contacts.filter((c) => {
        const cSuppId = String(c.SupplierID).trim()
        return (sIdStr && cSuppId === sIdStr) || (sRefStr && cSuppId === sRefStr)
      })
      const primaryContact = suppContacts.find((c) => c.IsPrimary) || suppContacts[0]

      setEditingSupplierId(supplier.SupplierID || supplier.SupplierReference || null)
      setSupplierForm({
        name: supplier.SupplierName || '',
        abn: supplier.ABN || '',
        address: supplier.Address || '',
        paymentTerms: supplier.PaymentTerms || '',
        phone: supplier.Phone || primaryContact?.PhoneNumber || primaryContact?.MobileNumber || '',
        email: supplier.Email || primaryContact?.Email || '',
        notes: supplier.Notes || '',
      })
    } else {
      setEditingSupplierId(null)
      setSupplierForm(emptySupplierForm)
    }
    setSupplierContactForms([makeEmptyContactRow()])
    setSupplierError('')
    setIsSupplierFormOpen(true)
  }

  function closeSupplierForm() {
    setIsSupplierFormOpen(false)
    setEditingSupplierId(null)
    setSupplierForm(emptySupplierForm)
    setSupplierContactForms([makeEmptyContactRow()])
    setSupplierError('')
  }

  function updateSupplierField(field: keyof SupplierForm, value: string) {
    setSupplierForm((current) => ({ ...current, [field]: value }))
  }

  function addSupplierContactRow() {
    setSupplierContactForms((current) => [
      ...current,
      { tempId: nextContactRowId(), name: '', phone: '', email: '', isPrimary: false },
    ])
  }

  function removeSupplierContactRow(tempId: string) {
    setSupplierContactForms((current) => {
      if (current.length <= 1) return current
      const filtered = current.filter((c) => c.tempId !== tempId)
      if (filtered.length > 0 && !filtered.some((c) => c.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true }
      }
      return filtered
    })
  }

  function updateSupplierContactRow(
    tempId: string,
    field: 'name' | 'phone' | 'email',
    value: string,
  ) {
    setSupplierContactForms((current) =>
      current.map((c) => (c.tempId === tempId ? { ...c, [field]: value } : c)),
    )
  }

  function setPrimarySupplierContact(tempId: string) {
    setSupplierContactForms((current) =>
      current.map((c) => ({ ...c, isPrimary: c.tempId === tempId })),
    )
  }

  function validateNewSupplierContacts(rows: SupplierContactForm[]): SupplierContactForm[] {
    const filledIn = rows.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim())
    if (filledIn.length === 0) {
      throw new Error('Please add at least one contact (name, phone number and email).')
    }
    for (const c of filledIn) {
      if (!c.name.trim() || !c.phone.trim() || !c.email.trim()) {
        throw new Error(
          'Each contact needs a name, phone number and email. Remove any empty contact rows.',
        )
      }
    }
    return filledIn
  }

  async function handleSaveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setSupplierError('')

    try {
      let contactsToSave: SupplierContactForm[] = []
      if (!editingSupplierId) {
        contactsToSave = validateNewSupplierContacts(supplierContactForms)
      }

      // If company phone or email is empty, include primary contact details
      if (!editingSupplierId && contactsToSave.length > 0) {
        const primary = contactsToSave.find((c) => c.isPrimary) || contactsToSave[0]
        if (!supplierForm.phone.trim() && primary?.phone.trim()) {
          supplierForm.phone = primary.phone.trim()
        }
        if (!supplierForm.email.trim() && primary?.email.trim()) {
          supplierForm.email = primary.email.trim()
        }
      }

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

      if (!editingSupplierId && contactsToSave.length > 0) {
        const newSupplier = result.suppliers[result.suppliers.length - 1]
        const newSupplierId = newSupplier?.SupplierID || newSupplier?.SupplierReference
        for (const contact of contactsToSave) {
          await window.logPro.saveSupplierContact(selectedWorkbook, {
            SupplierID: newSupplierId,
            ContactName: contact.name.trim(),
            Role: '',
            PhoneNumber: contact.phone.trim(),
            MobileNumber: '',
            Email: contact.email.trim(),
            Notes: '',
            IsPrimary: contact.isPrimary,
          })
        }
      }

      setSuppliers(result.suppliers)
      refreshWorkbookData()
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
                  <th>Contact Person</th>
                  <th>Address</th>
                  <th>ABN</th>
                  <th>Payment Terms</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const sIdStr = String(supplier.SupplierID || '').trim()
                  const sRefStr = String(supplier.SupplierReference || '').trim()
                  const suppContacts = contacts.filter((c) => {
                    const cSuppId = String(c.SupplierID).trim()
                    return (sIdStr && cSuppId === sIdStr) || (sRefStr && cSuppId === sRefStr)
                  })
                  const primaryContact = suppContacts.find((c) => c.IsPrimary) || suppContacts[0]
                  const displayPhone = supplier.Phone?.trim() || primaryContact?.PhoneNumber?.trim() || primaryContact?.MobileNumber?.trim() || '—'
                  const displayEmail = supplier.Email?.trim() || primaryContact?.Email?.trim() || '—'

                  return (
                    <tr key={String(supplier.SupplierID || supplier.SupplierReference)}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                        {supplier.SupplierReference || supplier.SupplierID}
                      </td>
                      <td style={{ fontWeight: 600 }}>{supplier.SupplierName}</td>
                      <td>
                        {primaryContact ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{primaryContact.ContactName}</span>
                            {primaryContact.IsPrimary && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  backgroundColor: '#dcfce7',
                                  color: '#166534',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                }}
                              >
                                Primary
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{supplier.Address || '—'}</td>
                      <td>{supplier.ABN || '—'}</td>
                      <td>{supplier.PaymentTerms || '—'}</td>
                      <td>{displayPhone}</td>
                      <td>{displayEmail}</td>
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
                  )
                })}
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
          initialSupplierId={targetProcurementSupplierId}
          initialContactId={targetProcurementContactId}
          onClearInitialSelection={() => {
            setTargetProcurementSupplierId(undefined)
            setTargetProcurementContactId(undefined)
          }}
        />
      )
    }

    if (currentPage === 'contacts') {
      return (
        <ContactsTab
          workbookPath={selectedWorkbook}
          suppliers={suppliers}
          onRefresh={refreshWorkbookData}
          onNavigateToProcurement={(supplierId, contactId) => {
            setTargetProcurementSupplierId(supplierId)
            setTargetProcurementContactId(contactId)
            setCurrentPage('procurements')
          }}
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
      <button
        type="button"
        onClick={testSaveAttachment}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 9999,
          padding: '8px 12px',
          background: '#f59e0b',
          color: '#000',
          fontWeight: 700,
          border: '2px solid #000',
          cursor: 'pointer',
        }}
      >
        TEST SAVE ATTACHMENT
      </button>

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
          LogPro v{__APP_VERSION__}
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

                {!editingSupplierId && (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginTop: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <strong style={{ fontSize: '0.95rem' }}>Contacts *</strong>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={addSupplierContactRow}
                        style={{ width: 'auto', padding: '5px 12px', fontSize: '0.82rem' }}
                      >
                        + Add Another Contact
                      </button>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Add at least one contact person for this supplier, and mark one as Primary.
                    </p>

                    {supplierContactForms.map((contact, index) => (
                      <div
                        key={contact.tempId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr auto auto',
                          gap: '8px',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Contact name"
                          value={contact.name}
                          onChange={(event) =>
                            updateSupplierContactRow(contact.tempId, 'name', event.target.value)
                          }
                          aria-label={`Contact ${index + 1} name`}
                        />
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={contact.phone}
                          onChange={(event) =>
                            updateSupplierContactRow(contact.tempId, 'phone', event.target.value)
                          }
                          aria-label={`Contact ${index + 1} phone`}
                        />
                        <input
                          type="email"
                          placeholder="Email address"
                          value={contact.email}
                          onChange={(event) =>
                            updateSupplierContactRow(contact.tempId, 'email', event.target.value)
                          }
                          aria-label={`Contact ${index + 1} email`}
                        />
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <input
                            type="radio"
                            name="primary-contact"
                            checked={contact.isPrimary}
                            onChange={() => setPrimarySupplierContact(contact.tempId)}
                            style={{ width: 'auto' }}
                          />
                          Primary
                        </label>
                        <button
                          type="button"
                          onClick={() => removeSupplierContactRow(contact.tempId)}
                          disabled={supplierContactForms.length <= 1}
                          title="Remove this contact"
                          style={{
                            width: 'auto',
                            padding: '4px 8px',
                            background: 'transparent',
                            borderColor: 'transparent',
                            color: '#94a3b8',
                            cursor: supplierContactForms.length <= 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
  onClick={testCreateWorkbookDirect}
  style={{
    marginLeft: '8px',
    padding: '8px 12px',
    background: '#22c55e',
    color: '#000',
    fontWeight: 700,
    border: '2px solid #000',
    cursor: 'pointer',
  }}
>
  TEST CREATE WORKBOOK
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
