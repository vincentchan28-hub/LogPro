import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'

type Currency = 'USD' | 'CNY'
type Range = '1M' | '6M'

type RatePoint = {
  date: string
  USD: number
  CNY: number
}

// CNY is the official code for the yuan. On screen we call it RMB.
const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'USD',
  CNY: 'RMB',
}

// Size of the drawing area (the chart scales to fit the panel).
const CHART_WIDTH = 480
const CHART_HEIGHT = 104
const PAD_LEFT = 46
const PAD_RIGHT = 10
const PAD_TOP = 8
const PAD_BOTTOM = 22

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

function shortDate(isoText: string): string {
  const date = new Date(`${isoText}T00:00:00`)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function longDate(isoText: string): string {
  const date = new Date(`${isoText}T00:00:00`)
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Asks the free Frankfurter service for AUD rates between a past date and today.
async function loadHistory(daysBack: number): Promise<RatePoint[]> {
  const url = `https://api.frankfurter.dev/v1/${daysAgo(daysBack)}..${isoDate(new Date())}?base=AUD&symbols=USD,CNY`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`The rate service answered with status ${response.status}`)
  }

  const data = await response.json()
  const rates = data && data.rates ? data.rates : {}

  const points: RatePoint[] = Object.keys(rates)
    .sort()
    .map((date) => ({
      date,
      USD: Number(rates[date].USD),
      CNY: Number(rates[date].CNY),
    }))

  return points.filter((point) => point.USD > 0 && point.CNY > 0)
}

export default function RateTrendChart() {
  const [currency, setCurrency] = useState<Currency>('USD')
  const [range, setRange] = useState<Range>('1M')
  const [month, setMonth] = useState<RatePoint[]>([])
  const [sixMonths, setSixMonths] = useState<RatePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([loadHistory(30), loadHistory(182)])
      .then(([monthPoints, sixMonthPoints]) => {
        if (cancelled) {
          return
        }
        setMonth(monthPoints)
        setSixMonths(sixMonthPoints)
        setError('')
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'LogPro could not load the past exchange rates. Check your internet connection and try again.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setLoading(true)
    setError('')
    setAttempt((current) => current + 1)
  }

  const points = range === '1M' ? month : sixMonths

  // Works out the line, the grid lines and the summary numbers.
  const chart = useMemo(() => {
    if (points.length < 2) {
      return null
    }

    const values = points.map((point) => point[currency])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = (max - min) * 0.15 || max * 0.01
    const low = min - padding
    const high = max + padding
    const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
    const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM

    const xs = values.map(
      (_value, index) => PAD_LEFT + (index / (values.length - 1)) * innerWidth,
    )
    const ys = values.map(
      (value) => PAD_TOP + (1 - (value - low) / (high - low)) * innerHeight,
    )

    const line = xs
      .map((x, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[index].toFixed(1)}`)
      .join(' ')
    const baseY = PAD_TOP + innerHeight
    const area = `${line} L${xs[xs.length - 1].toFixed(1)},${baseY} L${xs[0].toFixed(1)},${baseY} Z`

    const ticks = [0, 1, 2].map((step) => {
      const value = low + ((high - low) * step) / 2
      return {
        value,
        y: PAD_TOP + (1 - (value - low) / (high - low)) * innerHeight,
      }
    })

    const first = values[0]
    const last = values[values.length - 1]
    const average = values.reduce((sum, value) => sum + value, 0) / values.length

    return {
      values,
      xs,
      ys,
      line,
      area,
      ticks,
      min,
      max,
      first,
      last,
      average,
      change: last - first,
      changePercent: ((last - first) / first) * 100,
    }
  }, [points, currency])

  function handleMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (points.length < 2) {
      return
    }

    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * CHART_WIDTH
    const share = (x - PAD_LEFT) / (CHART_WIDTH - PAD_LEFT - PAD_RIGHT)
    const index = Math.round(share * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  const label = CURRENCY_LABELS[currency]
  const shownIndex =
    hoverIndex !== null && hoverIndex < points.length
      ? hoverIndex
      : points.length - 1
  const midIndex = Math.floor((points.length - 1) / 2)

  return (
    <div className="rate-trend">
      <div className="rate-trend-controls">
        <div className="segmented-wrap">
          <span>Show:</span>
          <div className="segmented">
            <button
              type="button"
              className={currency === 'USD' ? 'selected' : ''}
              onClick={() => setCurrency('USD')}
            >
              AUD → USD
            </button>
            <button
              type="button"
              className={currency === 'CNY' ? 'selected' : ''}
              onClick={() => setCurrency('CNY')}
            >
              AUD → RMB
            </button>
          </div>
        </div>

        <div className="segmented-wrap">
          <span>Period:</span>
          <div className="segmented">
            <button
              type="button"
              className={range === '1M' ? 'selected' : ''}
              onClick={() => setRange('1M')}
            >
              1 month
            </button>
            <button
              type="button"
              className={range === '6M' ? 'selected' : ''}
              onClick={() => setRange('6M')}
            >
              6 months
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="muted">Loading the past exchange rates…</p>}

      {!loading && error && (
        <>
          <p className="notice notice-error">{error}</p>
          <button type="button" className="secondary-button" onClick={retry}>
            Try again
          </button>
        </>
      )}

      {!loading && !error && !chart && (
        <p className="muted">There is not enough rate history to draw a chart.</p>
      )}

      {!loading && !error && chart && (
        <>
          <div className="rate-trend-stats">
            <div className="rate-trend-stat">
              <span>Latest</span>
              <strong>{chart.last.toFixed(4)}</strong>
            </div>
            <div className="rate-trend-stat">
              <span>Change over period</span>
              <strong style={{ color: chart.change >= 0 ? '#15803d' : '#b91c1c' }}>
                {chart.change >= 0 ? '+' : ''}
                {chart.change.toFixed(4)} ({chart.changePercent >= 0 ? '+' : ''}
                {chart.changePercent.toFixed(2)}%)
              </strong>
            </div>
            <div className="rate-trend-stat">
              <span>Highest</span>
              <strong>{chart.max.toFixed(4)}</strong>
            </div>
            <div className="rate-trend-stat">
              <span>Lowest</span>
              <strong>{chart.min.toFixed(4)}</strong>
            </div>
            <div className="rate-trend-stat">
              <span>Average</span>
              <strong>{chart.average.toFixed(4)}</strong>
            </div>
          </div>

          <p className="rate-trend-reading">
            {longDate(points[shownIndex].date)}: 1 AUD ={' '}
            {chart.values[shownIndex].toFixed(4)} {label}
          </p>

          <svg
            className="rate-trend-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Line chart of 1 AUD in ${label}`}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {chart.ticks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={PAD_LEFT}
                  x2={CHART_WIDTH - PAD_RIGHT}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={PAD_LEFT - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {tick.value.toFixed(currency === 'USD' ? 4 : 3)}
                </text>
              </g>
            ))}

            <path d={chart.area} fill="rgba(2, 132, 199, 0.12)" />
            <path
              d={chart.line}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <line
              x1={chart.xs[shownIndex]}
              x2={chart.xs[shownIndex]}
              y1={PAD_TOP}
              y2={CHART_HEIGHT - PAD_BOTTOM}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <circle
              cx={chart.xs[shownIndex]}
              cy={chart.ys[shownIndex]}
              r="5"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2"
            />

            <text
              x={PAD_LEFT}
              y={CHART_HEIGHT - 8}
              textAnchor="start"
              fontSize="11"
              fill="#64748b"
            >
              {shortDate(points[0].date)}
            </text>
            <text
              x={chart.xs[midIndex]}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {shortDate(points[midIndex].date)}
            </text>
            <text
              x={CHART_WIDTH - PAD_RIGHT}
              y={CHART_HEIGHT - 8}
              textAnchor="end"
              fontSize="11"
              fill="#64748b"
            >
              {shortDate(points[points.length - 1].date)}
            </text>
          </svg>

          <p className="muted small">
            Rising line = stronger Australian dollar. Source: European Central
            Bank reference rates, via
            frankfurter.dev. Published on business days.
          </p>
        </>
      )}
    </div>
  )
}