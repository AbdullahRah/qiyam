export type TimeFormat = '12h' | '24h'
export type Convention = 'standard' | 'alternative'

export interface QiyamWindow {
  start: Date
  end: Date
  nightDurationMinutes: number
  lastThirdMinutes: number
  middleOfNight?: Date
}

export function formatTime(date: Date, format: TimeFormat): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()

  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins}m`
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function parseTime(timeStr: string, baseDate: Date): Date {
  const cleanTime = timeStr.split(' ')[0]
  const [hours, mins] = cleanTime.split(':').map(Number)
  const date = new Date(baseDate)
  date.setHours(hours, mins, 0, 0)
  return date
}

function getNextDay(date: Date): Date {
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  return nextDay
}

export function calculateQiyamWindow(
  maghribTime: string,
  ishaTime: string,
  fajrTime: string,
  convention: Convention
): QiyamWindow {
  // Use today as base for calculation
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Parse times
  let maghrib = parseTime(maghribTime, today)
  let isha = parseTime(ishaTime, today)
  let fajr = parseTime(fajrTime, today)

  // Fajr is always on the next day relative to Maghrib
  // If Fajr time is earlier than Maghrib on the clock, it means it's tomorrow
  // But since we always treat Fajr as next day, we adjust if needed
  if (fajr <= maghrib) {
    fajr = getNextDay(fajr)
  }

  // Determine night start based on convention
  let nightStart: Date
  let nightStartLabel: string

  if (convention === 'alternative') {
    // Alternative: Isha → Fajr
    nightStart = isha
    nightStartLabel = 'Isha'

    // Ensure Isha is on the correct day
    // If Isha is before Maghrib (which shouldn't normally happen), adjust
    if (isha < maghrib) {
      // Isha is early morning, use next day's Isha
      isha = getNextDay(isha)
      nightStart = isha
    }
  } else {
    // Standard: Maghrib → Fajr
    nightStart = maghrib
    nightStartLabel = 'Maghrib'
  }

  // Calculate night duration
  const nightDurationMs = fajr.getTime() - nightStart.getTime()
  const nightDurationMinutes = Math.round(nightDurationMs / 60000)

  // Calculate last third of the night
  const lastThirdMinutes = Math.round(nightDurationMinutes / 3)
  const lastThirdStart = new Date(fajr.getTime() - lastThirdMinutes * 60000)

  // Calculate middle of the night
  const middleOfNight = new Date(nightStart.getTime() + nightDurationMs / 2)

  return {
    start: lastThirdStart,
    end: fajr,
    nightDurationMinutes,
    lastThirdMinutes,
    middleOfNight,
  }
}

// Validation function
export function validateQiyamCalculation(
  window: QiyamWindow
): { valid: boolean; warning?: string } {
  if (window.nightDurationMinutes <= 0) {
    return { valid: false, warning: 'Invalid night duration' }
  }

  if (window.nightDurationMinutes > 18 * 60) {
    return {
      valid: true,
      warning: 'Unusually long night duration (>18 hours)'
    }
  }

  if (window.lastThirdMinutes < 60) {
    return {
      valid: true,
      warning: 'Short Qiyam window (<1 hour)'
    }
  }

  return { valid: true }
}

// Test cases for development
export const testCases = [
  {
    name: 'Normal night (Maghrib 18:00, Fajr 05:00)',
    maghrib: '18:00',
    isha: '20:00',
    fajr: '05:00',
    convention: 'standard' as const,
    expected: {
      nightDurationMinutes: 660, // 11 hours
      lastThirdMinutes: 220, // ~3.67 hours
      qiyamStartHour: 2, // Should be around 2:00 AM
    },
  },
  {
    name: 'Cross-midnight (Maghrib 19:00, Fajr 04:30)',
    maghrib: '19:00',
    isha: '21:00',
    fajr: '04:30',
    convention: 'standard' as const,
    expected: {
      nightDurationMinutes: 570, // 9.5 hours
      lastThirdMinutes: 190,
      qiyamStartHour: 2, // Should be around 2:00 AM
    },
  },
  {
    name: 'Alternative convention (Isha → Fajr)',
    maghrib: '18:00',
    isha: '21:00',
    fajr: '05:00',
    convention: 'alternative' as const,
    expected: {
      nightDurationMinutes: 480, // 8 hours (21:00 to 05:00)
      lastThirdMinutes: 160,
      qiyamStartHour: 3, // Should be around 3:00 AM
    },
  },
]

export function runTestCases(): void {
  console.log('Running Qiyam calculation test cases...\n')

  testCases.forEach((test) => {
    const result = calculateQiyamWindow(
      test.maghrib,
      test.isha,
      test.fajr,
      test.convention
    )

    const startHour = result.start.getHours()
    const passed = startHour === test.expected.qiyamStartHour

    console.log(`${passed ? '✓' : '✗'} ${test.name}`)
    console.log(`  Night duration: ${formatDuration(result.nightDurationMinutes)}`)
    console.log(`  Qiyam starts: ${formatTime(result.start, '12h')}`)
    console.log(`  Expected start hour: ~${test.expected.qiyamStartHour}:00`)
    console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}\n`)
  })
}

export function getVirtue() {
  const virtues = [
    {
      text: "The best prayer after the obligatory prayers is the night prayer.",
      source: "Sahih Muslim"
    },
    {
      text: "Our Lord descends every night to the lowest heaven when the last third of the night remains...",
      source: "Bukhari & Muslim"
    },
    {
      text: "You should pray at night, for it was the habit of the righteous people before you.",
      source: "At-Tirmidhi"
    },
    {
      text: "The closest a servant is to his Lord is in the middle of the last part of the night.",
      source: "At-Tirmidhi"
    }
  ]
  return virtues[Math.floor(Math.random() * virtues.length)]
}
