export interface PrayerTimes {
  Maghrib: Date
  Isha: Date
  Fajr: Date
  Sunrise?: Date
  Dhuhr?: Date
  Asr?: Date
  Imsak?: Date
  Midnight?: Date
}

export interface Location {
  lat: number
  lng: number
}

export interface QiyamSettings {
  location: Location
  methodId: number
  convention: 'standard' | 'alternative'
  timeFormat: '12h' | '24h'
  error?: string
}

export type TimeFormat = '12h' | '24h'
export type Convention = 'standard' | 'alternative'
