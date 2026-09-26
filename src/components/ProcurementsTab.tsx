import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import {
  FileSpreadsheet,
  Plus,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Table as TableIcon,
  Search,
  Building,
  Layers,
  Paperclip,
  Upload,
  ChevronLeft,
  ChevronRight,
  Info,
  Truck,
  MoreVertical,
} from 'lucide-react'
import {
  type Supplier,
  type SupplierContact,
  type Procurement,
  type ProcurementGrade,
  type SpeciesDefinition,
  type GradeDefinition,
  AGREEMENT_TYPES,
  PRODUCT_TYPES,
  STANDARD_GRADES,
} from '../types'
import { SettingsModal } from './SettingsModal'
import { AddContactModal } from './AddContactModal'
import { PriceRevisionModal, type DetectedPriceChange } from './PriceRevisionModal'
import { ProcurementDetailView } from './ProcurementDetailView'
import {
  openSpecInNewWindow,
  removeSpec,
} from '../specStorage'
import {
  checkAttachmentFile,
  saveAttachment,
  openAttachmentInNewWindow,
} from '../attachmentStorage'

type ProcurementsTabProps = {
  workbookPath: string
  suppliers: Supplier[]
  onDataChanged: () => void
  initialSupplierId?: string
  initialContactId?: string
  onClearInitialSelection?: () => void
}

type PanelMode = 'blank' | 'view' | 'edit' | 'new'

type SpecFields = {
  LogSpecFileID: string
  LogSpecFileName: string
  LogSpecFileType: string
}

type GradeRowState = {
  tempId: string
  ProcurementGradeID?: number | string
  Species: string
  ProductType: 'Green' | 'Burnt'
  GradeName: string
  OfferedPricePerTonne: string | number
  AgreedPricePerTonne: string | number
  AgreedTonnes: string | number
  DeliveredTonnes: string | number
  Notes?: string
}

let rowCounter = 0
function getNextRowTempId(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

export function ProcurementsTab({
  workbookPath,
  suppliers,
  onDataChanged,
  initialSupplierId,
  initialContactId,
  onClearInitialSelection,
}: ProcurementsTabProps) {
  // Master data
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [speciesList, setSpeciesList] = useState<SpeciesDefinition[]>([])
  const [gradesList, setGradesList] = useState<GradeDefinition[]>([])
  const [allContacts, setAllContacts] = useState<SupplierContact[]>([])

  // Left panel: blank, viewing, editing or adding new
  const [mode, setMode] = useState<PanelMode>('blank')
  const [isDirty, setIsDirty] = useState(false)

  // Register view state
  const [registerSearch, setRegisterSearch] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Selected procurement
  const [selectedProcRef, setSelectedProcRef] = useState<string | null>(null)

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isPriceRevisionModalOpen, setIsPriceRevisionModalOpen] = useState(false)
  const [detectedPriceChanges, setDetectedPriceChanges] = useState<DetectedPriceChange[]>([])
  const [pendingUpdatePayload, setPendingUpdatePayload] = useState<{
    payload: Partial<Procurement>
    grades: Partial<ProcurementGrade>[]
  } | null>(null)

  // Status alerts
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 3-dot menu (edit mode) & delete confirmation
  const [isProcMenuOpen, setIsProcMenuOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deletePromptPos, setDeletePromptPos] = useState({ top: '30%', left: '50%' })

  // Timeline note (Section 6)
  const [timelineNoteText, setTimelineNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteAddedMsg, setNoteAddedMsg] = useState('')

  async function handleAddTimelineNote() {
    if (!selectedProcRef || !timelineNoteText.trim()) return
    setIsSavingNote(true)
    setNoteAddedMsg('')
    try {
      const res = await window.logPro.addProcurementNote(
        workbookPath,
        selectedProcRef,
        timelineNoteText.trim(),
      )
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setTimelineNoteText('')
        setNoteAddedMsg('Note added to the timeline.')
      }
    } finally {
      setIsSavingNote(false)
    }
  }

  function openDeletePrompt() {
    setIsProcMenuOpen(false)
    setDeleteStep(1)
  }

  function confirmFirstDeletePrompt() {
    setDeletePromptPos({
      top: `${10 + Math.random() * 55}%`,
      left: `${10 + Math.random() * 55}%`,
    })
    setDeleteStep(2)
  }

  async function confirmSecondDeletePrompt() {
    setDeleteStep(0)
    if (selectedProcRef) {
      await handleDeleteProcurement(selectedProcRef)
    }
  }

  // Form State
  const [supplierId, setSupplierId] = useState('')
  const [contactId, setContactId] = useState('')
  const [agreementType, setAgreementType] = useState<string>('Coupe')
  const [agreementDetail, setAgreementDetail] = useState('')
  const [plantation, setPlantation] = useState('')
  const [species, setSpecies] = useState('')
  const [harvestPeriodStart, setHarvestPeriodStart] = useState('')
  const [harvestPeriodEnd, setHarvestPeriodEnd] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weeklyEstimatedTonnes, setWeeklyEstimatedTonnes] = useState<string>('')
  const [forceWeeklyForecast, setForceWeeklyForecast] = useState(false)
  const [acceptanceDate, setAcceptanceDate] = useState('')
  const [acceptanceTime, setAcceptanceTime] = useState('')
  const [acceptanceMethod, setAcceptanceMethod] = useState<string>('In Person')
  const [acceptedByPerson, setAcceptedByPerson] = useState('')
  const [acceptanceNotes, setAcceptanceNotes] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  // Log Specification (one file per procurement)
  const [specFileId, setSpecFileId] = useState('')
  const [specFileName, setSpecFileName] = useState('')
  const [specFileType, setSpecFileType] = useState('')
  const [pendingSpecFile, setPendingSpecFile] = useState<File | null>(null)
  const [specError, setSpecError] = useState('')

  // Grade Rows initialized with 1 clean row
  const [gradeRows, setGradeRows] = useState<GradeRowState[]>(() => [
    {
      tempId: getNextRowTempId(),
      Species: 'Radiata Pine',
      ProductType: 'Green',
      GradeName: 'K Grade',
      OfferedPricePerTonne: '',
      AgreedPricePerTonne: '',
      AgreedTonnes: '',
      DeliveredTonnes: '0',
    },
  ])

  const loadData = useCallback(() => {
    try {
      const p = window.logPro.getProcurements(workbookPath)
      const s = window.logPro.getSpecies(workbookPath)
      const g = window.logPro.getGrades(workbookPath)
      const c = window.logPro.getSupplierContacts(workbookPath)

      setProcurements(p)
      setSpeciesList(s)
      setGradesList(g)
      setAllContacts(c)

      if (s.length > 0 && !species) {
        setSpecies(s[0].SpeciesName)
      }
    } catch (e) {
      console.error('Error loading procurement data:', e)
    }
  }, [workbookPath, species])

  // Load master data on mount, workbook change & when suppliers update
  useEffect(() => {
    queueMicrotask(loadData)
  }, [loadData, suppliers])

  // Warn before closing/reloading the tab if there are unsaved changes
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if ((mode === 'new' || mode === 'edit') && isDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [mode, isDirty])

  // Handle preselected supplier / contact when navigated from Global Contacts tab
  useEffect(() => {
    if (initialSupplierId) {
      setMode('new')
      setSelectedProcRef(null)
      setSupplierId(initialSupplierId)
      if (initialContactId) {
        setContactId(initialContactId)
      } else {
        const contacts = allContacts.filter((c) => String(c.SupplierID).trim() === initialSupplierId.trim())
        const primary = contacts.find((c) => c.IsPrimary)
        setContactId(String(primary ? primary.ContactID : (contacts[0]?.ContactID || '')))
      }
      onClearInitialSelection?.()
    }
  }, [initialSupplierId, initialContactId, allContacts, onClearInitialSelection])

  // Current selected supplier object
  const currentSupplier = useMemo(() => {
    return (
      suppliers.find(
        (s) =>
          String(s.SupplierID) === String(supplierId) ||
          String(s.SupplierReference) === String(supplierId),
      ) || null
    )
  }, [suppliers, supplierId])

  // Filtered contacts for selected supplier (matches both SupplierID and SupplierReference)
  const supplierContacts = useMemo(() => {
    if (!supplierId) return []
    const sIdStr = String(supplierId).trim()
    const altIdStr = currentSupplier ? String(currentSupplier.SupplierID || '').trim() : ''
    const altRefStr = currentSupplier ? String(currentSupplier.SupplierReference || '').trim() : ''

    return allContacts.filter((c) => {
      const cSuppId = String(c.SupplierID).trim()
      return (
        cSuppId === sIdStr ||
        (altIdStr !== '' && cSuppId === altIdStr) ||
        (altRefStr !== '' && cSuppId === altRefStr)
      )
    })
  }, [allContacts, supplierId, currentSupplier])

  // Contacts from other suppliers (for picking existing contact across suppliers)
  const otherContacts = useMemo(() => {
    if (!supplierId) return allContacts
    const sIdStr = String(supplierId).trim()
    const altIdStr = currentSupplier ? String(currentSupplier.SupplierID || '').trim() : ''
    const altRefStr = currentSupplier ? String(currentSupplier.SupplierReference || '').trim() : ''

    return allContacts.filter((c) => {
      const cSuppId = String(c.SupplierID).trim()
      return (
        cSuppId !== sIdStr &&
        (!altIdStr || cSuppId !== altIdStr) &&
        (!altRefStr || cSuppId !== altRefStr)
      )
    })
  }, [allContacts, supplierId, currentSupplier])

  // Auto-select primary contact if supplier is selected and contactId is empty
  useEffect(() => {
    if (supplierId && supplierContacts.length > 0 && !contactId) {
      const primary = supplierContacts.find((c) => c.IsPrimary)
      setContactId(String(primary ? primary.ContactID : supplierContacts[0].ContactID))
    }
  }, [supplierId, supplierContacts, contactId])

  // Current selected contact object
  const currentContact = useMemo(() => {
    return (
      allContacts.find((c) => String(c.ContactID) === String(contactId)) || null
    )
  }, [allContacts, contactId])

  // The saved procurement that is being viewed or edited
  const selectedProcurement = useMemo(() => {
    if (!selectedProcRef) return null
    return procurements.find((p) => p.ProcurementRef === selectedProcRef) || null
  }, [procurements, selectedProcRef])

  // Saved grades of the procurement being viewed
  const viewGrades = useMemo(() => {
    if (!selectedProcRef) return []
    return window.logPro.getProcurementGrades(workbookPath, selectedProcRef)
    // procurements is listed so the grades refresh after a save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbookPath, selectedProcRef, procurements])

  // ---------------- Leaving a form safely ----------------

  function confirmLeaveForm(): boolean {
    if ((mode === 'new' || mode === 'edit') && isDirty) {
      return window.confirm(
        'You have unsaved changes. If you continue, they will be lost.\n\nDo you want to leave without saving?',
      )
    }
    return true
  }

  // ---------------- Grade rows ----------------

  function handleAddGradeRow() {
    const defaultProduct = 'Green'
    const available = getGradesFor(species || speciesList[0]?.SpeciesName, defaultProduct)
    const newRow: GradeRowState = {
      tempId: getNextRowTempId(),
      Species: species || speciesList[0]?.SpeciesName || 'Radiata Pine',
      ProductType: defaultProduct,
      GradeName: available[0] || 'K Grade',
      OfferedPricePerTonne: '',
      AgreedPricePerTonne: '',
      AgreedTonnes: '',
      DeliveredTonnes: '0',
    }
    setGradeRows((prev) => [...prev, newRow])
    setIsDirty(true)
  }

  function handleRemoveGradeRow(index: number) {
    if (gradeRows.length <= 1) {
      setErrorMsg('At least one grade row must remain.')
      return
    }
    setGradeRows((prev) => prev.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  function handleGradeRowChange(
    index: number,
    field: keyof GradeRowState,
    value: any,
  ) {
    setGradeRows((prev) => {
      const updated = [...prev]
      const target = { ...updated[index], [field]: value }

      // If product type changed, adjust default grade if not in list
      if (field === 'ProductType') {
        const available = getGradesFor(target.Species, value)
        if (!available.includes(target.GradeName)) {
          target.GradeName = available[0] || ''
        }
      }

      updated[index] = target
      return updated
    })
  }

  function getGradesFor(
    speciesName?: string,
    productType?: 'Green' | 'Burnt',
    customSupplierId?: string | number,
  ): string[] {
    const pt = productType || 'Green'
    const targetSuppId =
      customSupplierId !== undefined
        ? String(customSupplierId).trim()
        : supplierId
        ? String(supplierId).trim()
        : ''

    // Gather from database grade definitions:
    // Match product type AND
    // Match species (or definition is universal across species) AND
    // Match supplier (or definition is universal across all suppliers)
    const custom = gradesList
      .filter((g) => {
        if (g.ProductType !== pt) return false
        if (g.SpeciesName && speciesName && g.SpeciesName !== speciesName) return false
        if (g.SupplierID && targetSuppId && String(g.SupplierID).trim() !== targetSuppId) {
          return false
        }
        return true
      })
      .map((g) => g.GradeName)

    // Standard fallback
    const std = STANDARD_GRADES[pt] || []
    return Array.from(new Set([...custom, ...std]))
  }

  // Calculate row and overall totals
  const totals = useMemo(() => {
    let totalAgreedTonnes = 0
    let totalDeliveredTonnes = 0
    let totalRemainingTonnes = 0
    let estimatedTotalValue = 0

    for (const r of gradeRows) {
      const agreed = Number(r.AgreedTonnes) || 0
      const delivered = Number(r.DeliveredTonnes) || 0
      const remaining = Math.max(0, agreed - delivered)
      const agreedPrice = Number(r.AgreedPricePerTonne) || 0

      totalAgreedTonnes += agreed
      totalDeliveredTonnes += delivered
      totalRemainingTonnes += remaining
      estimatedTotalValue += agreed * agreedPrice
    }

    return {
      totalAgreedTonnes,
      totalDeliveredTonnes,
      totalRemainingTonnes,
      estimatedTotalValue,
    }
  }, [gradeRows])

  // ---------------- Log Specification ----------------

  function handleSpecFileChosen(fileList: FileList | null) {
    setSpecError('')
    const file = fileList?.[0]
    if (!file) return

    const problem = checkAttachmentFile(file)
    if (problem) {
      setSpecError(problem)
      return
    }

    setPendingSpecFile(file)
  }

  function handleRemoveSpec() {
    setSpecError('')
    if (pendingSpecFile) {
      // Only forget the newly chosen file; the saved one stays.
      setPendingSpecFile(null)
    } else {
      setSpecFileId('')
      setSpecFileName('')
      setSpecFileType('')
    }
    setIsDirty(true)
  }

  async function handleOpenSpec(specId: string) {
    if (!specId) return
    setErrorMsg('')
    if (specId.includes('/') || specId.includes('\\') || !specId.startsWith('spec-')) {
      const message = await openAttachmentInNewWindow(workbookPath, specId)
      if (message) {
        setErrorMsg(message)
      }
      return
    }
    const message = await openSpecInNewWindow(specId)
    if (message) {
      setErrorMsg(message)
    }
  }


  // ---------------- Panel actions ----------------

  // Clears every field on the form
  function resetFormFields() {
    setSelectedProcRef(null)
    setSupplierId('')
    setContactId('')
    setAgreementType('Coupe')
    setAgreementDetail('')
    setPlantation('')
    setSpecies(speciesList[0]?.SpeciesName || 'Radiata Pine')
    setHarvestPeriodStart('')
    setHarvestPeriodEnd('')
    setStartDate('')
    setEndDate('')
    setWeeklyEstimatedTonnes('')
    setForceWeeklyForecast(false)
    setAcceptanceDate('')
    setAcceptanceTime('')
    setAcceptanceMethod('In Person')
    setAcceptedByPerson('')
    setAcceptanceNotes('')
    setGeneralNotes('')
    setSpecFileId('')
    setSpecFileName('')
    setSpecFileType('')
    setPendingSpecFile(null)
    setSpecError('')
    setErrorMsg('')
    setSuccessMsg('')

    // Reset grades to 1 clean row
    const defaultProduct = 'Green'
    const available = getGradesFor(speciesList[0]?.SpeciesName, defaultProduct)
    setGradeRows([
      {
        tempId: getNextRowTempId(),
        Species: speciesList[0]?.SpeciesName || 'Radiata Pine',
        ProductType: defaultProduct,
        GradeName: available[0] || 'K Grade',
        OfferedPricePerTonne: '',
        AgreedPricePerTonne: '',
        AgreedTonnes: '',
        DeliveredTonnes: '0',
      },
    ])
  }

  // "+ Add New Procurement"
  function handleStartNew() {
    if (!confirmLeaveForm()) return
    resetFormFields()
    setMode('new')
    setIsDirty(false)
  }

  // Copies a saved procurement into the form fields
  function loadProcurementIntoForm(proc: Procurement) {
    setSelectedProcRef(proc.ProcurementRef)
    setErrorMsg('')
    setSuccessMsg('')

    setSupplierId(String(proc.SupplierID || ''))
    setContactId(String(proc.ContactID || ''))
    setAgreementType(proc.AgreementType || 'Coupe')
    setAgreementDetail(proc.AgreementDetail || '')
    setPlantation(proc.Plantation || '')
    setSpecies(proc.Species || '')
    setHarvestPeriodStart(proc.HarvestPeriodStart || '')
    setHarvestPeriodEnd(proc.HarvestPeriodEnd || '')
    setStartDate(proc.StartDate || '')
    setEndDate(proc.EndDate || '')
    setWeeklyEstimatedTonnes(
      proc.WeeklyEstimatedTonnes !== undefined && proc.WeeklyEstimatedTonnes !== ''
        ? String(proc.WeeklyEstimatedTonnes)
        : '',
    )
    setForceWeeklyForecast(Boolean(proc.ForceWeeklyForecast))
    setAcceptanceDate(proc.AcceptanceDate || '')
    setAcceptanceTime(proc.AcceptanceTime || '')
    setAcceptanceMethod(proc.AcceptanceMethod || 'In Person')
    setAcceptedByPerson(proc.AcceptedByPerson || '')
    setAcceptanceNotes(proc.AcceptanceNotes || '')
    setGeneralNotes(proc.Notes || '')

    setSpecFileId(proc.LogSpecFileID || '')
    setSpecFileName(proc.LogSpecFileName || '')
    setSpecFileType(proc.LogSpecFileType || '')
    setPendingSpecFile(null)
    setSpecError('')

    // Load procurement grades
    const grades = window.logPro.getProcurementGrades(
      workbookPath,
      proc.ProcurementRef,
    )

    if (grades.length > 0) {
      setGradeRows(
        grades.map((g) => ({
          tempId: getNextRowTempId(),
          ProcurementGradeID: g.ProcurementGradeID,
          Species: g.Species,
          ProductType: g.ProductType as 'Green' | 'Burnt',
          GradeName: g.GradeName,
          OfferedPricePerTonne: g.OfferedPricePerTonne,
          AgreedPricePerTonne: g.AgreedPricePerTonne,
          AgreedTonnes: g.AgreedTonnes,
          DeliveredTonnes: g.DeliveredTonnes,
          Notes: g.Notes,
        })),
      )
    } else {
      setGradeRows([
        {
          tempId: getNextRowTempId(),
          Species: proc.Species || 'Radiata Pine',
          ProductType: 'Green',
          GradeName: 'K Grade',
          OfferedPricePerTonne: '',
          AgreedPricePerTonne: '',
          AgreedTonnes: '',
          DeliveredTonnes: '0',
        },
      ])
    }
  }

  // Click on a procurement in the register: show it for viewing
  function handleSelectProcurement(proc: Procurement) {
    if (!confirmLeaveForm()) return
    loadProcurementIntoForm(proc)
    setMode('view')
    setIsDirty(false)
  }

  function handleEditSelected() {
    setErrorMsg('')
    setSuccessMsg('')
    setIsDirty(false)
    setMode('edit')
  }

  function handleCloseView() {
    resetFormFields()
    setMode('blank')
    setIsDirty(false)
  }

  async function handleDeleteProcurement(procurementRef: string) {
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await window.logPro.deleteProcurement(workbookPath, procurementRef)
      if (res.error) {
        setErrorMsg(res.error)
        return
      }
      resetFormFields()
      setMode('blank')
      setIsDirty(false)
      loadData()
      onDataChanged()
      setSuccessMsg(`Procurement ${procurementRef} was deleted.`)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not delete the procurement.')
    }
  }

  function handleCancelForm() {
    if (!confirmLeaveForm()) return

    if (mode === 'edit' && selectedProcurement) {
      // Go back to the saved version
      loadProcurementIntoForm(selectedProcurement)
      setMode('view')
    } else {
      resetFormFields()
      setMode('blank')
    }
    setIsDirty(false)
  }

  // Only the supplier is required. Every other field is optional, and grade
  // rows can be left blank or removed entirely. The one number rule kept:
  // tonnes typed into a row cannot be negative.
  function validateForm() {
    if (!supplierId) {
      throw new Error('Please select a supplier.')
    }

    const validatedGrades: Partial<ProcurementGrade>[] = []
    for (const [idx, row] of gradeRows.entries()) {
      const rowNum = idx + 1
      const offered = Number(row.OfferedPricePerTonne) || 0
      const agreedPrice = Number(row.AgreedPricePerTonne) || 0
      const agreedTonnes = Number(row.AgreedTonnes) || 0
      const deliveredTonnes = Number(row.DeliveredTonnes) || 0
      const gradeLabel = row.GradeName ? ` (${row.GradeName})` : ''

      if (agreedTonnes < 0) {
        throw new Error(`Row ${rowNum}${gradeLabel}: Agreed tonnes cannot be negative.`)
      }
      if (deliveredTonnes < 0) {
        throw new Error(`Row ${rowNum}${gradeLabel}: Delivered tonnes cannot be negative.`)
      }

      validatedGrades.push({
        ProcurementGradeID: row.ProcurementGradeID,
        Species: row.Species.trim(),
        ProductType: row.ProductType,
        GradeName: row.GradeName.trim(),
        OfferedPricePerTonne: offered,
        AgreedPricePerTonne: agreedPrice,
        AgreedTonnes: agreedTonnes,
        DeliveredTonnes: deliveredTonnes,
        RemainingTonnes: Math.max(0, agreedTonnes - deliveredTonnes),
      })
    }

    return validatedGrades
  }

  // Save new procurement (also used by "Save as New (Duplicate)")
async function handleSaveNew(e?: FormEvent) {
  e?.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const validatedGrades = validateForm()
      setIsSaving(true)

      // Enforce mutual date exclusivity
      const useAgreementDates = Boolean(startDate.trim() || endDate.trim())
      const finalHarvestStart = useAgreementDates ? '' : harvestPeriodStart.trim()
      const finalHarvestEnd = useAgreementDates ? '' : harvestPeriodEnd.trim()
      const finalAgreementStart = useAgreementDates ? startDate.trim() : ''
      const finalAgreementEnd = useAgreementDates ? endDate.trim() : ''

      const payload: Partial<Procurement> = {
        SupplierID: supplierId,
        ContactID: contactId,
        AgreementType: agreementType,
        AgreementDetail: agreementDetail.trim(),
        Plantation: plantation.trim(),
        Species: species.trim() || validatedGrades[0]?.Species || '',
        HarvestPeriodStart: finalHarvestStart,
        HarvestPeriodEnd: finalHarvestEnd,
        StartDate: finalAgreementStart,
        EndDate: finalAgreementEnd,
        WeeklyEstimatedTonnes:
          weeklyEstimatedTonnes.trim() !== '' ? Number(weeklyEstimatedTonnes) || 0 : '',
        Status: 'Active',
        AcceptanceDate: acceptanceDate.trim(),
        AcceptanceTime: acceptanceTime.trim(),
        AcceptanceMethod: acceptanceMethod,
        AcceptedByPerson: acceptedByPerson.trim(),
        AcceptanceNotes: acceptanceNotes.trim(),
        Notes: generalNotes.trim(),
        ForceWeeklyForecast: forceWeeklyForecast,
        LogSpecFileID: pendingSpecFile ? '' : specFileId,
        LogSpecFileName: pendingSpecFile ? '' : specFileName,
        LogSpecFileType: pendingSpecFile ? '' : specFileType,
      }

      // 1. Save the procurement to generate the ProcurementRef
      const res = await window.logPro.saveProcurement(
        workbookPath,
        payload,
        validatedGrades,
      )

      if (res.error) {
        setIsSaving(false)
        setErrorMsg(res.error)
        return
      }

      let savedProcurement = res.procurement

      // 2. If a physical attachment was selected, save it using the generated reference
      if (pendingSpecFile && savedProcurement?.ProcurementRef) {
        const supp = suppliers.find(
          (s) =>
            String(s.SupplierID) === String(supplierId) ||
            String(s.SupplierReference) === String(supplierId),
        )
        const supplierName = supp?.SupplierName || `Supplier_${supplierId}`
        const attachRes = await saveAttachment(
          workbookPath,
          supplierName,
          savedProcurement.ProcurementRef,
          pendingSpecFile,
        )

        if (attachRes.ok) {
          const updateRes = await window.logPro.updateProcurement(
            workbookPath,
            savedProcurement.ProcurementRef,
            {
              LogSpecFileID: attachRes.relativePath,
              LogSpecFileName: attachRes.fileName,
              LogSpecFileType: pendingSpecFile.type || 'application/octet-stream',
            },
            validatedGrades,
          )
          if (!updateRes.error && updateRes.procurement) {
            savedProcurement = updateRes.procurement
          }
        } else {
          setErrorMsg(
            `Procurement ${savedProcurement.ProcurementRef} was created, but attachment could not be saved: ${attachRes.error}`,
          )
        }
      }

      setIsSaving(false)
      loadData()
      onDataChanged()
      loadProcurementIntoForm(savedProcurement)
      if (!pendingSpecFile || (savedProcurement && savedProcurement.LogSpecFileID)) {
        setSuccessMsg(`Procurement ${savedProcurement.ProcurementRef} saved successfully!`)
      }
      setMode('view')
      setIsDirty(false)
    } catch (err: any) {
      setIsSaving(false)
      setErrorMsg(err?.message || String(err))
    }
  }

  // Update selected procurement
  async function handleUpdateSelected(e: FormEvent) {
    e.preventDefault()
    if (!selectedProcRef) {
      setErrorMsg('Please select a procurement from the register to update.')
      return
    }

    setErrorMsg('')
    setSuccessMsg('')

    try {
      const validatedGrades = validateForm()

      // Enforce mutual date exclusivity
      const useAgreementDates = Boolean(startDate.trim() || endDate.trim())
      const finalHarvestStart = useAgreementDates ? '' : harvestPeriodStart.trim()
      const finalHarvestEnd = useAgreementDates ? '' : harvestPeriodEnd.trim()
      const finalAgreementStart = useAgreementDates ? startDate.trim() : ''
      const finalAgreementEnd = useAgreementDates ? endDate.trim() : ''

      const payload: Partial<Procurement> = {
        SupplierID: supplierId,
        ContactID: contactId,
        AgreementType: agreementType,
        AgreementDetail: agreementDetail.trim(),
        Plantation: plantation.trim(),
        Species: species.trim() || validatedGrades[0]?.Species || '',
        HarvestPeriodStart: finalHarvestStart,
        HarvestPeriodEnd: finalHarvestEnd,
        StartDate: finalAgreementStart,
        EndDate: finalAgreementEnd,
        WeeklyEstimatedTonnes:
          weeklyEstimatedTonnes.trim() !== '' ? Number(weeklyEstimatedTonnes) || 0 : '',
        Status: 'Active',
        AcceptanceDate: acceptanceDate.trim(),
        AcceptanceTime: acceptanceTime.trim(),
        AcceptanceMethod: acceptanceMethod,
        AcceptedByPerson: acceptedByPerson.trim(),
        AcceptanceNotes: acceptanceNotes.trim(),
        Notes: generalNotes.trim(),
        ForceWeeklyForecast: forceWeeklyForecast,
      }

      // Check for price changes against current persisted grades
      const existingGrades = window.logPro.getProcurementGrades(workbookPath, selectedProcRef)
      const detectedChanges: DetectedPriceChange[] = []

      for (const newG of validatedGrades) {
        const oldG = existingGrades.find(
          (og) =>
            (og.ProcurementGradeID && og.ProcurementGradeID === newG.ProcurementGradeID) ||
            (og.GradeName.trim().toLowerCase() === String(newG.GradeName || '').trim().toLowerCase() &&
              og.ProductType === newG.ProductType),
        )
        if (
          oldG &&
          Number(oldG.AgreedPricePerTonne) > 0 &&
          Number(newG.AgreedPricePerTonne) > 0 &&
          Math.abs(Number(oldG.AgreedPricePerTonne) - Number(newG.AgreedPricePerTonne)) > 0.001
        ) {
          detectedChanges.push({
            gradeName: String(newG.GradeName || ''),
            productType: String(newG.ProductType || 'Green Logs'),
            oldPrice: Number(oldG.AgreedPricePerTonne),
            newPrice: Number(newG.AgreedPricePerTonne),
            diff: Number(newG.AgreedPricePerTonne) - Number(oldG.AgreedPricePerTonne),
          })
        }
      }

      if (detectedChanges.length > 0) {
        setDetectedPriceChanges(detectedChanges)
        setPendingUpdatePayload({ payload, grades: validatedGrades })
        setIsPriceRevisionModalOpen(true)
        return
      }

      await executeProcurementUpdate(payload, validatedGrades)
    } catch (err: any) {
      setIsSaving(false)
      setErrorMsg(err?.message || String(err))
    }
  }

  async function executeProcurementUpdate(
    payload: Partial<Procurement>,
    validatedGrades: Partial<ProcurementGrade>[],
    priceChangeReason?: string,
    priceChangeEffectiveDate?: string,
    priceChangeNotes?: string,
  ) {
    if (!selectedProcRef) return
    setIsSaving(true)
    setErrorMsg('')

    try {
      // Which spec file the procurement has right now (before this save)
      const previousSpecId =
        window.logPro
          .getProcurements(workbookPath)
          .find((p) => p.ProcurementRef === selectedProcRef)?.LogSpecFileID || ''

      let specFields: SpecFields

      if (pendingSpecFile) {
        const supp = suppliers.find(
          (s) =>
            String(s.SupplierID) === String(payload.SupplierID || supplierId) ||
            String(s.SupplierReference) === String(payload.SupplierID || supplierId),
        )
        const supplierName = supp?.SupplierName || `Supplier_${payload.SupplierID || supplierId}`
        const attachRes = await saveAttachment(
          workbookPath,
          supplierName,
          selectedProcRef,
          pendingSpecFile,
        )
        if (!attachRes.ok) {
          setIsSaving(false)
          setErrorMsg(`Failed to save attachment file: ${attachRes.error}`)
          return
        }
        specFields = {
          LogSpecFileID: attachRes.relativePath,
          LogSpecFileName: attachRes.fileName,
          LogSpecFileType: pendingSpecFile.type || 'application/octet-stream',
        }
      } else {
        specFields = {
          LogSpecFileID: specFileId,
          LogSpecFileName: specFileName,
          LogSpecFileType: specFileType,
        }
      }

      const fullPayload = {
        ...payload,
        ...specFields,
        priceChangeReason,
        priceChangeEffectiveDate,
        priceChangeNotes,
      }
      const res = await window.logPro.updateProcurement(
        workbookPath,
        selectedProcRef,
        fullPayload,
        validatedGrades,
      )
      setIsSaving(false)

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        // If an old browser IndexedDB spec was replaced or removed, clean it up
        if (previousSpecId && previousSpecId !== specFields.LogSpecFileID && previousSpecId.startsWith('spec-')) {
          await removeSpec(previousSpecId)
        }

        loadData()
        onDataChanged()
        loadProcurementIntoForm(res.procurement)
        setSuccessMsg(
          `Procurement ${selectedProcRef} updated successfully with ${res.grades.length} grade lines.`,
        )
        setMode('view')
        setIsDirty(false)
      }
    } catch (err: any) {
      setIsSaving(false)
      setErrorMsg(err?.message || String(err))
    }
  }

  async function handleConfirmPriceRevision(details: {
    reason: string
    effectiveDate: string
    notes: string
  }) {
    setIsPriceRevisionModalOpen(false)
    if (!pendingUpdatePayload) return

    await executeProcurementUpdate(
      pendingUpdatePayload.payload,
      pendingUpdatePayload.grades,
      details.reason,
      details.effectiveDate,
      details.notes,
    )
    setPendingUpdatePayload(null)
    setDetectedPriceChanges([])
  }

  // Filtered procurements for register table
  const filteredProcurements = useMemo(() => {
    return procurements.filter((p) => {
      // Search text
      if (!registerSearch.trim()) return true
      const q = registerSearch.toLowerCase()
      const supplierName =
        suppliers.find(
          (s) =>
            String(s.SupplierID) === String(p.SupplierID) ||
            String(s.SupplierReference) === String(p.SupplierID),
        )?.SupplierName || ''

      return (
        p.ProcurementRef.toLowerCase().includes(q) ||
        supplierName.toLowerCase().includes(q) ||
        p.Plantation.toLowerCase().includes(q) ||
        p.Species.toLowerCase().includes(q) ||
        p.AgreementDetail.toLowerCase().includes(q)
      )
    })
  }, [procurements, registerSearch, suppliers])

  // Tonnes summary for a procurement in register
  function getProcurementTonnes(ref: string) {
    const grades = window.logPro.getProcurementGrades(workbookPath, ref)
    const agreed = grades.reduce((sum, g) => sum + (Number(g.AgreedTonnes) || 0), 0)
    const delivered = grades.reduce((sum, g) => sum + (Number(g.DeliveredTonnes) || 0), 0)
    const remaining = Math.max(0, agreed - delivered)
    return { agreed, delivered, remaining }
  }

  const badgeLabel =
    mode === 'edit'
      ? `Editing ${selectedProcRef}`
      : mode === 'view'
      ? `Viewing ${selectedProcRef}`
      : mode === 'new'
      ? 'New Agreement'
      : ''

  return (
    <div className="page-content" style={{ maxWidth: '1440px', padding: '24px 20px' }}>
      {/* Header bar */}
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
            <FileSpreadsheet size={28} color="var(--primary)" />
            <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)' }}>
              Procurement Agreement & Grades
            </h2>
            {badgeLabel && (
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: mode === 'new' ? '#f1f5f9' : 'var(--primary-soft)',
                  color: mode === 'new' ? '#475569' : 'var(--primary-dark)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>
            Manage log contracts, plantation agreements, pricing per tonne, and delivery tracking.
          </p>
        </div>

      </div>

      {/* Alert notices */}
      {errorMsg && (
        <div
          className="error-message"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main split grid: Left Register Sidebar vs Right Workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSidebarCollapsed ? '48px minmax(0, 1fr)' : '340px minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
          transition: 'grid-template-columns 0.2s ease',
        }}
      >
        {/* ==================== LEFT: PROCUREMENT REGISTER ==================== */}
        {isSidebarCollapsed ? (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
              position: 'sticky',
              top: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Expand register"
              style={{
                background: 'var(--primary-soft)',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                color: 'var(--primary)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={18} />
            </button>
            <div
              onClick={() => setIsSidebarCollapsed(false)}
              title="Click to view register"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '0.72rem',
              }}
            >
              <TableIcon size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                {filteredProcurements.length}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
              position: 'sticky',
              top: '16px',
              maxHeight: 'calc(100vh - 32px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header: Title + count + Add + collapse button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TableIcon size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                  Register
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary-dark)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {filteredProcurements.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStartNew}
                  style={{
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--primary-dark)',
                    background: 'rgba(2, 132, 199, 0.12)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add
                </button>

                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Collapse register"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#64748b',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>

            {/* Register Search (Full Width) */}
            <div style={{ display: 'flex', marginBottom: '10px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search agreements, ref, supplier..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 8px 7px 28px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            {/* Procurements List */}
            {filteredProcurements.length === 0 ? (
              <div
                style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  border: '1px dashed var(--border)',
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  fontSize: '0.82rem',
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>No agreements found.</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.76rem' }}>
                  Try adjusting search or status.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '2px',
                }}
              >
                {filteredProcurements.map((proc) => {
                  const isSelected = selectedProcRef === proc.ProcurementRef
                  const tonnes = getProcurementTonnes(proc.ProcurementRef)
                  const suppName =
                    suppliers.find(
                      (s) =>
                        String(s.SupplierID) === String(proc.SupplierID) ||
                        String(s.SupplierReference) === String(proc.SupplierID),
                    )?.SupplierName || `Supplier #${proc.SupplierID}`

                  const harvestRange = proc.HarvestPeriodStart
                    ? `${proc.HarvestPeriodStart}${proc.HarvestPeriodEnd ? ` – ${proc.HarvestPeriodEnd}` : ''}`
                    : proc.StartDate
                    ? `${proc.StartDate}${proc.EndDate ? ` – ${proc.EndDate}` : ''}`
                    : ''

                  const volumeDisplay =
                    tonnes.agreed > 0
                      ? `${tonnes.agreed.toLocaleString(undefined, { maximumFractionDigits: 1 })} t`
                      : '0 t'

                  return (
                    <div
                      key={proc.ProcurementRef}
                      onClick={() => handleSelectProcurement(proc)}
                      style={{
                        border: isSelected
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border)',
                        background: isSelected ? 'var(--primary-soft)' : '#ffffff',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Line 1: Ref + Spec Icon + Volume */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong
                            style={{
                              fontSize: '0.92rem',
                              color: isSelected ? 'var(--primary-dark)' : 'var(--text)',
                            }}
                          >
                            {proc.ProcurementRef}
                          </strong>
                          {proc.LogSpecFileID && (
                            <span
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleOpenSpec(proc.LogSpecFileID || '')
                              }}
                              title={`Log Spec: ${proc.LogSpecFileName || 'attached'} (click to open)`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <Paperclip size={13} />
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                          {volumeDisplay}
                        </span>
                      </div>

                      {/* Line 2: Supplier Name */}
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: '#0f172a',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={suppName}
                      >
                        {suppName}
                      </div>

                      {/* Line 3: Procured Volume · Species · Harvest Date Range */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.76rem',
                          color: '#64748b',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>
                          {volumeDisplay}
                        </span>
                        <span aria-hidden="true" style={{ color: '#cbd5e1' }}>•</span>
                        <span
                          style={{
                            maxWidth: '110px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={proc.Species || 'No species'}
                        >
                          {proc.Species || '—'}
                        </span>
                        {harvestRange && (
                          <>
                            <span aria-hidden="true" style={{ color: '#cbd5e1' }}>•</span>
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`Harvest / Commitment: ${harvestRange}`}
                            >
                              {harvestRange}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== RIGHT: MAIN WORKSPACE (VIEW / EDIT / NEW) ==================== */}
        <div style={{ minWidth: 0, width: '100%' }}>
          {/* Blank: select prompt + add button */}
          {mode === 'blank' && (
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '48px 24px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
                minHeight: '360px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <FileSpreadsheet size={28} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: 'var(--text)' }}>
                No Procurement Selected
              </h3>
              <p
                style={{
                  margin: 0,
                  color: 'var(--muted)',
                  maxWidth: '460px',
                  fontSize: '0.94rem',
                  lineHeight: 1.6,
                }}
              >
                Select a procurement from the register on the left to view, or click <strong>+new</strong> on the left panel to add a new procurement.
              </p>
            </div>
          )}

        {/* Viewing a saved procurement (read-only) */}
        {mode === 'view' && selectedProcurement && (
          <ProcurementDetailView
            procurement={selectedProcurement}
            supplier={currentSupplier}
            contact={currentContact}
            grades={viewGrades}
            onEdit={handleEditSelected}
            onClose={handleCloseView}
            onOpenSpec={() => void handleOpenSpec(selectedProcurement.LogSpecFileID || '')}
            workbookPath={workbookPath}
          />
        )}

        {/* Adding or editing: the form */}
        {(mode === 'new' || mode === 'edit') && (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
            }}
          >
            <form
              id="procurement-form"
              onSubmit={mode === 'edit' ? handleUpdateSelected : handleSaveNew}
              onChange={() => setIsDirty(true)}
            >
              {mode === 'edit' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsProcMenuOpen((v) => !v)}
                      title="More options"
                      style={{
                        width: 'auto',
                        height: '34px',
                        padding: '0 10px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {isProcMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
                          zIndex: 20,
                          minWidth: '190px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsProcMenuOpen(false)
                            handleSaveNew()
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 14px',
                            background: 'transparent',
                            border: 'none',
                            color: '#334155',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={14} /> Save as New (Duplicate)
                        </button>
                        <button
                          type="button"
                          onClick={openDeletePrompt}
                          style={{
                            width: '100%',
                            padding: '8px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderTop: '1px solid #f1f5f9',
                            color: '#dc2626',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 1: Supplier & Agreement Info */}
              {(() => {
                const hasHarvestDates = Boolean(harvestPeriodStart.trim() || harvestPeriodEnd.trim())

                return (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '18px',
                      marginBottom: '18px',
                      background: '#fbfdff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building size={18} color="var(--primary)" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                          1. Supplier &amp; Agreement Info
                        </h3>
                      </div>
                      {supplierId ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setIsAddContactOpen(true)}
                          style={{
                            width: 'auto',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '0px',
                          }}
                          title={`Add contact for ${currentSupplier?.SupplierName || 'supplier'}`}
                        >
                          <Plus size={14} /> Add Contact
                        </button>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '14px',
                        marginBottom: '14px',
                      }}
                    >
                      {/* Supplier dropdown */}
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          Supplier *
                        </label>
                        <select
                          value={supplierId}
                          onChange={(e) => {
                            const newSuppId = e.target.value
                            setSupplierId(newSuppId)
                            if (newSuppId) {
                              const supp = suppliers.find(
                                (s) =>
                                  String(s.SupplierID) === newSuppId ||
                                  String(s.SupplierReference) === newSuppId,
                              )
                              const sIdStr = String(newSuppId).trim()
                              const altIdStr = supp ? String(supp.SupplierID || '').trim() : ''
                              const altRefStr = supp ? String(supp.SupplierReference || '').trim() : ''

                              const contacts = allContacts.filter((c) => {
                                const cSuppId = String(c.SupplierID).trim()
                                return (
                                  cSuppId === sIdStr ||
                                  (altIdStr !== '' && cSuppId === altIdStr) ||
                                  (altRefStr !== '' && cSuppId === altRefStr)
                                )
                              })
                              const primary = contacts.find((c) => c.IsPrimary)
                              setContactId(String(primary ? primary.ContactID : (contacts[0]?.ContactID || '')))
                            } else {
                              setContactId('')
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                          required
                        >
                          <option value="">-- Select Supplier --</option>
                          {suppliers.map((s) => {
                            const idVal = String(s.SupplierID || s.SupplierReference || '')
                            return (
                              <option key={idVal} value={idVal}>
                                {s.SupplierName} {s.SupplierReference ? `(${s.SupplierReference})` : ''}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      {/* Contact Person dropdown */}
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          Contact Person
                        </label>
                        <select
                          value={contactId}
                          onChange={(e) => {
                            const val = e.target.value
                            if (!val) {
                              setContactId('')
                              return
                            }
                            const selectedC = allContacts.find((c) => String(c.ContactID) === val)
                            if (selectedC) {
                              setContactId(String(selectedC.ContactID))
                              if (String(selectedC.SupplierID).trim() !== String(supplierId).trim()) {
                                setSupplierId(String(selectedC.SupplierID))
                              }
                            } else {
                              setContactId(val)
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                        >
                          {!supplierId ? (
                            <>
                              <option value="">-- Pick Contact --</option>
                              {allContacts.map((c) => {
                                const supp = suppliers.find(
                                  (s) =>
                                    String(s.SupplierID) === String(c.SupplierID) ||
                                    String(s.SupplierReference) === String(c.SupplierID),
                                )
                                return (
                                  <option key={String(c.ContactID)} value={String(c.ContactID)}>
                                    {c.ContactName} {c.Role ? `(${c.Role})` : ''} — {supp?.SupplierName || `Supplier #${c.SupplierID}`} {c.IsPrimary ? '★' : ''}
                                  </option>
                                )
                              })}
                            </>
                          ) : (
                            <>
                              <option value="">
                                {supplierContacts.length === 0
                                  ? '-- No contacts for supplier yet --'
                                  : '-- Select Contact --'}
                              </option>
                              {supplierContacts.length > 0 && (
                                <optgroup label={`${currentSupplier?.SupplierName || 'Supplier'} Contacts`}>
                                  {supplierContacts.map((c) => (
                                    <option key={String(c.ContactID)} value={String(c.ContactID)}>
                                      {c.ContactName} {c.Role ? `(${c.Role})` : ''} {c.IsPrimary ? '★ (Primary)' : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {otherContacts.length > 0 && (
                                <optgroup label="── Other Contacts ──">
                                  {otherContacts.map((c) => {
                                    const supp = suppliers.find(
                                      (s) =>
                                        String(s.SupplierID) === String(c.SupplierID) ||
                                        String(s.SupplierReference) === String(c.SupplierID),
                                    )
                                    return (
                                      <option key={String(c.ContactID)} value={String(c.ContactID)}>
                                        {c.ContactName} {c.Role ? `(${c.Role})` : ''} — {supp?.SupplierName || `Supplier #${c.SupplierID}`}
                                      </option>
                                    )
                                  })}
                                </optgroup>
                              )}
                            </>
                          )}
                        </select>
                      </div>

                      {/* Agreement Type */}
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          Agreement Type *
                        </label>
                        <select
                          value={agreementType}
                          onChange={(e) => setAgreementType(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                          required
                        >
                          {AGREEMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Agreement Detail */}
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          {agreementType} Detail / Code *
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter ${agreementType} identifier (e.g. Coupe 14A)`}
                          value={agreementDetail}
                          onChange={(e) => setAgreementDetail(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                        />
                      </div>
                    </div>

                    {/* Agreement Dates (Start / End) */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                        Agreement Date Range (Option A)
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: hasHarvestDates ? '#94a3b8' : 'inherit' }}>
                              Agreement Start Date
                            </label>
                            {startDate && (
                              <button
                                type="button"
                                onClick={() => setStartDate('')}
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={startDate}
                            disabled={hasHarvestDates}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: hasHarvestDates ? '#f1f5f9' : '#fff',
                              cursor: hasHarvestDates ? 'not-allowed' : 'auto',
                              color: hasHarvestDates ? '#94a3b8' : 'inherit',
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: hasHarvestDates ? '#94a3b8' : 'inherit' }}>
                              Agreement End Date
                            </label>
                            {endDate && (
                              <button
                                type="button"
                                onClick={() => setEndDate('')}
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={endDate}
                            disabled={hasHarvestDates}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: hasHarvestDates ? '#f1f5f9' : '#fff',
                              cursor: hasHarvestDates ? 'not-allowed' : 'auto',
                              color: hasHarvestDates ? '#94a3b8' : 'inherit',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Current Supplier Info strip */}
                    {currentSupplier && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '10px',
                          padding: '10px 12px',
                          background: '#f1f5f9',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          color: '#334155',
                          marginTop: '12px',
                        }}
                      >
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Supplier:</span>
                          <strong>{currentSupplier.SupplierName}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Address:</span>
                          <strong>{currentSupplier.Address || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>ABN:</span>
                          <strong>{currentSupplier.ABN || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Payment Terms:</span>
                          <strong>{currentSupplier.PaymentTerms || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Company Phone:</span>
                          <strong>{currentSupplier.Phone || currentContact?.PhoneNumber || currentContact?.MobileNumber || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Company Email:</span>
                          <strong>{currentSupplier.Email || currentContact?.Email || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Contact Person:</span>
                          <strong>
                            {currentContact ? (
                              <>
                                {currentContact.ContactName}
                                {currentContact.IsPrimary && (
                                  <span
                                    style={{
                                      marginLeft: '4px',
                                      fontSize: '0.72rem',
                                      color: '#047857',
                                      backgroundColor: '#dcfce7',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Primary
                                  </span>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </strong>
                        </div>
                        {currentContact && (
                          <>
                            <div>
                              <span style={{ color: '#64748b', display: 'block' }}>Contact Role:</span>
                              <strong>{currentContact.Role || '—'}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748b', display: 'block' }}>Contact Phone:</span>
                              <strong>{currentContact.PhoneNumber || currentContact.MobileNumber || '—'}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748b', display: 'block' }}>Contact Email:</span>
                              <strong>{currentContact.Email || '—'}</strong>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Weekly forecast override toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={forceWeeklyForecast}
                          onChange={(e) => setForceWeeklyForecast(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        {Boolean(startDate.trim() || endDate.trim() || harvestPeriodStart.trim() || harvestPeriodEnd.trim())
                          ? 'Ignore this date range — keep including in the weekly delivery forecast after it ends'
                          : 'Include in weekly delivery forecast even without a date range'}
                      </label>
                    </div>
                  </div>
                )
              })()}

              {/* Section 2: Plantation Name and Harvest Period */}
              {(() => {
                const hasAgreementDates = Boolean(startDate.trim() || endDate.trim())

                return (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '18px',
                      marginBottom: '18px',
                      background: '#fbfdff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Building size={18} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                        2. Plantation Name and Harvest Period
                      </h3>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '14px',
                        marginBottom: '14px',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          Plantation Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Green Triangle Estate, Pine Ridge"
                          value={plantation}
                          onChange={(e) => setPlantation(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                          Species
                        </label>
                        <select
                          value={species}
                          onChange={(e) => setSpecies(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: '#fff',
                          }}
                        >
                          <option value="">-- Select Species --</option>
                          {speciesList.map((sp) => (
                            <option key={sp.SpeciesDefinitionID || sp.SpeciesName} value={sp.SpeciesName}>
                              {sp.SpeciesName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Harvest Period Dates */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                        Harvest Period Range (Option B)
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: hasAgreementDates ? '#94a3b8' : 'inherit' }}>
                              Harvest Period Start
                            </label>
                            {harvestPeriodStart && (
                              <button
                                type="button"
                                onClick={() => setHarvestPeriodStart('')}
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={harvestPeriodStart}
                            disabled={hasAgreementDates}
                            onChange={(e) => setHarvestPeriodStart(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: hasAgreementDates ? '#f1f5f9' : '#fff',
                              cursor: hasAgreementDates ? 'not-allowed' : 'auto',
                              color: hasAgreementDates ? '#94a3b8' : 'inherit',
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: hasAgreementDates ? '#94a3b8' : 'inherit' }}>
                              Harvest Period End
                            </label>
                            {harvestPeriodEnd && (
                              <button
                                type="button"
                                onClick={() => setHarvestPeriodEnd('')}
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={harvestPeriodEnd}
                            disabled={hasAgreementDates}
                            onChange={(e) => setHarvestPeriodEnd(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: hasAgreementDates ? '#f1f5f9' : '#fff',
                              cursor: hasAgreementDates ? 'not-allowed' : 'auto',
                              color: hasAgreementDates ? '#94a3b8' : 'inherit',
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: '10px',
                          padding: '6px 10px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          color: '#1e40af',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Info size={15} style={{ flexShrink: 0, color: '#2563eb' }} />
                        <span>
                          <strong>Date Range Rule:</strong> Enter <em>either</em> Agreement Dates <em>or</em> Harvest Period. When one is entered, the other is disabled so the Home tab can schedule and tally your weekly delivery volume accurately.
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Section 3: Haulage Commitment */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '18px',
                  marginBottom: '18px',
                  background: '#fbfdff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Truck size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                    3. Haulage Commitment
                  </h3>
                </div>

                <div style={{ maxWidth: '340px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', marginBottom: '4px' }}>
                    Weekly Estimated Delivery (tonnes)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 250"
                      value={weeklyEstimatedTonnes}
                      onChange={(e) => setWeeklyEstimatedTonnes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 50px 8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                        fontWeight: 700,
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        pointerEvents: 'none',
                      }}
                    >
                      t / wk
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '6px' }}>
                    Committed weekly tonnage delivery. Feeds the Weekly Delivery Schedule and Haulage Planner on the Home tab.
                  </div>
                </div>
              </div>

              {/* Section 4: Grades, Products, Prices & Tonnes (Interactive Table) */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px',
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                      4. Grades, Products, Prices &amp; Tonnes
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAddGradeRow}
                      style={{
                        width: 'auto',
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Plus size={14} /> Add Grade Row
                    </button>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.84rem' }}>
                  Add one row for each grade/product combination. Standard grades come from the reference PDF;
                  delivered and remaining tonnes calculate dynamically.
                </p>

                {/* Table */}
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '130px' }}>Species</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '110px' }}>Product</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '130px' }}>Grade</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: '95px' }}>Offered $/t</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: '100px' }}>Agreed $/t *</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: '100px' }}>Agreed t *</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: '100px' }}>Delivered t</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: '105px' }}>Remaining t</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '45px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeRows.map((row, idx) => {
                        const agreed = Number(row.AgreedTonnes) || 0
                        const delivered = Number(row.DeliveredTonnes) || 0
                        const remaining = Math.max(0, agreed - delivered)
                        const availableGrades = getGradesFor(row.Species, row.ProductType)

                        return (
                          <tr key={row.tempId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={row.Species}
                                onChange={(e) => handleGradeRowChange(idx, 'Species', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                }}
                              >
                                {speciesList.map((s) => (
                                  <option key={s.SpeciesName} value={s.SpeciesName}>
                                    {s.SpeciesName}
                                  </option>
                                ))}
                                {!speciesList.some((s) => s.SpeciesName === row.Species) && (
                                  <option value={row.Species}>{row.Species}</option>
                                )}
                              </select>
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={row.ProductType}
                                onChange={(e) =>
                                  handleGradeRowChange(
                                    idx,
                                    'ProductType',
                                    e.target.value as 'Green' | 'Burnt',
                                  )
                                }
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                }}
                              >
                                {PRODUCT_TYPES.map((pt) => (
                                  <option key={pt} value={pt}>
                                    {pt}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={row.GradeName}
                                onChange={(e) => handleGradeRowChange(idx, 'GradeName', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                }}
                              >
                                {availableGrades.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                                {!availableGrades.includes(row.GradeName) && row.GradeName && (
                                  <option value={row.GradeName}>{row.GradeName}</option>
                                )}
                              </select>
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={row.OfferedPricePerTonne}
                                onChange={(e) =>
                                  handleGradeRowChange(idx, 'OfferedPricePerTonne', e.target.value)
                                }
                                style={{
                                  width: '100%',
                                  textAlign: 'right',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                }}
                              />
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={row.AgreedPricePerTonne}
                                onChange={(e) =>
                                  handleGradeRowChange(idx, 'AgreedPricePerTonne', e.target.value)
                                }
                                style={{
                                  width: '100%',
                                  textAlign: 'right',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                }}
                              />
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={row.AgreedTonnes}
                                onChange={(e) =>
                                  handleGradeRowChange(idx, 'AgreedTonnes', e.target.value)
                                }
                                style={{
                                  width: '100%',
                                  textAlign: 'right',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                }}
                              />
                            </td>

                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={row.DeliveredTonnes}
                                onChange={(e) =>
                                  handleGradeRowChange(idx, 'DeliveredTonnes', e.target.value)
                                }
                                style={{
                                  width: '100%',
                                  textAlign: 'right',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                }}
                              />
                            </td>

                            <td
                              style={{
                                padding: '6px 12px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: remaining > 0 ? '#0369a1' : '#16a34a',
                              }}
                            >
                              {remaining.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveGradeRow(idx)}
                                style={{
                                  width: 'auto',
                                  padding: '4px',
                                  background: 'transparent',
                                  borderColor: 'transparent',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                }}
                                title="Delete row"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right' }}>
                          Agreement Totals:
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>
                          {totals.totalAgreedTonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#16a34a' }}>
                          {totals.totalDeliveredTonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                          {totals.totalRemainingTonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                        </td>
                        <td></td>
                      </tr>
                      <tr style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                        <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', color: '#166534', fontWeight: 600 }}>
                          Estimated Contract Commitment (AUD):
                        </td>
                        <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'left', color: '#15803d', fontWeight: 800 }}>
                          ${totals.estimatedTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AUD
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Section 6: Log Specification */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px',
                  background: '#fbfdff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Paperclip size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                    5. Log Specification File (Optional)
                  </h3>
                </div>

                <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.84rem' }}>
                  Attach one file (PDF or image, up to 10 MB) showing the log specification for this
                  procurement. A PDF can have several pages.
                </p>

                {specError && (
                  <div
                    className="error-message"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
                  >
                    <AlertCircle size={16} />
                    <span>{specError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {pendingSpecFile ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                      }}
                    >
                      <Paperclip size={15} color="#0284c7" /> {pendingSpecFile.name}
                      <span style={{ fontWeight: 400, color: '#92400e' }}>
                        (will be saved when you save)
                      </span>
                    </span>
                  ) : specFileId ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                      }}
                    >
                      <Paperclip size={15} color="#0284c7" /> {specFileName || 'Log specification'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No file attached.</span>
                  )}

                  {!pendingSpecFile && specFileId && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleOpenSpec(specFileId)}
                      style={{ width: 'auto', padding: '5px 12px', fontSize: '0.8rem', borderRadius: '0px' }}
                    >
                      View
                    </button>
                  )}

                  {(pendingSpecFile || specFileId) && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleRemoveSpec}
                      style={{
                        width: 'auto',
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '0px',
                      }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}

                  <label
                    className="secondary-button"
                    style={{
                      width: 'auto',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      borderRadius: '0px',
                    }}
                  >
                    <Upload size={14} />
                    {pendingSpecFile || specFileId ? 'Replace File' : 'Choose File'}
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      hidden
                      onChange={(event) => {
                        handleSpecFileChosen(event.target.files)
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Section 6: General Notes */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  background: '#fbfdff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <FileSpreadsheet size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                    6. General Notes
                  </h3>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    General Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any general comments, delivery notes, or road permits"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                {mode === 'edit' && selectedProcRef && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed var(--border)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Add a Timeline Note
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <textarea
                        rows={2}
                        placeholder="e.g. Called supplier to confirm harvest delay"
                        value={timelineNoteText}
                        onChange={(e) => setTimelineNoteText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#fff',
                          fontSize: '0.85rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddTimelineNote()}
                        disabled={isSavingNote || !timelineNoteText.trim()}
                        style={{
                          width: 'auto',
                          padding: '8px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          cursor: isSavingNote ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isSavingNote ? 'Adding...' : 'Add Note'}
                      </button>
                    </div>
                    {noteAddedMsg && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#15803d' }}>{noteAddedMsg}</p>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--muted)' }}>
                      Separate from General Notes above — this appears on the Timeline right away.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar - Right Aligned */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={handleCancelForm}
                  style={{
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={15} /> Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: mode === 'edit' ? (isDirty ? '#15803d' : '#475569') : '#ffffff',
                    background: mode === 'edit' ? (isDirty ? '#dcfce7' : '#f1f5f9') : '#475569',
                    border: mode === 'edit' ? (isDirty ? '1.5px solid #22c55e' : '1px solid #cbd5e1') : '1px solid #334155',
                    borderRadius: '0px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        workbookPath={workbookPath}
        suppliers={suppliers}
        onOpenAddSupplier={() => {}}
        onRefresh={loadData}
      />

      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        workbookPath={workbookPath}
        supplier={currentSupplier}
        suppliers={suppliers}
        onContactSaved={(newId, newSuppId) => {
          loadData()
          if (newSuppId) setSupplierId(String(newSuppId))
          setContactId(String(newId))
          onDataChanged?.()
        }}
        onContactAdded={(newId) => {
          loadData()
          setContactId(String(newId))
          onDataChanged?.()
        }}
      />

      {deleteStep === 1 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 'min(90%, 440px)', padding: '22px 24px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', boxShadow: '0 20px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#991b1b' }}>Delete this procurement?</h3>
            <p style={{ margin: '0 0 18px', color: '#7f1d1d', fontSize: '0.92rem', lineHeight: 1.5 }}>
              This will delete procurement <strong>{selectedProcRef}</strong>
              {currentSupplier?.SupplierName ? ` (${currentSupplier.SupplierName})` : ''} from the workbook.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="secondary-button" onClick={() => setDeleteStep(0)} style={{ width: 'auto', padding: '8px 16px' }}>
                Cancel
              </button>
              <button type="button" onClick={confirmFirstDeletePrompt} style={{ width: 'auto', padding: '8px 18px', background: '#dc2626', border: 'none', color: '#ffffff', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStep === 2 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100 }}>
          <div
            style={{
              position: 'absolute',
              top: deletePromptPos.top,
              left: deletePromptPos.left,
              transform: 'translate(-50%, -50%)',
              width: 'min(90%, 440px)',
              padding: '22px 24px',
              borderRadius: '12px',
              background: '#fecaca',
              border: '2px solid #b91c1c',
              boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
            }}
          >
            <h3 className="flash-warning" style={{ margin: '0 0 10px', color: '#7f1d1d' }}>
              ⚠ This cannot be undone
            </h3>
            <p style={{ margin: '0 0 18px', color: '#7f1d1d', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Deleting <strong>{selectedProcRef}</strong> permanently removes it and its price history from
              the workbook. There is no way to recover it afterwards.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="secondary-button" onClick={() => setDeleteStep(0)} style={{ width: 'auto', padding: '8px 16px' }}>
                Cancel
              </button>
              <button type="button" onClick={() => void confirmSecondDeletePrompt()} style={{ width: 'auto', padding: '8px 18px', background: '#7f1d1d', border: 'none', color: '#ffffff', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}>
                Yes, delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <PriceRevisionModal
        isOpen={isPriceRevisionModalOpen}
        onClose={() => {
          setIsPriceRevisionModalOpen(false)
          setPendingUpdatePayload(null)
          setDetectedPriceChanges([])
        }}
        onConfirm={handleConfirmPriceRevision}
        procurementRef={selectedProcRef || ''}
        supplierName={currentSupplier?.SupplierName || ''}
        changes={detectedPriceChanges}
      />
    </div>
  )
}