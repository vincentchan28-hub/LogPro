import { useEffect, useMemo, useState, useCallback } from 'react'
import './costing.css'
import {
  COUNTRIES,
  CURRENCY_LABELS,
  amountToText,
  calculate,
  convert,
  formatDateTime,
  formatMoney,
  ownRatesFromLive,
  parseAmount,
  ratesFromOwn,
  round2,
  round6,
  type CostingInput,
  type CostingRecord,
  type CurrencyCode,
  type Rates,
  type RatesResult,
} from './costing'

type FieldKey =
  | 'selling'
  | 'clearance'
  | 'seaFreight'
  | 'transport'
  | 'fumigation'
  | 'packing'
  | 'commission'

type FieldValues = Record<FieldKey, string>

const emptyValues: FieldValues = {
  selling: '',
  clearance: '',
  seaFreight: '',
  transport: '',
  fumigation: '',
  packing: '',
  commission: '',
}

// Only used while the user types their own rates and no live rates exist.
const placeholderRates: Rates = { AUD: 1, USD: 1, CNY: 1, JPY: 1, KRW: 1 }

const restartMessage =
  'LogPro needs to be restarted to use this. Close the app, press Ctrl+C in the VS Code terminal, then run: npm run dev'

function failedRates(message: string): RatesResult {
  return {
    ok: false,
    error: message,
    sourceName: '',
    sourceUrl: '',
    rateDate: '',
    perAud: null,
    problems: [],
  }
}

// A short name for the "Rates from" column of the saved costings.
function shortSource(text: string): string {
  if (text.includes('(RBA)')) {
    return 'RBA'
  }

  if (text.includes('(ECB)')) {
    return 'ECB'
  }

  if (text.startsWith('Own')) {
    return 'Own rates'
  }

  return text
}

// Only lets digits and one decimal point through.
function acceptNumber(text: string, apply: (accepted: string) => void) {
  if (/^\d*\.?\d*$/.test(text)) {
    apply(text)
  }
}

type MoneyRowProps = {
  label: string
  hint?: string
  amountAud: number
  currencies: CurrencyCode[]
  rates: Rates | null
  // When set, the yellow box sits in this currency's column.
  entry?: {
    currency: CurrencyCode
    value: string
    onChange: (text: string) => void
  }
  style?: 'total' | 'result'
}

function MoneyRow({
  label,
  hint,
  amountAud,
  currencies,
  rates,
  entry,
  style,
}: MoneyRowProps) {
  return (
    <tr className={style ? `row-${style}` : ''}>
      <th scope="row">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </th>

      {currencies.map((currency) => {
        if (entry && entry.currency === currency) {
          return (
            <td key={currency} className="cell-entry">
              <input
                className="yellow-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={entry.value}
                onChange={(event) => entry.onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const inputs = Array.from(
                      document.querySelectorAll<HTMLInputElement>(
                        '.costing-table .yellow-input',
                      ),
                    )
                    const currentIndex = inputs.indexOf(event.currentTarget)

                    if (currentIndex >= 0) {
                      inputs[currentIndex + 1]?.focus()
                    }
                  }
                }}
                aria-label={`${label} in ${CURRENCY_LABELS[currency]}`}
              />
            </td>
          )
        }

        if (!rates) {
          return <td key={currency}>—</td>
        }

        const shown = amountAud * rates[currency]

        return (
          <td key={currency} className={shown < 0 ? 'negative' : ''}>
            {formatMoney(shown, currency)}
          </td>
        )
      })}
    </tr>
  )
}

type CostingPageProps = {
  workbookPath: string
}

export default function CostingPage({ workbookPath }: CostingPageProps) {
  const [countryName, setCountryName] = useState(COUNTRIES[0].name)
  const [label, setLabel] = useState('')
  const [values, setValues] = useState<FieldValues>(emptyValues)
  const [sellingIn, setSellingIn] = useState<'USD' | 'LOCAL'>('USD')

  const [live, setLive] = useState<RatesResult | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [useOwnRates, setUseOwnRates] = useState(false)
  const [ownAudPerUsd, setOwnAudPerUsd] = useState('')
  const [ownLocalPerUsd, setOwnLocalPerUsd] = useState('')

  const [history, setHistory] = useState<CostingRecord[]>([])
  const [historyError, setHistoryError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const country =
    COUNTRIES.find((item) => item.name === countryName) ?? COUNTRIES[0]
  const local = country.currency
  const localIsUsd = local === 'USD'
  const currencies: CurrencyCode[] = localIsUsd
    ? ['AUD', 'USD']
    : ['AUD', 'USD', local]
  const sellingCurrency: CurrencyCode =
    sellingIn === 'USD' || localIsUsd ? 'USD' : local

  const liveRates = live && live.ok && live.perAud ? live.perAud : null

  const rates = useMemo<Rates | null>(() => {
    if (useOwnRates) {
      return ratesFromOwn(
        liveRates ?? placeholderRates,
        local,
        parseAmount(ownAudPerUsd),
        parseAmount(ownLocalPerUsd),
      )
    }

    return liveRates
  }, [useOwnRates, liveRates, local, ownAudPerUsd, ownLocalPerUsd])

  const result = useMemo(() => {
    if (!rates) {
      return null
    }

    return calculate(
      {
        localCurrency: local,
        sellingCurrency,
        selling: parseAmount(values.selling),
        clearance: parseAmount(values.clearance),
        seaFreight: parseAmount(values.seaFreight),
        transport: parseAmount(values.transport),
        fumigation: parseAmount(values.fumigation),
        packing: parseAmount(values.packing),
        commission: parseAmount(values.commission),
      },
      rates,
    )
  }, [rates, local, sellingCurrency, values])

  const loadRates = useCallback(async () => {
    if (typeof window.logPro?.getRates !== 'function') {
      setLive(failedRates(restartMessage))
      setRatesLoading(false)
      return
    }

    setRatesLoading(true)

    try {
      setLive(await window.logPro.getRates())
    } catch {
      setLive(failedRates('LogPro could not ask for exchange rates.'))
    } finally {
      setRatesLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    if (typeof window.logPro?.listCostings !== 'function') {
      setHistoryError(restartMessage)
      return
    }

    try {
      const response = await window.logPro.listCostings(workbookPath)
      setHistory(response.costings)
      setHistoryError(response.error)
    } catch {
      setHistoryError('LogPro could not load the saved costings.')
    }
  }, [workbookPath])

  useEffect(() => {
    void loadRates()
    void loadHistory()
  }, [loadRates, loadHistory])

  function setField(key: FieldKey, text: string) {
    acceptNumber(text, (accepted) =>
      setValues((current) => ({ ...current, [key]: accepted })),
    )
  }

  function changeCountry(name: string) {
    setCountryName(name)
    setSellingIn('USD')
    setUseOwnRates(false)
    setValues((current) => ({ ...current, selling: '', clearance: '' }))
    setSaveMessage('')
    setSaveError('')
  }

  function changeSellingIn(next: 'USD' | 'LOCAL') {
    if (next === sellingIn) {
      return
    }

    const nextCurrency: CurrencyCode = next === 'USD' ? 'USD' : local
    const amount = parseAmount(values.selling)

    // Convert what is already typed, so the price stays the same.
    if (rates && amount > 0) {
      const converted = convert(amount, sellingCurrency, nextCurrency, rates)
      setValues((current) => ({
        ...current,
        selling: amountToText(converted, nextCurrency),
      }))
    }

    setSellingIn(next)
  }

  function toggleOwnRates(checked: boolean) {
    if (checked) {
      if (liveRates) {
        const start = ownRatesFromLive(liveRates, local)
        setOwnAudPerUsd(start.audPerUsd.toFixed(4))
        setOwnLocalPerUsd(localIsUsd ? '' : start.localPerUsd.toFixed(4))
      } else {
        setOwnAudPerUsd('')
        setOwnLocalPerUsd('')
      }
    }

    setUseOwnRates(checked)
  }

  async function handleSave() {
    setSaveMessage('')
    setSaveError('')

    if (!rates || !result) {
      setSaveError('There are no exchange rates yet, so nothing can be saved.')
      return
    }

    if (parseAmount(values.selling) <= 0) {
      setSaveError('Type a selling price first.')
      return
    }

    if (typeof window.logPro?.saveCosting !== 'function') {
      setSaveError(restartMessage)
      return
    }

    const record: CostingInput = {
      Label: label.trim(),
      DestinationCountry: country.name,
      LocalCurrency: CURRENCY_LABELS[local],
      SellingPriceUSD: round2(result.sellingAud * rates.USD),
      SellingPriceLocal: round2(result.sellingAud * rates[local]),
      SellingPriceAUD: round2(result.sellingAud),
      ClearanceAUD: round2(result.clearanceAud),
      SeaFreightAUD: round2(result.seaFreightAud),
      TransportAUD: round2(result.transportAud),
      FumigationAUD: round2(result.fumigationAud),
      PackingAUD: round2(result.packingAud),
      TotalCostsAUD: round2(result.totalCostsAud),
      MaxAffordableOfferAUD: round2(result.breakEvenAud),
      MaxAffordableOfferUSD: round2(result.breakEvenAud * rates.USD),
      TraderCommissionAUD: round2(result.commissionAud),
      RecommendedOfferAUD: round2(result.recommendedAud),
      RecommendedOfferUSD: round2(result.recommendedAud * rates.USD),
      AudPerUsd: round6(1 / rates.USD),
      LocalPerUsd: round6(rates[local] / rates.USD),
      RateSource: useOwnRates
        ? 'Own rates typed in by the user'
        : (live?.sourceName ?? ''),
      RateDate: useOwnRates
        ? new Date().toISOString().slice(0, 10)
        : (live?.rateDate ?? ''),
    }

    setIsSaving(true)

    try {
      const response = await window.logPro.saveCosting(workbookPath, record)

      if (response.error) {
        setSaveError(response.error)
        return
      }

      setHistory(response.costings)
      setSaveMessage(
        `Saved as ${response.costings[0]?.CostingReference ?? 'a new costing'}.`,
      )
    } catch {
      setSaveError(restartMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const localLabel = CURRENCY_LABELS[local]
  const localDecimals = local === 'JPY' || local === 'KRW' ? 2 : 4
  const tooExpensive = result !== null && result.recommendedAud < 0

  return (
    <section className="page-content costing-page">
      <div className="page-heading">
        <div>
          <h2>Costing</h2>
          <p>
            Start with the selling price and take off every cost, to see the
            most you can offer for logs at the mill door. All amounts are per
            tonne.
          </p>
        </div>
      </div>

      <div className="costing-card">
        <div className="costing-top">
          <label className="field-label">
            Destination country
            <select
              className="field-input"
              value={country.name}
              onChange={(event) => changeCountry(event.target.value)}
            >
              {COUNTRIES.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Reference or note (optional)
            <input
              className="field-input"
              type="text"
              maxLength={200}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Example: China A-Grade - Rizhao Port"
            />
          </label>
        </div>
      </div>

      <div className="costing-card">
        <div className="card-heading">
          <h3>Exchange rates</h3>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadRates()}
            disabled={ratesLoading}
          >
            {ratesLoading ? 'Getting rates…' : 'Refresh rates'}
          </button>
        </div>

        {ratesLoading && !live && <p className="muted">Getting the latest rates…</p>}

        {liveRates && live && (
          <p className="rate-source">
            <strong>{useOwnRates ? 'Live rates (not in use):' : 'Source:'}</strong>{' '}
            {live.sourceName}
            <br />
            <strong>Rates dated:</strong> {live.rateDate}
          </p>
        )}

        {live && live.ok && live.problems.length > 0 && (
          <p className="notice notice-warn">
            The first rate source could not be read, so the next one was used
            instead ({live.problems.join('; ')}).
          </p>
        )}

        {live && !live.ok && <p className="notice notice-error">{live.error}</p>}

        {rates && (
          <p className="rate-line">
            1 AUD = {rates.USD.toFixed(4)} USD
            {!localIsUsd && (
              <>
                {' '}
                &nbsp;•&nbsp; 1 AUD = {rates[local].toFixed(localDecimals)}{' '}
                {localLabel}
              </>
            )}
            {useOwnRates && <span className="status-pill">Your own rates</span>}
          </p>
        )}

        <label className="check-label">
          <input
            type="checkbox"
            checked={useOwnRates}
            onChange={(event) => toggleOwnRates(event.target.checked)}
          />
          Use my own exchange rates (for example, my bank&apos;s rate)
        </label>

        {useOwnRates && (
          <div className="own-rates">
            <label className="own-rate-label">
              1 USD =
              <input
                className="yellow-input"
                type="text"
                inputMode="decimal"
                value={ownAudPerUsd}
                onChange={(event) =>
                  acceptNumber(event.target.value, setOwnAudPerUsd)
                }
              />
              AUD
            </label>

            {!localIsUsd && (
              <label className="own-rate-label">
                1 USD =
                <input
                  className="yellow-input"
                  type="text"
                  inputMode="decimal"
                  value={ownLocalPerUsd}
                  onChange={(event) =>
                    acceptNumber(event.target.value, setOwnLocalPerUsd)
                  }
                />
                {localLabel}
              </label>
            )}
          </div>
        )}

        <p className="muted small">
          Rates are published once each business day. They are a guide, not a
          bank&apos;s exact rate.
        </p>
      </div>

      <div className="costing-card">
        <div className="card-heading">
          <h3>Work backwards from the selling price</h3>

          {!localIsUsd && (
            <div className="segmented-wrap">
              <span>Type the selling price in:</span>
              <div className="segmented">
                <button
                  type="button"
                  className={sellingIn === 'USD' ? 'selected' : ''}
                  onClick={() => changeSellingIn('USD')}
                >
                  USD
                </button>
                <button
                  type="button"
                  className={sellingIn === 'LOCAL' ? 'selected' : ''}
                  onClick={() => changeSellingIn('LOCAL')}
                >
                  {localLabel}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="muted small">
          Type only in the yellow boxes. The other columns fill in by
          themselves.
        </p>

        <div className="table-scroll">
          <table className="costing-table">
            <colgroup>
              <col style={{ width: '42%' }} />
              {currencies.map((c) => (
                <col
                  key={c}
                  style={{ width: `${Math.round(58 / currencies.length)}%` }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Per tonne</th>
                {currencies.map((currency) => (
                  <th key={currency} scope="col">
                    {CURRENCY_LABELS[currency]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MoneyRow
                label={`Selling price in ${country.name}`}
                amountAud={result?.sellingAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: sellingCurrency,
                  value: values.selling,
                  onChange: (text) => setField('selling', text),
                }}
              />
              <MoneyRow
                label="Less: Customs clearance"
                amountAud={result?.clearanceAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: local,
                  value: values.clearance,
                  onChange: (text) => setField('clearance', text),
                }}
              />
              <MoneyRow
                label="Less: Sea freight"
                amountAud={result?.seaFreightAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: 'AUD',
                  value: values.seaFreight,
                  onChange: (text) => setField('seaFreight', text),
                }}
              />
              <MoneyRow
                label="Less: Transport"
                hint="Trucking to the port"
                amountAud={result?.transportAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: 'AUD',
                  value: values.transport,
                  onChange: (text) => setField('transport', text),
                }}
              />
              <MoneyRow
                label="Less: Fumigation"
                amountAud={result?.fumigationAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: 'AUD',
                  value: values.fumigation,
                  onChange: (text) => setField('fumigation', text),
                }}
              />
              <MoneyRow
                label="Less: Packing"
                amountAud={result?.packingAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: 'AUD',
                  value: values.packing,
                  onChange: (text) => setField('packing', text),
                }}
              />
              <MoneyRow
                label="Total costs"
                amountAud={result?.totalCostsAud ?? 0}
                currencies={currencies}
                rates={rates}
                style="total"
              />
              <MoneyRow
                label="Break-even mill door price"
                hint="The most you could pay and still break even (maximum affordable offer)"
                amountAud={result?.breakEvenAud ?? 0}
                currencies={currencies}
                rates={rates}
                style="total"
              />
              <MoneyRow
                label="Less: Trader commission (optional)"
                amountAud={result?.commissionAud ?? 0}
                currencies={currencies}
                rates={rates}
                entry={{
                  currency: 'AUD',
                  value: values.commission,
                  onChange: (text) => setField('commission', text),
                }}
              />
              <MoneyRow
                label="Recommended offer to the supplier"
                hint="Mill door price, per tonne"
                amountAud={result?.recommendedAud ?? 0}
                currencies={currencies}
                rates={rates}
                style="result"
              />
            </tbody>
          </table>
        </div>

        {tooExpensive && (
          <p className="notice notice-error">
            The costs and commission are higher than the selling price, so
            there is nothing left to offer a supplier at these numbers.
          </p>
        )}
      </div>

      <div className="costing-card">
        <div className="card-heading">
          <h3>Save this costing</h3>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !rates}
          >
            {isSaving ? 'Saving…' : 'Save Costing'}
          </button>
        </div>

        {saveMessage && <p className="notice notice-ok">{saveMessage}</p>}
        {saveError && <p className="notice notice-error">{saveError}</p>}

        <p className="muted small">
          Saving keeps the numbers and the exchange rates used, so you can look
          back at them later.
        </p>
      </div>

      <div className="costing-card">
        <div className="card-heading">
          <h3>Saved costings</h3>
        </div>

        {historyError && <p className="notice notice-error">{historyError}</p>}

        {history.length === 0 && !historyError ? (
          <p className="muted">No costings saved yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="costing-table history-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Note</th>
                  <th scope="col">Country</th>
                  <th scope="col">Selling (USD)</th>
                  <th scope="col">Total costs (AUD)</th>
                  <th scope="col">Break-even (AUD)</th>
                  <th scope="col">Commission (AUD)</th>
                  <th scope="col">Offer (AUD)</th>
                  <th scope="col">Rates from</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.CostingReference}>
                    <th scope="row">{item.CostingReference}</th>
                    <td>{formatDateTime(item.CreatedAt)}</td>
                    <td>{item.Label || '—'}</td>
                    <td>{item.DestinationCountry}</td>
                    <td>{formatMoney(item.SellingPriceUSD, 'USD')}</td>
                    <td>{formatMoney(item.TotalCostsAUD, 'AUD')}</td>
                    <td>{formatMoney(item.MaxAffordableOfferAUD, 'AUD')}</td>
                    <td>{formatMoney(item.TraderCommissionAUD, 'AUD')}</td>
                    <td className={item.RecommendedOfferAUD < 0 ? 'negative' : ''}>
                      {formatMoney(item.RecommendedOfferAUD, 'AUD')}
                    </td>
                    <td>
                      {shortSource(item.RateSource)} ({item.RateDate})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}