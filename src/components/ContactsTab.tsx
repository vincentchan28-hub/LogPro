import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Building,
  Phone,
  Mail,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Filter,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { type Supplier, type SupplierContact } from '../types'
import { AddContactModal } from './AddContactModal'

type ContactsTabProps = {
  workbookPath: string
  suppliers: Supplier[]
  onRefresh: () => void
  onNavigateToProcurement: (supplierId: string, contactId: string) => void
}

export function ContactsTab({
  workbookPath,
  suppliers,
  onRefresh,
  onNavigateToProcurement,
}: ContactsTabProps) {
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('ALL')
  const [primaryOnlyFilter, setPrimaryOnlyFilter] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [contactToEdit, setContactToEdit] = useState<SupplierContact | null>(null)
  const [preselectedSupplier, setPreselectedSupplier] = useState<Supplier | null>(null)

  // Delete confirmation
  const [contactToDelete, setContactToDelete] = useState<SupplierContact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Load contacts
  const loadContacts = useCallback(() => {
    if (!workbookPath) return
    try {
      const data = window.logPro.getSupplierContacts(workbookPath)
      setContacts(data || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
    }
  }, [workbookPath])

  useEffect(() => {
    queueMicrotask(loadContacts)
  }, [loadContacts, suppliers])

  // Supplier lookup map for quick name retrieval
  const supplierMap = useMemo(() => {
    const map = new Map<string, Supplier>()
    suppliers.forEach((s) => {
      if (s.SupplierID) map.set(String(s.SupplierID).trim(), s)
      if (s.SupplierReference) map.set(String(s.SupplierReference).trim(), s)
      if (s.SupplierName) map.set(s.SupplierName.toLowerCase().trim(), s)
    })
    return map
  }, [suppliers])

  const getSupplierInfo = useCallback(
    (suppId: string | number): Supplier | undefined => {
      const key = String(suppId).trim()
      return supplierMap.get(key)
    },
    [supplierMap],
  )

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return contacts.filter((c) => {
      // Primary filter
      if (primaryOnlyFilter && !c.IsPrimary) return false

      // Supplier filter
      if (selectedSupplierFilter !== 'ALL') {
        const cSuppId = String(c.SupplierID).trim()
        if (cSuppId !== selectedSupplierFilter) return false
      }

      // Search query across name, role, email, phone, mobile, notes, supplier name
      if (query) {
        const supp = getSupplierInfo(c.SupplierID)
        const suppName = supp?.SupplierName?.toLowerCase() || ''
        const suppRef = supp?.SupplierReference?.toLowerCase() || ''
        const name = (c.ContactName || '').toLowerCase()
        const role = (c.Role || '').toLowerCase()
        const email = (c.Email || '').toLowerCase()
        const phone = (c.PhoneNumber || '').toLowerCase()
        const mobile = (c.MobileNumber || '').toLowerCase()
        const notes = (c.Notes || '').toLowerCase()

        const match =
          name.includes(query) ||
          role.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          mobile.includes(query) ||
          notes.includes(query) ||
          suppName.includes(query) ||
          suppRef.includes(query)

        if (!match) return false
      }

      return true
    })
  }, [contacts, searchQuery, selectedSupplierFilter, primaryOnlyFilter, getSupplierInfo])

  // Statistics
  const totalContacts = contacts.length
  const primaryCount = contacts.filter((c) => c.IsPrimary).length
  const uniqueSuppliersWithContacts = new Set(contacts.map((c) => String(c.SupplierID).trim())).size

  // Handlers
  function handleOpenAdd(supplierToPreset?: Supplier) {
    setContactToEdit(null)
    setPreselectedSupplier(supplierToPreset || null)
    setIsModalOpen(true)
  }

  function handleOpenEdit(contact: SupplierContact) {
    setContactToEdit(contact)
    const supp = getSupplierInfo(contact.SupplierID)
    setPreselectedSupplier(supp || null)
    setIsModalOpen(true)
  }

  function handleModalClosed() {
    setIsModalOpen(false)
    setContactToEdit(null)
    setPreselectedSupplier(null)
  }

  function handleContactSaved() {
    loadContacts()
    onRefresh()
  }

  async function handleDeleteConfirm() {
    if (!contactToDelete?.ContactID) return

    setIsDeleting(true)
    setDeleteError('')

    try {
      const res = await window.logPro.deleteSupplierContact(workbookPath, contactToDelete.ContactID)
      setIsDeleting(false)

      if (res.error) {
        setDeleteError(res.error)
      } else {
        setContactToDelete(null)
        loadContacts()
        onRefresh()
      }
    } catch (err: any) {
      setIsDeleting(false)
      setDeleteError(err?.message || 'Failed to delete contact.')
    }
  }

  return (
    <section className="page-content" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header bar */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Supplier Contacts Directory</h2>
              <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
                All contacts across timber suppliers, harvest managers, and procurement representatives.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAdd()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <UserPlus size={16} /> Add Contact
        </button>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          margin: '20px 0',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Contacts
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {totalContacts}
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Suppliers with Contacts
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {uniqueSuppliersWithContacts} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}>/ {suppliers.length}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#fefce8',
              color: '#ca8a04',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Primary Contacts
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {primaryCount}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', flex: 1, minWidth: '280px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by name, role, email, phone, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          {/* Supplier Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={16} color="var(--muted)" />
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: '0.88rem',
              }}
            >
              <option value="ALL">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => {
                const sId = String(s.SupplierID || s.SupplierReference || '')
                const count = contacts.filter((c) => String(c.SupplierID).trim() === sId).length
                return (
                  <option key={sId} value={sId}>
                    {s.SupplierName} ({count})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Primary filter toggle */}
          <button
            type="button"
            className={primaryOnlyFilter ? 'primary-button' : 'secondary-button'}
            onClick={() => setPrimaryOnlyFilter(!primaryOnlyFilter)}
            style={{
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: primaryOnlyFilter ? 'var(--primary)' : '#f8fafc',
              color: primaryOnlyFilter ? '#ffffff' : 'inherit',
            }}
          >
            <Filter size={14} />
            {primaryOnlyFilter ? 'Primary Only (Active)' : 'Primary Only'}
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
          Showing <strong>{filteredContacts.length}</strong> of {totalContacts} contacts
        </div>
      </div>

      {/* Contacts Table View */}
      {filteredContacts.length === 0 ? (
        <section className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <Users size={48} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
          <h3>{totalContacts === 0 ? 'No contacts found' : 'No matching contacts'}</h3>
          <p style={{ maxWidth: '440px', margin: '0 auto 18px', color: 'var(--muted)' }}>
            {totalContacts === 0
              ? 'Start building your directory by adding contacts for your timber growers and suppliers.'
              : 'Try adjusting your search criteria or clearing active filters to see all contacts.'}
          </p>
          {totalContacts === 0 ? (
            <button
              type="button"
              onClick={() => handleOpenAdd()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={16} /> Add First Contact
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSearchQuery('')
                setSelectedSupplierFilter('ALL')
                setPrimaryOnlyFilter(false)
              }}
            >
              Reset Filters
            </button>
          )}
        </section>
      ) : (
        <div className="table-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', width: '220px' }}>Contact Name</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', width: '200px' }}>Supplier</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', width: '150px' }}>Role / Position</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', width: '170px' }}>Phone / Mobile</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', width: '190px' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Notes</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', width: '190px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c) => {
                const supp = getSupplierInfo(c.SupplierID)
                const suppName = supp?.SupplierName || `Supplier #${c.SupplierID}`
                const suppRef = supp?.SupplierReference
                const initials = (c.ContactName || 'C')
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <tr
                    key={String(c.ContactID)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s ease',
                    }}
                    className="hover:bg-slate-50"
                  >
                    {/* Contact Name & Badge */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: c.IsPrimary ? '#dcfce7' : '#f1f5f9',
                            color: c.IsPrimary ? '#15803d' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                            {c.ContactName}
                          </div>
                          {c.IsPrimary && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#dcfce7',
                                color: '#166534',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginTop: '2px',
                              }}
                            >
                              ★ Primary Contact
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{suppName}</div>
                      {suppRef && (
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            marginTop: '2px',
                          }}
                        >
                          {suppRef}
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {c.Role ? (
                        <span style={{ fontWeight: 500 }}>{c.Role}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>

                    {/* Phone / Mobile */}
                    <td style={{ padding: '12px 14px' }}>
                      {c.MobileNumber || c.PhoneNumber ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.82rem' }}>
                          {c.MobileNumber && (
                            <a
                              href={`tel:${c.MobileNumber}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: 'var(--primary-dark)',
                                textDecoration: 'none',
                              }}
                              title="Call mobile"
                            >
                              <Phone size={12} /> {c.MobileNumber}
                            </a>
                          )}
                          {c.PhoneNumber && c.PhoneNumber !== c.MobileNumber && (
                            <a
                              href={`tel:${c.PhoneNumber}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#64748b',
                                textDecoration: 'none',
                              }}
                              title="Call office phone"
                            >
                              <Phone size={12} /> {c.PhoneNumber}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>

                    {/* Email */}
                    <td style={{ padding: '12px 14px' }}>
                      {c.Email ? (
                        <a
                          href={`mailto:${c.Email}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: 'var(--primary-dark)',
                            textDecoration: 'none',
                            fontSize: '0.82rem',
                            wordBreak: 'break-all',
                          }}
                          title={`Email ${c.ContactName}`}
                        >
                          <Mail size={12} /> {c.Email}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.8rem', maxWidth: '200px' }}>
                      {c.Notes ? (
                        <span title={c.Notes} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.Notes}
                        </span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Start Procurement Action */}
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            const sId = String(c.SupplierID).trim()
                            const cId = String(c.ContactID).trim()
                            onNavigateToProcurement(sId, cId)
                          }}
                          title={`Create procurement with ${c.ContactName}`}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--primary-dark)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <FileSpreadsheet size={13} />
                          <span>Procure</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenEdit(c)}
                          title={`Edit ${c.ContactName}`}
                          style={{
                            padding: '4px 7px',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setDeleteError('')
                            setContactToDelete(c)
                          }}
                          title={`Delete ${c.ContactName}`}
                          style={{
                            padding: '4px 7px',
                            fontSize: '0.78rem',
                            color: '#dc2626',
                            borderColor: 'transparent',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <AddContactModal
        isOpen={isModalOpen}
        onClose={handleModalClosed}
        workbookPath={workbookPath}
        supplier={preselectedSupplier}
        suppliers={suppliers}
        contactToEdit={contactToEdit}
        onContactSaved={handleContactSaved}
      />

      {/* Delete Confirmation Modal */}
      {contactToDelete && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setContactToDelete(null)}>
          <div
            className="modal-card"
            style={{ width: 'min(100%, 440px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Delete Contact</h3>
            </div>

            <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{contactToDelete.ContactName}</strong>?
              {contactToDelete.IsPrimary && (
                <span style={{ display: 'block', marginTop: '6px', color: '#b45309', fontWeight: 600 }}>
                  Warning: This is currently designated as the Primary Contact for this supplier.
                </span>
              )}
            </p>

            {deleteError && (
              <div className="error-message" style={{ marginBottom: '14px' }}>
                {deleteError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setContactToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
