import { useState, useEffect, type FormEvent } from 'react'
import { UserPlus, UserCheck, X } from 'lucide-react'
import { type Supplier, type SupplierContact } from '../types'

export type AddContactModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  supplier?: Supplier | null
  suppliers?: Supplier[]
  contactToEdit?: SupplierContact | null
  onContactAdded?: (newContactId: string | number) => void
  onContactSaved?: (savedContactId: string | number, supplierId: string | number) => void
}

export function AddContactModal({
  isOpen,
  onClose,
  workbookPath,
  supplier,
  suppliers = [],
  contactToEdit,
  onContactAdded,
  onContactSaved,
}: AddContactModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [contactName, setContactName] = useState('')
  const [role, setRole] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = Boolean(contactToEdit)

  // Reset form when modal opens or contact changes
  useEffect(() => {
    if (!isOpen) return

    queueMicrotask(() => {
      setErrorMsg('')
      if (contactToEdit) {
        setSelectedSupplierId(String(contactToEdit.SupplierID || ''))
        setContactName(contactToEdit.ContactName || '')
        setRole(contactToEdit.Role || '')
        setPhoneNumber(contactToEdit.PhoneNumber || '')
        setMobileNumber(contactToEdit.MobileNumber || '')
        setEmail(contactToEdit.Email || '')
        setNotes(contactToEdit.Notes || '')
        setIsPrimary(Boolean(contactToEdit.IsPrimary))
      } else {
        const defaultSuppId = supplier
          ? String(supplier.SupplierID || supplier.SupplierReference || '')
          : suppliers.length > 0
          ? String(suppliers[0].SupplierID || suppliers[0].SupplierReference || '')
          : ''
        setSelectedSupplierId(defaultSuppId)
        setContactName('')
        setRole('')
        setPhoneNumber('')
        setMobileNumber('')
        setEmail('')
        setNotes('')
        setIsPrimary(false)
      }
    })
  }, [isOpen, contactToEdit, supplier, suppliers])

  if (!isOpen) return null

  // If fixed supplier prop is passed without suppliers array, find supplier info
  const effectiveSupplier =
    supplier ||
    suppliers.find(
      (s) => String(s.SupplierID) === selectedSupplierId || String(s.SupplierReference) === selectedSupplierId,
    )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!selectedSupplierId.trim()) {
      setErrorMsg('Please select a supplier for this contact.')
      return
    }

    if (!contactName.trim()) {
      setErrorMsg('Contact name is required.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      if (isEditing && contactToEdit?.ContactID) {
        const res = await window.logPro.updateSupplierContact(
          workbookPath,
          contactToEdit.ContactID,
          {
            SupplierID: selectedSupplierId.trim(),
            ContactName: contactName.trim(),
            Role: role.trim(),
            PhoneNumber: phoneNumber.trim(),
            MobileNumber: mobileNumber.trim(),
            Email: email.trim(),
            Notes: notes.trim(),
            IsPrimary: isPrimary,
          },
        )

        setIsSubmitting(false)

        if (res.error) {
          setErrorMsg(res.error)
        } else {
          onContactSaved?.(contactToEdit.ContactID, selectedSupplierId.trim())
          onClose()
        }
      } else {
        const res = await window.logPro.saveSupplierContact(workbookPath, {
          SupplierID: selectedSupplierId.trim(),
          ContactName: contactName.trim(),
          Role: role.trim(),
          PhoneNumber: phoneNumber.trim(),
          MobileNumber: mobileNumber.trim(),
          Email: email.trim(),
          Notes: notes.trim(),
          IsPrimary: isPrimary,
        })

        setIsSubmitting(false)

        if (res.error) {
          setErrorMsg(res.error)
        } else {
          const created = res.contacts[res.contacts.length - 1]
          const createdId = created?.ContactID || ''
          onContactAdded?.(createdId)
          onContactSaved?.(createdId, selectedSupplierId.trim())
          onClose()
        }
      }
    } catch (err: any) {
      setIsSubmitting(false)
      setErrorMsg(err?.message || 'Failed to save contact.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 'min(100%, 540px)' }}
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
            {isEditing ? (
              <UserCheck size={20} color="var(--primary)" />
            ) : (
              <UserPlus size={20} color="var(--primary)" />
            )}
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              {isEditing
                ? `Edit Contact: ${contactToEdit?.ContactName || 'Contact'}`
                : effectiveSupplier
                ? `Add Contact for ${effectiveSupplier.SupplierName}`
                : 'Add Supplier Contact'}
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

        <form onSubmit={handleSubmit}>
          {/* Supplier Selector: If supplier is pre-fixed and no other suppliers given, show readonly indicator; else dropdown */}
          {!supplier && suppliers.length > 0 ? (
            <label style={{ marginBottom: '12px', display: 'block' }}>
              Supplier *
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => {
                  const sId = String(s.SupplierID || s.SupplierReference || '')
                  return (
                    <option key={sId} value={sId}>
                      {s.SupplierName} {s.SupplierReference ? `(${s.SupplierReference})` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
          ) : supplier ? (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontSize: '0.88rem',
              }}
            >
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Supplier
              </span>
              <strong>{supplier.SupplierName}</strong>
              {supplier.SupplierReference ? ` (${supplier.SupplierReference})` : ''}
            </div>
          ) : null}

          <label>
            Contact Name *
            <input
              type="text"
              required
              placeholder="e.g. John Mitchell"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>
              Role / Position
              <input
                type="text"
                placeholder="e.g. Harvest Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                placeholder="john@timber.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>
              Phone Number (Office)
              <input
                type="text"
                placeholder="03 9000 0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
            <label>
              Mobile Number
              <input
                type="text"
                placeholder="0400 000 000"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              rows={2}
              placeholder="Notes, radio channels, site availability, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isSubmitting}
            />
            <span style={{ fontSize: '0.9rem' }}>
              Primary Contact for this Supplier
            </span>
          </label>

          <div className="modal-actions" style={{ marginTop: '18px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Contact' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
