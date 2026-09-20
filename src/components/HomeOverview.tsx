import { useMemo } from 'react'
import {
  FileSpreadsheet,
  Scale,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { type Supplier, type Page } from '../types'

type HomeOverviewProps = {
  workbookPath: string
  suppliers: Supplier[]
  onNavigate: (page: Page) => void
}

export function HomeOverview({
  workbookPath,
  suppliers,
  onNavigate,
}: HomeOverviewProps) {
  const procurements = useMemo(() => {
    try {
      return window.logPro.getProcurements(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath])

  const stats = useMemo(() => {
    let totalAgreed = 0
    let totalDelivered = 0
    let totalRemaining = 0
    let activeCount = 0
    let draftCount = 0
    let completedCount = 0

    for (const p of procurements) {
      if (p.Status === 'Active') activeCount++
      else if (p.Status === 'Draft' || p.Status === 'Waiting for Acceptance') draftCount++
      else if (p.Status === 'Completed') completedCount++

      const grades = window.logPro.getProcurementGrades(workbookPath, p.ProcurementRef)
      for (const g of grades) {
        const agreed = Number(g.AgreedTonnes) || 0
        const delivered = Number(g.DeliveredTonnes) || 0
        totalAgreed += agreed
        totalDelivered += delivered
        totalRemaining += Math.max(0, agreed - delivered)
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
    }
  }, [procurements, workbookPath])

  return (
    <div className="home-content" style={{ maxWidth: '1200px', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 8px', color: 'var(--text)' }}>
          Log Procurement Dashboard
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem' }}>
          Overview of active timber agreements, supplier procurement tonnes, and delivery metrics.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--muted)' }}>
              Total Procurements
            </span>
            <FileSpreadsheet size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>
            {stats.procurementsCount}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.8rem' }}>
            <span style={{ color: '#059669', fontWeight: 600 }}>{stats.activeCount} active</span>
            <span style={{ color: '#94a3b8' }}>•</span>
            <span style={{ color: '#64748b' }}>{stats.draftCount} pending</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--muted)' }}>
              Contracted Agreed Tonnes
            </span>
            <Scale size={20} color="#0284c7" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0284c7' }}>
            {stats.totalAgreed.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>t</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '6px' }}>
            Total volume across all procurement grades
          </div>
        </div>

        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--muted)' }}>
              Delivered vs Remaining
            </span>
            <TrendingUp size={20} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>
            {stats.totalDelivered.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 400, color: '#64748b' }}>
              / {stats.totalRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} t left
            </span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '6px' }}>
            {stats.totalAgreed > 0
              ? `${Math.round((stats.totalDelivered / stats.totalAgreed) * 100)}% delivered to date`
              : 'No agreed volume recorded'}
          </div>
        </div>


      </div>



      {/* Recent Procurements Table Preview */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Recent Procurements</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
              Latest agreements entered in this workbook
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNavigate('procurements')}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
            }}
          >
            Go to Procurements <ArrowRight size={16} />
          </button>
        </div>

        {procurements.length === 0 ? (
          <div
            style={{
              padding: '28px',
              textAlign: 'center',
              border: '2px dashed var(--border)',
              borderRadius: '8px',
              color: 'var(--muted)',
            }}
          >
            No procurements entered yet. Click "Procurements & Grades" above to create your first agreement.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table
              style={{
                width: '100%',
                minWidth: '1100px',
                tableLayout: 'auto',
                borderCollapse: 'separate',
                borderSpacing: '0',
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '110px' }}>
                    Ref
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '180px' }}>
                    Supplier
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '220px' }}>
                    Agreement
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '160px' }}>
                    Plantation
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Species
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '120px' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '90px' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody style={{ whiteSpace: 'nowrap' }}>
                {procurements.slice(0, 5).map((p) => {
                  const sName =
                    suppliers.find(
                      (s) =>
                        String(s.SupplierID) === String(p.SupplierID) ||
                        String(s.SupplierReference) === String(p.SupplierID),
                    )?.SupplierName || `Supplier #${p.SupplierID}`

                  return (
                    <tr key={p.ProcurementRef}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                        {p.ProcurementRef}
                      </td>
                      <td style={{ fontWeight: 600 }}>{sName}</td>
                      <td>
                        {p.AgreementType}: {p.AgreementDetail || '—'}
                      </td>
                      <td>{p.Plantation || '—'}</td>
                      <td>{p.Species || '—'}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: p.Status === 'Active' ? '#ecfdf5' : '#f1f5f9',
                            color: p.Status === 'Active' ? '#065f46' : '#475569',
                          }}
                        >
                          {p.Status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onNavigate('procurements')}
                          style={{
                            width: 'auto',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
