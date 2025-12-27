'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback } from 'react'
import { fetchPrayerTimes } from '@/lib/aladhan'
import { PrayerTimes, Location } from '@/types'

interface UsePrayerTimesProps {
  lat: number
  lng: number
  methodId: number
  convention: 'standard' | 'alternative'
}

function parseApiTime(timeStr: string, baseDate: Date): Date {
  // Aladhan times can look like "05:12 (GST)" or "05:12"
  const cleanTime = timeStr.split(' ')[0]
  const [hours, minutes] = cleanTime.split(':').map(Number)
  const date = new Date(baseDate)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function parseManualTime(timeStr: string, baseDate: Date, isNextDay: boolean = false): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date(baseDate)
  date.setHours(hours, minutes, 0, 0)

  if (isNextDay) {
    date.setDate(date.getDate() + 1)
  }

  return date
}

export function usePrayerTimes({
  lat,
  lng,
  methodId,
  convention,
}: UsePrayerTimesProps) {
  const queryKey = useMemo(
    () => ['prayer-times', lat, lng, methodId] as const,
    [lat, lng, methodId]
  )

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PrayerTimes> => {
      try {
        const now = new Date()
        let fetchDate = new Date(now)

        // Initial fetch to get today's timings
        const initialDateStr = fetchDate.toISOString().split('T')[0]
        const initialRes = await fetchPrayerTimes(lat, lng, methodId, initialDateStr)
        const initialFajrStr = initialRes.timings.Fajr

        // Check if we are currently BEFORE today's Fajr
        // If so, we are actually in the "Night" that started yesterday
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayFajr = parseApiTime(initialFajrStr, baseDate)

        let finalTimings = initialRes.timings
        let nightBaseDate = baseDate

        if (now < todayFajr) {
          // It's early morning, we want the night window that started yesterday
          fetchDate.setDate(fetchDate.getDate() - 1)
          const yesterdayDateStr = fetchDate.toISOString().split('T')[0]
          const yesterdayRes = await fetchPrayerTimes(lat, lng, methodId, yesterdayDateStr)
          finalTimings = yesterdayRes.timings
          nightBaseDate = new Date(fetchDate.getFullYear(), fetchDate.getMonth(), fetchDate.getDate())
        }

        const timings = finalTimings as Record<string, string>
        console.log('Using Prayer Timings for date:', fetchDate.toISOString().split('T')[0], timings)

        const maghribStr = timings.Maghrib || timings.Sunset
        if (!maghribStr) throw new Error('Maghrib time not found in API response')

        const maghribDate = parseApiTime(maghribStr, nightBaseDate)
        const ishaDate = parseApiTime(timings.Isha, nightBaseDate)
        const fajrDate = parseApiTime(timings.Fajr, nightBaseDate)

        // Fajr is next day relative to the night's start (Maghrib)
        const finalFajr = new Date(fajrDate.getTime() + 24 * 60 * 60 * 1000)

        // Isha is next day if it's before Maghrib (rare but possible in some high latitudes)
        const finalIsha = ishaDate <= maghribDate
          ? new Date(ishaDate.getTime() + 24 * 60 * 60 * 1000)
          : ishaDate

        return {
          Maghrib: maghribDate,
          Isha: finalIsha,
          Fajr: finalFajr,
          Sunrise: timings.Sunrise ? parseApiTime(timings.Sunrise, nightBaseDate) : undefined,
          Dhuhr: timings.Dhuhr ? parseApiTime(timings.Dhuhr, nightBaseDate) : undefined,
          Asr: timings.Asr ? parseApiTime(timings.Asr, nightBaseDate) : undefined,
          Imsak: timings.Imsak ? parseApiTime(timings.Imsak, nightBaseDate) : undefined,
          Midnight: timings.Midnight ? parseApiTime(timings.Midnight, nightBaseDate) : undefined,
        }
      } catch (err) {
        console.error('Error in usePrayerTimes queryFn:', err)
        throw err
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: lat !== 0 && lng !== 0,
  })

  return query
}

// Prefetch prayer times for a location
export function usePrefetchPrayerTimes() {
  const queryClient = useQueryClient()

  const prefetch = useCallback(async (location: Location, methodId: number) => {
    const queryKey = ['prayer-times', location.lat, location.lng, methodId] as const

    await queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const today = new Date()
        const dateStr = today.toISOString().split('T')[0]
        const response = await fetchPrayerTimes(location.lat, location.lng, methodId, dateStr)

        const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const maghribDate = parseApiTime(response.timings.Maghrib, baseDate)
        const ishaDate = parseApiTime(response.timings.Isha, baseDate)
        const fajrDate = parseApiTime(response.timings.Fajr, baseDate)

        const fajrIsNextDay = fajrDate <= maghribDate
        const ishaIsNextDay = ishaDate <= maghribDate

        return {
          Maghrib: maghribDate,
          Isha: ishaIsNextDay ? new Date(ishaDate.getTime() + 24 * 60 * 60 * 1000) : ishaDate,
          Fajr: fajrIsNextDay ? new Date(fajrDate.getTime() + 24 * 60 * 60 * 1000) : fajrDate,
          Sunrise: parseApiTime(response.timings.Sunrise, baseDate),
          Dhuhr: parseApiTime(response.timings.Dhuhr, baseDate),
          Asr: parseApiTime(response.timings.Asr, baseDate),
          Imsak: parseApiTime(response.timings.Imsak, baseDate),
          Midnight: parseApiTime(response.timings.Midnight, baseDate),
        }
      },
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient])

  return prefetch
}
