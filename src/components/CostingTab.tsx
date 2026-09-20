import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import {
  Calculator,
  RefreshCw,
  Save,
  Trash2,
  Globe2,
  DollarSign,
  Info,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react'
import { type CostingRecord } from '../types'
import {
  fetchLiveExchangeRates,
  saveCustomExchangeRates,
  clearCustomExchangeRates,
  type ExchangeRateData,
} from '../services/exchangeRateService'

type CostingTabProps = {
  workbookPath: string
  onRefresh?: () => void
}

type DestinationCountry = {
  code: string
  name: string
  flag: string
  currencyCode: 'CNY' | 'JPY' | 'KRW' | 'USD' | 'VND' | 'INR'
  currencySymbol: string
  currencyLabel: string
  defaultClearanceCurrency: 'CNY' | 'AUD' | 'USD'
}

const COUNTRIES: DestinationCountry[] = [
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    currencyCode: 'CNY',
    currencySymbol: '¥',
    currencyLabel: 'RMB / CNY',
    defaultClearanceCurrency: 'CNY',
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    currencyCode: 'JPY',
    currencySymbol: '¥',
    currencyLabel: 'JPY',
    defaultClearanceCurrency: 'AUD',
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    currencyCode: 'KRW',
    currencySymbol: '₩',
    currencyLabel: 'KRW',
    defaultClearanceCurrency: 'AUD',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyLabel: 'USD',
    defaultClearanceCurrency: 'AUD',
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyLabel: 'USD',
    defaultClearanceCurrency: 'AUD',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyLabel: 'USD',
    defaultClearanceCurrency: 'AUD',
  },
  {
    code: 'TW',
    name: 'Taiwan',
    flag: '🇹🇼',
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyLabel: 'USD',
    defaultClearanceCurrency: 'AUD',
  },
]

export function CostingTab({ workbookPath }: CostingTabProps) {
  // Country selection (Default: China)
  const [selectedCountryCode, setSelectedCountryCode] = useState('CN')
  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === selectedCountryCode) || COUNTRIES[0],
    [selectedCountryCode],
  )

  // Live Exchange Rates (Australian RBA aligned)
  const [exchangeData, setExchangeData] = useState<ExchangeRateData | null>(null)
  const [isLoadingRates, setIsLoadingRates] = useState(false)
  const [rateFeedback, setRateFeedback] = useState('')
  const [isEditingRates, setIsEditingRates] = useState(false)
  const [customAudUsd, setCustomAudUsd] = useState('0.6550')
  const [customAudCny, setCustomAudCny] = useState('4.7200')

  // Selling Price input mode: user can type either in USD or in RMB
  const [sellingPriceInputMode, setSellingPriceInputMode] = useState<'USD' | 'RMB'>('USD')
  const [sellingPriceUSD, setSellingPriceUSD] = useState('145.00')
  const [sellingPriceRMB, setSellingPriceRMB] = useState('1045.00')

  // Cost deductions
  // Customs Clearance in RMB/tonne (Yellow field)
  const [customsClearanceRMB, setCustomsClearanceRMB] = useState('35.00')
  // Sea Freight in AUD/tonne (Yellow field)
  const [seaFreightAUD, setSeaFreightAUD] = useState('42.00')
  // Fumigation in AUD/tonne (Yellow field)
  const [fumigationAUD, setFumigationAUD] = useState('6.50')
  // Packing in AUD/tonne (Yellow field)
  const [packingAUD, setPackingAUD] = useState('12.00')
  // Trader Commission in AUD/tonne (Optional)
  const [traderCommissionAUD, setTraderCommissionAUD] = useState('5.00')
  const [includeCommission, setIncludeCommission] = useState(true)

  // Saved Costings History
  const [savedCostings, setSavedCostings] = useState<CostingRecord[]>([])
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  // Save Modal Form fields
  const [costingRef, setCostingRef] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [gradeOrSpecies, setGradeOrSpecies] = useState('Radiata Pine - A Grade')
  const [costingNotes, setCostingNotes] = useState('')

  const loadExchangeRates = useCallback(async (force: boolean) => {
    setIsLoadingRates(true)
    try {
      const data = await fetchLiveExchangeRates(force)
      setExchangeData(data)
      setCustomAudUsd(data.rates.USD.toFixed(4))
      setCustomAudCny(data.rates.CNY.toFixed(4))
      if (force) {
        setRateFeedback('Exchange rates refreshed successfully from central bank feeds.')
        setTimeout(() => setRateFeedback(''), 4000)
      }
    } catch {
      setRateFeedback('Could not retrieve live rates; using fallback benchmarks.')
    } finally {
      setIsLoadingRates(false)
    }
  }, [])

  const loadWorkbookCostings = useCallback(() => {
    if (!workbookPath || typeof window.logPro?.getCostings !== 'function') return
    try {
      const list = window.logPro.getCostings(workbookPath)
      setSavedCostings(list)
    } catch (err) {
      console.warn('Error reading saved costings:', err)
    }
  }, [workbookPath])

  // Load Exchange Rates on mount
  useEffect(() => {
    loadExchangeRates(false)
    loadWorkbookCostings()
  }, [loadExchangeRates, loadWorkbookCostings])

  // Active Effective Exchange Rates
  const audUsdRate = Number(customAudUsd) || exchangeData?.rates.USD || 0.655
  const audCnyRate = Number(customAudCny) || exchangeData?.rates.CNY || 4.72
  // Cross Rate: 1 USD = X CNY (derived: audCny / audUsd)
  const usdCnyRate = audUsdRate > 0 ? audCnyRate / audUsdRate : 7.206

  // Handle two-way Selling Price conversion
  function handleSellingPriceUSDChange(val: string) {
    setSellingPriceUSD(val)
    setSellingPriceInputMode('USD')
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0) {
      const rmbVal = (num * usdCnyRate).toFixed(2)
      setSellingPriceRMB(rmbVal)
    } else {
      setSellingPriceRMB('')
    }
  }

  function handleSellingPriceRMBChange(val: string) {
    setSellingPriceRMB(val)
    setSellingPriceInputMode('RMB')
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0 && usdCnyRate > 0) {
      const usdVal = (num / usdCnyRate).toFixed(2)
      setSellingPriceUSD(usdVal)
    } else {
      setSellingPriceUSD('')
    }
  }

  // Currency Calculations per Metric Tonne
  const calculations = useMemo(() => {
    // 1. Selling Price
    let spAud = 0
    let spUsd = 0
    let spRmb = 0

    if (sellingPriceInputMode === 'USD') {
      spUsd = parseFloat(sellingPriceUSD) || 0
      spAud = audUsdRate > 0 ? spUsd / audUsdRate : 0
      spRmb = spAud * audCnyRate
    } else {
      spRmb = parseFloat(sellingPriceRMB) || 0
      spAud = audCnyRate > 0 ? spRmb / audCnyRate : 0
      spUsd = spAud * audUsdRate
    }

    // 2. Customs Clearance (User enters in RMB/tonne)
    const clearanceRmb = parseFloat(customsClearanceRMB) || 0
    const clearanceAud = audCnyRate > 0 ? clearanceRmb / audCnyRate : 0
    const clearanceUsd = clearanceAud * audUsdRate

    // 3. Sea Freight (User enters in AUD/tonne)
    const freightAud = parseFloat(seaFreightAUD) || 0
    const freightUsd = freightAud * audUsdRate
    const freightRmb = freightAud * audCnyRate

    // 4. Fumigation (User enters in AUD/tonne)
    const fumiAud = parseFloat(fumigationAUD) || 0
    const fumiUsd = fumiAud * audUsdRate
    const fumiRmb = fumiAud * audCnyRate

    // 5. Packing (User enters in AUD/tonne)
    const packAud = parseFloat(packingAUD) || 0
    const packUsd = packAud * audUsdRate
    const packRmb = packAud * audCnyRate

    // 6. Trader Commission (Optional, in AUD/tonne)
    const commAud = includeCommission ? parseFloat(traderCommissionAUD) || 0 : 0
    const commUsd = commAud * audUsdRate
    const commRmb = commAud * audCnyRate

    // Total Deductions (per metric tonne)
    const totalDeductionsAud =
      clearanceAud + freightAud + fumiAud + packAud + commAud
    const totalDeductionsUsd = totalDeductionsAud * audUsdRate
    const totalDeductionsRmb = totalDeductionsAud * audCnyRate

    // Mill Door Price (Reverse Netback Offer)
    const millDoorAud = Math.max(0, spAud - totalDeductionsAud)
    const millDoorUsd = millDoorAud * audUsdRate
    const millDoorRmb = millDoorAud * audCnyRate

    // Break-even without commission
    const breakEvenMillDoorAud = Math.max(
      0,
      spAud - (clearanceAud + freightAud + fumiAud + packAud),
    )

    return {
      spAud,
      spUsd,
      spRmb,
      clearanceAud,
      clearanceUsd,
      clearanceRmb,
      freightAud,
      freightUsd,
      freightRmb,
      fumiAud,
      fumiUsd,
      fumiRmb,
      packAud,
      packUsd,
      packRmb,
      commAud,
      commUsd,
      commRmb,
      totalDeductionsAud,
      totalDeductionsUsd,
      totalDeductionsRmb,
      millDoorAud,
      millDoorUsd,
      millDoorRmb,
      breakEvenMillDoorAud,
    }
  }, [
    sellingPriceInputMode,
    sellingPriceUSD,
    sellingPriceRMB,
    customsClearanceRMB,
    seaFreightAUD,
    fumigationAUD,
    packingAUD,
    traderCommissionAUD,
    includeCommission,
    audUsdRate,
    audCnyRate,
  ])

  // Save Costing to Workbook
  function openSaveModal() {
    const nextNum = savedCostings.length + 1
    setCostingRef(`CST-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`)
    setCustomerName('')
    setCostingNotes(`Reverse netback costing for ${selectedCountry.name} export.`)
    setIsSaveModalOpen(true)
  }

  async function handleSaveCosting(e: FormEvent) {
    e.preventDefault()
    if (!workbookPath) return

    const newRecord: Partial<CostingRecord> = {
      CostingRef: costingRef.trim() || `CST-${Date.now()}`,
      DestinationCountry: selectedCountry.name,
      SellingPriceEntered:
        sellingPriceInputMode === 'USD'
          ? parseFloat(sellingPriceUSD) || 0
          : parseFloat(sellingPriceRMB) || 0,
      SellingPriceCurrency: sellingPriceInputMode,
      SellingPriceAUD: Number(calculations.spAud.toFixed(2)),
      SellingPriceUSD: Number(calculations.spUsd.toFixed(2)),
      SellingPriceRMB: Number(calculations.spRmb.toFixed(2)),
      ExchangeRateAUD_USD: Number(audUsdRate.toFixed(4)),
      ExchangeRateAUD_CNY: Number(audCnyRate.toFixed(4)),
      RateSource: exchangeData?.source || 'Reserve Bank of Australia (RBA) Reference',
      RateDate: exchangeData?.lastUpdated || new Date().toISOString().split('T')[0],
      CustomsClearanceRMB: Number(parseFloat(customsClearanceRMB).toFixed(2)) || 0,
      CustomsClearanceAUD: Number(calculations.clearanceAud.toFixed(2)),
      SeaFreightAUD: Number(parseFloat(seaFreightAUD).toFixed(2)) || 0,
      FumigationAUD: Number(parseFloat(fumigationAUD).toFixed(2)) || 0,
      PackingAUD: Number(parseFloat(packingAUD).toFixed(2)) || 0,
      TraderCommissionAUD: includeCommission
        ? Number(parseFloat(traderCommissionAUD).toFixed(2)) || 0
        : 0,
      TraderCommissionRate: includeCommission ? parseFloat(traderCommissionAUD) || 0 : 0,
      TraderCommissionType: '$',
      TotalDeductionsAUD: Number(calculations.totalDeductionsAud.toFixed(2)),
      MillDoorPriceAUD: Number(calculations.millDoorAud.toFixed(2)),
      MillDoorPriceUSD: Number(calculations.millDoorUsd.toFixed(2)),
      MillDoorPriceRMB: Number(calculations.millDoorRmb.toFixed(2)),
      CustomerName: customerName.trim(),
      GradeOrSpecies: gradeOrSpecies.trim(),
      Notes: costingNotes.trim(),
      CreatedBy: 'Vincent Chan',
      CreatedDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    }

    try {
      const res = await window.logPro.saveCosting(workbookPath, newRecord)
      if (res && !res.error) {
        setSavedCostings(res.costings)
        setIsSaveModalOpen(false)
        setSaveSuccessMsg(`Costing "${newRecord.CostingRef}" saved to Excel workbook.`)
        setTimeout(() => setSaveSuccessMsg(''), 4000)
      } else {
        alert(res?.error || 'Failed to save costing.')
      }
    } catch (err: any) {
      alert(`Error saving costing: ${err?.message || String(err)}`)
    }
  }

  async function handleDeleteCosting(costingId: string | number) {
    if (!confirm('Are you sure you want to delete this saved costing record?')) return
    try {
      const res = await window.logPro.deleteCosting(workbookPath, costingId)
      if (res && !res.error) {
        setSavedCostings(res.costings)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Load a saved scenario back into the calculator
  function loadScenario(record: CostingRecord) {
    if (record.SellingPriceCurrency === 'RMB') {
      setSellingPriceInputMode('RMB')
      setSellingPriceRMB(record.SellingPriceRMB.toFixed(2))
      setSellingPriceUSD(record.SellingPriceUSD.toFixed(2))
    } else {
      setSellingPriceInputMode('USD')
      setSellingPriceUSD(record.SellingPriceUSD.toFixed(2))
      setSellingPriceRMB(record.SellingPriceRMB.toFixed(2))
    }

    setCustomsClearanceRMB(record.CustomsClearanceRMB.toFixed(2))
    setSeaFreightAUD(record.SeaFreightAUD.toFixed(2))
    setFumigationAUD(record.FumigationAUD.toFixed(2))
    setPackingAUD(record.PackingAUD.toFixed(2))
    if (record.TraderCommissionAUD > 0) {
      setIncludeCommission(true)
      setTraderCommissionAUD(record.TraderCommissionAUD.toFixed(2))
    } else {
      setIncludeCommission(false)
    }

    if (record.ExchangeRateAUD_USD > 0) {
      setCustomAudUsd(record.ExchangeRateAUD_USD.toFixed(4))
    }
    if (record.ExchangeRateAUD_CNY > 0) {
      setCustomAudCny(record.ExchangeRateAUD_CNY.toFixed(4))
    }

    // Scroll to top of calculator smoothly
    const elem = document.getElementById('costing-calculator-container')
    if (elem) elem.scrollIntoView({ behavior: 'smooth' })
  }

  // Apply custom rate override
  function handleApplyCustomRates() {
    if (exchangeData) {
      saveCustomExchangeRates({
        ...exchangeData,
        rates: {
          ...exchangeData.rates,
          USD: Number(customAudUsd) || 0.655,
          CNY: Number(customAudCny) || 4.72,
        },
      })
    }
    setIsEditingRates(false)
    setRateFeedback('Custom rates locked and saved.')
    setTimeout(() => setRateFeedback(''), 3000)
  }

  function handleResetToOfficialRates() {
    clearCustomExchangeRates()
    setIsEditingRates(false)
    loadExchangeRates(true)
  }

  return (
    <div
      id="costing-page"
      className="page-content"
      style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '24px 20px' }}
    >
      {/* Page Header */}
      <div
        id="costing-header-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          marginBottom: '20px',
          padding: '24px 28px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calculator size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
              Reverse Netback Costing Engine
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
              }}
            >
              Export Price Backwards Model
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', maxWidth: '820px', lineHeight: 1.5 }}>
            Calculate backwards from overseas selling prices (starting with China) to determine the maximum
            feasible <strong>Mill Door Purchasing Offer (AUD/tonne)</strong> after deducting all ocean freight,
            port clearance, biosecurity treatments, and packing costs.
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            id="save-costing-button"
            onClick={openSaveModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
              cursor: 'pointer',
            }}
          >
            <Save size={16} /> Save Costing Scenario
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px',
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Control Bar: Country Selection & Official Exchange Rate Banner */}
      <div
        id="costing-controls-bar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '16px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          marginBottom: '20px',
        }}
      >
        {/* Destination Country Card */}
        <div
          id="destination-country-card"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Globe2 size={18} color="#0284c7" />
              <label htmlFor="country-select" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Export Destination Country
              </label>
            </div>
            <select
              id="country-select"
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#0f172a',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.currencyLabel})
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#64748b' }}>
            Active Market: <strong style={{ color: '#0f172a' }}>{selectedCountry.flag} {selectedCountry.name}</strong> • Overseas Currency: <strong style={{ color: '#0284c7' }}>{selectedCountry.currencyLabel}</strong>
          </div>
        </div>

        {/* Australian RBA Exchange Rate Live Banner */}
        <div
          id="exchange-rate-banner-card"
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="#16a34a" />
              <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                Live Foreign Exchange Reference (Zero-Cost Central Bank Feed)
              </strong>
              {exchangeData?.isCustomOverride && (
                <span style={{ fontSize: '0.72rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Manual Override Active
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                id="refresh-rates-button"
                onClick={() => loadExchangeRates(true)}
                disabled={isLoadingRates}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: isLoadingRates ? 'wait' : 'pointer',
                }}
                title="Fetch latest official rates from Reserve Bank / Central Bank"
              >
                <RefreshCw size={13} className={isLoadingRates ? 'animate-spin' : ''} />
                {isLoadingRates ? 'Updating…' : 'Refresh Rates'}
              </button>

              <button
                type="button"
                id="edit-rates-toggle"
                onClick={() => setIsEditingRates(!isEditingRates)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: isEditingRates ? '#0284c7' : '#ffffff',
                  border: isEditingRates ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  color: isEditingRates ? '#ffffff' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isEditingRates ? 'Close Customizer' : 'Edit / Lock Rates'}
              </button>
            </div>
          </div>

          {/* Rates Display Grid */}
          {!isEditingRates ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  AUD / USD Benchmark
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  1 AUD = ${audUsdRate.toFixed(4)} USD
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  (Inverse: 1 USD = ${(1 / audUsdRate).toFixed(4)} AUD)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  AUD / CNY (RMB) Benchmark
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  1 AUD = ¥{audCnyRate.toFixed(4)} RMB
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  (Inverse: 1 RMB = ${(1 / audCnyRate).toFixed(4)} AUD)
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Derived USD / RMB Cross Rate
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0369a1' }}>
                  1 USD = ¥{usdCnyRate.toFixed(4)} RMB
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  (Cross parity: CNY / USD)
                </div>
              </div>
            </div>
          ) : (
            /* Custom Rate Editing Mode */
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #93c5fd',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                gap: '16px',
              }}
            >
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  AUD / USD Rate
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={customAudUsd}
                  onChange={(e) => setCustomAudUsd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  AUD / CNY (RMB) Rate
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={customAudCny}
                  onChange={(e) => setCustomAudCny(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleApplyCustomRates}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Apply & Lock
                </button>
                <button
                  type="button"
                  onClick={handleResetToOfficialRates}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Live RBA
                </button>
              </div>
            </div>
          )}

          {/* Sourcing Attribution Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '10px',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Info size={13} color="#0284c7" />
              <span>
                <strong>Source:</strong> {exchangeData?.source || 'Reserve Bank of Australia (RBA) Daily Foreign Exchange Benchmark F11'}
              </span>
            </div>
            <span>
              Effective as of: <strong>{exchangeData?.lastUpdated || 'Today'}</strong> (Free public feed, zero API cost)
            </span>
          </div>
          {rateFeedback && (
            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#0369a1', fontWeight: 600 }}>
              {rateFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Costing Table Container (Spreadsheet Layout with Yellow Input Cells) */}
      <div
        id="costing-calculator-container"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
          overflow: 'hidden',
          marginBottom: '28px',
        }}
      >
        {/* Table Header Strip with Explanation */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Reverse Netback Calculation Sheet
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Highlighted yellow cells indicate user input fields. All other values and currencies recalculate in real-time.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: '#fffbeb',
              borderRadius: '8px',
              border: '1px solid #fde68a',
              fontSize: '0.8rem',
              color: '#92400e',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: '#fef08a',
                border: '1px solid #eab308',
                borderRadius: '3px',
              }}
            />
            <span>Yellow Fields = Direct Input Currency</span>
          </div>
        </div>

        {/* Interactive Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '14px 20px', width: '32%', color: '#334155', fontWeight: 800 }}>
                  Cost Component / Line Item
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    width: '22%',
                    color: '#0f172a',
                    fontWeight: 800,
                    textAlign: 'right',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  AUD / tonne
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    width: '22%',
                    color: '#0f172a',
                    fontWeight: 800,
                    textAlign: 'right',
                  }}
                >
                  USD / tonne
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    width: '24%',
                    color: '#0f172a',
                    fontWeight: 800,
                    textAlign: 'right',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  {selectedCountry.currencyLabel} / tonne
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Selling Price (Delivered / CIF) - Either USD or RMB */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    Selling Price (Delivered / CIF)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Gross export revenue. Enter in either <strong>USD</strong> or <strong>RMB</strong> (both auto-convert).
                  </div>
                </td>

                {/* AUD/t (Computed) */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    ${calculations.spAud.toFixed(2)}
                  </span>
                </td>

                {/* USD/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>$</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={sellingPriceUSD}
                      onChange={(e) => handleSellingPriceUSDChange(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '130px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter overseas selling price in USD/tonne"
                    />
                  </div>
                </td>

                {/* RMB/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>¥</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={sellingPriceRMB}
                      onChange={(e) => handleSellingPriceRMBChange(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '140px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter overseas selling price in RMB/tonne"
                    />
                  </div>
                </td>
              </tr>

              {/* Row 2: Customs Clearance (Yellow Field in RMB) */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fcfcfd' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    Customs Clearance
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Port terminal inspection, import declaration & quarantine duties.
                  </div>
                </td>

                {/* AUD/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                    -${calculations.clearanceAud.toFixed(2)}
                  </span>
                </td>

                {/* USD/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>
                    -${calculations.clearanceUsd.toFixed(2)}
                  </span>
                </td>

                {/* RMB/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>¥</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={customsClearanceRMB}
                      onChange={(e) => setCustomsClearanceRMB(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '140px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter customs clearance cost in RMB/tonne"
                    />
                  </div>
                </td>
              </tr>

              {/* Row 3: Sea Freight (Yellow Field in AUD) */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    Sea Freight
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Ocean bulk vessel shipping or container liner booking from Australian port.
                  </div>
                </td>

                {/* AUD/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={seaFreightAUD}
                      onChange={(e) => setSeaFreightAUD(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '130px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter ocean freight cost in AUD/tonne"
                    />
                  </div>
                </td>

                {/* USD/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>
                    -${calculations.freightUsd.toFixed(2)}
                  </span>
                </td>

                {/* RMB/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ color: '#64748b' }}>
                    -¥{calculations.freightRmb.toFixed(2)}
                  </span>
                </td>
              </tr>

              {/* Row 4: Fumigation (Yellow Field in AUD) */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fcfcfd' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    Fumigation
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Bio-security export fumigation treatment (EDN or Methyl Bromide) & phyto certificate.
                  </div>
                </td>

                {/* AUD/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>$</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={fumigationAUD}
                      onChange={(e) => setFumigationAUD(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '130px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter fumigation cost in AUD/tonne"
                    />
                  </div>
                </td>

                {/* USD/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>
                    -${calculations.fumiUsd.toFixed(2)}
                  </span>
                </td>

                {/* RMB/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ color: '#64748b' }}>
                    -¥{calculations.fumiRmb.toFixed(2)}
                  </span>
                </td>
              </tr>

              {/* Row 5: Packing (Yellow Field in AUD) */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    Packing
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    Depot marshalling, container stuffing / securing, or wharf marshalling fees.
                  </div>
                </td>

                {/* AUD/t (Yellow Input Field) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={packingAUD}
                      onChange={(e) => setPackingAUD(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '130px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '2px solid #eab308',
                        backgroundColor: '#fef08a',
                        fontWeight: 800,
                        fontSize: '0.98rem',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none',
                      }}
                      title="Enter packing & stuffing cost in AUD/tonne"
                    />
                  </div>
                </td>

                {/* USD/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>
                    -${calculations.packUsd.toFixed(2)}
                  </span>
                </td>

                {/* RMB/t (Auto-converted) */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ color: '#64748b' }}>
                    -¥{calculations.packRmb.toFixed(2)}
                  </span>
                </td>
              </tr>

              {/* Row 6: Trader Commission (Optional field requested by user) */}
              <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#fffdf5' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="include-commission-toggle"
                      checked={includeCommission}
                      onChange={(e) => setIncludeCommission(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label
                      htmlFor="include-commission-toggle"
                      style={{ fontWeight: 600, color: '#92400e', cursor: 'pointer' }}
                    >
                      Trader Commission / Margin (Optional)
                    </label>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '24px', marginTop: '2px' }}>
                    Trading margin allowance deducted before formulating grower / mill purchase offer.
                  </div>
                </td>

                {/* AUD/t (Yellow Input Field if enabled) */}
                <td style={{ padding: '12px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  {includeCommission ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>$</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={traderCommissionAUD}
                        onChange={(e) => setTraderCommissionAUD(e.target.value)}
                        placeholder="0.00"
                        style={{
                          width: '130px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '2px solid #eab308',
                          backgroundColor: '#fef08a',
                          fontWeight: 800,
                          fontSize: '0.98rem',
                          color: '#0f172a',
                          textAlign: 'right',
                          outline: 'none',
                        }}
                        title="Enter trader commission in AUD/tonne"
                      />
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Disabled ($0.00)</span>
                  )}
                </td>

                {/* USD/t */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <span style={{ color: includeCommission ? '#64748b' : '#94a3b8' }}>
                    {includeCommission ? `-$${calculations.commUsd.toFixed(2)}` : '$0.00'}
                  </span>
                </td>

                {/* RMB/t */}
                <td style={{ padding: '16px 18px', textAlign: 'right', backgroundColor: '#f8fafc' }}>
                  <span style={{ color: includeCommission ? '#64748b' : '#94a3b8' }}>
                    {includeCommission ? `-¥${calculations.commRmb.toFixed(2)}` : '¥0.00'}
                  </span>
                </td>
              </tr>

              {/* Subtotal: Total Deductions Summary Row */}
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#475569' }}>
                  Total Export & Logistics Deductions
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                  -${calculations.totalDeductionsAud.toFixed(2)}/t
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                  -${calculations.totalDeductionsUsd.toFixed(2)}/t
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                  -¥{calculations.totalDeductionsRmb.toFixed(2)}/t
                </td>
              </tr>

              {/* Primary Netback Result Row: Mill Door Price */}
              <tr
                style={{
                  backgroundColor: '#f0fdf4',
                  borderBottom: '2px solid #86efac',
                }}
              >
                <td style={{ padding: '22px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                      }}
                    >
                      NET RESULT
                    </div>
                    <strong style={{ fontSize: '1.2rem', color: '#14532d' }}>
                      Mill Door Price
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#166534', marginTop: '4px' }}>
                    Maximum purchasing offer price payable to mill / forest supplier at gate.
                  </div>
                </td>

                {/* Main Highlighted Mill Door Price in AUD/t */}
                <td style={{ padding: '22px 18px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#15803d' }}>
                    ${calculations.millDoorAud.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>
                    AUD / metric tonne
                  </div>
                </td>

                {/* Mill Door Price in USD/t */}
                <td style={{ padding: '22px 18px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    ${calculations.millDoorUsd.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    USD / metric tonne
                  </div>
                </td>

                {/* Mill Door Price in RMB/t */}
                <td style={{ padding: '22px 18px', textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    ¥{calculations.millDoorRmb.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    RMB / metric tonne
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Breakdown Card / Quick Analysis */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.86rem', color: '#334155' }}>
              <strong>Netback Ratio:</strong>{' '}
              <span style={{ fontWeight: 700, color: '#0284c7' }}>
                {calculations.spAud > 0
                  ? `${((calculations.millDoorAud / calculations.spAud) * 100).toFixed(1)}%`
                  : '0%'}
              </span>{' '}
              of delivered selling price
            </div>

            {includeCommission && (
              <div style={{ fontSize: '0.86rem', color: '#334155' }}>
                <strong>Break-even (Zero Commission):</strong>{' '}
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  ${calculations.breakEvenMillDoorAud.toFixed(2)} AUD/t
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                // Reset to default standard model
                setSellingPriceUSD('145.00')
                setSellingPriceRMB('1045.00')
                setCustomsClearanceRMB('35.00')
                setSeaFreightAUD('42.00')
                setFumigationAUD('6.50')
                setPackingAUD('12.00')
                setTraderCommissionAUD('5.00')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} /> Reset Defaults
            </button>

            <button
              type="button"
              onClick={openSaveModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={14} /> Save This Scenario
            </button>
          </div>
        </div>
      </div>

      {/* Costings History Section (Persisted in Excel Workbook) */}
      <div
        id="costing-history-section"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} color="#0284c7" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Saved Costing Scenarios & Netback Audit Log
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Persisted in workbook sheet: <strong>Costings</strong> ({savedCostings.length} records).
              </p>
            </div>
          </div>
        </div>

        {savedCostings.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              No saved costing scenarios found in this workbook yet.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
              Calculate an offer above and click <strong>"Save Costing Scenario"</strong> to keep a historical record.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.86rem',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Ref & Date</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Destination / Customer</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Species / Grade</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Selling Price</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Deductions</th>
                  <th style={{ padding: '12px 16px', color: '#166534', fontWeight: 800, textAlign: 'right' }}>Mill Door Offer (AUD)</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Exchange Rates</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedCostings.map((costing, idx) => (
                  <tr
                    key={costing.CostingID || idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>
                        {costing.CostingRef || `CST-${idx + 1}`}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                        {costing.CreatedDate ? costing.CreatedDate.split(' ')[0] : '—'}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {costing.DestinationCountry || 'China'}
                      </div>
                      {costing.CustomerName && (
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {costing.CustomerName}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      {costing.GradeOrSpecies || 'Standard Grade'}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        ${costing.SellingPriceUSD.toFixed(2)} USD
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        ¥{costing.SellingPriceRMB.toFixed(2)} RMB
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#b91c1c' }}>
                      -${costing.TotalDeductionsAUD.toFixed(2)}/t
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: '#15803d',
                          backgroundColor: '#f0fdf4',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        ${costing.MillDoorPriceAUD.toFixed(2)}/t
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                      <div>AUD/USD: {costing.ExchangeRateAUD_USD.toFixed(4)}</div>
                      <div>AUD/CNY: {costing.ExchangeRateAUD_CNY.toFixed(4)}</div>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => loadScenario(costing)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Load this costing scenario into active calculator"
                        >
                          <ArrowRight size={13} /> Load
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCosting(costing.CostingID || costing.CostingRef || '')}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                          title="Delete from workbook"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Costing Modal Dialog */}
      {isSaveModalOpen && (
        <div
          id="save-costing-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            id="save-costing-modal"
            style={{
              width: 'min(100%, 540px)',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.25)',
              border: '1px solid #cbd5e1',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Save Costing to Excel Workbook
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCosting} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Summary of Active Calculation */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
                    Computed Mill Door Offer
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d' }}>
                    ${calculations.millDoorAud.toFixed(2)} AUD/tonne
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#166534' }}>
                  <div>Selling: ${calculations.spUsd.toFixed(2)} USD</div>
                  <div>Deductions: -${calculations.totalDeductionsAud.toFixed(2)} AUD</div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Costing Reference ID *
                </label>
                <input
                  type="text"
                  required
                  value={costingRef}
                  onChange={(e) => setCostingRef(e.target.value)}
                  placeholder="e.g. CST-2026-001"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Customer / Importer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Lanshan Port Forest Co. / China Buyer"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Target Log Species & Grade (Optional)
                </label>
                <input
                  type="text"
                  value={gradeOrSpecies}
                  onChange={(e) => setGradeOrSpecies(e.target.value)}
                  placeholder="e.g. Radiata Pine - A Grade / Fresh Logs"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Notes & Contract Terms (Optional)
                </label>
                <textarea
                  rows={2}
                  value={costingNotes}
                  onChange={(e) => setCostingNotes(e.target.value)}
                  placeholder="e.g. Port of Portland loading, 40ft containerized, payment LC at sight"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    backgroundColor: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <Save size={15} /> Save to Workbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
