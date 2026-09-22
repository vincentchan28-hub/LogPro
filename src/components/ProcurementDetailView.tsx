import type { CSSProperties } from 'react'
import { Pencil, Paperclip, X } from 'lucide-react'
import type {
  Procurement,
  ProcurementGrade,
  Supplier,
  SupplierContact,
} from '../types'

type ProcurementDetailViewProps = {
  procurement: Procurement
  supplier: Supplier | null
  contact: SupplierContact | null
  grades: ProcurementGrade[]
  onEdit: () => void
  onClose: () => void
  onOpenSpec: () => void
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px',
  marginBottom: '16px',
  background: '#fbfdff',
}

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '1.05rem',
  color: 'var(--primary-dark)',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
}

function Field({ label, value }: { label: string; value?: string | number }) {
  const shown =
    value === undefined || String(value).trim() === '' ? '—' : String(value)

  return (
    <div>
      <div
        style={{
          fontSize: '0.78rem',
          color: '#64748b',
          fontWeight: 600,
          marginBottom: '2px',
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

export function ProcurementDetailView({
  procurement,
  supplier,
  contact,
  grades,
  onEdit,
  onClose,
  onOpenSpec,
}: ProcurementDetailViewProps) {
  const hasSpec = Boolean(procurement.LogSpecFileID)

  let totalAgreed = 0
  let totalDelivered = 0
  let totalValue = 0

  for (const g of grades) {
    const agreed = Number(g.AgreedTonnes) || 0
    totalAgreed += agreed
    totalDelivered += Number(g.DeliveredTonnes) || 0
    totalValue += agreed * (Number(g.AgreedPricePerTonne) || 0)
  }

  const totalRemaining = Math.max(0, totalAgreed - totalDelivered)

  const headCell: CSSProperties = { padding: '8px 10px', textAlign: 'left' }
  const headCellRight: CSSProperties = { padding: '8px 10px', textAlign: 'right' }
  const bodyCell: CSSProperties = { padding: '8px 10px' }
  const bodyCellRight: CSSProperties = { padding: '8px 10px', textAlign: 'right' }

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong style={{ fontSize: '1.3rem', color: 'var(--primary-dark)' }}>
            {procurement.ProcurementRef}
          </strong>
          {hasSpec && <Paperclip size={16} color="#0284c7" />}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onEdit}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontWeight: 700,
              color: '#ffffff',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '8px',
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
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
            }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* Supplier & contact */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Supplier &amp; Contact</h3>
        <div style={gridStyle}>
          <Field label="Supplier" value={supplier?.SupplierName} />
          <Field label="Address" value={supplier?.Address} />
          <Field label="ABN" value={supplier?.ABN} />
          <Field label="Payment Terms" value={supplier?.PaymentTerms} />
          <Field label="Contact" value={contact?.ContactName} />
          <Field label="Contact Role" value={contact?.Role} />
          <Field label="Phone" value={contact?.PhoneNumber} />
          <Field label="Mobile" value={contact?.MobileNumber} />
          <Field label="Email" value={contact?.Email} />
        </div>
      </div>

      {/* Agreement */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Agreement</h3>
        <div style={gridStyle}>
          <Field label="Agreement Type" value={procurement.AgreementType} />
          <Field label={`${procurement.AgreementType} Detail`} value={procurement.AgreementDetail} />
        </div>
      </div>

      {/* Plantation & harvest */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Plantation &amp; Harvest Period</h3>
        <div style={gridStyle}>
          <Field label="Plantation" value={procurement.Plantation} />
          <Field label="Harvest Period Start" value={procurement.HarvestPeriodStart} />
          <Field label="Harvest Period End" value={procurement.HarvestPeriodEnd} />
          <Field label="Agreement Start Date" value={procurement.StartDate} />
          <Field label="Agreement End Date" value={procurement.EndDate} />
        </div>
      </div>

      {/* Grades */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Grades, Products, Prices &amp; Tonnes</h3>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
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
                  <td colSpan={8} style={{ ...bodyCell, textAlign: 'center', color: 'var(--muted)' }}>
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
                      <td style={bodyCell}>{g.ProductType}</td>
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

      {/* Log specification */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Log Specification</h3>
        {hasSpec ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Paperclip size={16} color="#0284c7" />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              {procurement.LogSpecFileName || 'Log specification'}
            </span>
            <button
              type="button"
              className="secondary-button"
              onClick={onOpenSpec}
              style={{ width: 'auto', padding: '5px 12px', fontSize: '0.8rem' }}
            >
              Open in new window
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            No Log Specification attached.
          </div>
        )}
      </div>

      {/* General Notes */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h3 style={sectionTitleStyle}>General Notes</h3>
        <div
          style={{
            fontSize: '0.92rem',
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
  )
}