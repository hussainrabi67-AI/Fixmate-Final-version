import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  type LocationCoords,
  CITY_COORDINATES,
  getBrowserGeolocation,
  reverseGeocodeCity,
} from '../lib/locationService'

interface LocationContextValue {
  userLocation: LocationCoords | null
  locationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'manual'
  isPromptOpen: boolean
  errorMsg: string | null
  openLocationModal: () => void
  closeLocationModal: () => void
  requestLocation: () => Promise<boolean>
  setManualCity: (cityName: string) => void
  clearLocation: () => void
}

const STORAGE_KEY = 'fixmate_user_location'
const PROMPTED_KEY = 'fixmate_location_prompted'

const LocationContext = createContext<LocationContextValue>({
  userLocation: null,
  locationStatus: 'idle',
  isPromptOpen: false,
  errorMsg: null,
  openLocationModal: () => {},
  closeLocationModal: () => {},
  requestLocation: async () => false,
  setManualCity: () => {},
  clearLocation: () => {},
})

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'manual'>('idle')
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 1. Load saved location from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setUserLocation(parsed)
          setLocationStatus(parsed.status || 'granted')
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, [])

  // 2. When user signs in, ask for location access if not already granted or prompted in this session
  useEffect(() => {
    if (!user) return

    const hasSavedLoc = localStorage.getItem(STORAGE_KEY)
    const sessionPrompted = sessionStorage.getItem(PROMPTED_KEY)

    if (!hasSavedLoc && !sessionPrompted) {
      // Mark session prompted and open modal right after sign in
      sessionStorage.setItem(PROMPTED_KEY, 'true')
      // Small timeout so dashboard/home page transition settles smoothly
      const timer = setTimeout(() => {
        setIsPromptOpen(true)
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [user])

  // Request browser geolocation
  async function requestLocation(): Promise<boolean> {
    setLocationStatus('requesting')
    setErrorMsg(null)

    try {
      const pos = await getBrowserGeolocation()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude

      // Get city name via reverse geocoding
      const city = await reverseGeocodeCity(lat, lng)

      const loc: LocationCoords = {
        lat,
        lng,
        city,
      }

      setUserLocation(loc)
      setLocationStatus('granted')
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, status: 'granted' }))
      setIsPromptOpen(false)
      return true
    } catch (err: any) {
      console.warn('Geolocation request failed or denied:', err)
      setLocationStatus('denied')

      if (err.code === 1 || err.message?.includes('denied')) {
        setErrorMsg('Microphone/Location permission denied by browser. You can manually select your city below.')
      } else if (err.message === 'GEOLOCATION_UNSUPPORTED') {
        setErrorMsg('Geolocation is not supported by your browser. Please select your city manually.')
      } else {
        setErrorMsg('Could not detect position. Please select your city manually.')
      }
      return false
    }
  }

  // Set manual city
  function setManualCity(cityName: string) {
    const key = cityName.toLowerCase().trim()
    const coords = CITY_COORDINATES[key] || CITY_COORDINATES.peshawar

    const loc: LocationCoords = {
      lat: coords.lat,
      lng: coords.lng,
      city: cityName,
    }

    setUserLocation(loc)
    setLocationStatus('manual')
    setErrorMsg(null)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, status: 'manual' }))
    setIsPromptOpen(false)
  }

  function clearLocation() {
    setUserLocation(null)
    setLocationStatus('idle')
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        locationStatus,
        isPromptOpen,
        errorMsg,
        openLocationModal: () => setIsPromptOpen(true),
        closeLocationModal: () => setIsPromptOpen(false),
        requestLocation,
        setManualCity,
        clearLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocation() {
  return useContext(LocationContext)
}
