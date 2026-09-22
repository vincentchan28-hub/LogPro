import { useState, useMemo, useCallback } from 'react'
import {
  TrendingUp,
  Search,
  Filter,
  Download,
  RotateCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  AlertCircle,
  Building2,
  X,
  Check,
  Calendar,
} from 'lucide-react'
import {
  type PriceHistory,
  type Procurement,
  type ProcurementGrade,
  type Supplier,
} from '../types'

type PriceHistoryTabProps = {
  workbookPath: string
  priceHistory: PriceHistory[]
  procurements: Procurement[]
  grades: ProcurementGrade[]
  suppliers: Supplier[]
  onRefresh: () => void
  onNavigateToProcurement?: (ref: string) => void
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

export function PriceHistoryTab({
  workbookPath,
  priceHistory,
  procurements,
  grades,
  suppliers,
  onRefresh,
  onNavigateToProcurement,
}: PriceHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProcurementFilter, setSelectedProcurementFilter] = useState('ALL')
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('ALL')
  const [selectedProductTypeFilter, setSelectedProductTypeFilter] = useState('ALL')
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL')

  // Manual Price Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalProcRef, setModalProcRef] = useState('')
  const [modalGradeKey, setModalGradeKey] = useState('')
  const [modalPrevPrice, setModalPrevPrice] = useState<number>(0)
  const [modalNewPrice, setModalNewPrice] = useState<string>('')
  const [modalReason, setModalReason] = useState(COMMON_REASONS[0])
  const [modalCustomReason, setModalCustomReason] = useState('')
  const [modalEffectiveDate, setModalEffectiveDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [modalNotes, setModalNotes] = useState('')
  const [modalUpdateLiveGrade, setModalUpdateLiveGrade] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')

  // Map of SupplierID -> SupplierName
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of suppliers) {
      if (s.SupplierID !== undefined) {
        map.set(String(s.SupplierID), s.SupplierName)
      }
    }
    return map
  }, [suppliers])

  // Map of ProcurementRef -> Procurement
  const procurementMap = useMemo(() => {
    const map = new Map<string, Procurement>()
    for (const p of procurements) {
      if (p.ProcurementRef) {
        map.set(p.ProcurementRef.trim().toLowerCase(), p)
      }
    }
    return map
  }, [procurements])

  // Get supplier name for a given ProcurementRef
  const getSupplierNameForRef = useCallback(
    (ref: string): string => {
      const p = procurementMap.get(ref.trim().toLowerCase())
      if (!p) return ''
      return supplierMap.get(String(p.SupplierID)) || `Supplier #${p.SupplierID}`
    },
    [procurementMap, supplierMap],
  )

  // Filtered Price History records
  const filteredRecords = useMemo(() => {
    return priceHistory.filter((rec) => {
      const refMatch =
        selectedProcurementFilter === 'ALL' ||
        rec.ProcurementRef.trim().toLowerCase() === selectedProcurementFilter.trim().toLowerCase()

      const p = procurementMap.get(rec.ProcurementRef.trim().toLowerCase())
      const supplierMatch =
        selectedSupplierFilter === 'ALL' ||
        (p && String(p.SupplierID) === selectedSupplierFilter)

      const productTypeMatch =
        selectedProductTypeFilter === 'ALL' ||
        rec.ProductType.trim().toLowerCase() === selectedProductTypeFilter.trim().toLowerCase()

      const prev = Number(rec.PreviousPrice) || 0
      const curr = Number(rec.NewPrice) || 0
      const diff = curr - prev

      let directionMatch = true
      if (selectedDirectionFilter === 'UP') {
        directionMatch = diff > 0
      } else if (selectedDirectionFilter === 'DOWN') {
        directionMatch = diff < 0
      }

      const q = searchTerm.trim().toLowerCase()
      const searchMatch =
        !q ||
        rec.ProcurementRef.toLowerCase().includes(q) ||
        rec.GradeName.toLowerCase().includes(q) ||
        rec.ProductType.toLowerCase().includes(q) ||
        rec.Reason.toLowerCase().includes(q) ||
        rec.Notes.toLowerCase().includes(q) ||
        rec.RecordedBy.toLowerCase().includes(q) ||
        getSupplierNameForRef(rec.ProcurementRef).toLowerCase().includes(q)

      return refMatch && supplierMatch && productTypeMatch && directionMatch && searchMatch
    })
  }, [
    priceHistory,
    selectedProcurementFilter,
    selectedSupplierFilter,
    selectedProductTypeFilter,
    selectedDirectionFilter,
    searchTerm,
    procurementMap,
    getSupplierNameForRef,
  ])

  // Statistics & Metrics
  const metrics = useMemo(() => {
    const totalCount = priceHistory.length
    const uniqueRefs = new Set(priceHistory.map((h) => h.ProcurementRef.trim())).size

    let totalDelta = 0
    let increases = 0
    let decreases = 0

    for (const h of priceHistory) {
      const p = Number(h.PreviousPrice) || 0
      const n = Number(h.NewPrice) || 0
      const d = n - p
      totalDelta += d
      if (d > 0) increases++
      else if (d < 0) decreases++
    }

    const avgDelta = totalCount > 0 ? totalDelta / totalCount : 0

    return {
      totalCount,
      uniqueRefs,
      avgDelta,
      increases,
      decreases,
    }
  }, [priceHistory])

  // Available grades for manual modal based on selected procurement
  const modalAvailableGrades = useMemo(() => {
    if (!modalProcRef) return []
    return grades.filter(
      (g) => g.ProcurementRef.trim().toLowerCase() === modalProcRef.trim().toLowerCase(),
    )
  }, [modalProcRef, grades])

  // Open modal with clean defaults
  function openManualModal() {
    setModalError('')
    setModalSuccess('')
    const defaultRef = procurements[0]?.ProcurementRef || ''
    setModalProcRef(defaultRef)

    const availableForDefault = grades.filter(
      (g) => g.ProcurementRef.trim().toLowerCase() === defaultRef.trim().toLowerCase(),
    )
    if (availableForDefault.length > 0) {
      const g = availableForDefault[0]
      const key = `${g.ProductType}::${g.GradeName}`
      setModalGradeKey(key)
      setModalPrevPrice(Number(g.AgreedPricePerTonne) || 0)
      setModalNewPrice(String(g.AgreedPricePerTonne || ''))
    } else {
      setModalGradeKey('')
      setModalPrevPrice(0)
      setModalNewPrice('')
    }

    setModalReason(COMMON_REASONS[0])
    setModalCustomReason('')
    setModalNotes('')
    setModalUpdateLiveGrade(true)
    setIsModalOpen(true)
  }

  // Handle procurement change in modal
  function handleModalProcRefChange(ref: string) {
    setModalProcRef(ref)
    const available = grades.filter(
      (g) => g.ProcurementRef.trim().toLowerCase() === ref.trim().toLowerCase(),
    )
    if (available.length > 0) {
      const g = available[0]
      setModalGradeKey(`${g.ProductType}::${g.GradeName}`)
      setModalPrevPrice(Number(g.AgreedPricePerTonne) || 0)
      setModalNewPrice(String(g.AgreedPricePerTonne || ''))
    } else {
      setModalGradeKey('')
      setModalPrevPrice(0)
      setModalNewPrice('')
    }
  }

  // Handle grade change in modal
  function handleModalGradeChange(key: string) {
    setModalGradeKey(key)
    const [prodType, gradeName] = key.split('::')
    const match = modalAvailableGrades.find(
      (g) => g.ProductType === prodType && g.GradeName === gradeName,
    )
    if (match) {
      setModalPrevPrice(Number(match.AgreedPricePerTonne) || 0)
      setModalNewPrice(String(match.AgreedPricePerTonne || ''))
    }
  }

  // Save manual price revision
  async function handleSaveManualAdjustment(e: React.FormEvent) {
    e.preventDefault()
    if (!modalProcRef) {
      setModalError('Please select a procurement agreement.')
      return
    }
    if (!modalGradeKey) {
      setModalError('Please select a grade to adjust.')
      return
    }
    const newRate = parseFloat(modalNewPrice)
    if (isNaN(newRate) || newRate <= 0) {
      setModalError('Please enter a valid new price greater than 0.')
      return
    }

    const [prodType, gradeName] = modalGradeKey.split('::')
    const finalReason =
      modalReason === 'Other (Custom)'
        ? modalCustomReason.trim() || 'Custom rate revision'
        : modalReason

    setIsSaving(true)
    setModalError('')

    try {
      const res = await window.logPro.recordPriceHistory(
        workbookPath,
        {
          ProcurementRef: modalProcRef,
          ProductType: prodType,
          GradeName: gradeName,
          PreviousPrice: modalPrevPrice,
          NewPrice: newRate,
          ChangeType: 'Agreed Price Revision',
          Reason: finalReason,
          EffectiveDateTime: modalEffectiveDate,
          Notes: modalNotes,
          RecordedBy: 'Current User',
        },
        modalUpdateLiveGrade,
      )

      if (res.error) {
        setModalError(res.error)
      } else {
        setModalSuccess('Price revision recorded successfully in Excel.')
        setTimeout(() => {
          setIsModalOpen(false)
          onRefresh()
        }, 600)
      }
    } catch (err: any) {
      setModalError(err?.message || 'Failed to record price revision.')
    } finally {
      setIsSaving(false)
    }
  }

  // Export CSV
  function handleExportCsv() {
    if (filteredRecords.length === 0) {
      alert('No price history records to export with current filters.')
      return
    }

    const headers = [
      'RecordedDateTime',
      'ProcurementRef',
      'Supplier',
      'ProductType',
      'GradeName',
      'PreviousPrice',
      'NewPrice',
      'Variance',
      'ChangeType',
      'Reason',
      'EffectiveDateTime',
      'RecordedBy',
      'Notes',
    ]

    const rows = filteredRecords.map((r) => {
      const prev = Number(r.PreviousPrice) || 0
      const curr = Number(r.NewPrice) || 0
      const diff = curr - prev
      const supplierName = getSupplierNameForRef(r.ProcurementRef)

      return [
        `"${r.RecordedDateTime || ''}"`,
        `"${r.ProcurementRef || ''}"`,
        `"${supplierName}"`,
        `"${r.ProductType || ''}"`,
        `"${r.GradeName || ''}"`,
        prev.toFixed(2),
        curr.toFixed(2),
        diff.toFixed(2),
        `"${r.ChangeType || ''}"`,
        `"${r.Reason || ''}"`,
        `"${r.EffectiveDateTime || ''}"`,
        `"${r.RecordedBy || ''}"`,
        `"${(r.Notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Price_History_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div
      id="price-history-page"
      className="page-content"
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
      }}
    >
      {/* Top Banner & Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              }}
            >
              <TrendingUp size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)', fontWeight: 800 }}>
              Price History & Rate Revision Audit
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>
            Audit trail of agreed timber rate revisions, indexations, and contract negotiations across all procurements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            id="price-history-export-btn"
            onClick={handleExportCsv}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Download size={16} color="#64748b" />
            Export CSV
          </button>
          <button
            type="button"
            id="price-history-refresh-btn"
            onClick={onRefresh}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <RotateCw size={16} color="#64748b" />
            Refresh
          </button>
          <button
            type="button"
            id="price-history-log-btn"
            onClick={openManualModal}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
            }}
          >
            <Plus size={16} />
            Log Price Revision
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Rate Revisions
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
              }}
            >
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
              {metrics.totalCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>records logged</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contracts Impacted
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
              }}
            >
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
              {metrics.uniqueRefs}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>unique procurements</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Average Rate Variance
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: metrics.avgDelta >= 0 ? '#ecfdf5' : '#fef2f2',
                color: metrics.avgDelta >= 0 ? '#059669' : '#dc2626',
              }}
            >
              {metrics.avgDelta >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: metrics.avgDelta >= 0 ? '#059669' : '#dc2626',
              }}
            >
              {metrics.avgDelta >= 0 ? '+' : ''}${metrics.avgDelta.toFixed(2)}/t
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>across revisions</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Adjustment Breakdown
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#fffbeb',
                color: '#d97706',
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#059669',
              }}
            >
              <ArrowUpRight size={16} />
              {metrics.increases} Increases
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#dc2626',
              }}
            >
              <ArrowDownRight size={16} />
              {metrics.decreases} Decreases
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Keyword Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              id="price-history-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ref, grade, reason, user, or notes..."
              style={{
                width: '100%',
                padding: '9px 34px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  width: 'auto',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter by Procurement Ref */}
          <div>
            <select
              id="filter-procurement-ref"
              value={selectedProcurementFilter}
              onChange={(e) => setSelectedProcurementFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              <option value="ALL">All Procurements ({procurements.length})</option>
              {procurements.map((p) => (
                <option key={p.ProcurementRef} value={p.ProcurementRef}>
                  {p.ProcurementRef} {p.Plantation ? `- ${p.Plantation}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Supplier */}
          <div>
            <select
              id="filter-supplier"
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              <option value="ALL">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s.SupplierID} value={String(s.SupplierID)}>
                  {s.SupplierName}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Direction */}
          <div>
            <select
              id="filter-direction"
              value={selectedDirectionFilter}
              onChange={(e) => setSelectedDirectionFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
              }}
            >
              <option value="ALL">All Price Changes</option>
              <option value="UP">Increases Only (+$)</option>
              <option value="DOWN">Decreases Only (-$)</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Tag Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '10px',
            borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
            <Filter size={14} color="#64748b" />
            <span>Product Type:</span>
          </div>

          {['ALL', 'Green', 'Burnt'].map((pt) => {
            const isSelected = selectedProductTypeFilter === pt
            return (
              <button
                key={pt}
                type="button"
                onClick={() => setSelectedProductTypeFilter(pt)}
                style={{
                  width: 'auto',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #0284c7' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#0284c7' : '#f8fafc',
                  color: isSelected ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                {pt === 'ALL' ? 'All Product Types' : pt}
              </button>
            )
          })}

          {(searchTerm ||
            selectedProcurementFilter !== 'ALL' ||
            selectedSupplierFilter !== 'ALL' ||
            selectedProductTypeFilter !== 'ALL' ||
            selectedDirectionFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setSelectedProcurementFilter('ALL')
                setSelectedSupplierFilter('ALL')
                setSelectedProductTypeFilter('ALL')
                setSelectedDirectionFilter('ALL')
              }}
              style={{
                width: 'auto',
                marginLeft: 'auto',
                padding: '5px 10px',
                background: 'transparent',
                border: 'none',
                color: '#dc2626',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Data Table */}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              minWidth: '980px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.86rem',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Recorded Date</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Agreement Ref</th>
                <th style={{ padding: '12px 16px' }}>Supplier</th>
                <th style={{ padding: '12px 16px' }}>Product & Grade</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Previous Rate</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>New Agreed Rate</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>Variance ($/t)</th>
                <th style={{ padding: '12px 16px' }}>Revision Reason</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Effective Date</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Logged By</th>
                <th style={{ padding: '12px 16px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={36} color="#cbd5e1" />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.98rem', color: '#475569' }}>
                        No price revision records found
                      </p>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', maxWidth: '420px' }}>
                        {priceHistory.length === 0
                          ? 'When you modify agreed grade prices on procurements, revision records will appear here automatically.'
                          : 'No records matched your search filters. Try clearing or expanding your filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => {
                  const prev = Number(r.PreviousPrice) || 0
                  const curr = Number(r.NewPrice) || 0
                  const diff = curr - prev
                  const pct = prev > 0 ? (diff / prev) * 100 : 0
                  const supplierName = getSupplierNameForRef(r.ProcurementRef)

                  return (
                    <tr
                      key={r.PriceHistoryID || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafcff',
                        color: '#1e293b',
                      }}
                    >
                      {/* Date */}
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {r.RecordedDateTime || r.EffectiveDateTime || '—'}
                      </td>

                      {/* Procurement Ref */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {onNavigateToProcurement ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToProcurement(r.ProcurementRef)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              width: 'auto',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#0284c7',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '0.88rem',
                            }}
                            title="Open this agreement in Procurements"
                          >
                            {r.ProcurementRef}
                          </button>
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                            {r.ProcurementRef}
                          </span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155', maxWidth: '160px' }}>
                        {supplierName || '—'}
                      </td>

                      {/* Product & Grade */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {r.GradeName}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {r.ProductType}
                        </div>
                      </td>

                      {/* Previous Rate */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap' }}>
                        ${prev.toFixed(2)}
                      </td>

                      {/* New Rate */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ${curr.toFixed(2)}
                      </td>

                      {/* Variance */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 9px',
                            borderRadius: '16px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            backgroundColor: diff > 0 ? '#ecfdf5' : diff < 0 ? '#fef2f2' : '#f8fafc',
                            color: diff > 0 ? '#065f46' : diff < 0 ? '#991b1b' : '#475569',
                            border: `1px solid ${diff > 0 ? '#a7f3d0' : diff < 0 ? '#fecaca' : '#e2e8f0'}`,
                          }}
                        >
                          {diff > 0 ? <ArrowUpRight size={13} /> : diff < 0 ? <ArrowDownRight size={13} /> : null}
                          {diff >= 0 ? '+' : ''}${diff.toFixed(2)}
                          {prev > 0 && ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`}
                        </span>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.Reason || 'Price Revision'}
                        </span>
                      </td>

                      {/* Effective Date */}
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {r.EffectiveDateTime || '—'}
                      </td>

                      {/* Logged By */}
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {r.RecordedBy || 'Current User'}
                      </td>

                      {/* Notes */}
                      <td
                        style={{
                          padding: '12px 16px',
                          color: '#64748b',
                          fontSize: '0.8rem',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={r.Notes}
                      >
                        {r.Notes || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.82rem',
            color: '#64748b',
          }}
        >
          <span>
            Showing <strong style={{ color: '#0f172a' }}>{filteredRecords.length}</strong> of{' '}
            <strong style={{ color: '#0f172a' }}>{priceHistory.length}</strong> price revision records
          </span>
          <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
            Source: Excel Sheet <code style={{ color: '#475569' }}>PriceHistory</code>
          </span>
        </div>
      </div>

      {/* Manual Price Adjustment Modal */}
      {isModalOpen && (
        <div
          id="manual-price-revision-modal"
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
            style={{
              width: 'min(100%, 600px)',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                backgroundColor: '#059669',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                  }}
                >
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                    Log Timber Price Revision
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#d1fae5' }}>
                    Record an audit entry for renegotiated or adjusted grade rates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  width: 'auto',
                  padding: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ffffff',
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

            {/* Modal Form */}
            <form onSubmit={handleSaveManualAdjustment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {modalError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={16} color="#dc2626" />
                  <span>{modalError}</span>
                </div>
              )}
              {modalSuccess && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #a7f3d0',
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <Check size={16} color="#059669" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Procurement Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                  Procurement Agreement <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  required
                  value={modalProcRef}
                  onChange={(e) => handleModalProcRefChange(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Select Procurement Agreement --</option>
                  {procurements.map((p) => {
                    const suppName = supplierMap.get(String(p.SupplierID)) || ''
                    return (
                      <option key={p.ProcurementRef} value={p.ProcurementRef}>
                        {p.ProcurementRef} - {suppName} ({p.Plantation || p.Species || 'Coupe'})
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Grade Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                  Grade to Adjust <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  required
                  value={modalGradeKey}
                  onChange={(e) => handleModalGradeChange(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Select Grade --</option>
                  {modalAvailableGrades.map((g, i) => {
                    const key = `${g.ProductType}::${g.GradeName}`
                    return (
                      <option key={i} value={key}>
                        {g.GradeName} ({g.ProductType}) - Current: ${Number(g.AgreedPricePerTonne).toFixed(2)}/t
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Previous vs New Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Previous Agreed Rate ($/t)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled
                    value={modalPrevPrice}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f1f5f9',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#475569',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    New Agreed Rate ($/t) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalNewPrice}
                    onChange={(e) => setModalNewPrice(e.target.value)}
                    placeholder="e.g. 102.50"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Price Revision Reason */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                  Revision Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
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

              {modalReason === 'Other (Custom)' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Custom Reason Detail <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalCustomReason}
                    onChange={(e) => setModalCustomReason(e.target.value)}
                    placeholder="Describe specific renegotiation reason..."
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Effective Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="#64748b" />
                  Effective Date
                </label>
                <input
                  type="date"
                  value={modalEffectiveDate}
                  onChange={(e) => setModalEffectiveDate(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                  Audit Notes & Commentary
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Optional notes regarding the rate negotiation, approval reference..."
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Also update current live grade rate */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="modal-update-live-grade"
                  checked={modalUpdateLiveGrade}
                  onChange={(e) => setModalUpdateLiveGrade(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="modal-update-live-grade"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                >
                  Also update this grade's current rate in{' '}
                  <strong style={{ color: '#0f172a' }}>ProcurementGrades</strong>
                </label>
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
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
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
                  disabled={isSaving}
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? (
                    <>
                      <RotateCw size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Save Price Revision
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
