import { useState, type CSSProperties } from 'react'
import { Pencil, Paperclip, X, History } from 'lucide-react'
import type {
  Procurement,
  ProcurementGrade,
  Supplier,
  SupplierContact,
  TimelineEvent,
} from '../types'
import { ProductTypeBadge } from './ProductTypeBadge'
import { ProcurementTimelineModal } from './ProcurementTimelineModal'

type ProcurementDetailViewProps = {
  procurement: Procurement
  supplier: Supplier | null
  contact: SupplierContact | null
  grades: ProcurementGrade[]
  onEdit: () => void
  onClose: () => void
  onOpenSpec: () => void
  workbookPath: string
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px 20px',
  marginBottom: '18px',
  background: '#fbfdff',
}

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 14px',
  fontSize: '1.05rem',
  fontWeight: 700,
  color: 'var(--primary-dark)',
}

function Field({
  label,
  value,
  subvalue,
}: {
  label: string
  value?: string | number
  subvalue?: string
}) {
  const shown =
    value === undefined || String(value).trim() === '' ? '—' : String(value)

  return (
    <div>
      <div
        style={{
          fontSize: '0.76rem',
          color: '#64748b',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          marginBottom: '3px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '0.92rem',
          color: 'var(--text)',
          fontWeight: 600,
          wordBreak: 'break-word',
        }}
      >
        {shown}
      </div>
      {subvalue && (
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
          {subvalue}
        </div>
      )}
    </div>
  )
}

function money(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function tonnes(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

const headCell: CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.8rem',
  borderBottom: '1px solid var(--border)',
}

const headCellRight: CSSProperties = {
  ...headCell,
  textAlign: 'right',
}

const bodyCell: CSSProperties = {
  padding: '8px 10px',
  fontSize: '0.84rem',
  borderBottom: '1px solid #f1f5f9',
}

const bodyCellRight: CSSProperties = {
  ...bodyCell,
  textAlign: 'right',
}

export function ProcurementDetailView({
  procurement,
  supplier,
  contact,
  grades,
  onEdit,
  onClose,
  onOpenSpec,
  workbookPath,
}: ProcurementDetailViewProps) {
  const hasSpec = Boolean(procurement.LogSpecFileID)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])

  function openTimeline() {
    try {
      setTimelineEvents(window.logPro.getProcurementTimeline(workbookPath, procurement.ProcurementRef))
    } catch {
      setTimelineEvents([])
    }
    setIsTimelineOpen(true)
  }

  let totalAgreed = 0
  let totalDelivered = 0
  let totalValue = 0

  for (const g of grades) {
    const agreed = Number(g.AgreedTonnes) || 0
    const delivered = Number(g.DeliveredTonnes) || 0
    const price = Number(g.AgreedPricePerTonne) || 0
    totalAgreed += agreed
    totalDelivered += delivered
    totalValue += agreed * price
  }

  const totalRemaining = Math.max(0, totalAgreed - totalDelivered)

  const contactDetailString = [
    contact?.Role,
    contact?.PhoneNumber ? `Ph: ${contact.PhoneNumber}` : null,
    contact?.MobileNumber ? `Mob: ${contact.MobileNumber}` : null,
    contact?.Email,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header bar with Ref and Top-Right Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong style={{ fontSize: '1.35rem', color: 'var(--primary-dark)' }}>
            {procurement.ProcurementRef}
          </strong>
          {hasSpec && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                color: '#0284c7',
                background: '#e0f2fe',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              <Paperclip size={13} /> Spec Attached
            </span>
          )}
        </div>

        {/* Top-Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={openTimeline}
            style={{
              width: 'auto',
              height: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0px',
              cursor: 'pointer',
            }}
          >
            <History size={15} /> Timeline
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={{
              width: 'auto',
              height: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 18px',
              fontWeight: 700,
              color: '#475569',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '0px',
              cursor: 'pointer',
            }}
          >
            <Pencil size={15} /> Edit
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            style={{
              width: 'auto',
              height: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              borderRadius: '0px',
            }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* 1. Supplier & Agreement Info */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>1. Supplier &amp; Agreement Info</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '14px',
          }}
        >
          <Field
            label="Supplier"
            value={supplier?.SupplierName || `Supplier #${procurement.SupplierID}`}
            subvalue={supplier?.Address ? `Address: ${supplier.Address}` : undefined}
          />
          <Field
            label="Contact Person"
            value={contact?.ContactName || '—'}
            subvalue={contactDetailString || undefined}
          />
          <Field label="Agreement Type" value={procurement.AgreementType} />
          <Field label={`${procurement.AgreementType} Detail / Code`} value={procurement.AgreementDetail} />
          <Field label="Agreement Start Date" value={procurement.StartDate} />
          <Field label="Agreement End Date" value={procurement.EndDate} />
        </div>
      </div>

      {/* 2. Plantation Name and Harvest Period */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>2. Plantation Name and Harvest Period</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <Field label="Plantation Name" value={procurement.Plantation} />
          <Field label="Species" value={procurement.Species || '—'} />
          <Field label="Harvest Period Start" value={procurement.HarvestPeriodStart} />
          <Field label="Harvest Period End" value={procurement.HarvestPeriodEnd} />
        </div>
      </div>

      {/* 3. Haulage Commitment */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>3. Haulage Commitment</h3>
        <div style={{ maxWidth: '340px' }}>
          <Field
            label="Weekly Estimated Delivery"
            value={
              procurement.WeeklyEstimatedTonnes !== undefined &&
              procurement.WeeklyEstimatedTonnes !== '' &&
              Number(procurement.WeeklyEstimatedTonnes) > 0
                ? `${Number(procurement.WeeklyEstimatedTonnes).toLocaleString()} tonnes / week`
                : '—'
            }
          />
        </div>
      </div>

      {/* 4. Grades, Products, Prices & Tonnes Table */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>4. Grades, Products, Prices &amp; Tonnes</h3>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: '#ffffff' }}>
          <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>
                <th style={headCell}>Species</th>
                <th style={headCell}>Product</th>
                <th style={headCell}>Grade</th>
                <th style={headCellRight}>Offered $/t</th>
                <th style={headCellRight}>Agreed $/t</th>
                <th style={headCellRight}>Agreed t</th>
                <th style={headCellRight}>Delivered t</th>
                <th style={headCellRight}>Remaining t</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...bodyCell, textAlign: 'center', color: 'var(--muted)', padding: '16px' }}>
                    No grades entered.
                  </td>
                </tr>
              ) : (
                grades.map((g, idx) => {
                  const agreed = Number(g.AgreedTonnes) || 0
                  const delivered = Number(g.DeliveredTonnes) || 0

                  return (
                    <tr key={String(g.ProcurementGradeID || idx)} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={bodyCell}>{g.Species}</td>
                      <td style={bodyCell}><ProductTypeBadge productType={g.ProductType} /></td>
                      <td style={{ ...bodyCell, fontWeight: 600 }}>{g.GradeName}</td>
                      <td style={bodyCellRight}>${money(Number(g.OfferedPricePerTonne) || 0)}</td>
                      <td style={{ ...bodyCellRight, fontWeight: 600 }}>
                        ${money(Number(g.AgreedPricePerTonne) || 0)}
                      </td>
                      <td style={bodyCellRight}>{tonnes(agreed)}</td>
                      <td style={bodyCellRight}>{tonnes(delivered)}</td>
                      <td style={{ ...bodyCellRight, fontWeight: 700 }}>
                        {tonnes(Math.max(0, agreed - delivered))}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={5} style={{ ...bodyCellRight }}>
                  Agreement Totals:
                </td>
                <td style={bodyCellRight}>{tonnes(totalAgreed)} t</td>
                <td style={bodyCellRight}>{tonnes(totalDelivered)} t</td>
                <td style={bodyCellRight}>{tonnes(totalRemaining)} t</td>
              </tr>
              <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                <td colSpan={5} style={{ ...bodyCellRight, color: '#166534' }}>
                  Estimated Contract Commitment (AUD):
                </td>
                <td colSpan={3} style={{ ...bodyCell, color: '#15803d' }}>
                  ${money(totalValue)} AUD
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. Log Specification & 6. General Notes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {/* Log specification */}
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <h3 style={sectionTitleStyle}>5. Log Specification</h3>
          {hasSpec ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Paperclip size={16} color="#0284c7" />
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                {procurement.LogSpecFileName || 'Log specification file'}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenSpec}
                style={{ width: 'auto', padding: '5px 12px', fontSize: '0.8rem', borderRadius: '0px' }}
              >
                Open in new window
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
              No Log Specification attached.
            </div>
          )}
        </div>

        {/* General Notes */}
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <h3 style={sectionTitleStyle}>6. General Notes</h3>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--text)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {procurement.Notes || '—'}
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons (Right-aligned) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={openTimeline}
          style={{
            width: 'auto',
            height: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 16px',
            fontWeight: 600,
            color: '#334155',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0px',
            cursor: 'pointer',
          }}
        >
          <History size={15} /> Timeline
        </button>
        <button
          type="button"
          onClick={onEdit}
          style={{
            width: 'auto',
            height: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 20px',
            fontWeight: 700,
            color: '#475569',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '0px',
            cursor: 'pointer',
          }}
        >
          <Pencil size={15} /> Edit
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          style={{
            width: 'auto',
            height: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 18px',
            borderRadius: '0px',
          }}
        >
          <X size={15} /> Close
        </button>
      </div>

      <ProcurementTimelineModal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        procurementRef={procurement.ProcurementRef}
        events={timelineEvents}
      />
    </div>
  )
}