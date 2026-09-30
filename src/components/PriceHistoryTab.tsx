import { useState, useMemo, useCallback } from 'react'
import {
  TrendingUp,
  Search,
  Download,
  RotateCw,
  Plus,
  FileSpreadsheet,
  AlertCircle,
  X,
  Check,
  Calendar,
  CheckCircle2,
  Archive,
  Eye,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  MessageSquare,
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
  const [selectedCompletedProc, setSelectedCompletedProc] = useState<Procurement | null>(null)
  const [expandedProcRefs, setExpandedProcRefs] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('ALL')

  // Re-open (Uncomplete) Modal State
  const [reopenModalProc, setReopenModalProc] = useState<Procurement | null>(null)
  const [reopenReason, setReopenReason] = useState('')
  const [isReopening, setIsReopening] = useState(false)
  const [reopenError, setReopenError] = useState('')
  const [pageToast, setPageToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  // Completed / Expired procurements only
  const completedProcurements = useMemo(() => {
    return procurements.filter((p) => p.Status === 'Completed')
  }, [procurements])



  const filteredCompletedProcurements = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return completedProcurements.filter((p) => {
      const suppName = getSupplierNameForRef(p.ProcurementRef)
      const supplierMatch =
        selectedSupplierFilter === 'ALL' || String(p.SupplierID) === selectedSupplierFilter

      const searchMatch =
        !q ||
        p.ProcurementRef.toLowerCase().includes(q) ||
        suppName.toLowerCase().includes(q) ||
        p.Plantation.toLowerCase().includes(q) ||
        p.Species.toLowerCase().includes(q) ||
        p.AgreementDetail.toLowerCase().includes(q) ||
        p.Notes.toLowerCase().includes(q)

      return supplierMatch && searchMatch
    })
  }, [completedProcurements, searchTerm, selectedSupplierFilter, getSupplierNameForRef])

  function toggleExpandProc(ref: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setExpandedProcRefs((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) {
        next.delete(ref)
      } else {
        next.add(ref)
      }
      return next
    })
  }

  function handleOpenReopen(p: Procurement, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setReopenModalProc(p)
    setReopenReason('')
    setReopenError('')
  }

  async function handleConfirmReopen() {
    if (!reopenModalProc) return
    setIsReopening(true)
    setReopenError('')
    try {
      const res = await window.logPro.reopenProcurement(
        workbookPath,
        reopenModalProc.ProcurementRef,
        {
          reason: reopenReason.trim() || 'Procurement re-opened from Price History',
        },
      )
      if (res.error) {
        setReopenError(res.error)
      } else {
        const refName = reopenModalProc.ProcurementRef
        setReopenModalProc(null)
        setPageToast({
          type: 'success',
          text: `Procurement ${refName} was re-opened and returned to the active ledger & procurement register.`,
        })
        onRefresh()
      }
    } catch (err: any) {
      setReopenError(err?.message || 'Failed to re-open procurement.')
    } finally {
      setIsReopening(false)
    }
  }



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

  // Export CSV of Completed Procurements & Price Lists
  function handleExportCsv() {
    if (filteredCompletedProcurements.length === 0) {
      alert('No completed agreements to export with current filters.')
      return
    }

    const headers = [
      'AgreementRef',
      'Supplier',
      'Plantation',
      'Species',
      'StartDate',
      'EndDate',
      'TotalAgreedTonnes',
      'DeliveredTonnes',
      'ProductType',
      'GradeName',
      'AgreedRatePerTonne',
      'OfferedRatePerTonne',
      'GradeNotes',
      'AgreementNotes',
    ]

    const rows: string[] = []
    for (const p of filteredCompletedProcurements) {
      const pGrades = grades.filter(
        (g) => g.ProcurementRef.trim().toLowerCase() === p.ProcurementRef.trim().toLowerCase(),
      )
      const suppName = getSupplierNameForRef(p.ProcurementRef)
      if (pGrades.length === 0) {
        rows.push(
          [
            `"${p.ProcurementRef}"`,
            `"${suppName}"`,
            `"${p.Plantation || p.AgreementDetail || ''}"`,
            `"${p.Species || ''}"`,
            `"${p.StartDate || p.HarvestPeriodStart || ''}"`,
            `"${p.EndDate || p.HarvestPeriodEnd || ''}"`,
            `"${p.TotalAgreedTonnes || ''}"`,
            `"0"`,
            '""',
            '""',
            '""',
            '""',
            '""',
            `"${(p.Notes || '').replace(/"/g, '""')}"`,
          ].join(','),
        )
      } else {
        for (const g of pGrades) {
          rows.push(
            [
              `"${p.ProcurementRef}"`,
              `"${suppName}"`,
              `"${p.Plantation || p.AgreementDetail || ''}"`,
              `"${p.Species || ''}"`,
              `"${p.StartDate || p.HarvestPeriodStart || ''}"`,
              `"${p.EndDate || p.HarvestPeriodEnd || ''}"`,
              `"${p.TotalAgreedTonnes || ''}"`,
              `"${g.DeliveredTonnes || 0}"`,
              `"${g.ProductType || ''}"`,
              `"${g.GradeName || ''}"`,
              `"${g.AgreedPricePerTonne}"`,
              `"${g.OfferedPricePerTonne || ''}"`,
              `"${(g.Notes || '').replace(/"/g, '""')}"`,
              `"${(p.Notes || '').replace(/"/g, '""')}"`,
            ].join(','),
          )
        }
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Completed_Agreements_Price_History_${new Date().toISOString().slice(0, 10)}.csv`)
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
      <div className="page-heading">
        <div className="page-title-group">
          <div className="page-title-icon-badge">
            <TrendingUp size={22} />
          </div>
          <h2>Price History</h2>
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

      {/* Toast Alert */}
      {pageToast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: pageToast.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${pageToast.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: pageToast.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pageToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{pageToast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'currentColor',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Completed & Expired Agreements Register */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Information & Summary Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              padding: '14px 20px',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#065f46' }}>
                  Archived Completed Agreements ({completedProcurements.length})
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#047857' }}>
                  Procurements concluded early or expired by date drop off the active register and are archived here for historical rate audit and volume review.
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
              <Search
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search completed agreements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  outline: 'none',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Supplier Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                Supplier:
              </label>
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.SupplierID} value={String(s.SupplierID)}>
                    {s.SupplierName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Completed Agreements Table */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ width: '38px', padding: '10px 8px 10px 14px' }}></th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Agreement Ref</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Supplier</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Plantation / Coupe</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Species</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Date Range</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Agreed Tonnes</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Delivered</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompletedProcurements.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                        <Archive size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                        {completedProcurements.length === 0
                          ? 'No procurements have been completed yet. When an agreement ends or is stopped early, it will appear here.'
                          : 'No completed agreements match your search or filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCompletedProcurements.map((p) => {
                      const suppName = getSupplierNameForRef(p.ProcurementRef)
                      const isExpanded = expandedProcRefs.has(p.ProcurementRef)
                      const procGrades = grades.filter((g) => g.ProcurementRef.trim().toLowerCase() === p.ProcurementRef.trim().toLowerCase())
                      const procHistory = priceHistory.filter((h) => h.ProcurementRef.trim().toLowerCase() === p.ProcurementRef.trim().toLowerCase())

                      const targetTonnes =
                        p.AgreedTonnesMode === 'total' && p.TotalAgreedTonnes
                          ? Number(p.TotalAgreedTonnes)
                          : procGrades.reduce((sum, g) => sum + (Number(g.AgreedTonnes) || 0), 0)

                      const deliveredTonnes = procGrades.reduce((sum, g) => sum + (Number(g.DeliveredTonnes) || 0), 0)

                      const startD = p.StartDate || p.HarvestPeriodStart || '—'
                      const endD = p.EndDate || p.HarvestPeriodEnd || '—'

                      return (
                        <tr key={p.ProcurementRef} style={{ display: 'contents' }}>
                          <tr
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                              backgroundColor: isExpanded ? '#f0f9ff' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isExpanded) e.currentTarget.style.backgroundColor = '#f8fafc'
                            }}
                            onMouseLeave={(e) => {
                              if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                            onClick={() => toggleExpandProc(p.ProcurementRef)}
                          >
                            <td style={{ width: '38px', padding: '10px 8px 10px 14px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => toggleExpandProc(p.ProcurementRef, e)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: isExpanded ? '#0284c7' : '#94a3b8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title={isExpanded ? 'Collapse price list' : 'Click to display price list'}
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                              <span
                                style={{
                                  color: onNavigateToProcurement ? '#0284c7' : '#0f172a',
                                  cursor: onNavigateToProcurement ? 'pointer' : 'default',
                                  textDecoration: onNavigateToProcurement ? 'underline' : 'none',
                                }}
                                onClick={(e) => {
                                  if (onNavigateToProcurement) {
                                    e.stopPropagation()
                                    onNavigateToProcurement(p.ProcurementRef)
                                  }
                                }}
                                title={onNavigateToProcurement ? `Open agreement ${p.ProcurementRef}` : ''}
                              >
                                {p.ProcurementRef}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#334155' }}>
                              {suppName || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b' }}>
                              {p.Plantation || p.AgreementDetail || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b' }}>
                              {p.Species || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748b' }}>
                              {startD} → {endD}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              {targetTonnes ? targetTonnes.toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                              {deliveredTonnes ? deliveredTonnes.toLocaleString() : '0'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  backgroundColor: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                <CheckCircle2 size={12} /> Completed
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpandProc(p.ProcurementRef, e)}
                                  style={{
                                    width: 'auto',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: isExpanded ? '#0284c7' : '#ffffff',
                                    color: isExpanded ? '#ffffff' : '#0369a1',
                                    fontWeight: 600,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Click to display price list of all grades"
                                >
                                  <FileSpreadsheet size={13} />
                                  {isExpanded ? 'Hide Price List' : 'View Price List'}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleOpenReopen(p, e)}
                                  style={{
                                    width: 'auto',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #7dd3fc',
                                    background: '#f0f9ff',
                                    color: '#0369a1',
                                    fontWeight: 600,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Re-open agreement and return to active ledger"
                                >
                                  <RotateCcw size={12} />
                                  Re-open
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Price List and Grade details */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: '#f0f9ff' }}>
                              <td colSpan={10} style={{ padding: '0 16px 16px 16px', borderBottom: '2px solid #bae6fd' }}>
                                <div
                                  style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '10px',
                                    padding: '16px 20px',
                                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)',
                                  }}
                                >
                                  {/* Header banner of expanded price list */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: '14px',
                                      paddingBottom: '12px',
                                      borderBottom: '1px solid #e2e8f0',
                                      flexWrap: 'wrap',
                                      gap: '10px',
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FileSpreadsheet size={18} color="#0284c7" />
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                          Price List &amp; Grade Rates: {p.ProcurementRef}
                                        </h4>
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            background: '#ecfdf5',
                                            color: '#065f46',
                                            fontWeight: 700,
                                            border: '1px solid #a7f3d0',
                                          }}
                                        >
                                          Archived Price List
                                        </span>
                                      </div>
                                      <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                        Supplier: <strong style={{ color: '#334155' }}>{suppName}</strong> • {p.Plantation || p.AgreementDetail || 'Plantation'} • Species: {p.Species} • Term: {startD} to {endD}
                                      </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => handleOpenReopen(p, e)}
                                        style={{
                                          width: 'auto',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '7px 14px',
                                          borderRadius: '6px',
                                          border: '1px solid #0284c7',
                                          background: '#0284c7',
                                          color: '#ffffff',
                                          fontWeight: 700,
                                          fontSize: '0.82rem',
                                          cursor: 'pointer',
                                          boxShadow: '0 1px 3px rgba(2, 132, 199, 0.2)',
                                        }}
                                        title="Re-open agreement and return to active ledger"
                                      >
                                        <RotateCcw size={13} /> Re-open (Put Back into Ledger)
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedCompletedProc(p)
                                        }}
                                        style={{
                                          width: 'auto',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '7px 12px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          background: '#ffffff',
                                          color: '#475569',
                                          fontWeight: 600,
                                          fontSize: '0.82rem',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Eye size={13} /> Full Record
                                      </button>
                                    </div>
                                  </div>

                                  {/* Notes if present */}
                                  {p.Notes && (
                                    <div
                                      style={{
                                        backgroundColor: '#fffbeb',
                                        border: '1px solid #fef3c7',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        marginBottom: '14px',
                                        fontSize: '0.83rem',
                                        color: '#92400e',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      <strong>Agreement &amp; Completion Notes:</strong> {p.Notes}
                                    </div>
                                  )}

                                  {/* Grade Price List Table */}
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: procHistory.length > 0 ? '16px' : 0 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Product Type</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Grade Name</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Agreed Rate ($/t)</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Offered ($/t)</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Target Tonnes</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Delivered</th>
                                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Grade Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {procGrades.length === 0 ? (
                                          <tr>
                                            <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                              No grades found for this procurement agreement.
                                            </td>
                                          </tr>
                                        ) : (
                                          procGrades.map((g, gi) => (
                                            <tr key={gi} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '8px 12px' }}>
                                                <span
                                                  style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    backgroundColor: g.ProductType === 'Burnt' ? '#fef2f2' : '#f0fdf4',
                                                    color: g.ProductType === 'Burnt' ? '#991b1b' : '#166534',
                                                    border: `1px solid ${g.ProductType === 'Burnt' ? '#fecaca' : '#bbf7d0'}`,
                                                  }}
                                                >
                                                  {g.ProductType}
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{g.GradeName}</td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                                ${Number(g.AgreedPricePerTonne).toFixed(2)}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                                {Number(g.OfferedPricePerTonne) > 0 ? `$${Number(g.OfferedPricePerTonne).toFixed(2)}` : '—'}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                                {Number(g.AgreedTonnes).toLocaleString()}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                                {Number(g.DeliveredTonnes || 0).toLocaleString()}
                                              </td>
                                              <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.8rem' }}>
                                                {g.Notes ? (
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
                                                    <MessageSquare size={13} /> {g.Notes}
                                                  </span>
                                                ) : (
                                                  '—'
                                                )}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Historical Rate Revisions for this Agreement */}
                                  {procHistory.length > 0 && (
                                    <div>
                                      <h5 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                        Rate Revisions &amp; Price Amendments for {p.ProcurementRef}
                                      </h5>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {procHistory.map((h, hi) => (
                                          <div
                                            key={hi}
                                            style={{
                                              padding: '8px 12px',
                                              backgroundColor: '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              borderRadius: '6px',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              fontSize: '0.8rem',
                                              flexWrap: 'wrap',
                                              gap: '8px',
                                            }}
                                          >
                                            <div>
                                              <strong style={{ color: '#0f172a' }}>{h.GradeName} ({h.ProductType}):</strong>{' '}
                                              <span style={{ color: '#475569' }}>{h.ChangeType} — {h.Reason || 'Rate update'}</span>
                                              {h.Notes && <span style={{ color: '#64748b' }}> • {h.Notes}</span>}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                              <span style={{ fontWeight: 700, color: '#059669' }}>${Number(h.NewPrice).toFixed(2)}/t</span>
                                              <span style={{ marginLeft: '8px', fontSize: '0.74rem', color: '#94a3b8' }}>{h.EffectiveDateTime || h.RecordedDateTime}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

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
                Showing <strong style={{ color: '#0f172a' }}>{filteredCompletedProcurements.length}</strong> of{' '}
                <strong style={{ color: '#0f172a' }}>{completedProcurements.length}</strong> completed agreements
              </span>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                Archived from Procurement Register
              </span>
            </div>
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

      {/* Completed Procurement Detail Modal */}
      {selectedCompletedProc && (
        <div
          id="completed-procurement-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCompletedProc(null)
          }}
        >
          <div
            style={{
              width: 'min(100%, 780px)',
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
                padding: '16px 22px',
                backgroundColor: '#065f46',
                color: '#ffffff',
                borderTopLeftRadius: '14px',
                borderTopRightRadius: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <CheckCircle2 size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                    {selectedCompletedProc.ProcurementRef} — Archived Agreement
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>
                    {getSupplierNameForRef(selectedCompletedProc.ProcurementRef)} • Status: Completed
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCompletedProc(null)}
                style={{
                  width: 'auto',
                  padding: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Meta Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Supplier</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {getSupplierNameForRef(selectedCompletedProc.ProcurementRef) || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Plantation / Coupe</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {selectedCompletedProc.Plantation || selectedCompletedProc.AgreementDetail || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Species</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {selectedCompletedProc.Species || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Agreement Term</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedCompletedProc.StartDate || selectedCompletedProc.HarvestPeriodStart || '—'} to{' '}
                    {selectedCompletedProc.EndDate || selectedCompletedProc.HarvestPeriodEnd || '—'}
                  </div>
                </div>
              </div>

              {/* Notes / Stop Notes */}
              {selectedCompletedProc.Notes && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                    Completion & Agreement Notes:
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedCompletedProc.Notes}
                  </p>
                </div>
              )}

              {/* Grades Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Final Agreed Rates & Specifications
                </h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Product Type</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Grade</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Agreed Rate ($/t)</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Agreed Tonnes</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Delivered</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Grade Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades
                        .filter((g) => g.ProcurementRef.trim().toLowerCase() === selectedCompletedProc.ProcurementRef.trim().toLowerCase())
                        .map((g, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor: g.ProductType === 'Burnt' ? '#fef2f2' : '#f0fdf4',
                                  color: g.ProductType === 'Burnt' ? '#991b1b' : '#166534',
                                  border: `1px solid ${g.ProductType === 'Burnt' ? '#fecaca' : '#bbf7d0'}`,
                                }}
                              >
                                {g.ProductType}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{g.GradeName}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              ${Number(g.AgreedPricePerTonne).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                              {Number(g.AgreedTonnes).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              {Number(g.DeliveredTonnes || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.8rem' }}>
                              {g.Notes || '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price History Events for this procurement */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Price History & Rate Audit Log
                </h4>
                {priceHistory.filter((h) => h.ProcurementRef.trim().toLowerCase() === selectedCompletedProc.ProcurementRef.trim().toLowerCase()).length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>No price revisions or completion records logged for this agreement.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {priceHistory
                      .filter((h) => h.ProcurementRef.trim().toLowerCase() === selectedCompletedProc.ProcurementRef.trim().toLowerCase())
                      .map((h, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                              {h.GradeName} ({h.ProductType}):
                            </span>{' '}
                            <span style={{ color: '#475569', fontSize: '0.82rem' }}>
                              {h.ChangeType} — {h.Reason || 'Rate update'}
                            </span>
                            {h.Notes && (
                              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                Notes: {h.Notes}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#059669' }}>
                              ${Number(h.NewPrice).toFixed(2)}/t
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {h.EffectiveDateTime || h.RecordedDateTime}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                borderBottomLeftRadius: '14px',
                borderBottomRightRadius: '14px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const target = selectedCompletedProc
                  setSelectedCompletedProc(null)
                  handleOpenReopen(target)
                }}
                style={{
                  width: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #0284c7',
                  background: '#f0f9ff',
                  color: '#0369a1',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Re-open (Put Back into Ledger)
              </button>

              <button
                type="button"
                onClick={() => setSelectedCompletedProc(null)}
                style={{
                  width: 'auto',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close Archive View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-open (Uncomplete) Procurement Dialog */}
      {reopenModalProc && (
        <div
          id="reopen-procurement-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isReopening) setReopenModalProc(null)
          }}
        >
          <div
            style={{
              width: 'min(100%, 540px)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                backgroundColor: '#0369a1',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={18} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                    Re-open Procurement Agreement
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#bae6fd' }}>
                    {reopenModalProc.ProcurementRef} • {getSupplierNameForRef(reopenModalProc.ProcurementRef)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalProc(null)}
                disabled={isReopening}
                style={{
                  width: 'auto',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  cursor: isReopening ? 'not-allowed' : 'pointer',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reopenError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{reopenError}</span>
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to re-open <strong>{reopenModalProc.ProcurementRef}</strong>?
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  fontSize: '0.83rem',
                  color: '#0369a1',
                  lineHeight: 1.5,
                }}
              >
                Re-opening this agreement will change its status back to <strong>Active</strong>. It will immediately drop off the Price History archive and return to the active procurement register and ledger.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  Reason / Notes for Re-opening (Optional):
                </label>
                <input
                  type="text"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Harvest period resumed, additional quota allocated..."
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setReopenModalProc(null)}
                disabled={isReopening}
                style={{
                  width: 'auto',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: isReopening ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                disabled={isReopening}
                style={{
                  width: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isReopening ? 'not-allowed' : 'pointer',
                  opacity: isReopening ? 0.7 : 1,
                }}
              >
                {isReopening ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    Re-opening...
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    Confirm Re-open &amp; Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
