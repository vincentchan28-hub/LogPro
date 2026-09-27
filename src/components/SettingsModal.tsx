import { useState, useMemo, useEffect, useRef, useCallback, type FormEvent } from 'react'
import {
  Settings,
  Building,
  BarChart3,
  Download,
  MapPin,
  X,
  Plus,
  Copy,
  Check,
  Tag,
  Trees,
  FileSpreadsheet,
  Pencil,
  Save,
  Trash2,
  Filter,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import {
  type Supplier,
  type SupplierContact,
  type SpeciesDefinition,
  type GradeDefinition,
  type WorkbookResult,
  PRODUCT_TYPES,
} from '../types'
import { ProductTypeBadge } from './ProductTypeBadge'

type SettingsTab = 'speciesGrades' | 'suppliers' | 'reports' | 'workbook'
// The name the browser uses to remember the size of the Settings box.
const SETTINGS_SIZE_KEY = 'logpro.settingsModalSize'

// The standard size used until you resize the box yourself.
const DEFAULT_SETTINGS_SIZE = { width: 900, height: 620 }

// Reads the size you last chose. Uses the standard size if nothing was saved.
function readSavedSize(): { width: number; height: number } {
  try {
    const text = window.localStorage.getItem(SETTINGS_SIZE_KEY)
    if (text) {
      const saved = JSON.parse(text)
      const width = Number(saved.width)
      const height = Number(saved.height)
      if (width >= 480 && height >= 320) {
        return { width, height }
      }
    }
  } catch {
    // If the browser blocks saving, use the standard size.
  }
  return DEFAULT_SETTINGS_SIZE
}

// Saves the size so it is still there next time.
function saveSize(width: number, height: number) {
  try {
    window.localStorage.setItem(
      SETTINGS_SIZE_KEY,
      JSON.stringify({ width, height }),
    )
  } catch {
    // If the browser blocks saving, carry on without it.
  }
}

// Remembers how wide each column of the Grades table is.
const GRADE_COLUMN_WIDTHS_KEY = 'logpro.gradesTableColumnWidths'

const DEFAULT_GRADE_COLUMN_WIDTHS = {
  gradeName: 160,
  supplier: 160,
  productType: 120,
  species: 140,
  notes: 220,
}

type GradeColumnWidths = typeof DEFAULT_GRADE_COLUMN_WIDTHS

function readGradeColumnWidths(): GradeColumnWidths {
  try {
    const text = window.localStorage.getItem(GRADE_COLUMN_WIDTHS_KEY)
    if (text) {
      return { ...DEFAULT_GRADE_COLUMN_WIDTHS, ...JSON.parse(text) }
    }
  } catch {
    // Use defaults if the browser blocks reading.
  }
  return { ...DEFAULT_GRADE_COLUMN_WIDTHS }
}

function saveGradeColumnWidths(widths: GradeColumnWidths) {
  try {
    window.localStorage.setItem(GRADE_COLUMN_WIDTHS_KEY, JSON.stringify(widths))
  } catch {
    // Ignore storage issues.
  }
}

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  workbookPath: string
  suppliers: Supplier[]
  onOpenAddSupplier: () => void
  onRefresh: () => void
  onWorkbookChanged?: (result: WorkbookResult) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  workbookPath,
  suppliers,
  onOpenAddSupplier,
  onRefresh,
  onWorkbookChanged,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('speciesGrades')
  const [hasCopiedLocation, setHasCopiedLocation] = useState(false)
  const [workbookMessage, setWorkbookMessage] = useState('')
  const [workbookError, setWorkbookError] = useState('')
  const [isChangingWorkbook, setIsChangingWorkbook] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)

  // Species & Grade definition state
  const [speciesGradesVersion, setSpeciesGradesVersion] = useState(0)
  const [gradeColumnWidths, setGradeColumnWidths] = useState<GradeColumnWidths>(() =>
    readGradeColumnWidths(),
  )

  function startColumnResize(column: keyof GradeColumnWidths, event: React.MouseEvent) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = gradeColumnWidths[column]

    function onMove(moveEvent: MouseEvent) {
      const next = Math.max(60, startWidth + (moveEvent.clientX - startX))
      setGradeColumnWidths((current) => ({ ...current, [column]: next }))
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setGradeColumnWidths((current) => {
        saveGradeColumnWidths(current)
        return current
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const [newSpeciesName, setNewSpeciesName] = useState('')
  const [selectedSpeciesForGrade, setSelectedSpeciesForGrade] = useState('')
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('')
  const [isAddSpeciesOpen, setIsAddSpeciesOpen] = useState(false)
  const [isSpeciesListVisible, setIsSpeciesListVisible] = useState(false)
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false)
  const [addGradeSpeciesName, setAddGradeSpeciesName] = useState('')
  const [addGradeProductType, setAddGradeProductType] = useState<'Green' | 'Burnt'>('Green')
  const [addGradeSupplierId, setAddGradeSupplierId] = useState('')
  const [addGradeRows, setAddGradeRows] = useState<string[]>(['', '', '', '', ''])
  const [addGradeToBoth, setAddGradeToBoth] = useState(false)
  const [selectedGradeForDetails, setSelectedGradeForDetails] = useState<GradeDefinition | null>(null)
  const [speciesError, setSpeciesError] = useState('')
  const [speciesSuccess, setSpeciesSuccess] = useState('')
  const [isSubmittingSpecies, setIsSubmittingSpecies] = useState(false)

  // Species Edit & Delete state
  const [editingSpecies, setEditingSpecies] = useState<SpeciesDefinition | null>(null)
  const [editSpeciesName, setEditSpeciesName] = useState('')
  const [editSpeciesNotes, setEditSpeciesNotes] = useState('')
  const [deletingSpecies, setDeletingSpecies] = useState<SpeciesDefinition | null>(null)
  const [isSavingSpecies, setIsSavingSpecies] = useState(false)
  const [isDeletingSpecies, setIsDeletingSpecies] = useState(false)

  // Grade Edit & Delete state
  const [editingGrade, setEditingGrade] = useState<GradeDefinition | null>(null)
  const [editGradeName, setEditGradeName] = useState('')
  const [editGradeSupplierId, setEditGradeSupplierId] = useState('')
  const [editGradeSpeciesName, setEditGradeSpeciesName] = useState('')
  const [editGradeProductType, setEditGradeProductType] = useState<'Green' | 'Burnt'>('Green')
  const [editGradeNotes, setEditGradeNotes] = useState('')
  const [deletingGrade, setDeletingGrade] = useState<GradeDefinition | null>(null)
  const [isSavingGrade, setIsSavingGrade] = useState(false)
  const [isDeletingGrade, setIsDeletingGrade] = useState(false)

  // Supplier Edit state & handlers
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [editSupplierForm, setEditSupplierForm] = useState({
    name: '',
    abn: '',
    address: '',
    paymentTerms: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [supplierEditError, setSupplierEditError] = useState('')
  const [supplierEditSuccess, setSupplierEditSuccess] = useState('')
  const [isSavingSupplier, setIsSavingSupplier] = useState(false)
  const [supplierContacts, setSupplierContacts] = useState<SupplierContact[]>([])

  const loadSupplierContacts = useCallback(() => {
    if (!workbookPath) return
    try {
      const contacts = window.logPro.getSupplierContacts(workbookPath)
      setSupplierContacts(contacts || [])
    } catch {
      // ignore
    }
  }, [workbookPath])

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(loadSupplierContacts)
    }
  }, [isOpen, workbookPath, suppliers, loadSupplierContacts])

  // Delete mode toggle for Grades and Suppliers tabs
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false)

  // Multi-select delete for Grades
  const [selectedGradeIdsForBulkDelete, setSelectedGradeIdsForBulkDelete] = useState<Set<string>>(new Set())
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Supplier Delete state & handlers
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false)
  const [supplierDeleteError, setSupplierDeleteError] = useState('')

  function handleStartDeleteSupplier(supplier: Supplier) {
    setDeletingSupplier(supplier)
    setSupplierDeleteError('')
  }

  function handleCancelDeleteSupplier() {
    setDeletingSupplier(null)
    setSupplierDeleteError('')
  }

  async function handleConfirmDeleteSupplier() {
    if (!deletingSupplier) return
    const supplierId = deletingSupplier.SupplierID || deletingSupplier.SupplierReference
    if (!supplierId) return

    setIsDeletingSupplier(true)
    setSupplierDeleteError('')
    try {
      const res = await window.logPro.deleteSupplier(workbookPath, supplierId)
      if (res.error) {
        setSupplierDeleteError(res.error)
      } else {
        setSupplierEditSuccess(`Supplier "${deletingSupplier.SupplierName}" deleted successfully.`)
        setDeletingSupplier(null)
        loadSupplierContacts()
        onRefresh()
      }
    } catch (err: any) {
      setSupplierDeleteError(err?.message || 'Failed to delete supplier.')
    } finally {
      setIsDeletingSupplier(false)
    }
  }

  function handleStartEditSupplier(supplier: Supplier) {
    const sIdStr = String(supplier.SupplierID || '').trim()
    const sRefStr = String(supplier.SupplierReference || '').trim()
    const suppContacts = supplierContacts.filter((c) => {
      const cSuppId = String(c.SupplierID).trim()
      return (sIdStr && cSuppId === sIdStr) || (sRefStr && cSuppId === sRefStr)
    })
    const primaryContact = suppContacts.find((c) => c.IsPrimary) || suppContacts[0]

    setEditingSupplier(supplier)
    setEditSupplierForm({
      name: supplier.SupplierName || '',
      abn: supplier.ABN || '',
      address: supplier.Address || '',
      paymentTerms: supplier.PaymentTerms || '',
      phone: supplier.Phone || primaryContact?.PhoneNumber || primaryContact?.MobileNumber || '',
      email: supplier.Email || primaryContact?.Email || '',
      notes: supplier.Notes || '',
    })
    setSupplierEditError('')
    setSupplierEditSuccess('')
  }

  function handleCancelEditSupplier() {
    setEditingSupplier(null)
    setSupplierEditError('')
  }

  async function handleSaveSupplierEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingSupplier) return

    const trimmedName = editSupplierForm.name.trim()
    if (!trimmedName) {
      setSupplierEditError('Supplier Name is required.')
      return
    }

    const supplierId = editingSupplier.SupplierID || editingSupplier.SupplierReference
    if (!supplierId) {
      setSupplierEditError('Invalid supplier identifier.')
      return
    }

    setIsSavingSupplier(true)
    setSupplierEditError('')

    try {
      const res = await window.logPro.updateSupplier(workbookPath, supplierId, {
        name: trimmedName,
        abn: editSupplierForm.abn.trim(),
        address: editSupplierForm.address.trim(),
        paymentTerms: editSupplierForm.paymentTerms.trim(),
        phone: editSupplierForm.phone.trim(),
        email: editSupplierForm.email.trim(),
        notes: editSupplierForm.notes.trim(),
      })

      if (res.error) {
        setSupplierEditError(res.error)
      } else {
        setSupplierEditSuccess(`Supplier "${trimmedName}" updated successfully.`)
        setEditingSupplier(null)
        loadSupplierContacts()
        onRefresh()
      }
    } catch (err: any) {
      setSupplierEditError(err?.message || 'Failed to update supplier.')
    } finally {
      setIsSavingSupplier(false)
    }
  }

  async function handleOpenExistingWorkbook() {
    setWorkbookMessage('')
    setWorkbookError('')
    setIsChangingWorkbook(true)

    try {
      const result = await window.logPro.openWorkbook()

      if (!result) {
        return
      }

      if (result.error) {
        setWorkbookError(result.error)
        return
      }

      if (!result.path) {
        setWorkbookError('No workbook was selected.')
        return
      }

      onWorkbookChanged?.(result)
      setWorkbookMessage('Existing workbook opened successfully.')
    } catch (err: any) {
      setWorkbookError(err?.message || 'Could not create the workbook.')
    } finally {
      setIsChangingWorkbook(false)
    }
  }

  async function handleCreateNewWorkbook() {
    setWorkbookMessage('')
    setWorkbookError('')
    setIsChangingWorkbook(true)

    try {
      const result = await window.logPro.createWorkbook()

      if (!result) {
        return
      }

      if (result.error) {
        setWorkbookError(result.error)
        return
      }

      if (!result.path) {
        setWorkbookError('The new workbook was not created.')
        return
      }

      onWorkbookChanged?.(result)
      setWorkbookMessage('New workbook created successfully.')
    } catch (err: any) {
      setWorkbookError(err?.message || 'Could not open the workbook.')
    } finally {
      setIsChangingWorkbook(false)
    }
  }

  async function handleBackupEverything() {
    setWorkbookMessage('')
    setWorkbookError('')
    if (!workbookPath) {
      setWorkbookError('No workbook is currently open to back up.')
      return
    }

    const desktop = (window as any).logProDesktop
    if (!desktop || typeof desktop.backupEverything !== 'function') {
      setWorkbookError('Full ZIP backup feature requires the Electron desktop application.')
      return
    }

    setIsBackingUp(true)
    try {
      const res = await desktop.backupEverything(workbookPath)
      if (res.canceled) {
        setIsBackingUp(false)
        return
      }
      if (!res.ok) {
        setWorkbookError(res.error || 'Failed to create complete backup.')
      } else {
        setWorkbookMessage(`Complete backup archive created successfully: ${res.zipPath}`)
      }
    } catch (err: any) {
      setWorkbookError(err?.message || 'Error occurred while creating backup.')
    } finally {
      setIsBackingUp(false)
    }
  }

  function handlePromptRestore() {
    setWorkbookMessage('')
    setWorkbookError('')
    if (!workbookPath) {
      setWorkbookError('No workbook is currently open. Please open or create a workbook first.')
      return
    }
    setIsRestoreConfirmOpen(true)
  }

  async function handleExecuteRestore() {
    setIsRestoreConfirmOpen(false)
    setWorkbookMessage('')
    setWorkbookError('')

    const desktop = (window as any).logProDesktop
    if (!desktop || typeof desktop.restoreBackup !== 'function') {
      setWorkbookError('Full restore feature requires the Electron desktop application.')
      return
    }

    setIsRestoring(true)
    try {
      const res = await desktop.restoreBackup(workbookPath)
      if (res.canceled) {
        setIsRestoring(false)
        return
      }
      if (!res.ok) {
        setWorkbookError(res.error || 'Failed to restore backup.')
      } else {
        setWorkbookMessage(res.safetyBackupPath
          ? `Backup restored successfully. A safety backup was saved at: ${res.safetyBackupPath}. Reloading workbook...`
          : 'Backup restored successfully. Reloading workbook...')
        if (res.restoredWorkbookPath) {
          try {
            const loadRes = await window.logPro.loadWorkbook(res.restoredWorkbookPath)
            if (onWorkbookChanged && loadRes) {
              onWorkbookChanged(loadRes)
            }
            onRefresh()
          } catch (e: any) {
            console.warn('Reloading restored workbook warning:', e)
          }
        }
      }
    } catch (err: any) {
      setWorkbookError(err?.message || 'Error occurred while restoring backup.')
    } finally {
      setIsRestoring(false)
    }
  }

  // Load species & grades from logPro
  const speciesList: SpeciesDefinition[] = useMemo(() => {
    if (!workbookPath) return []
    try {
      void speciesGradesVersion
      return window.logPro.getSpecies(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath, speciesGradesVersion])

  const gradesList: GradeDefinition[] = useMemo(() => {
    if (!workbookPath) return []
    try {
      void speciesGradesVersion
      return window.logPro.getGrades(workbookPath)
    } catch {
      return []
    }
  }, [workbookPath, speciesGradesVersion])

  // Active filtered supplier details
  const activeFilteredSupplier = useMemo(() => {
    if (!selectedSupplierFilter) return null
    return (
      suppliers.find(
        (s) => String(s.SupplierID || s.SupplierReference) === String(selectedSupplierFilter),
      ) || null
    )
  }, [selectedSupplierFilter, suppliers])

  type GroupedGradeRow = {
    key: string
    gradeName: string
    supplierId: string
    supplierName: string
    speciesName: string
    notes: string
    defs: GradeDefinition[]
  }

  const filteredGrades = useMemo(() => {
    return gradesList.filter((g) => {
      if (
        selectedSpeciesForGrade &&
        g.SpeciesName &&
        g.SpeciesName.toLowerCase() !== selectedSpeciesForGrade.toLowerCase()
      ) {
        return false
      }
      if (selectedSupplierFilter) {
        const matchesId = String(g.SupplierID || '') === String(selectedSupplierFilter)
        const supplierObj = suppliers.find(
          (s) => String(s.SupplierID || s.SupplierReference) === String(selectedSupplierFilter),
        )
        const matchesName =
          supplierObj &&
          g.SupplierName &&
          g.SupplierName.toLowerCase() === supplierObj.SupplierName.toLowerCase()
        return Boolean(matchesId || matchesName)
      }
      return true
    })
  }, [gradesList, selectedSpeciesForGrade, selectedSupplierFilter, suppliers])

  const groupedGrades = useMemo<GroupedGradeRow[]>(() => {
    const map = new Map<string, GroupedGradeRow>()
    for (const g of filteredGrades) {
      const key = `${g.SpeciesName || ''}||${g.SupplierID || ''}||${g.GradeName}`
      const existing = map.get(key)
      if (existing) {
        existing.defs.push(g)
        if (g.Notes && !existing.notes.includes(g.Notes)) {
          existing.notes = existing.notes ? `${existing.notes}; ${g.Notes}` : g.Notes
        }
      } else {
        map.set(key, {
          key,
          gradeName: g.GradeName,
          supplierId: String(g.SupplierID || ''),
          supplierName: g.SupplierName || '',
          speciesName: g.SpeciesName || '',
          notes: g.Notes || '',
          defs: [g],
        })
      }
    }
    return Array.from(map.values())
  }, [filteredGrades])

  const activeGradeForDetails = useMemo(() => {
    if (selectedGradeForDetails) {
      const found = gradesList.find(
        (g) => String(g.GradeDefinitionID) === String(selectedGradeForDetails.GradeDefinitionID),
      )
      if (found) return found
    }
    return selectedGradeForDetails || null
  }, [selectedGradeForDetails, gradesList])

  // Reports data computed from procurements & grades
  const reportData = useMemo(() => {
    if (!workbookPath) {
      return {
        procurementsCount: 0,
        activeCount: 0,
        draftCount: 0,
        completedCount: 0,
        totalAgreed: 0,
        totalDelivered: 0,
        totalRemaining: 0,
        speciesBreakdown: {} as Record<string, { agreed: number; delivered: number }>,
        supplierBreakdown: {} as Record<string, { agreed: number; delivered: number; deals: number }>,
      }
    }

    try {
      const procurements = window.logPro.getProcurements(workbookPath)
      let activeCount = 0
      let draftCount = 0
      let completedCount = 0
      let totalAgreed = 0
      let totalDelivered = 0
      let totalRemaining = 0
      const speciesBreakdown: Record<string, { agreed: number; delivered: number }> = {}
      const supplierBreakdown: Record<string, { agreed: number; delivered: number; deals: number }> = {}

      for (const p of procurements) {
        if (p.Status === 'Active') activeCount++
        else if (p.Status === 'Draft' || p.Status === 'Waiting for Acceptance') draftCount++
        else if (p.Status === 'Completed') completedCount++

        const matchedSupplier = suppliers.find(
          (s) => String(s.SupplierID) === String(p.SupplierID) || String(s.SupplierReference) === String(p.SupplierID)
        )
        const sName = matchedSupplier?.SupplierName || `Supplier #${p.SupplierID}`
        if (!supplierBreakdown[sName]) {
          supplierBreakdown[sName] = { agreed: 0, delivered: 0, deals: 0 }
        }
        supplierBreakdown[sName].deals++

        const grades = window.logPro.getProcurementGrades(workbookPath, p.ProcurementRef)
        for (const g of grades) {
          const agreed = Number(g.AgreedTonnes) || 0
          const delivered = Number(g.DeliveredTonnes) || 0
          totalAgreed += agreed
          totalDelivered += delivered
          totalRemaining += Math.max(0, agreed - delivered)

          const spName = g.Species || p.Species || 'Radiata Pine'
          if (!speciesBreakdown[spName]) {
            speciesBreakdown[spName] = { agreed: 0, delivered: 0 }
          }
          speciesBreakdown[spName].agreed += agreed
          speciesBreakdown[spName].delivered += delivered

          supplierBreakdown[sName].agreed += agreed
          supplierBreakdown[sName].delivered += delivered
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
        speciesBreakdown,
        supplierBreakdown,
      }
    } catch {
      return {
        procurementsCount: 0,
        activeCount: 0,
        draftCount: 0,
        completedCount: 0,
        totalAgreed: 0,
        totalDelivered: 0,
        totalRemaining: 0,
        speciesBreakdown: {} as Record<string, { agreed: number; delivered: number }>,
        supplierBreakdown: {} as Record<string, { agreed: number; delivered: number; deals: number }>,
      }
    }
  }, [workbookPath, suppliers])

  const modalRef = useRef<HTMLElement | null>(null)
  const pressStartedOnBackdrop = useRef(false)

  // Remembers the size whenever you drag the corner to resize the box.
  useEffect(() => {
    if (!isOpen) return
    const box = modalRef.current
    if (!box || typeof ResizeObserver === 'undefined') return

    let timer: number | undefined
    let isFirstReport = true

    const observer = new ResizeObserver(() => {
      // The first report is just the box appearing, not you resizing it.
      if (isFirstReport) {
        isFirstReport = false
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        saveSize(box.offsetWidth, box.offsetHeight)
      }, 150)
    })

    observer.observe(box)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Species handlers
  async function handleAddSpecies(e: FormEvent) {
    e.preventDefault()
    if (!newSpeciesName.trim()) {
      setSpeciesError('Please enter a species name.')
      return
    }
    setSpeciesError('')
    setSpeciesSuccess('')
    setIsSubmittingSpecies(true)

    try {
      const res = await window.logPro.addSpecies(
        workbookPath,
        newSpeciesName,
        'User-added species',
      )

      if (res.error) {
        setSpeciesError(res.error)
      } else {
        setSpeciesSuccess(`Added species "${newSpeciesName}" with standard grades.`)
        setNewSpeciesName('')
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
        setIsAddSpeciesOpen(false)
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to add species.')
    } finally {
      setIsSubmittingSpecies(false)
    }
  }


  function handleStartEditSpecies(sp: SpeciesDefinition) {
    setEditingSpecies(sp)
    setEditSpeciesName(sp.SpeciesName)
    setEditSpeciesNotes(sp.Notes || '')
    setSpeciesError('')
    setSpeciesSuccess('')
  }

  function handleCancelEditSpecies() {
    setEditingSpecies(null)
  }

  async function handleSaveSpeciesEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingSpecies) return
    const cleanName = editSpeciesName.trim()
    if (!cleanName) {
      setSpeciesError('Species name is required.')
      return
    }

    setIsSavingSpecies(true)
    setSpeciesError('')
    try {
      const targetId = editingSpecies.SpeciesDefinitionID || editingSpecies.SpeciesName
      const res = await window.logPro.updateSpecies(workbookPath, targetId, {
        speciesName: cleanName,
        notes: editSpeciesNotes.trim(),
      })

      if (res.error) {
        setSpeciesError(res.error)
      } else {
        setSpeciesSuccess(`Species "${cleanName}" updated successfully.`)
        setEditingSpecies(null)
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to update species.')
    } finally {
      setIsSavingSpecies(false)
    }
  }

  function handleStartDeleteSpecies(sp: SpeciesDefinition) {
    setDeletingSpecies(sp)
    setSpeciesError('')
    setSpeciesSuccess('')
  }

  function handleCancelDeleteSpecies() {
    setDeletingSpecies(null)
  }

  async function handleConfirmDeleteSpecies() {
    if (!deletingSpecies) return
    setIsDeletingSpecies(true)
    setSpeciesError('')
    try {
      const targetId = deletingSpecies.SpeciesDefinitionID || deletingSpecies.SpeciesName
      const res = await window.logPro.deleteSpecies(workbookPath, targetId)

      if (res.error) {
        setSpeciesError(res.error)
      } else {
        setSpeciesSuccess(`Species "${deletingSpecies.SpeciesName}" deleted.`)
        setDeletingSpecies(null)
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to delete species.')
    } finally {
      setIsDeletingSpecies(false)
    }
  }

  // Grade handlers
  async function handleAddGradeRows(e: FormEvent) {
    e.preventDefault()
    const namesToAdd = addGradeRows.map((n) => n.trim()).filter((n) => n !== '')

    if (namesToAdd.length === 0) {
      setSpeciesError('Please enter at least one grade name.')
      return
    }

    setSpeciesError('')
    setSpeciesSuccess('')
    setIsSubmittingSpecies(true)

    try {
      const supplierObj = suppliers.find(
        (s) => String(s.SupplierID || s.SupplierReference) === String(addGradeSupplierId),
      )
      const supplierName = supplierObj ? supplierObj.SupplierName : ''

      let addedCount = 0
      let lastError = ''

      // If "Add to Both" is checked, add grades for both Green and Burnt
      const productTypesToAdd = addGradeToBoth ? ['Green', 'Burnt'] : [addGradeProductType]

      for (const gradeName of namesToAdd) {
        for (const productType of productTypesToAdd) {
          const productTypeMapped = productType === 'Green' ? 'Green Logs' : 'Burnt Logs'
          const res = await window.logPro.addGrade(
            workbookPath,
            addGradeSpeciesName,
            productTypeMapped,
            gradeName,
            'User-added grade',
            addGradeSupplierId,
            supplierName,
          )
          if (res.error) {
            lastError = res.error
          } else {
            addedCount++
          }
        }
      }

      if (addedCount > 0) {
        const typeText = addGradeToBoth ? 'Green and Burnt' : addGradeProductType
        setSpeciesSuccess(
          `Added ${addedCount} grade${addedCount === 1 ? '' : 's'} for ${typeText}${supplierName ? ` (linked to ${supplierName})` : ''}.`,
        )
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
        setAddGradeRows(['', '', '', '', ''])
        setAddGradeToBoth(false)
        setIsAddGradeOpen(false)
      }
      if (lastError) {
        setSpeciesError(lastError)
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to add grades.')
    } finally {
      setIsSubmittingSpecies(false)
    }
  }

  function handleStartEditGrade(g: GradeDefinition) {
    setEditingGrade(g)
    setEditGradeName(g.GradeName)
    setEditGradeSupplierId(String(g.SupplierID || ''))
    setEditGradeSpeciesName(g.SpeciesName || '')
    setEditGradeProductType((g.ProductType as any) || 'Green')
    setEditGradeNotes(g.Notes || '')
    setSpeciesError('')
    setSpeciesSuccess('')
  }

  function handleCancelEditGrade() {
    setEditingGrade(null)
  }

  async function handleSaveGradeEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingGrade || !editingGrade.GradeDefinitionID) return
    const cleanName = editGradeName.trim()
    if (!cleanName) {
      setSpeciesError('Grade name is required.')
      return
    }

    setIsSavingGrade(true)
    setSpeciesError('')

    try {
      const supplierObj = suppliers.find(
        (s) => String(s.SupplierID || s.SupplierReference) === String(editGradeSupplierId),
      )
      const supplierName = supplierObj ? supplierObj.SupplierName : ''

      const res = await window.logPro.updateGrade(workbookPath, editingGrade.GradeDefinitionID, {
        gradeName: cleanName,
        productType: editGradeProductType === 'Green' ? 'Green Logs' : 'Burnt Logs',
        speciesName: editGradeSpeciesName.trim(),
        supplierId: editGradeSupplierId,
        supplierName: supplierName,
        notes: editGradeNotes.trim(),
      })

      if (res.error) {
        setSpeciesError(res.error)
      } else {
        setSpeciesSuccess(`Grade "${cleanName}" updated successfully.`)
        if (
          selectedGradeForDetails &&
          String(selectedGradeForDetails.GradeDefinitionID) === String(editingGrade.GradeDefinitionID)
        ) {
          setSelectedGradeForDetails({
            ...editingGrade,
            GradeName: cleanName,
            ProductType: editGradeProductType,
            SpeciesName: editGradeSpeciesName.trim(),
            SupplierID: editGradeSupplierId,
            SupplierName: supplierName,
            Notes: editGradeNotes.trim(),
          })
        }
        setEditingGrade(null)
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to update grade.')
    } finally {
      setIsSavingGrade(false)
    }
  }

  function handleStartDeleteGrade(g: GradeDefinition) {
    setDeletingGrade(g)
    setSpeciesError('')
    setSpeciesSuccess('')
  }

  function handleCancelDeleteGrade() {
    setDeletingGrade(null)
  }

  async function handleConfirmDeleteGrade() {
    if (!deletingGrade || !deletingGrade.GradeDefinitionID) return
    setIsDeletingGrade(true)
    setSpeciesError('')
    try {
      const res = await window.logPro.deleteGrade(workbookPath, deletingGrade.GradeDefinitionID)

      if (res.error) {
        setSpeciesError(res.error)
      } else {
        setSpeciesSuccess(`Grade "${deletingGrade.GradeName}" deleted.`)
        if (
          selectedGradeForDetails &&
          String(selectedGradeForDetails.GradeDefinitionID) === String(deletingGrade.GradeDefinitionID)
        ) {
          setSelectedGradeForDetails(null)
        }
        setDeletingGrade(null)
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
      }
    } catch (err: any) {
      setSpeciesError(err?.message || 'Failed to delete grade.')
    } finally {
      setIsDeletingGrade(false)
    }
  }

  function toggleGradeSelectedForDelete(id: string) {
    setSelectedGradeIdsForBulkDelete((current) => {
      const updated = new Set(current)
      if (updated.has(id)) {
        updated.delete(id)
      } else {
        updated.add(id)
      }
      return updated
    })
  }

  async function handleConfirmBulkDeleteGrades() {
    if (selectedGradeIdsForBulkDelete.size === 0) return
    setIsBulkDeleting(true)
    setSpeciesError('')
    try {
      const ids = Array.from(selectedGradeIdsForBulkDelete)
      let lastError = ''
      let deletedCount = 0
      for (const id of ids) {
        const res = await window.logPro.deleteGrade(workbookPath, id)
        if (res.error) {
          lastError = res.error
        } else {
          deletedCount++
        }
      }
      if (deletedCount > 0) {
        setSpeciesSuccess(`Deleted ${deletedCount} grade${deletedCount === 1 ? '' : 's'}.`)
        setSelectedGradeIdsForBulkDelete(new Set())
        setSelectedGradeForDetails(null)
        setSpeciesGradesVersion((v) => v + 1)
        onRefresh()
      }
      if (lastError) {
        setSpeciesError(lastError)
      }
    } finally {
      setIsBulkDeleting(false)
      setIsBulkDeleteConfirmOpen(false)
    }
  }

  const savedSize = readSavedSize()

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        // Only close if the press and the release both happened on the dark background.
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) {
          onClose()
        }
      }}
    >
      <section
        ref={modalRef}
        className="modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `${savedSize.width}px`,
          height: `${savedSize.height}px`,
          minWidth: 'min(640px, 96vw)',
          minHeight: 'min(420px, 94vh)',
          maxWidth: '96vw',
          maxHeight: '94vh',
          padding: 0,
          overflow: 'hidden',
          resize: 'both',
        }}
      >
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <Settings size={22} className="settings-icon-primary" />
            <div>
              <h3>Settings & Tools</h3>
              <p>Configure grades, manage suppliers, view reports and export workbook data</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Delete Mode Toggle */}
            <label
              htmlFor="settings-delete-mode-toggle"
              className="delete-toggle-switch"
              title="Turn on to show delete buttons for grades, species and suppliers"
            >
              <Trash2 size={13} color={isDeleteEnabled ? '#dc2626' : '#64748b'} />
              <input
                id="settings-delete-mode-toggle"
                type="checkbox"
                checked={isDeleteEnabled}
                onChange={(e) => {
                  setIsDeleteEnabled(e.target.checked)
                  setSelectedGradeIdsForBulkDelete(new Set())
                }}
              />
              <span className="delete-toggle-slider" />
            </label>

            <button
              type="button"
              className="settings-modal-close-btn"
              onClick={onClose}
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="settings-tabs-bar">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'speciesGrades' ? 'active' : ''}`}
            onClick={() => setActiveTab('speciesGrades')}
          >
            <Trees size={15} />
            <span>Grades</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <Building size={15} />
            <span>Suppliers ({suppliers.length})</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={15} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'workbook' ? 'active' : ''}`}
            onClick={() => setActiveTab('workbook')}
          >
            <FileSpreadsheet size={15} />
            <span>Workbook & Export</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="settings-tab-content">
          {/* TAB 1: GRADES */}
          {activeTab === 'speciesGrades' && (
            <div className="settings-tab-pane">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 className="pane-title" style={{ margin: 0 }}>Grades ({gradesList.length})</h4>
                  <p className="pane-subtitle" style={{ margin: '2px 0 0' }}>{speciesList.length} species defined</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsAddSpeciesOpen((v) => !v)}
                    style={{ width: 'auto', padding: '7px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Plus size={14} /> Add Species
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsSpeciesListVisible((v) => !v)}
                    title="Edit existing species"
                    style={{ width: 'auto', padding: '7px 10px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              {isSpeciesListVisible && speciesList.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  {speciesList.map((sp) => (
                    <div
                      key={sp.SpeciesName}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 6px 4px 12px',
                        borderRadius: '20px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#334155',
                      }}
                    >
                      <Trees size={12} className="muted" />
                      <span>{sp.SpeciesName}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEditSpecies(sp)}
                        title={`Edit ${sp.SpeciesName}`}
                        style={{
                          width: 'auto',
                          padding: '2px',
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      {isDeleteEnabled && (
                        <button
                          type="button"
                          onClick={() => handleStartDeleteSpecies(sp)}
                          title={`Delete ${sp.SpeciesName}`}
                          style={{
                            width: 'auto',
                            padding: '2px',
                            background: 'transparent',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isAddSpeciesOpen && (
                <form
                  onSubmit={handleAddSpecies}
                  className="settings-inline-form"
                  style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '14px' }}
                >
                  <div style={{ flex: 1 }}>
                    <label htmlFor="new-species-name">Species Name *</label>
                    <input
                      id="new-species-name"
                      type="text"
                      placeholder="e.g. Douglas Fir, Blue Gum"
                      value={newSpeciesName}
                      onChange={(e) => setNewSpeciesName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="primary-button" disabled={isSubmittingSpecies} style={{ width: 'auto' }}>
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: 'auto' }}
                    onClick={() => {
                      setIsAddSpeciesOpen(false)
                      setNewSpeciesName('')
                    }}
                  >
                    Cancel
                  </button>
                </form>
              )}

              {isAddGradeOpen && (
                <form onSubmit={handleAddGradeRows} className="settings-inline-form" style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label htmlFor="add-grade-species">Species</label>
                      <select
                        id="add-grade-species"
                        value={addGradeSpeciesName}
                        onChange={(e) => setAddGradeSpeciesName(e.target.value)}
                      >
                        <option value="">All Species</option>
                        {speciesList.map((s) => (
                          <option key={s.SpeciesName} value={s.SpeciesName}>
                            {s.SpeciesName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-grade-product">Product Type</label>
                      <select
                        id="add-grade-product"
                        value={addGradeProductType}
                        onChange={(e) => setAddGradeProductType(e.target.value as 'Green' | 'Burnt')}
                        disabled={addGradeToBoth}
                      >
                        <option value="Green">Green</option>
                        <option value="Burnt">Burnt</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-grade-supplier">Supplier</label>
                      <select
                        id="add-grade-supplier"
                        value={addGradeSupplierId}
                        onChange={(e) => setAddGradeSupplierId(e.target.value)}
                      >
                        <option value="">All Suppliers (General)</option>
                        {suppliers.map((s) => (
                          <option
                            key={String(s.SupplierID || s.SupplierReference)}
                            value={String(s.SupplierID || s.SupplierReference)}
                          >
                            {s.SupplierName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '28px' }}>
                      <input
                        id="add-grade-both"
                        type="checkbox"
                        checked={addGradeToBoth}
                        onChange={(e) => setAddGradeToBoth(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label
                        htmlFor="add-grade-both"
                        style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}
                      >
                        Add to both Green and Burnt
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    {addGradeRows.map((rowValue, idx) => (
                      <input
                        key={idx}
                        type="text"
                        placeholder={`Grade name ${idx + 1}`}
                        value={rowValue}
                        onChange={(e) => {
                          const updated = [...addGradeRows]
                          updated[idx] = e.target.value
                          setAddGradeRows(updated)
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto' }}
                      onClick={() => setAddGradeRows((prev) => [...prev, ''])}
                    >
                      <Plus size={14} /> Add Another Row
                    </button>
                    <button type="submit" className="primary-button" disabled={isSubmittingSpecies} style={{ width: 'auto' }}>
                      <Save size={14} /> Save Grades
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: 'auto' }}
                      onClick={() => {
                        setIsAddGradeOpen(false)
                        setAddGradeRows(['', '', '', '', ''])
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {speciesError && <p className="notice notice-error">{speciesError}</p>}
              {speciesSuccess && <p className="notice notice-ok">{speciesSuccess}</p>}

              <div>
                  {/* Top Filter Bar */}
                  <div
                    className="grades-filter-bar"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
  const [selectedSpeciesForGrade, setSelectedSpeciesForGrade] = useState('Radiata Pine')

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trees size={14} className="muted" />
                      <select
                        value={selectedSpeciesForGrade}
                        onChange={(e) => {
                          setSelectedSpeciesForGrade(e.target.value)
                          setSelectedGradeForDetails(null)
                        }}
                        className="species-dropdown-filter"
                        aria-label="Filter grades by species"
                      >
                        <option value="">All Species</option>
                        {speciesList.map((s) => (
                          <option key={s.SpeciesName} value={s.SpeciesName}>
                            {s.SpeciesName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={14} className="muted" />
                      <select
                        value={selectedSupplierFilter}
                        onChange={(e) => {
                          setSelectedSupplierFilter(e.target.value)
                          setSelectedGradeForDetails(null)
                        }}
                        className="species-dropdown-filter"
                        style={{ minWidth: '180px' }}
                        aria-label="Filter grades by supplier"
                      >
                        <option value="">All Suppliers</option>
                        {suppliers.map((s) => (
                          <option
                            key={String(s.SupplierID || s.SupplierReference)}
                            value={String(s.SupplierID || s.SupplierReference)}
                          >
                            {s.SupplierName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Supplier & Grade Details Card (when supplier is selected or a grade is clicked) */}
                  {(selectedSupplierFilter || activeGradeForDetails) && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        marginBottom: '14px',
                      }}
                    >
                      {selectedSupplierFilter && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: activeGradeForDetails ? '12px' : '0',
                            borderBottom: activeGradeForDetails ? '1px solid #e2e8f0' : 'none',
                            paddingBottom: activeGradeForDetails ? '10px' : '0',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building size={16} className="text-primary" />
                            <div>
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                                {activeFilteredSupplier?.SupplierName || 'Supplier Grades'}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>
                                ({filteredGrades.length} {filteredGrades.length === 1 ? 'grade' : 'grades'} available)
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setAddGradeSupplierId(selectedSupplierFilter)
                              setIsAddGradeOpen(true)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            <Plus size={13} /> Add Grade for {activeFilteredSupplier ? activeFilteredSupplier.SupplierName.split(' ')[0] : 'Supplier'}
                          </button>
                        </div>
                      )}

                      {activeGradeForDetails ? (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <Tag size={15} className="text-primary" />
                              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                                {activeGradeForDetails.GradeName}
                              </strong>
                              <span
                                className={`badge-pill ${activeGradeForDetails.IsStandard ? 'badge-blue' : 'badge-amber'}`}
                              >
                                {activeGradeForDetails.IsStandard ? 'PDF Standard' : 'Custom Grade'}
                              </span>
                              <ProductTypeBadge productType={activeGradeForDetails.ProductType} />
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStartEditGrade(activeGradeForDetails)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 9px',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <Pencil size={12} /> Edit Grade
                              </button>
                              {isDeleteEnabled && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleStartDeleteGrade(activeGradeForDetails)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    fontSize: '0.78rem',
                                    color: '#dc2626',
                                    borderColor: '#fca5a5',
                                    background: '#fef2f2',
                                  }}
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: '10px',
                              fontSize: '0.83rem',
                              background: '#ffffff',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                                Supplier Source
                              </span>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {activeGradeForDetails.SupplierName || 'Universal / All Suppliers'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                                Target Species
                              </span>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {activeGradeForDetails.SpeciesName || 'All Species (Universal)'}
                              </span>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                                Specifications & Dimensions
                              </span>
                              <span style={{ color: '#334155' }}>
                                {activeGradeForDetails.Notes || 'No specific dimension or defect constraints recorded.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                          {filteredGrades.length > 0
                            ? 'Click a grade in the table below, or its pencil icon, to view or edit its details.'
                            : 'No grades currently registered specifically for this supplier. You can use the form below to register supplier-specific grades.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Grades Table */}
                  {isDeleteEnabled && selectedGradeIdsForBulkDelete.size > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 12px',
                        marginBottom: '10px',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b' }}>
                        {selectedGradeIdsForBulkDelete.size} grade{selectedGradeIdsForBulkDelete.size === 1 ? '' : 's'} selected
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedGradeIdsForBulkDelete(new Set())}
                          style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem' }}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsBulkDeleteConfirmOpen(true)}
                          style={{
                            width: 'auto',
                            padding: '5px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            background: '#dc2626',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <Trash2 size={13} /> Delete Selected
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="settings-table-wrapper">
                    <table className="settings-table" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        {isDeleteEnabled && <col style={{ width: '36px' }} />}
                        <col style={{ width: `${gradeColumnWidths.gradeName}px` }} />
                        <col style={{ width: `${gradeColumnWidths.supplier}px` }} />
                        <col style={{ width: `${gradeColumnWidths.productType}px` }} />
                        <col style={{ width: `${gradeColumnWidths.species}px` }} />
                        <col style={{ width: `${gradeColumnWidths.notes}px` }} />
                        <col style={{ width: isDeleteEnabled ? '100px' : '65px' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {isDeleteEnabled && <th></th>}
                          {(
                            [
                              ['gradeName', 'Grade Name'],
                              ['supplier', 'Supplier'],
                              ['productType', 'Product Type'],
                              ['species', 'Species'],
                              ['notes', 'Specs / Notes'],
                            ] as const
                          ).map(([key, label]) => (
                            <th key={key} style={{ position: 'relative' }}>
                              {label}
                              <span
                                onMouseDown={(e) => startColumnResize(key, e)}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: '6px',
                                  cursor: 'col-resize',
                                }}
                              />
                            </th>
                          ))}
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedGrades.length === 0 ? (
                          <tr>
                            <td colSpan={isDeleteEnabled ? 7 : 6} className="text-center muted">
                              No grades found for this filter.
                            </td>
                          </tr>
                        ) : (
                          groupedGrades.map((row) => {
                            const representative = row.defs[0]
                            const isSelected =
                              activeGradeForDetails &&
                              row.defs.some(
                                (d) =>
                                  String(d.GradeDefinitionID) ===
                                  String(activeGradeForDetails.GradeDefinitionID),
                              )
                            return (
                              <tr
                                key={row.key}
                                onClick={() => setSelectedGradeForDetails(representative)}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? '#eff6ff' : undefined,
                                }}
                                title="Click to view full grade details"
                              >
                                {isDeleteEnabled && (
                                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={row.defs.every((d) =>
                                        selectedGradeIdsForBulkDelete.has(String(d.GradeDefinitionID)),
                                      )}
                                      onChange={() =>
                                        row.defs.forEach((d) =>
                                          toggleGradeSelectedForDelete(String(d.GradeDefinitionID)),
                                        )
                                      }
                                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                                    />
                                  </td>
                                )}
                                <td className="font-semibold">
                                  <span className="cell-flex">
                                    <Tag size={13} className="text-primary" />
                                    {row.gradeName}
                                  </span>
                                </td>
                                <td>
                                  {row.supplierName ? (
                                    <span
                                      className="badge-pill badge-blue"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    >
                                      <Building size={11} /> {row.supplierName}
                                    </span>
                                  ) : (
                                    <span className="muted" style={{ fontSize: '0.8rem' }}>Universal</span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {row.defs.map((d) => (
                                      <span
                                        key={String(d.GradeDefinitionID)}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleStartEditGrade(d)
                                        }}
                                        title={`Edit ${row.gradeName} (${d.ProductType})`}
                                        style={{ cursor: 'pointer' }}
                                      >
                                        <ProductTypeBadge productType={d.ProductType} />
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="muted">{row.speciesName || 'All Species'}</td>
                                <td
                                  className="muted"
                                  style={{
                                    maxWidth: '180px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {row.notes || '—'}
                                </td>
                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => handleStartEditGrade(representative)}
                                      title={`Edit ${row.gradeName}`}
                                      style={{ padding: '3px 7px', fontSize: '0.78rem' }}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    {isDeleteEnabled && (
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => handleStartDeleteGrade(representative)}
                                        title={`Delete ${row.gradeName}`}
                                        style={{
                                          padding: '3px 7px',
                                          fontSize: '0.78rem',
                                          color: '#dc2626',
                                          borderColor: '#fca5a5',
                                          background: '#fef2f2',
                                        }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
          )}

          {/* TAB 2: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="settings-tab-pane">
              <div className="pane-header-actions">
                <div>
                  <h4 className="pane-title">Suppliers Register</h4>
                  <p className="pane-subtitle">Manage timber growers, forest managers and transport partners</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      onOpenAddSupplier()
                    }}
                  >
                    <Plus size={15} /> Add Supplier
                  </button>
                </div>
              </div>

              {supplierEditSuccess && (
                <div
                  className="success-message"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '0 0 12px',
                  }}
                >
                  <span>{supplierEditSuccess}</span>
                  <button
                    type="button"
                    onClick={() => setSupplierEditSuccess('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      padding: '2px',
                    }}
                    aria-label="Dismiss success notice"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {suppliers.length === 0 ? (
                <div className="empty-panel">
                  <Building size={32} className="muted" />
                  <h5>No suppliers registered</h5>
                  <p>Click Add Supplier to add your first plantation owner or timber supplier.</p>
                </div>
              ) : (
                <div className="settings-table-wrapper">
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>ID / Ref</th>
                        <th>Supplier Name</th>
                        <th>Contact Person</th>
                        <th>Address</th>
                        <th>ABN</th>
                        <th>Payment Terms</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th style={{ textAlign: 'center', width: isDeleteEnabled ? '145px' : '90px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => {
                        const sIdStr = String(s.SupplierID || '').trim()
                        const sRefStr = String(s.SupplierReference || '').trim()
                        const suppContacts = supplierContacts.filter((c) => {
                          const cSuppId = String(c.SupplierID).trim()
                          return (sIdStr && cSuppId === sIdStr) || (sRefStr && cSuppId === sRefStr)
                        })
                        const primaryContact = suppContacts.find((c) => c.IsPrimary) || suppContacts[0]
                        const displayPhone = s.Phone?.trim() || primaryContact?.PhoneNumber?.trim() || primaryContact?.MobileNumber?.trim() || '—'
                        const displayEmail = s.Email?.trim() || primaryContact?.Email?.trim() || '—'

                        return (
                          <tr key={String(s.SupplierID || s.SupplierReference)}>
                            <td className="font-bold text-primary">
                              {s.SupplierReference || s.SupplierID}
                            </td>
                            <td className="font-semibold">{s.SupplierName}</td>
                            <td>
                              {primaryContact ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 600 }}>{primaryContact.ContactName}</span>
                                  {primaryContact.IsPrimary && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        backgroundColor: '#ecfdf5',
                                        color: '#047857',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #a7f3d0',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Primary
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td className="muted">{s.Address || '—'}</td>
                            <td>{s.ABN || '—'}</td>
                            <td>{s.PaymentTerms || '—'}</td>
                            <td>{displayPhone}</td>
                            <td>{displayEmail}</td>
                            <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleStartEditSupplier(s)}
                                title={`Edit ${s.SupplierName}`}
                                aria-label={`Edit ${s.SupplierName}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}
                              >
                                <Pencil size={13} />
                                <span>Edit</span>
                              </button>
                              {isDeleteEnabled && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleStartDeleteSupplier(s)}
                                  title={`Delete ${s.SupplierName}`}
                                  aria-label={`Delete ${s.SupplierName}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: '#dc2626',
                                    borderColor: '#fca5a5',
                                    background: '#fef2f2',
                                  }}
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REPORTS */}
          {activeTab === 'reports' && (
            <div className="settings-tab-pane">
              <div className="reports-kpi-grid">
                <div className="kpi-box">
                  <span className="kpi-label">Total Procurements</span>
                  <strong className="kpi-value">{reportData.procurementsCount}</strong>
                  <span className="kpi-sub">{reportData.activeCount} Active • {reportData.draftCount} Draft • {reportData.completedCount} Completed</span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Agreed Tonnes</span>
                  <strong className="kpi-value">{reportData.totalAgreed.toLocaleString()} t</strong>
                  <span className="kpi-sub">Total contracted volume</span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Delivered Tonnes</span>
                  <strong className="kpi-value text-emerald">{reportData.totalDelivered.toLocaleString()} t</strong>
                  <span className="kpi-sub">
                    {reportData.totalAgreed > 0
                      ? Math.round((reportData.totalDelivered / reportData.totalAgreed) * 100)
                      : 0}% fulfillment rate
                  </span>
                </div>
                <div className="kpi-box">
                  <span className="kpi-label">Remaining to Deliver</span>
                  <strong className="kpi-value text-blue">{reportData.totalRemaining.toLocaleString()} t</strong>
                  <span className="kpi-sub">Outstanding balance</span>
                </div>
              </div>

              <div className="reports-section-title">
                <h5>Volume by Species</h5>
              </div>
              <div className="settings-table-wrapper" style={{ marginBottom: '20px' }}>
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Species</th>
                      <th>Agreed (Tonnes)</th>
                      <th>Delivered (Tonnes)</th>
                      <th>Remaining (Tonnes)</th>
                      <th>Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(reportData.speciesBreakdown).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center muted">No procurement deliveries recorded yet.</td>
                      </tr>
                    ) : (
                      Object.entries(reportData.speciesBreakdown).map(([sp, data]) => {
                        const pct = data.agreed > 0 ? Math.round((data.delivered / data.agreed) * 100) : 0
                        return (
                          <tr key={sp}>
                            <td className="font-semibold">{sp}</td>
                            <td>{data.agreed.toLocaleString()} t</td>
                            <td className="text-emerald font-semibold">{data.delivered.toLocaleString()} t</td>
                            <td className="text-blue font-semibold">{Math.max(0, data.agreed - data.delivered).toLocaleString()} t</td>
                            <td>
                              <span className={`badge-pill ${pct >= 100 ? 'badge-emerald' : 'badge-blue'}`}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="reports-section-title">
                <h5>Volume by Supplier</h5>
              </div>
              <div className="settings-table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Deals</th>
                      <th>Agreed Volume</th>
                      <th>Delivered Volume</th>
                      <th>Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(reportData.supplierBreakdown).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center muted">No supplier volume data available.</td>
                      </tr>
                    ) : (
                      Object.entries(reportData.supplierBreakdown).map(([supp, data]) => {
                        const pct = data.agreed > 0 ? Math.round((data.delivered / data.agreed) * 100) : 0
                        return (
                          <tr key={supp}>
                            <td className="font-semibold">{supp}</td>
                            <td>{data.deals}</td>
                            <td>{data.agreed.toLocaleString()} t</td>
                            <td className="text-emerald font-semibold">{data.delivered.toLocaleString()} t</td>
                            <td>
                              <span className={`badge-pill ${pct >= 100 ? 'badge-emerald' : 'badge-blue'}`}>
                                {pct}%
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: WORKBOOK & EXPORT */}
          {activeTab === 'workbook' && (
            <div className="settings-tab-pane">
              <div className="workbook-tools-grid">
                {/* Existing workbook card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-blue-light">
                    <FileSpreadsheet size={22} className="text-blue" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Use Existing Workbook</h5>

                    <p>
                      Select an existing LogPro Excel workbook from your computer.
                      The workbook must be an .xlsx file containing the required LogPro sheets.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleOpenExistingWorkbook}
                      disabled={isChangingWorkbook}
                      style={{
                        marginTop: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileSpreadsheet size={15} />
                      {isChangingWorkbook ? 'Opening…' : 'Open Existing Workbook'}
                    </button>
                  </div>
                </div>

                {/* New workbook card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-emerald-light">
                    <Plus size={22} className="text-emerald" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Create New Workbook</h5>

                    <p>
                      Create a new LogPro Excel workbook and choose its folder and filename.
                      LogPro will create all 11 required worksheets automatically.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleCreateNewWorkbook}
                      disabled={isChangingWorkbook}
                      style={{
                        marginTop: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={15} />
                      {isChangingWorkbook ? 'Creating…' : 'Create New Workbook'}
                    </button>
                  </div>
                </div>

                {/* Export card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-blue-light">
                    <Download size={22} className="text-blue" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Export Workbook (.xlsx)</h5>

                    <p>
                      Save a copy of the current LogPro workbook as an Excel .xlsx file.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => window.logPro.exportWorkbookFile(workbookPath)}
                      disabled={!workbookPath || isChangingWorkbook}
                      style={{
                        marginTop: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Download size={15} />
                      Download .xlsx Workbook
                    </button>
                  </div>
                </div>

                {/* Current workbook location card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-amber-light">
                    <MapPin size={22} className="text-amber" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Current Workbook Location</h5>

                    <p>
                      This is the Excel workbook currently used by LogPro.
                    </p>

                    <div className="location-box" style={{ marginTop: '12px' }}>
                      <code>
                        {workbookPath || 'No workbook selected'}
                      </code>

                      <button
                        type="button"
                        className="location-copy-btn"
                        onClick={() => {
                          if (workbookPath && navigator.clipboard) {
                            navigator.clipboard.writeText(workbookPath)
                            setHasCopiedLocation(true)
                            setTimeout(() => setHasCopiedLocation(false), 2000)
                          }
                        }}
                        disabled={!workbookPath}
                        title="Copy file path"
                      >
                        {hasCopiedLocation ? (
                          <Check size={14} color="#16a34a" />
                        ) : (
                          <Copy size={14} />
                        )}
                        <span>
                          {hasCopiedLocation ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Backup Everything card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-emerald-light">
                    <Archive size={22} className="text-emerald" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Backup Everything</h5>

                    <p>
                      Create a complete ZIP backup containing your active Excel workbook, the complete
                      Attachments folder, and all supplier files.
                    </p>

                    <button
                      type="button"
                      className="workbook-backup-action workbook-backup-action--backup"
                      onClick={handleBackupEverything}
                      disabled={!workbookPath || isBackingUp || isChangingWorkbook}
                      style={{ marginTop: '12px' }}
                    >
                      <Archive size={15} />
                      {isBackingUp ? 'Backing up…' : 'Backup (.zip)'}
                    </button>
                  </div>
                </div>

                {/* Restore Complete Backup card */}
                <div className="tool-card">
                  <div className="tool-card-icon bg-amber-light">
                    <RotateCcw size={22} className="text-amber" />
                  </div>

                  <div className="tool-card-body">
                    <h5>Restore Complete Backup</h5>

                    <p>
                      Restore a full ZIP backup. Replaces the current workbook and local Attachments folder.
                      An automatic safety backup will be created first.
                    </p>

                    <button
                      type="button"
                      className="workbook-backup-action workbook-backup-action--restore"
                      onClick={handlePromptRestore}
                      disabled={!workbookPath || isRestoring || isChangingWorkbook}
                      style={{ marginTop: '12px' }}
                    >
                      <RotateCcw size={15} />
                      {isRestoring ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                </div>
              </div>

              {workbookMessage && (
                <p
                  style={{
                    marginTop: '14px',
                    color: '#15803d',
                    fontWeight: 600,
                  }}
                >
                  {workbookMessage}
                </p>
              )}

              {workbookError && (
                <p
                  className="error-message"
                  style={{ marginTop: '14px' }}
                >
                  {workbookError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* EDIT SUPPLIER SUB-MODAL */}
        {editingSupplier && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSavingSupplier) {
                handleCancelEditSupplier()
              }
            }}
          >
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-supplier-modal-title"
              style={{ width: 'min(100%, 620px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3
                    id="edit-supplier-modal-title"
                    style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}
                  >
                    Edit Supplier
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>Reference:</span>
                    <span className="badge-pill badge-blue" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {editingSupplier.SupplierReference || editingSupplier.SupplierID}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditSupplier}
                  disabled={isSavingSupplier}
                  aria-label="Close edit form"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {supplierEditError && (
                <div className="error-message" style={{ marginBottom: '14px' }}>
                  {supplierEditError}
                </div>
              )}

              <form onSubmit={handleSaveSupplierEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="edit-supplier-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Supplier Name *
                    </label>
                    <input
                      id="edit-supplier-name"
                      type="text"
                      required
                      value={editSupplierForm.name}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, name: e.target.value })}
                      placeholder="e.g. Hancock Victorian Plantations"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-supplier-abn" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      ABN
                    </label>
                    <input
                      id="edit-supplier-abn"
                      type="text"
                      value={editSupplierForm.abn}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, abn: e.target.value })}
                      placeholder="e.g. 12 345 678 901"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="edit-supplier-address" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Physical / Depot Address
                    </label>
                    <input
                      id="edit-supplier-address"
                      type="text"
                      value={editSupplierForm.address}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, address: e.target.value })}
                      placeholder="e.g. 120 Plantation Rd, Traralgon VIC"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-supplier-payment-terms" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Payment Terms
                    </label>
                    <input
                      id="edit-supplier-payment-terms"
                      type="text"
                      value={editSupplierForm.paymentTerms}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, paymentTerms: e.target.value })}
                      placeholder="e.g. 14 Days EOM / 30 Days Net"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="edit-supplier-phone" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Phone
                    </label>
                    <input
                      id="edit-supplier-phone"
                      type="text"
                      value={editSupplierForm.phone}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, phone: e.target.value })}
                      placeholder="e.g. 03 5174 1234"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-supplier-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Email
                    </label>
                    <input
                      id="edit-supplier-email"
                      type="email"
                      value={editSupplierForm.email}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, email: e.target.value })}
                      placeholder="e.g. accounts@supplier.com.au"
                      disabled={isSavingSupplier}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-supplier-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Notes
                  </label>
                  <textarea
                    id="edit-supplier-notes"
                    rows={3}
                    value={editSupplierForm.notes}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, notes: e.target.value })}
                    placeholder="Log delivery instructions, FSC certification details, site access rules..."
                    disabled={isSavingSupplier}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '8px',
                    paddingTop: '14px',
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelEditSupplier}
                    disabled={isSavingSupplier}
                    style={{ padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSavingSupplier}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
                  >
                    <Save size={15} />
                    {isSavingSupplier ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* EDIT SPECIES SUB-MODAL */}
        {editingSpecies && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSavingSpecies) {
                handleCancelEditSpecies()
              }
            }}
          >
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-species-title"
              style={{ width: 'min(100%, 520px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3 id="edit-species-title" style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Edit Species
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Updating this species will cascade to all associated grade definitions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditSpecies}
                  disabled={isSavingSpecies}
                  aria-label="Close form"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSpeciesEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="edit-species-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Species Name *
                  </label>
                  <input
                    id="edit-species-name"
                    type="text"
                    required
                    value={editSpeciesName}
                    onChange={(e) => setEditSpeciesName(e.target.value)}
                    placeholder="e.g. Radiata Pine"
                    disabled={isSavingSpecies}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label htmlFor="edit-species-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Notes / Botanical Info
                  </label>
                  <input
                    id="edit-species-notes"
                    type="text"
                    value={editSpeciesNotes}
                    onChange={(e) => setEditSpeciesNotes(e.target.value)}
                    placeholder="e.g. Pinus radiata, softwood"
                    disabled={isSavingSpecies}
                    style={{ width: '100%' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '8px',
                    paddingTop: '14px',
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelEditSpecies}
                    disabled={isSavingSpecies}
                    style={{ padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSavingSpecies}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
                  >
                    <Save size={15} />
                    {isSavingSpecies ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* DELETE SPECIES CONFIRMATION SUB-MODAL */}
        {deletingSpecies && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeletingSpecies) {
                handleCancelDeleteSpecies()
              }
            }}
          >
            <section
              className="modal-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-species-title"
              style={{ width: 'min(100%, 480px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-species-title" style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700, color: '#991b1b' }}>
                Delete Species
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{deletingSpecies.SpeciesName}</strong>?
                This species definition will be removed from your workbook database.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelDeleteSpecies}
                  disabled={isDeletingSpecies}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleConfirmDeleteSpecies}
                  disabled={isDeletingSpecies}
                  style={{
                    padding: '8px 18px',
                    background: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={15} />
                  {isDeletingSpecies ? 'Deleting…' : 'Delete Species'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* EDIT GRADE SUB-MODAL */}
        {editingGrade && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSavingGrade) {
                handleCancelEditGrade()
              }
            }}
          >
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-grade-title"
              style={{ width: 'min(100%, 560px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <h3 id="edit-grade-title" style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Edit Grade Definition
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Update grade specifications, linked supplier, or target species.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditGrade}
                  disabled={isSavingGrade}
                  aria-label="Close form"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveGradeEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="edit-grade-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Grade Name *
                    </label>
                    <input
                      id="edit-grade-name"
                      type="text"
                      required
                      value={editGradeName}
                      onChange={(e) => setEditGradeName(e.target.value)}
                      placeholder="e.g. Export Grade A"
                      disabled={isSavingGrade}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-grade-prodtype" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Product Type
                    </label>
                    <select
                      id="edit-grade-prodtype"
                      value={editGradeProductType}
                      onChange={(e) => setEditGradeProductType(e.target.value as 'Green' | 'Burnt')}
                      disabled={isSavingGrade}
                      style={{ width: '100%' }}
                    >
                      {PRODUCT_TYPES.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label htmlFor="edit-grade-supplier" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Linked Supplier
                    </label>
                    <select
                      id="edit-grade-supplier"
                      value={editGradeSupplierId}
                      onChange={(e) => setEditGradeSupplierId(e.target.value)}
                      disabled={isSavingGrade}
                      style={{ width: '100%' }}
                    >
                      <option value="">All Suppliers (General/Universal)</option>
                      {suppliers.map((s) => (
                        <option
                          key={String(s.SupplierID || s.SupplierReference)}
                          value={String(s.SupplierID || s.SupplierReference)}
                        >
                          {s.SupplierName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-grade-species" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Target Species
                    </label>
                    <select
                      id="edit-grade-species"
                      value={editGradeSpeciesName}
                      onChange={(e) => setEditGradeSpeciesName(e.target.value)}
                      disabled={isSavingGrade}
                      style={{ width: '100%' }}
                    >
                      <option value="">All Species (Universal)</option>
                      {speciesList.map((s) => (
                        <option key={s.SpeciesName} value={s.SpeciesName}>
                          {s.SpeciesName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-grade-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Specifications / Dimension / Defect Notes
                  </label>
                  <textarea
                    id="edit-grade-notes"
                    rows={3}
                    value={editGradeNotes}
                    onChange={(e) => setEditGradeNotes(e.target.value)}
                    placeholder="e.g. SED 30cm+, Max knot 6cm, sweep < 15mm..."
                    disabled={isSavingGrade}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '8px',
                    paddingTop: '14px',
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelEditGrade}
                    disabled={isSavingGrade}
                    style={{ padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSavingGrade}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
                  >
                    <Save size={15} />
                    {isSavingGrade ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* DELETE GRADE CONFIRMATION SUB-MODAL */}
        {deletingGrade && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeletingGrade) {
                handleCancelDeleteGrade()
              }
            }}
          >
            <section
              className="modal-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-grade-title"
              style={{ width: 'min(100%, 480px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-grade-title" style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700, color: '#991b1b' }}>
                Delete Grade
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete grade <strong>{deletingGrade.GradeName}</strong> ({deletingGrade.ProductType})?
                This grade definition will be removed from your workbook database.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelDeleteGrade}
                  disabled={isDeletingGrade}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleConfirmDeleteGrade}
                  disabled={isDeletingGrade}
                  style={{
                    padding: '8px 18px',
                    background: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={15} />
                  {isDeletingGrade ? 'Deleting…' : 'Delete Grade'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* BULK DELETE GRADES CONFIRMATION SUB-MODAL */}
        {isBulkDeleteConfirmOpen && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isBulkDeleting) {
                setIsBulkDeleteConfirmOpen(false)
              }
            }}
          >
            <section
              className="modal-card"
              role="alertdialog"
              aria-modal="true"
              style={{ width: 'min(100%, 480px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700, color: '#991b1b' }}>
                Delete {selectedGradeIdsForBulkDelete.size} Grade{selectedGradeIdsForBulkDelete.size === 1 ? '' : 's'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete these {selectedGradeIdsForBulkDelete.size} grade definition{selectedGradeIdsForBulkDelete.size === 1 ? '' : 's'}?
                This cannot be undone.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  disabled={isBulkDeleting}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleConfirmBulkDeleteGrades}
                  disabled={isBulkDeleting}
                  style={{
                    padding: '8px 18px',
                    background: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={15} />
                  {isBulkDeleting ? 'Deleting…' : 'Delete Grades'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* DELETE SUPPLIER CONFIRMATION SUB-MODAL */}
        {deletingSupplier && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeletingSupplier) {
                handleCancelDeleteSupplier()
              }
            }}
          >
            <section
              className="modal-card"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-supplier-title"
              style={{ width: 'min(100%, 480px)', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-supplier-title" style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 700, color: '#991b1b' }}>
                Delete Supplier
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete supplier <strong>{deletingSupplier.SupplierName}</strong> (Ref: {deletingSupplier.SupplierReference || deletingSupplier.SupplierID})?
                This will remove the supplier from your workbook database register.
              </p>
              {supplierDeleteError && (
                <p className="notice notice-error" style={{ marginBottom: '14px' }}>
                  {supplierDeleteError}
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelDeleteSupplier}
                  disabled={isDeletingSupplier}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleConfirmDeleteSupplier}
                  disabled={isDeletingSupplier}
                  style={{
                    padding: '8px 18px',
                    background: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={15} />
                  {isDeletingSupplier ? 'Deleting…' : 'Delete Supplier'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* RESTORE CONFIRMATION MODAL */}
        {isRestoreConfirmOpen && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 1200 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isRestoring) {
                setIsRestoreConfirmOpen(false)
              }
            }}
          >
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              style={{ width: 'min(100%, 540px)', background: '#ffffff', padding: '24px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#b45309',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Confirm Complete Backup Restoration
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    This action will replace your active workbook and attachments.
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '0.86rem',
                  color: '#92400e',
                  lineHeight: 1.5,
                  marginBottom: '16px',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '6px' }}>
                  Please read carefully before proceeding:
                </strong>
                <ul style={{ margin: '0 0 8px 18px', padding: 0 }}>
                  <li>Your currently open workbook will be replaced by the restored version.</li>
                  <li>Local Attachments and supplier files will be synchronized to the backup state.</li>
                  <li>Any changes made after this backup was taken will be overwritten.</li>
                </ul>
                <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                  Automatic safety: An automatic safety ZIP snapshot of your existing workbook and Attachments will be saved before extraction.
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  color: '#475569',
                  marginBottom: '20px',
                }}
              >
                <strong>Warning:</strong> Never edit the same workbook simultaneously on two different computers.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsRestoreConfirmOpen(false)}
                  disabled={isRestoring}
                  style={{ width: 'auto', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  style={{
                    width: 'auto',
                    padding: '8px 18px',
                    background: '#dc2626',
                    borderColor: '#b91c1c',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  {isRestoring ? 'Restoring…' : 'Proceed with Restore'}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
