export interface LocationCoords {
  lat: number
  lng: number
  city?: string
  address?: string
}

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  peshawar: { lat: 34.0151, lng: 71.5249 },
  nowshera: { lat: 34.0105, lng: 71.9876 },
  'akora khattak': { lat: 33.9892, lng: 72.1256 },
  akora: { lat: 33.9892, lng: 72.1256 },
  mardan: { lat: 34.1986, lng: 72.0404 },
  charsadda: { lat: 34.1482, lng: 71.7406 },
  swabi: { lat: 34.1202, lng: 72.4700 },
  kohat: { lat: 33.5869, lng: 71.4422 },
  abbottabad: { lat: 34.1688, lng: 73.2215 },
  islamabad: { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.5651, lng: 73.0169 },
  lahore: { lat: 31.5204, lng: 74.3587 },
  karachi: { lat: 24.8607, lng: 67.0011 },
  multan: { lat: 30.1575, lng: 71.5249 },
  faisalabad: { lat: 31.4504, lng: 73.1350 },
  sialkot: { lat: 32.4945, lng: 74.5229 },
  gujranwala: { lat: 32.1877, lng: 74.1945 },
  quetta: { lat: 30.1798, lng: 66.975 },
}

export const POPULAR_CITIES = [
  'Peshawar',
  'Nowshera',
  'Akora Khattak',
  'Mardan',
  'Charsadda',
  'Swabi',
  'Islamabad',
  'Rawalpindi',
  'Lahore',
  'Karachi',
]

/**
 * Haversine formula to calculate distance between two coordinates in kilometers
 */
export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * Formats distance into clean string representation (e.g. "1.2 km away")
 */
export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || isNaN(distanceKm)) return null
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000)
    return `${meters} meters away`
  }
  return `${distanceKm} km away`
}

/**
 * Gets coordinates for a technician based on service area or bio
 */
export function getTechnicianCoords(tech: { service_area?: string | null; bio?: string | null }): { lat: number; lng: number } | null {
  if (!tech) return null

  // Try matching service area
  const area = (tech.service_area || '').toLowerCase().trim()
  if (area) {
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
      if (area.includes(cityName) || cityName.includes(area)) {
        return coords
      }
    }
  }

  // Try bio text for city names
  const bio = (tech.bio || '').toLowerCase()
  if (bio) {
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
      if (bio.includes(cityName)) {
        return coords
      }
    }
  }

  // Default fallback if area is unknown: Peshawar region
  return CITY_COORDINATES.peshawar
}

/**
 * Calculates distance from user location to a technician
 */
export function getDistanceToTechnician(
  userLocation: LocationCoords | null,
  tech: { service_area?: string | null; bio?: string | null }
): number | null {
  if (!userLocation) return null
  const techCoords = getTechnicianCoords(tech)
  if (!techCoords) return null
  return getDistanceInKm(userLocation.lat, userLocation.lng, techCoords.lat, techCoords.lng)
}

/**
 * Gets browser geolocation with promise
 */
export function getBrowserGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    )
  })
}

/**
 * Reverse geocodes lat/lng into city name using OSM Nominatim API
 */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`)
    if (res.ok) {
      const data = await res.json()
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.county ||
        data.address?.suburb ||
        data.address?.state_district
      if (city) return city
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err)
  }

  // Nearest city fallback based on distance
  let closestCity = 'Peshawar'
  let minDistance = Infinity
  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    const dist = getDistanceInKm(lat, lng, coords.lat, coords.lng)
    if (dist < minDistance) {
      minDistance = dist
      closestCity = cityName.charAt(0).toUpperCase() + cityName.slice(1)
    }
  }
  return closestCity
}
