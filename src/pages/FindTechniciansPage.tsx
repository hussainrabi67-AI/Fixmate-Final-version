import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Loader2, AlertCircle, ArrowLeft,
  MapPin, ShieldCheck, X, Navigation, Compass, Sparkles
} from 'lucide-react'
import {
  fetchServiceCategories, fetchVerifiedTechnicians, findCategoryIdByName,
} from '../lib/technicianService'
import type { PublicTechnician, ServiceCategoryDB } from '../types/technician'
import TechnicianCard from '../components/TechnicianCard'
import ServiceImageLogo from '../components/ServiceImageLogo'
import VoiceInputButton from '../components/VoiceInputButton'
import { useLocation } from '../context/LocationContext'
import { getDistanceToTechnician } from '../lib/locationService'

export default function FindTechniciansPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { userLocation, openLocationModal } = useLocation()
  const [categories, setCategories] = useState<ServiceCategoryDB[]>([])
  const [technicians, setTechnicians] = useState<PublicTechnician[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [sortByNearest, setSortByNearest] = useState(true)

  const selectedCategory = searchParams.get('category') || ''
  const categoryName = searchParams.get('name') || ''

  useEffect(() => {
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    async function load() {
      try {
        let categoryId: string | null = selectedCategory || null

        // If we have a category name but no ID, resolve it
        if (!categoryId && categoryName) {
          categoryId = await findCategoryIdByName(categoryName)
        }

        const techs = await fetchVerifiedTechnicians(categoryId)
        if (!cancelled) {
          setTechnicians(techs)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load technicians.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedCategory, categoryName])

  const selectedCat = categories.find((c) => c.id === selectedCategory)

  // Service areas list
  const availableAreas = useMemo(() => {
    return [...new Set(technicians.map((t) => t.service_area).filter(Boolean))] as string[]
  }, [technicians])

  // Client-side text & area filtering + distance sorting
  const filteredTechnicians = useMemo(() => {
    const list = technicians.filter((t) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.profession?.toLowerCase().includes(q) ||
        t.service_area?.toLowerCase().includes(q) ||
        t.bio?.toLowerCase().includes(q) ||
        t.services?.some((s) => s.name.toLowerCase().includes(q))

      const matchesArea = !selectedArea || t.service_area === selectedArea

      return matchesSearch && matchesArea
    })

    if (sortByNearest && userLocation) {
      return [...list].sort((a, b) => {
        const distA = getDistanceToTechnician(userLocation, a) ?? 9999
        const distB = getDistanceToTechnician(userLocation, b) ?? 9999
        return distA - distB
      })
    }

    return list
  }, [technicians, searchQuery, selectedArea, sortByNearest, userLocation])

  function selectCategory(id: string) {
    if (id) {
      setSearchParams({ category: id })
    } else {
      setSearchParams({})
    }
  }

  function handleClearFilters() {
    setSearchParams({})
    setSearchQuery('')
    setSelectedArea('')
  }

  return (
    <div className="section py-8 sm:py-12 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-soft mb-3">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>FixMate Verified Directory</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-3">
          {selectedCat && (
            <ServiceImageLogo name={selectedCat.name} icon={selectedCat.icon} size="md" />
          )}
          <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {selectedCat ? `${selectedCat.name} Technicians` : 'Verified Professionals'}
          </h1>
        </div>
        <p className="mx-auto mt-2.5 max-w-xl text-base text-ink/60">
          {selectedCat
            ? `Browse verified ${selectedCat.name.toLowerCase()} specialists ready for doorstep service.`
            : 'Find background-checked, skilled technicians sorted by proximity to your doorstep.'}
        </p>

        {/* Location Banner */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-50/80 px-4 py-2 border border-purple-200 text-xs font-semibold text-primary">
          <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
          <span>
            {userLocation?.city ? (
              <>
                Recommending nearest specialists to <strong>{userLocation.city}</strong>
              </>
            ) : (
              'Enable location to sort technicians by distance'
            )}
          </span>
          <button
            onClick={openLocationModal}
            className="ml-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-dark transition-all shadow-soft"
          >
            {userLocation?.city ? 'Change Location' : 'Set Location'}
          </button>
        </div>
      </div>

      {/* Search & Location Bar */}
      <div className="mt-6 mx-auto max-w-2xl flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by technician, trade, city (e.g. plumber Lahore, AC)..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-20 text-xs sm:text-sm text-ink placeholder:text-ink/40 shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-full p-1 text-ink/40 hover:text-ink transition-colors"
                title="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <VoiceInputButton
              onTranscript={(text) => setSearchQuery(text)}
              language="both"
              variant="icon"
            />
          </div>
        </div>

        {availableAreas.length > 0 && (
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-ink shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Areas ({availableAreas.length})</option>
            {availableAreas.map((area, idx) => (
              <option key={idx} value={area}>
                {area}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Category filter pills */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => selectCategory('')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            !selectedCategory
              ? 'bg-primary text-white shadow-soft scale-[1.02]'
              : 'bg-white text-ink/70 ring-1 ring-slate-200 hover:bg-primary-light'
          }`}
        >
          <span>✨ All Services</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-primary text-white shadow-soft scale-[1.02]'
                : 'bg-white text-ink/75 ring-1 ring-slate-200 hover:bg-primary-light'
            }`}
          >
            <ServiceImageLogo name={cat.name} icon={cat.icon} size="xs" />
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Results Header */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-ink">
            {filteredTechnicians.length} technician{filteredTechnicians.length !== 1 ? 's' : ''} available
          </p>
          {(selectedCategory || searchQuery || selectedArea) && (
            <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold text-primary">
              Filtered
            </span>
          )}
          {userLocation && (
            <button
              onClick={() => setSortByNearest(!sortByNearest)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border transition-all ${
                sortByNearest
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Navigation className="h-3 w-3 text-emerald-600" />
              <span>{sortByNearest ? 'Sorted by Proximity' : 'Default Order'}</span>
            </button>
          )}
        </div>

        {(selectedCategory || searchQuery || selectedArea) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl bg-error/10 p-4 text-center text-sm text-error">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            {error}
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <EmptyState onReset={handleClearFilters} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTechnicians.map((tech) => (
              <TechnicianCard key={tech.id} technician={tech} />
            ))}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="mt-12 text-center">
        <Link to="/services" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Browse all service categories
        </Link>
      </div>
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200/80 shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-primary">
        <Search className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-bold text-ink">
        No technicians match your search filters
      </p>
      <p className="mt-2 text-xs text-ink/60 leading-relaxed">
        Try clearing your search query or selecting "All Services" to view all active verified technicians.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
        <button onClick={onReset} className="btn-primary text-xs w-full sm:w-auto">
          Show All Technicians
        </button>
        <Link to="/services" className="btn-secondary text-xs w-full sm:w-auto">
          Browse Categories
        </Link>
      </div>
    </div>
  )
}
