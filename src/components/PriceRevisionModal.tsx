import { useState, type FormEvent } from 'react'
import { TrendingUp, AlertCircle, X, Check } from 'lucide-react'

export type DetectedPriceChange = {
  gradeName: string
  productType: string
  oldPrice: number
  newPrice: number
  diff: number
}

type PriceRevisionModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (revisionDetails: {
    reason: string
    effectiveDate: string
    notes: string
  }) => void
  procurementRef: string
  supplierName: string
  changes: DetectedPriceChange[]
}

const COMMON_REASONS = [
  'Rate renegotiation',
  'Market price indexation',
  'Haulage allowance adjustment',
  'Harvest distance / road condition variance',
  'Mill intake specification update',
  'Quality & diameter grade variation',
  'Burnt log salvage discount',
  'Inflation & operational cost change',
]

export function PriceRevisionModal({
  isOpen,
  onClose,
  onConfirm,
  procurementRef,
  supplierName,
  changes,
}: PriceRevisionModalProps) {
  const [reason, setReason] = useState(COMMON_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const finalReason =
      reason === 'Other (Custom)'
        ? customReason.trim() || 'Unspecified price adjustment'
        : reason

    onConfirm({
      reason: finalReason,
      effectiveDate,
      notes: notes.trim(),
    })
  }

  return (
    <div
      id="price-revision-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 42, 61, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        id="price-revision-modal"
        style={{
          width: 'min(100%, 620px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#d97706',
                color: '#ffffff',
              }}
            >
              <TrendingUp size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
                Record Price Revision Audit
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Rate change detected for{' '}
                <strong style={{ color: '#92400e' }}>{procurementRef}</strong>{' '}
                {supplierName && `(${supplierName})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 'auto',
              padding: '6px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Detected Price Diffs Table */}
          <div
            style={{
              backgroundColor: '#fffdf5',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#92400e',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <AlertCircle size={16} color="#d97706" />
              <span>Detected Price Changes ({changes.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {changes.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #fef08a',
                    fontSize: '0.86rem',
                  }}
                >
                  <div>
                    <strong style={{ color: '#1e293b' }}>{c.gradeName}</strong>{' '}
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({c.productType})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: '0.85rem' }}>
                      ${c.oldPrice.toFixed(2)}/t
                    </span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      ${c.newPrice.toFixed(2)}/t
                    </span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: c.diff >= 0 ? '#ecfdf5' : '#fef2f2',
                        color: c.diff >= 0 ? '#065f46' : '#991b1b',
                        border: `1px solid ${c.diff >= 0 ? '#a7f3d0' : '#fecaca'}`,
                      }}
                    >
                      {c.diff >= 0 ? '+' : ''}${c.diff.toFixed(2)}/t
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              Reason for Price Revision <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other (Custom)">Other (Custom Reason...)</option>
            </select>
          </div>

          {reason === 'Other (Custom)' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Custom Reason Description <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="E.g., Special quality deviation allowance"
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Effective Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              Effective Date
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            />
          </div>

          {/* Revision Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              Revision Notes / Context (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Approved during contractor site review by operations manager..."
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 'auto',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                width: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Check size={16} />
              Save Procurement & Price History
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
