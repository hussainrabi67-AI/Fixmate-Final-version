import { useState } from 'react'
import type { ChartDataPoint } from '../../lib/adminService'
import { Star, ShieldCheck, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export function LineTrendChart({ data }: { data: ChartDataPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-medium text-ink/40">
        No trend data available
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 4)
  const height = 150
  const width = 500
  const paddingX = 28
  const paddingTop = 20
  const paddingBottom = 28

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1 || 1)) * (width - paddingX * 2)
    const y = paddingTop + (1 - d.value / maxValue) * (height - paddingTop - paddingBottom)
    return { x, y, value: d.value, label: d.label }
  })

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    return `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`

  return (
    <div className="w-full">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + (1 - ratio) * (height - paddingTop - paddingBottom)
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#EDE9FE"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )
          })}

          {/* Shaded Area with smooth animation */}
          <path d={areaD} fill="url(#trendAreaGradient)" className="transition-all duration-700" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#7C3AED"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-700"
          />

          {/* Data Points */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill="#FFFFFF"
                  stroke="#7C3AED"
                  strokeWidth="2.5"
                  className="transition-all duration-200 shadow-sm"
                />

                {isHovered && (
                  <g className="animate-in fade-in zoom-in-95 duration-150">
                    <rect
                      x={p.x - 26}
                      y={p.y - 32}
                      width="52"
                      height="22"
                      rx="6"
                      fill="#1E1B4B"
                      className="shadow-lift"
                    />
                    <text
                      x={p.x}
                      y={p.y - 17}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-white tabular-nums"
                    >
                      {p.value} reqs
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-1 flex justify-between px-2 text-[11px] font-medium text-ink/50 tabular-nums">
        {data.map((d, i) => (
          <span key={i} className="truncate">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function CategoryBarChart({ data }: { data: ChartDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-medium text-ink/40">
        No category demand recorded yet
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-3 pt-1">
      {data.map((item, idx) => {
        const percentage = Math.round((item.value / maxValue) * 100)
        return (
          <div key={idx} className="space-y-1 group">
            <div className="flex items-center justify-between text-xs font-medium text-ink">
              <span className="truncate group-hover:text-primary transition-colors">{item.label}</span>
              <span className="tabular-nums font-semibold text-ink/70">
                {item.value} {item.value === 1 ? 'request' : 'requests'}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
                style={{
                  width: `${Math.max(percentage, 5)}%`,
                  backgroundColor: item.color || '#7C3AED',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DonutChart({
  data,
  totalLabel = 'Total',
}: {
  data: ChartDataPoint[]
  totalLabel?: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-medium text-ink/40">
        No distribution records available
      </div>
    )
  }

  let accumulatedAngle = 0
  const size = 140
  const center = size / 2
  const radius = 50
  const strokeWidth = 16

  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const angle = (d.value / total) * 360
      const startAngle = accumulatedAngle
      accumulatedAngle += angle

      const circumference = 2 * Math.PI * radius
      const strokeDasharray = `${(angle / 360) * circumference} ${circumference}`
      const strokeDashoffset = -((startAngle / 360) * circumference)

      return {
        ...d,
        strokeDasharray,
        strokeDashoffset,
        percentage: Math.round((d.value / total) * 100),
      }
    })

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      {/* SVG Donut */}
      <div className="relative flex h-32 w-32 shrink-0 items-center justify-center group">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {slices.map((s, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={s.color || '#7C3AED'}
              strokeWidth={strokeWidth}
              strokeDasharray={s.strokeDasharray}
              strokeDashoffset={s.strokeDashoffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out hover:opacity-90"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black tabular-nums tracking-tight text-ink group-hover:scale-110 transition-transform">
            {total}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/45">
            {totalLabel}
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-1 gap-1.5 text-xs">
        {slices.map((s, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 group">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full group-hover:scale-125 transition-transform"
                style={{ backgroundColor: s.color || '#7C3AED' }}
              />
              <span className="truncate font-medium text-ink/75 group-hover:text-ink transition-colors">
                {s.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold tabular-nums text-ink shrink-0">
              <span>{s.value}</span>
              <span className="text-[10px] font-normal text-ink/40">({s.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================================
   SPECIALIZED DECORATIVE CHARTS FOR DEDICATED ADMIN PAGES
   ========================================================================= */

/** 1. User Roles & Distribution Gauge (for Users Page) */
export function UserDistributionCard({
  totalUsers,
  customersCount,
  techniciansCount,
  adminsCount,
}: {
  totalUsers: number
  customersCount: number
  techniciansCount: number
  adminsCount: number
}) {
  const customerPct = totalUsers ? Math.round((customersCount / totalUsers) * 100) : 0
  const techPct = totalUsers ? Math.round((techniciansCount / totalUsers) * 100) : 0
  const adminPct = totalUsers ? Math.round((adminsCount / totalUsers) * 100) : 0

  return (
    <div className="card p-5 bg-gradient-to-br from-white to-purple-50/30">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/80">Account Composition</h4>
          <p className="text-[11px] text-ink/50">Platform user role segmentation</p>
        </div>
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 tabular-nums">
          {totalUsers} Registered
        </span>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="mt-4">
        <div className="h-3.5 w-full flex overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200">
          <div
            style={{ width: `${customerPct}%` }}
            className="bg-blue-500 rounded-l-full transition-all duration-700 hover:brightness-110"
            title={`Customers: ${customersCount} (${customerPct}%)`}
          />
          <div
            style={{ width: `${techPct}%` }}
            className="bg-purple-600 transition-all duration-700 hover:brightness-110"
            title={`Technicians: ${techniciansCount} (${techPct}%)`}
          />
          <div
            style={{ width: `${adminPct}%` }}
            className="bg-rose-500 rounded-r-full transition-all duration-700 hover:brightness-110"
            title={`Admins: ${adminsCount} (${adminPct}%)`}
          />
        </div>

        {/* 3 Metric Pills */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50/70 p-3 ring-1 ring-blue-100">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Customers</span>
            <p className="mt-1 text-lg font-black tabular-nums text-ink">{customersCount}</p>
            <span className="text-[10px] text-ink/40 font-medium">{customerPct}% of total</span>
          </div>

          <div className="rounded-xl bg-purple-50/70 p-3 ring-1 ring-purple-100">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Technicians</span>
            <p className="mt-1 text-lg font-black tabular-nums text-ink">{techniciansCount}</p>
            <span className="text-[10px] text-ink/40 font-medium">{techPct}% of total</span>
          </div>

          <div className="rounded-xl bg-rose-50/70 p-3 ring-1 ring-rose-100">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Admins</span>
            <p className="mt-1 text-lg font-black tabular-nums text-ink">{adminsCount}</p>
            <span className="text-[10px] text-ink/40 font-medium">{adminPct}% of total</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 2. Technician Verification Funnel (for Technicians Page) */
export function TechnicianVerificationFunnel({
  total,
  approved,
  pending,
  rejected,
}: {
  total: number
  approved: number
  pending: number
  rejected: number
}) {
  const approvedPct = total ? Math.round((approved / total) * 100) : 0
  const pendingPct = total ? Math.round((pending / total) * 100) : 0
  const rejectedPct = total ? Math.round((rejected / total) * 100) : 0

  return (
    <div className="card p-5 bg-gradient-to-br from-white to-amber-50/20">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/80">Provider Verification Status</h4>
          <p className="text-[11px] text-ink/50">Marketplace screening & qualification status</p>
        </div>
        {pending > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
            <Clock className="h-3 w-3" /> {pending} Action Needed
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-200/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold shrink-0 shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Approved / Active</span>
            <p className="text-lg font-black tabular-nums text-ink">{approved}</p>
            <span className="text-[10px] text-ink/40 font-medium">{approvedPct}% verified</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50/80 p-3 ring-1 ring-amber-200/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold shrink-0 shadow-sm">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Awaiting Review</span>
            <p className="text-lg font-black tabular-nums text-ink">{pending}</p>
            <span className="text-[10px] text-ink/40 font-medium">{pendingPct}% queue</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-rose-50/80 p-3 ring-1 ring-rose-200/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 text-white font-bold shrink-0 shadow-sm">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Rejected</span>
            <p className="text-lg font-black tabular-nums text-ink">{rejected}</p>
            <span className="text-[10px] text-ink/40 font-medium">{rejectedPct}% disqualified</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 3. Star Rating Breakdown Histogram (for Reviews Page) */
export function ReviewRatingHistogram({
  reviews,
}: {
  reviews: Array<{ rating: number }>
}) {
  const total = reviews.length
  const avg = total
    ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / total).toFixed(1)
    : '0.0'

  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  reviews.forEach((r) => {
    const star = Math.min(Math.max(Math.round(r.rating || 0), 1), 5)
    counts[star] = (counts[star] || 0) + 1
  })

  return (
    <div className="card p-5 bg-gradient-to-br from-white to-amber-50/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/80">Satisfaction & Ratings Breakdown</h4>
          <p className="text-[11px] text-ink/50">Aggregated feedback across all customer bookings</p>
        </div>

        <div className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-2 ring-1 ring-amber-200">
          <div className="text-center">
            <span className="text-2xl font-black tabular-nums text-amber-700 leading-none">{avg}</span>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3 w-3 ${
                    s <= Math.round(Number(avg)) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="border-l border-amber-200 pl-3 text-left">
            <span className="text-xs font-bold text-ink block tabular-nums">{total} Reviews</span>
            <span className="text-[10px] text-ink/50 font-medium">100% Real Supabase Data</span>
          </div>
        </div>
      </div>

      {/* 5-star to 1-star rows */}
      <div className="mt-4 space-y-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = counts[star] || 0
          const pct = total ? Math.round((count / total) * 100) : 0
          return (
            <div key={star} className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 w-12 shrink-0 font-bold text-ink/80">
                <span>{star}</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              </div>

              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="w-16 text-right tabular-nums text-[11px] font-semibold text-ink/70">
                {count} <span className="text-ink/40 font-normal">({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 4. Complaint Resolution Rate Gauge (for Complaints Page) */
export function ComplaintResolutionMetrics({
  total,
  open,
  underReview,
  resolved,
  closed,
}: {
  total: number
  open: number
  underReview: number
  resolved: number
  closed: number
}) {
  const resolvedCount = resolved + closed
  const resolutionRate = total ? Math.round((resolvedCount / total) * 100) : 100

  return (
    <div className="card p-5 bg-gradient-to-br from-white to-rose-50/20">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink/80">Dispute & Complaint Metrics</h4>
          <p className="text-[11px] text-ink/50">Customer satisfaction & grievance resolution progress</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
          open > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {open > 0 ? `${open} Open Disputes` : 'All Clear'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-rose-50/80 p-3 ring-1 ring-rose-200">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Open</span>
          <p className="mt-1 text-xl font-black tabular-nums text-ink">{open}</p>
          <span className="text-[10px] text-ink/40 font-medium">Needs response</span>
        </div>

        <div className="rounded-xl bg-amber-50/80 p-3 ring-1 ring-amber-200">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Under Review</span>
          <p className="mt-1 text-xl font-black tabular-nums text-ink">{underReview}</p>
          <span className="text-[10px] text-ink/40 font-medium">In investigation</span>
        </div>

        <div className="rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-200">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Resolved</span>
          <p className="mt-1 text-xl font-black tabular-nums text-ink">{resolved}</p>
          <span className="text-[10px] text-ink/40 font-medium">Action taken</span>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <span className="text-[10px] font-bold text-ink/60 uppercase tracking-wider block">Resolution Rate</span>
          <p className="mt-1 text-xl font-black tabular-nums text-emerald-600">{resolutionRate}%</p>
          <span className="text-[10px] text-ink/40 font-medium">{resolvedCount} of {total} closed</span>
        </div>
      </div>
    </div>
  )
}
