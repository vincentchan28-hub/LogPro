import { useState, useMemo } from 'react'
import {
  FileSpreadsheet,
  Scale,
  ArrowRight,
  Truck,
  LayoutDashboard,
} from 'lucide-react'
import { type Supplier, type Page, type Procurement } from '../types'

type HomeOverviewProps = {
  workbookPath: string
  suppliers: Supplier[]
  onNavigate: (page: Page) => void
}

/**
 * Calculates start (Monday 00:00:00) and end (Sunday 23:59:59) of the week containing refDate.
 */
function getWeekRange(refDate: Date): {
  start: Date
  end: Date
  startStr: string
  endStr: string
  label: string
} {
  const d = new Date(refDate)
  const day = d.getDay()
  // Sunday is 0; in Monday-start weeks, shift Sunday to 7
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.getFullYear(), d.getMonth(), diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const pad = (n: number) => String(n).padStart(2, '0')
  const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
  const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`

  const fmtOpt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  const label = `${monday.toLocaleDateString(undefined, fmtOpt)} – ${sunday.toLocaleDateString(undefined, fmtOpt)}`

  return { start: monday, end: sunday, startStr, endStr, label }
}

/**
 * Determines the active date range source for a procurement according to the
 * mutual exclusivity rule (Agreement Dates vs Harvest Period).
 */
function getProcurementActiveRange(p: Procurement): {
  type: 'Agreement' | 'Harvest' | 'None'
  start: string
  end: string
  label: string
} {
  if (p.StartDate || p.EndDate) {
    return {
      type: 'Agreement',
      start: p.StartDate || '',
      end: p.EndDate || '',
      label: `${p.StartDate || '—'} → ${p.EndDate || '—'}`,
    }
  }
  if (p.HarvestPeriodStart || p.HarvestPeriodEnd) {
    return {
      type: 'Harvest',
      start: p.HarvestPeriodStart || '',
      end: p.HarvestPeriodEnd || '',
      label: `${p.HarvestPeriodStart || '—'} → ${p.HarvestPeriodEnd || '—'}`,
    }
  }
  return {
    type: 'None',
    start: '',
    end: '',
    label: 'No dates set',
  }
}

/**
 * Checks whether a procurement is scheduled to deliver during the given week.
 */
function isProcurementInWeekRange(
  p: Procurement,
  weekStartStr: string,
  weekEndStr: string,
): boolean {
  const isStopped = p.Status === 'Completed' || p.Status === 'Cancelled'
  if (isStopped) return false

  const range = getProcurementActiveRange(p)

  if (range.type === 'None') {
    return Boolean(p.ForceWeeklyForecast)
  }

  const { start, end } = range
  if (start && end) {
    if (start <= weekEndStr && end >= weekStartStr) return true
    return Boolean(p.ForceWeeklyForecast)
  }
  if (start) {
    if (start <= weekEndStr) return true
    return Boolean(p.ForceWeeklyForecast)
  }
  if (end) {
    if (end >= weekStartStr) return true
    return Boolean(p.ForceWeeklyForecast)
  }
  return Boolean(p.ForceWeeklyForecast)
}

export function HomeOverview({
  workbookPath,
  suppliers,
  onNavigate,
}: HomeOverviewProps) {
  // Navigation for Weekly Delivery Planner
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const procurements = useMemo(() => {
    try {
      return window.logPro.getProcurements(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath])

  // Current selected week boundaries
  const currentWeek = useMemo(() => getWeekRange(selectedDate), [selectedDate])

  // Overall Contract Stats (without status requirement)
  const stats = useMemo(() => {
    let totalAgreed = 0

    for (const p of procurements) {
      const grades = window.logPro.getProcurementGrades(workbookPath, p.ProcurementRef)
      for (const g of grades) {
        const agreed = Number(g.AgreedTonnes) || 0
        totalAgreed += agreed
      }
    }

    return {
      procurementsCount: procurements.length,
      totalAgreed,
    }
  }, [procurements, workbookPath])

  // Procurements delivering during the selected week
  const activeWeeklyDeliveries = useMemo(() => {
    return procurements
      .filter((p) => isProcurementInWeekRange(p, currentWeek.startStr, currentWeek.endStr))
      .map((p) => {
        const range = getProcurementActiveRange(p)
        const weeklyTonnes = Number(p.WeeklyEstimatedTonnes) || 0
        const supp = suppliers.find(
          (s) =>
            String(s.SupplierID) === String(p.SupplierID) ||
            String(s.SupplierReference) === String(p.SupplierID),
        )
        const supplierName = supp?.SupplierName || `Supplier #${p.SupplierID}`

        return {
          procurement: p,
          supplierName,
          range,
          weeklyTonnes,
        }
      })
  }, [procurements, currentWeek, suppliers])

  // Total committed delivery tonnage for the selected week
  const totalWeeklyExpectedTonnes = useMemo(() => {
    return activeWeeklyDeliveries.reduce((sum, item) => sum + item.weeklyTonnes, 0)
  }, [activeWeeklyDeliveries])

  // Count active suppliers delivering this week
  const activeSuppliersCount = useMemo(() => {
    const suppSet = new Set<string>()
    for (const item of activeWeeklyDeliveries) {
      suppSet.add(String(item.procurement.SupplierID))
    }
    return suppSet.size
  }, [activeWeeklyDeliveries])

  // 4-Week Delivery Projection: 4 upcoming projection weeks (excluding current week)
  const lookaheadWeeks = useMemo(() => {
    const weeks = []
    const now = new Date()
    const currentRealWeek = getWeekRange(now)

    for (let i = 1; i <= 4; i++) {
      const targetDate = new Date(currentRealWeek.start.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      const wRange = getWeekRange(targetDate)

      let weekTonnes = 0
      const activeSupps = new Set<string>()

      for (const p of procurements) {
        if (isProcurementInWeekRange(p, wRange.startStr, wRange.endStr)) {
          const tonnes = Number(p.WeeklyEstimatedTonnes) || 0
          weekTonnes += tonnes
          if (tonnes > 0) {
            activeSupps.add(String(p.SupplierID))
          }
        }
      }

      weeks.push({
        index: i,
        label: `+${i} Week${i > 1 ? 's' : ''}`,
        dateRange: wRange.label,
        totalTonnes: weekTonnes,
        supplierCount: activeSupps.size,
        targetDate,
        startStr: wRange.startStr,
      })
    }
    return weeks
  }, [procurements])

  // Check if currently viewing the real-world current week
  const isViewingThisWeek = useMemo(() => {
    const today = new Date()
    const todayWeek = getWeekRange(today)
    return todayWeek.startStr === currentWeek.startStr
  }, [currentWeek])

  function handleCurrentWeek() {
    setSelectedDate(new Date())
  }

  return (
    <div className="home-content" style={{ maxWidth: '1240px', padding: '32px 24px' }}>
      <div className="page-heading">
        <div className="page-title-group">
          <div className="page-title-icon-badge">
            <LayoutDashboard size={22} />
          </div>
          <h2>Home</h2>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* Card 1: Total Procurements */}
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
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '6px' }}>
            Registered agreements in workbook
          </div>
        </div>

        {/* Card 2: Expected Delivery This Week */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '2px solid #0284c7',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0369a1' }}>
              Expected Delivery This Week
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <Truck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0284c7' }}>
            {totalWeeklyExpectedTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>tonnes</span>
          </div>
          <div style={{ color: '#0369a1', fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
            {activeSuppliersCount > 0
              ? `From ${activeSuppliersCount} supplier${activeSuppliersCount > 1 ? 's' : ''} in range`
              : 'No suppliers active in current week'}
          </div>
        </div>

        {/* Card 3: Contracted Agreed Tonnes */}
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
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>
            {stats.totalAgreed.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
            <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--muted)' }}>t</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '6px' }}>
            Total agreed across all grades
          </div>
        </div>

        {/* Card 4: Reserved for a future dashboard metric */}
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '130px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)',
          }}
        >
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 600 }}>Empty</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: WEEKLY DELIVERY SCHEDULE & PLANNING TRACKER */}
      {/* ========================================================================= */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
        }}
      >
        {/* Header & Week Navigation Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={22} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>
                Weekly Delivery Schedule &amp; Haulage Planner
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
              Automatically tallies weekly commitments for all procurements with agreement or harvest dates covering this week.
            </p>
          </div>
        </div>

        {/* Selected Week Display Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
              Viewing Schedule For:
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{currentWeek.label}</span>
              {isViewingThisWeek ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#dbeafe',
                    color: '#1e40af',
                  }}
                >
                  Current Week
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleCurrentWeek}
                  style={{
                    padding: '2px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                  }}
                  title="Return to Current Week"
                >
                  Return to Current Week
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Active Suppliers Delivering:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {activeSuppliersCount} {activeSuppliersCount === 1 ? 'Supplier' : 'Suppliers'}
              </div>
            </div>
            <div style={{ height: '32px', width: '1px', background: '#cbd5e1' }} />
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Week's Tally Commitment:</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7' }}>
                {totalWeeklyExpectedTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} tonnes
              </div>
            </div>
          </div>
        </div>

        {/* 4-Week Lookahead Bar (Upcoming 4 projection weeks) */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            4 Week Projection
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
            }}
          >
            {lookaheadWeeks.map((w) => {
              const isSelected = w.startStr === currentWeek.startStr
              return (
                <div
                  key={w.index}
                  onClick={() => setSelectedDate(w.targetDate)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? '#f0f9ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  title="Click to view this week's full schedule"
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : '#475569' }}>
                        {w.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {w.supplierCount} supp.
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isSelected ? '#0369a1' : '#1e293b' }}>
                      {w.totalTonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>tonnes</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.dateRange}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </div>

        {/* Detailed Weekly Commitment Table */}
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
          Weekly Agreement
        </div>

        {activeWeeklyDeliveries.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              border: '2px dashed #e2e8f0',
              borderRadius: '8px',
              color: '#64748b',
              background: '#f8fafc',
            }}
          >
            <Truck size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', color: '#334155', fontSize: '1.05rem' }}>
              No Deliveries Scheduled for this Week
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', maxWidth: '480px', marginInline: 'auto' }}>
              There are no timber agreements or harvest periods covering the date range{' '}
              <strong>{currentWeek.label}</strong> with a committed weekly delivery tonnage.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate('procurements')}
              style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
            >
              Manage Procurements <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table
              style={{
                width: '100%',
                minWidth: '860px',
                borderCollapse: 'collapse',
                fontSize: '0.86rem',
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Ref</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Supplier</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Plantation</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Species</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '240px' }}>Active Date Range</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>Weekly Commitment</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeWeeklyDeliveries.map((item) => {
                  const p = item.procurement

                  return (
                    <tr
                      key={p.ProcurementRef}
                      style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary-dark)', whiteSpace: 'nowrap' }}>
                        {p.ProcurementRef}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.supplierName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.Plantation || '—'}</div>
                        {(p.AgreementType || p.AgreementDetail) && (
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                            {p.AgreementType}: {p.AgreementDetail || '—'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{p.Species || '—'}</td>
                      {/* Single-line active date range */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: item.range.type === 'Agreement' ? '#ede9fe' : '#fef3c7',
                              color: item.range.type === 'Agreement' ? '#5b21b6' : '#92400e',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.range.type}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {item.range.start || '—'} → {item.range.end || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {item.weeklyTonnes > 0 ? (
                          `${item.weeklyTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} t`
                        ) : (
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}>Not set</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onNavigate('procurements')}
                          style={{ width: 'auto', padding: '4px 10px', fontSize: '0.78rem' }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                    Total Estimated Delivery Expected for this Week:
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '1.05rem', color: '#0284c7', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {totalWeeklyExpectedTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} t
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION: RECENT PROCUREMENTS TABLE */}
      {/* ========================================================================= */}
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
              Latest timber agreements registered in this workbook
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
            No procurements entered yet. Click "Procurements &amp; Grades" above to create your first agreement.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table
              style={{
                width: '100%',
                minWidth: '950px',
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
                    Plantation Name
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Species
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Weekly Haulage
                  </th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: '90px' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody style={{ whiteSpace: 'nowrap' }}>
                {procurements.slice(0, 8).map((p) => {
                  const sName =
                    suppliers.find(
                      (s) =>
                        String(s.SupplierID) === String(p.SupplierID) ||
                        String(s.SupplierReference) === String(p.SupplierID),
                    )?.SupplierName || `Supplier #${p.SupplierID}`

                  const weeklyT = Number(p.WeeklyEstimatedTonnes) || 0

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
                      <td style={{ fontWeight: 600, color: weeklyT > 0 ? '#0284c7' : '#94a3b8' }}>
                        {weeklyT > 0 ? `${weeklyT.toLocaleString()} t / wk` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
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
