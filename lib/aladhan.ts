import { z } from 'zod'

// Types for API responses
export interface PrayerTimesAPIResponse {
  timings: Record<string, string>
  date: {
    readable: string
    timestamp: string
    hijri: Record<string, unknown>
    gregorian: Record<string, unknown>
  }
  meta: {
    latitude: number
    longitude: number
    timezone: string
    method: {
      id: number
      name: string
      params: Record<string, number>
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface MethodsAPIResponse {
  id: number
  name: string
  params: Record<string, number>
}

// Zod schemas
export const prayerTimesSchema = z.object({
  timings: z.object({
    Fajr: z.string(),
    Maghrib: z.string().optional(),
    Sunset: z.string().optional(),
    Isha: z.string(),
    Sunrise: z.string().optional(),
    Dhuhr: z.string().optional(),
    Asr: z.string().optional(),
    Imsak: z.string().optional(),
    Midnight: z.string().optional(),
  }).passthrough(),
  date: z.object({
    readable: z.string(),
    timestamp: z.string(),
    hijri: z.object({
      date: z.string(),
      month: z.object({ en: z.string(), ar: z.string() }).passthrough(),
      year: z.string(),
    }).passthrough(),
    gregorian: z.object({
      date: z.string(),
      month: z.object({ en: z.string(), number: z.union([z.string(), z.number()]) }).passthrough(),
      year: z.string(),
    }).passthrough(),
  }).passthrough(),
  meta: z.object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
    method: z.object({
      id: z.number(),
      name: z.string(),
      params: z.record(z.number()),
    }).passthrough(),
  }).passthrough(),
}).passthrough()

export const methodsSchema = z.object({
  id: z.number(),
  name: z.string(),
  params: z.record(z.number()),
})

// API functions
const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1'

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  methodId: number = 2,
  date?: string
) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    method: methodId.toString(),
  })

  if (date) {
    params.append('date', date)
  }

  const response = await fetch(
    `${ALADHAN_BASE_URL}/timings?${params.toString()}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch prayer times')
  }

  const data = await response.json()
  const parsed = prayerTimesSchema.safeParse(data.data)

  if (!parsed.success) {
    console.error('Zod Error:', parsed.error)
    throw new Error('Invalid prayer times data')
  }

  return parsed.data as PrayerTimesAPIResponse
}

export async function fetchCalculationMethods(): Promise<MethodsAPIResponse[]> {
  const response = await fetch(`${ALADHAN_BASE_URL}/methods`)

  if (!response.ok) {
    throw new Error('Failed to fetch calculation methods')
  }

  const data = await response.json()
  const methodsData = data.data

  // Transform the API response into an array
  const methods: MethodsAPIResponse[] = Object.entries(methodsData).map(([key, value]) => {
    const methodData = value as { id: number; name: string; params: Record<string, number> }
    return {
      id: methodData.id,
      name: methodData.name,
      params: methodData.params,
    }
  })

  return methods
}

export async function fetchAddressFromCoords(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: {
          'User-Agent': 'QiyamApp/1.0'
        }
      }
    )

    if (!response.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }

    const data = await response.json()
    const addressData = data.address || {}
    const city = addressData.city || addressData.town || addressData.village || addressData.suburb
    const country = addressData.country

    if (city && country) {
      return `${city}, ${country}`
    } else if (city || country) {
      return city || country
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (error) {
    console.error('Error fetching address:', error)
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

export async function fetchCoordsFromAddress(
  address: string
): Promise<{ lat: number; lng: number }> {
  // Use AlAdhan's city lookup endpoint
  const response = await fetch(
    `${ALADHAN_BASE_URL}/cityByName/${encodeURIComponent(address)}`
  )

  if (!response.ok) {
    throw new Error('Location not found')
  }

  const data = await response.json()

  if (!data.data?.latitude || !data.data?.longitude) {
    throw new Error('Invalid location data')
  }

  return {
    lat: parseFloat(data.data.latitude),
    lng: parseFloat(data.data.longitude),
  }
}
