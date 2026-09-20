import { useState, type FormEvent } from 'react'
import { UserPlus, X } from 'lucide-react'
import { type Supplier } from '../types'

type AddContactModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  supplier: Supplier | null
  onContactAdded: (newContactId: string | number) => void
}

export function AddContactModal({
  isOpen,
  onClose,
  workbookPath,
  supplier,
  onContactAdded,
}: AddContactModalProps) {
  const [contactName, setContactName] = useState('')
  const [role, setRole] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !supplier) return null

  const supplierId = supplier.SupplierID || supplier.SupplierReference || ''

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!contactName.trim()) {
      setErrorMsg('Contact name is required.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    const res = await window.logPro.saveSupplierContact(workbookPath, {
      SupplierID: supplierId,
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
      onContactAdded(created?.ContactID || '')
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 'min(100%, 520px)' }}
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
            <UserPlus size={20} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              Add Contact for {supplier.SupplierName}
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
              Role
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
              Phone Number
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
              placeholder="Contact notes or availability"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={isSubmitting}
            />
            Primary Contact for this Supplier
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
