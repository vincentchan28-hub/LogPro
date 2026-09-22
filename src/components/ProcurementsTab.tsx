import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import {
  FileSpreadsheet,
  Plus,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
  Trash2,
  Table as TableIcon,
  Search,
  Download,
  Building,
  UserCheck,
  Calendar,
  Layers,
  FileCheck,
  Paperclip,
  Upload,
} from 'lucide-react'
import {
  type Supplier,
  type SupplierContact,
  type Procurement,
  type ProcurementGrade,
  type SpeciesDefinition,
  type GradeDefinition,
  AGREEMENT_TYPES,
  STATUSES,
  ACCEPTANCE_METHODS,
  PRODUCT_TYPES,
  STANDARD_GRADES,
} from '../types'
import { GradeSettingsModal } from './GradeSettingsModal'
import { AddContactModal } from './AddContactModal'
import { PriceRevisionModal, type DetectedPriceChange } from './PriceRevisionModal'
import { ProcurementDetailView } from './ProcurementDetailView'
import {
  checkSpecFile,
  fileToSpec,
  loadSpec,
  makeSpecId,
  openSpecInNewWindow,
  removeSpec,
  saveSpec,
} from '../specStorage'

type ProcurementsTabProps = {
  workbookPath: string
  suppliers: Supplier[]
  onDataChanged: () => void
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
  ProductType: 'Fresh Logs' | 'Burnt Logs'
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
  const [statusFilter, setStatusFilter] = useState<string>('All')

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
  const [status, setStatus] = useState<string>('Draft')
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
      ProductType: 'Fresh Logs',
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

  // Load master data on mount & workbook change
  useEffect(() => {
    queueMicrotask(loadData)
  }, [loadData])

  // Filtered contacts for selected supplier
  const supplierContacts = useMemo(() => {
    if (!supplierId) return []
    const sIdStr = String(supplierId).trim()
    return allContacts.filter((c) => String(c.SupplierID).trim() === sIdStr)
  }, [allContacts, supplierId])

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
    const defaultProduct = 'Fresh Logs'
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
    productType?: 'Fresh Logs' | 'Burnt Logs',
    customSupplierId?: string | number,
  ): string[] {
    const pt = productType || 'Fresh Logs'
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

    const problem = checkSpecFile(file)
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
    const message = await openSpecInNewWindow(specId)
    if (message) {
      setErrorMsg(message)
    }
  }

  // Used when saving a NEW procurement (also "Save as New (Duplicate)").
  async function buildSpecFieldsForNew(): Promise<{ fields: SpecFields; createdId: string }> {
    if (pendingSpecFile) {
      const id = makeSpecId()
      const spec = fileToSpec(pendingSpecFile)
      await saveSpec(id, spec)
      return {
        fields: { LogSpecFileID: id, LogSpecFileName: spec.name, LogSpecFileType: spec.type },
        createdId: id,
      }
    }

    if (specFileId) {
      // Duplicate: give the copy its own file so removing one never affects the other.
      const existing = await loadSpec(specFileId)
      if (existing) {
        const id = makeSpecId()
        await saveSpec(id, existing)
        return {
          fields: {
            LogSpecFileID: id,
            LogSpecFileName: existing.name,
            LogSpecFileType: existing.type,
          },
          createdId: id,
        }
      }
    }

    return {
      fields: { LogSpecFileID: '', LogSpecFileName: '', LogSpecFileType: '' },
      createdId: '',
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
    setStatus('Draft')
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
    const defaultProduct = 'Fresh Logs'
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
    setStatus(proc.Status || 'Draft')
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
          ProductType: g.ProductType as 'Fresh Logs' | 'Burnt Logs',
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
          ProductType: 'Fresh Logs',
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

  // Validate form data matching Python legacy logic
  function validateForm() {
    if (!supplierId) {
      throw new Error('Please select a supplier.')
    }
    if (!contactId && supplierContacts.length > 0) {
      throw new Error('Please select a supplier contact.')
    }
    if (!agreementType) {
      throw new Error('Please select an Agreement Type.')
    }
    if (!agreementDetail.trim()) {
      throw new Error(`Please enter the ${agreementType} detail or ID.`)
    }
    if (!STATUSES.includes(status as any)) {
      throw new Error('Please select a valid procurement status.')
    }
    if (!harvestPeriodStart.trim() || !harvestPeriodEnd.trim()) {
      throw new Error(
        'Please enter both Harvest Period Start and Harvest Period End.',
      )
    }

    // Validate grades
    if (gradeRows.length === 0) {
      throw new Error('At least one grade row is required.')
    }

    const validatedGrades: Partial<ProcurementGrade>[] = []
    for (const [idx, row] of gradeRows.entries()) {
      const rowNum = idx + 1
      if (!row.Species.trim()) {
        throw new Error(`Row ${rowNum}: Please specify species.`)
      }
      if (!row.GradeName.trim()) {
        throw new Error(`Row ${rowNum}: Please select a grade.`)
      }
      const offered = Number(row.OfferedPricePerTonne) || 0
      const agreedPrice = Number(row.AgreedPricePerTonne) || 0
      const agreedTonnes = Number(row.AgreedTonnes) || 0
      const deliveredTonnes = Number(row.DeliveredTonnes) || 0

      if (offered < 0) {
        throw new Error(
          `Row ${rowNum} (${row.GradeName}): Offered price cannot be negative.`,
        )
      }
      if (agreedPrice <= 0) {
        throw new Error(
          `Row ${rowNum} (${row.GradeName}): Agreed price $/t must be greater than 0.`,
        )
      }
      if (agreedTonnes <= 0) {
        throw new Error(
          `Row ${rowNum} (${row.GradeName}): Agreed tonnes must be greater than 0.`,
        )
      }
      if (deliveredTonnes < 0 || deliveredTonnes > agreedTonnes) {
        throw new Error(
          `Row ${rowNum} (${row.GradeName}): Delivered tonnes must be between 0 and Agreed Tonnes.`,
        )
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
  async function handleSaveNew(e: FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    let createdSpecId = ''

    try {
      const validatedGrades = validateForm()
      setIsSaving(true)

      const spec = await buildSpecFieldsForNew()
      createdSpecId = spec.createdId

      const payload: Partial<Procurement> = {
        SupplierID: supplierId,
        ContactID: contactId,
        AgreementType: agreementType,
        AgreementDetail: agreementDetail.trim(),
        Plantation: plantation.trim(),
        Species: species.trim() || validatedGrades[0]?.Species || '',
        HarvestPeriodStart: harvestPeriodStart.trim(),
        HarvestPeriodEnd: harvestPeriodEnd.trim(),
        StartDate: startDate.trim(),
        EndDate: endDate.trim(),
        Status: status,
        AcceptanceDate: acceptanceDate.trim(),
        AcceptanceTime: acceptanceTime.trim(),
        AcceptanceMethod: acceptanceMethod,
        AcceptedByPerson: acceptedByPerson.trim(),
        AcceptanceNotes: acceptanceNotes.trim(),
        Notes: generalNotes.trim(),
        ...spec.fields,
      }

      const res = await window.logPro.saveProcurement(
        workbookPath,
        payload,
        validatedGrades,
      )
      setIsSaving(false)

      if (res.error) {
        await removeSpec(createdSpecId)
        setErrorMsg(res.error)
      } else {
        loadData()
        onDataChanged()
        loadProcurementIntoForm(res.procurement)
        setSuccessMsg(`Procurement ${res.procurement.ProcurementRef} saved successfully!`)
        setMode('view')
        setIsDirty(false)
      }
    } catch (err: any) {
      setIsSaving(false)
      await removeSpec(createdSpecId)
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

      const payload: Partial<Procurement> = {
        SupplierID: supplierId,
        ContactID: contactId,
        AgreementType: agreementType,
        AgreementDetail: agreementDetail.trim(),
        Plantation: plantation.trim(),
        Species: species.trim() || validatedGrades[0]?.Species || '',
        HarvestPeriodStart: harvestPeriodStart.trim(),
        HarvestPeriodEnd: harvestPeriodEnd.trim(),
        StartDate: startDate.trim(),
        EndDate: endDate.trim(),
        Status: status,
        AcceptanceDate: acceptanceDate.trim(),
        AcceptanceTime: acceptanceTime.trim(),
        AcceptanceMethod: acceptanceMethod,
        AcceptedByPerson: acceptedByPerson.trim(),
        AcceptanceNotes: acceptanceNotes.trim(),
        Notes: generalNotes.trim(),
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
            productType: String(newG.ProductType || 'Fresh Logs'),
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

    let createdSpecId = ''

    try {
      // Which spec file the procurement has right now (before this save)
      const previousSpecId =
        window.logPro
          .getProcurements(workbookPath)
          .find((p) => p.ProcurementRef === selectedProcRef)?.LogSpecFileID || ''

      let specFields: SpecFields

      if (pendingSpecFile) {
        createdSpecId = makeSpecId()
        const spec = fileToSpec(pendingSpecFile)
        await saveSpec(createdSpecId, spec)
        specFields = {
          LogSpecFileID: createdSpecId,
          LogSpecFileName: spec.name,
          LogSpecFileType: spec.type,
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
        await removeSpec(createdSpecId)
        setErrorMsg(res.error)
      } else {
        // The old file is no longer needed if it was replaced or removed
        if (previousSpecId && previousSpecId !== specFields.LogSpecFileID) {
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
      await removeSpec(createdSpecId)
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
      // Status filter
      if (statusFilter !== 'All' && p.Status !== statusFilter) {
        return false
      }
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
  }, [procurements, statusFilter, registerSearch, suppliers])

  function getStatusColor(st: string): { bg: string; text: string; border: string } {
    switch (st) {
      case 'Active':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' }
      case 'Accepted':
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
      case 'Waiting for Acceptance':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a' }
      case 'Completed':
        return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }
      case 'Cancelled':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' }
      default: // Draft
        return { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' }
    }
  }

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.logPro.exportWorkbookFile(workbookPath)}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
            }}
            title="Download active Excel workbook to your computer"
          >
            <Download size={16} /> Export Excel
          </button>
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

      {/* Main split grid: left panel vs Register */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* ==================== LEFT PANEL ==================== */}

        {/* Blank: only the add button */}
        {mode === 'blank' && (
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
              minHeight: '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleStartNew}
              style={{
                width: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 26px',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Plus size={18} /> Add New Procurement
            </button>
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
              onSubmit={mode === 'edit' ? handleUpdateSelected : handleSaveNew}
              onChange={() => setIsDirty(true)}
            >
              {/* Section 1: Supplier & Contact */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px',
                  background: '#fbfdff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={18} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                      1. Supplier & Contact
                    </h3>
                  </div>
                  {supplierId && (
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
                      }}
                    >
                      <Plus size={14} /> Add Contact
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Supplier *
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => {
                        const newSuppId = e.target.value
                        setSupplierId(newSuppId)
                        if (newSuppId) {
                          const contacts = allContacts.filter((c) => String(c.SupplierID).trim() === newSuppId.trim())
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

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Contact Person *
                    </label>
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                      }}
                      disabled={!supplierId || supplierContacts.length === 0}
                    >
                      <option value="">
                        {!supplierId
                          ? '-- Select supplier first --'
                          : supplierContacts.length === 0
                          ? '-- No contacts for supplier --'
                          : '-- Select Contact --'}
                      </option>
                      {supplierContacts.map((c) => (
                        <option key={String(c.ContactID)} value={String(c.ContactID)}>
                          {c.ContactName} {c.Role ? `(${c.Role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Readonly info strip */}
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
                    }}
                  >
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
                    {currentContact && (
                      <>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Role:</span>
                          <strong>{currentContact.Role || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Phone:</span>
                          <strong>{currentContact.PhoneNumber || currentContact.MobileNumber || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block' }}>Email:</span>
                          <strong>{currentContact.Email || '—'}</strong>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Agreement */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px',
                  background: '#fbfdff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <FileCheck size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                    2. Agreement Details
                  </h3>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
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

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      {agreementType} Detail / Code *
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter ${agreementType} identifier (e.g. Coupe 14A, Block East)`}
                      value={agreementDetail}
                      onChange={(e) => setAgreementDetail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Plantation & Harvest */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '18px',
                  background: '#fbfdff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                    3. Plantation & Harvest Period
                  </h3>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Plantation Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Green Triangle Estate"
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Harvest Period Start *
                    </label>
                    <input
                      type="date"
                      value={harvestPeriodStart}
                      onChange={(e) => setHarvestPeriodStart(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Harvest Period End *
                    </label>
                    <input
                      type="date"
                      value={harvestPeriodEnd}
                      onChange={(e) => setHarvestPeriodEnd(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Agreement Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Agreement End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
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
                      4. Grades, Products, Prices & Tonnes
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setIsSettingsOpen(true)}
                      style={{
                        width: 'auto',
                        padding: '5px 10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Configure custom species and grades"
                    >
                      <SettingsIcon size={14} /> Settings
                    </button>
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
                                    e.target.value as 'Fresh Logs' | 'Burnt Logs',
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
                                required
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
                                required
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

              {/* Section 5: Log Specification */}
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
                    5. Log Specification
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
                      style={{ width: 'auto', padding: '5px 12px', fontSize: '0.8rem' }}
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

              {/* Section 6: Status & Acceptance */}
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
                  <UserCheck size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)' }}>
                    6. Status & Acceptance
                  </h3>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Acceptance Date
                    </label>
                    <input
                      type="date"
                      value={acceptanceDate}
                      onChange={(e) => setAcceptanceDate(e.target.value)}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Acceptance Time
                    </label>
                    <input
                      type="time"
                      value={acceptanceTime}
                      onChange={(e) => setAcceptanceTime(e.target.value)}
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
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Acceptance Method
                    </label>
                    <select
                      value={acceptanceMethod}
                      onChange={(e) => setAcceptanceMethod(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: '#fff',
                      }}
                    >
                      {ACCEPTANCE_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Accepted By Person
                    </label>
                    <input
                      type="text"
                      placeholder="Signatory name"
                      value={acceptedByPerson}
                      onChange={(e) => setAcceptedByPerson(e.target.value)}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      Acceptance Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Acceptance conditions or contract reference"
                      value={acceptanceNotes}
                      onChange={(e) => setAcceptanceNotes(e.target.value)}
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

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      General Notes
                    </label>
                    <textarea
                      rows={2}
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
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    fontSize: '0.95rem',
                  }}
                >
                  <Save size={18} />
                  {isSaving
                    ? 'Saving...'
                    : mode === 'edit'
                    ? 'Save Changes'
                    : 'Save Procurement'}
                </button>

                {mode === 'edit' && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={handleSaveNew}
                    style={{
                      width: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                    }}
                    title="Save current details as a brand new agreement"
                  >
                    <Plus size={16} /> Save as New (Duplicate)
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelForm}
                  style={{
                    width: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 18px',
                  }}
                >
                  <RotateCcw size={16} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== RIGHT: PROCUREMENT REGISTER ==================== */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TableIcon size={20} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>
                Procurement Register
              </h3>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary-dark)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {filteredProcurements.length}
              </span>
            </div>
          </div>

          {/* Register Search & Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                placeholder="Search Ref, Supplier, Coupe, Plantation..."
                value={registerSearch}
                onChange={(e) => setRegisterSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Procurements List / Table */}
          {filteredProcurements.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                border: '2px dashed var(--border)',
                borderRadius: '8px',
                color: 'var(--muted)',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>No procurements match this criteria.</p>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                Create an agreement or clear the search filter.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '720px', overflowY: 'auto' }}>
              {filteredProcurements.map((proc) => {
                const isSelected = selectedProcRef === proc.ProcurementRef
                const stColor = getStatusColor(proc.Status)
                const tonnes = getProcurementTonnes(proc.ProcurementRef)
                const percentDelivered =
                  tonnes.agreed > 0
                    ? Math.min(100, Math.round((tonnes.delivered / tonnes.agreed) * 100))
                    : 0
                const suppName =
                  suppliers.find(
                    (s) =>
                      String(s.SupplierID) === String(proc.SupplierID) ||
                      String(s.SupplierReference) === String(proc.SupplierID),
                  )?.SupplierName || `Supplier #${proc.SupplierID}`

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
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '1rem', color: 'var(--primary-dark)' }}>
                          {proc.ProcurementRef}
                        </strong>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: stColor.bg,
                            color: stColor.text,
                            border: `1px solid ${stColor.border}`,
                          }}
                        >
                          {proc.Status}
                        </span>
                        {proc.LogSpecFileID && (
                          <span
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => {
                              event.stopPropagation()
                              void handleOpenSpec(proc.LogSpecFileID || '')
                            }}
                            title={`Log Specification: ${proc.LogSpecFileName || 'attached'} (double-click to open)`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: '#0284c7',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            <Paperclip size={16} />
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {proc.AgreementType}: {proc.AgreementDetail || '—'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                      {suppName}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '0.8rem',
                        color: '#475569',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {proc.Plantation && (
                        <span>
                          Plantation: <strong>{proc.Plantation}</strong>
                        </span>
                      )}
                      {proc.Species && (
                        <span>
                          Species: <strong>{proc.Species}</strong>
                        </span>
                      )}
                      {proc.HarvestPeriodStart && (
                        <span>
                          Harvest: {proc.HarvestPeriodStart} to {proc.HarvestPeriodEnd || '—'}
                        </span>
                      )}
                    </div>

                    {/* Delivery Progress Bar */}
                    <div style={{ marginTop: '6px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          marginBottom: '3px',
                        }}
                      >
                        <span>
                          Delivered: <strong>{tonnes.delivered} t</strong> / {tonnes.agreed} t
                        </span>
                        <span style={{ color: tonnes.remaining > 0 ? '#0284c7' : '#16a34a', fontWeight: 700 }}>
                          {tonnes.remaining} t left ({percentDelivered}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          background: '#e2e8f0',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentDelivered}%`,
                            height: '100%',
                            background:
                              percentDelivered >= 100
                                ? '#16a34a'
                                : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <GradeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        workbookPath={workbookPath}
        speciesList={speciesList}
        gradesList={gradesList}
        suppliers={suppliers}
        onRefresh={loadData}
      />

      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        workbookPath={workbookPath}
        supplier={currentSupplier}
        onContactAdded={(newId) => {
          loadData()
          setContactId(String(newId))
        }}
      />

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