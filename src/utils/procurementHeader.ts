import type { Procurement, ProcurementHeaderMode } from '../types'

type ProcurementHeaderSource = Exclude<ProcurementHeaderMode, 'auto' | 'custom'>

type ProcurementHeaderOption = {
  mode: ProcurementHeaderSource
  label: string
  text: string
}

export function getProcurementHeaderOptions(procurement: Procurement): ProcurementHeaderOption[] {
  const agreementType = String(procurement.AgreementType || '').trim().toLowerCase()
  const agreementDetail = String(procurement.AgreementDetail || '').trim()
  const harvestRange = procurement.HarvestPeriodStart
    ? `${procurement.HarvestPeriodStart}${procurement.HarvestPeriodEnd ? ` – ${procurement.HarvestPeriodEnd}` : ''}`
    : procurement.StartDate
    ? `${procurement.StartDate}${procurement.EndDate ? ` – ${procurement.EndDate}` : ''}`
    : ''

  const options: ProcurementHeaderOption[] = [
    {
      mode: 'contract-number',
      label: 'Contract Number Details',
      text:
        String(procurement.ContractNumber || '').trim() ||
        (agreementType === 'contract number' ? agreementDetail : ''),
    },
    {
      mode: 'harvest',
      label: 'Harvest Details',
      text: (agreementType === 'harvest' ? agreementDetail : '') || harvestRange,
    },
    {
      mode: 'coupe',
      label: 'Coupe Details',
      text: agreementType === 'coupe' ? agreementDetail : '',
    },
    {
      mode: 'block',
      label: 'Block Details',
      text: agreementType === 'block' ? agreementDetail : '',
    },
    {
      mode: 'plantation',
      label: 'Plantation Name',
      text: String(procurement.Plantation || '').trim(),
    },
  ]

  return options.filter((option) => option.text !== '')
}

export function getProcurementHeaderDisplay(procurement: Procurement) {
  const options = getProcurementHeaderOptions(procurement)
  const defaultText = options[0]?.text || ''
  const mode =
    procurement.HeaderDisplayMode ||
    (String(procurement.CustomHeader || '').trim() ? 'custom' : 'auto')
  const selectedText =
    mode === 'custom'
      ? String(procurement.CustomHeader || '').trim()
      : mode === 'auto'
      ? ''
      : options.find((option) => option.mode === mode)?.text || ''

  return {
    text: selectedText || defaultText || procurement.ProcurementRef,
    isProcurementRef: !selectedText && !defaultText,
  }
}