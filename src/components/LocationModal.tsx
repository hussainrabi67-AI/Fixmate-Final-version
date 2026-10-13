import { useState } from 'react'
import {
  MapPin,
  Navigation,
  CheckCircle2,
  X,
  Building2,
  Sparkles,
  AlertCircle,
  Loader2,
  Compass,
} from 'lucide-react'
import { useLocation } from '../context/LocationContext'
import { POPULAR_CITIES } from '../lib/locationService'

export default function LocationModal() {
  const {
    userLocation,
    locationStatus,
    isPromptOpen,
    errorMsg,
    closeLocationModal,
    requestLocation,
    setManualCity,
  } = useLocation()

  const [selectedCity, setSelectedCity] = useState(userLocation?.city || 'Peshawar')
  const [customCity, setCustomCity] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  if (!isPromptOpen) return null

  const isRequesting = locationStatus === 'requesting'

  async function handleAllow() {
    const success = await requestLocation()
    if (success) {
      // Modal auto closes inside requestLocation
    }
  }

  function handleSelectCitySubmit(e: React.FormEvent) {
    e.preventDefault()
    const cityToSave = showCustom ? customCity.trim() : selectedCity
    if (cityToSave) {
      setManualCity(cityToSave)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-lift border border-slate-100 overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background ambient lighting glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />

        {/* Close Button */}
        <button
          onClick={closeLocationModal}
          className="absolute right-5 top-5 rounded-full p-2 text-ink/40 hover:bg-slate-100 hover:text-ink transition-all"
          title="Close / Skip"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-soft">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              <span>Smart Recommendation</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight">
              Recommend Nearest Technicians
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm text-ink/70 leading-relaxed">
          Allow FixMate to access your location to show verified repair specialists closest to your doorstep for faster response times.
        </p>

        {/* Error message banner if browser blocked access */}
        {errorMsg && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200/80">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Current status display if set */}
        {userLocation && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50/80 p-3.5 border border-emerald-200/80 text-xs font-semibold text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Current location: <strong>{userLocation.city || 'Detected Position'}</strong></span>
            </div>
            <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>
        )}

        {/* Main Action 1: Geolocation Button */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleAllow}
            disabled={isRequesting}
            className="btn-primary w-full py-3.5 text-sm font-extrabold shadow-soft flex items-center justify-center gap-2.5"
          >
            {isRequesting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Detecting your location...</span>
              </>
            ) : (
              <>
                <Navigation className="h-5 w-5 fill-current" />
                <span>📍 Allow Location Access</span>
              </>
            )}
          </button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-white px-3 text-[11px] font-bold text-ink/40 uppercase tracking-wider">
              Or Select Your City Manually
            </span>
          </div>

          {/* Form: Select City Manually */}
          <form onSubmit={handleSelectCitySubmit} className="space-y-3">
            {!showCustom ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setShowCustom(true)
                      } else {
                        setSelectedCity(e.target.value)
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-background py-3 pl-10 pr-8 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-soft"
                  >
                    {POPULAR_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Enter Other City</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-secondary py-3 px-4 text-xs font-bold shrink-0"
                >
                  Set City
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Compass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
                  <input
                    type="text"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Enter city name (e.g. Swabi)..."
                    className="w-full rounded-2xl border border-slate-200 bg-background py-3 pl-10 pr-4 text-sm font-medium text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customCity.trim()}
                  className="btn-primary py-3 px-4 text-xs font-bold shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="rounded-2xl border border-slate-200 px-3 py-3 text-xs font-medium text-ink/60 hover:bg-slate-100"
                >
                  Back
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer Skip Button */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-ink/50">
          <span className="flex items-center gap-1">
            🔒 Your location is never shared publicly
          </span>
          <button
            onClick={closeLocationModal}
            className="font-bold text-ink/70 hover:text-ink hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
