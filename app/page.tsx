'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Settings, Copy, MapPin, Clock, AlertCircle, Check, Loader2, Search, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePrayerTimes } from '@/hooks/use-prayer-times'
import { useSettings } from '@/hooks/use-settings'
import { formatTime, calculateQiyamWindow, formatDuration, getVirtue } from '@/lib/qiyam'
import { fetchAddressFromCoords } from '@/lib/aladhan'
import { searchCities, type CityResult } from '@/lib/geocoding'

type LocationMode = 'gps' | 'search'

export default function HomePage() {
  const {
    settings,
    updateSettings,
    toggleTimeFormat,
  } = useSettings()

  const timeFormat = settings.timeFormat
  const [locationMode, setLocationMode] = useState<LocationMode>('gps')
  const [searchQuery, setSearchQuery] = useState('')
  const [address, setAddress] = useState('')
  const [showCopied, setShowCopied] = useState(false)

  // Search state
  const [recommendations, setRecommendations] = useState<CityResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const searchDebounceRef = useRef<NodeJS.Timeout>()

  const {
    data: prayerTimes,
    isLoading: isLoadingPrayerTimes,
    error: prayerError,
  } = usePrayerTimes({
    lat: settings.location.lat,
    lng: settings.location.lng,
    methodId: settings.methodId,
    convention: settings.convention,
  })

  // Handle GPS location
  const handleUseGPS = useCallback(() => {
    if (!navigator.geolocation) {
      updateSettings({ error: 'Geolocation is not supported by your browser' })
      return
    }

    setShowRecommendations(false)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        updateSettings({
          location: { lat: latitude, lng: longitude },
          error: undefined
        })
        setLocationMode('gps')

        // Fetch address
        try {
          const addr = await fetchAddressFromCoords(latitude, longitude)
          setAddress(addr)
        } catch {
          setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }
      },
      (error) => {
        updateSettings({ error: 'Unable to retrieve your location. Check permissions.' })
        setLocationMode('gps')
      }
    )
  }, [updateSettings])

  // Handle address search input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowRecommendations(true)

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    if (value.length < 2) {
      setRecommendations([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchCities(value)
      setRecommendations(results)
      setIsSearching(false)
    }, 500)
  }

  const selectCity = useCallback((city: CityResult) => {
    updateSettings({
      location: { lat: city.latitude, lng: city.longitude },
      error: undefined
    })
    setAddress(`${city.name}, ${city.country || ''}`)
    setSearchQuery(city.name)
    setShowRecommendations(false)
    setLocationMode('search')
  }, [updateSettings])

  // Initial address fetch if valid coords and empty address
  useEffect(() => {
    if (settings.location.lat && settings.location.lng && !address) {
      fetchAddressFromCoords(settings.location.lat, settings.location.lng)
        .then(setAddress)
        .catch(() => { })
    }
  }, [settings.location, address])

  // Try to get GPS on initial mount if not set
  useEffect(() => {
    if (settings.location.lat === 40.7128 && settings.location.lng === -74.0060) {
      handleUseGPS()
    }
  }, [handleUseGPS])

  // Calculate Qiyam window
  const qiyamWindow = prayerTimes
    ? calculateQiyamWindow(
      formatTime(prayerTimes.Maghrib, '24h'),
      formatTime(prayerTimes.Isha, '24h'),
      formatTime(prayerTimes.Fajr, '24h'),
      settings.convention
    )
    : null

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    if (!qiyamWindow) return

    const text = `Qiyam Window${address ? ` for ${address}` : ''}:\n` +
      `• Starts: ${formatTime(qiyamWindow.start, timeFormat)}\n` +
      `• Ends (Fajr): ${formatTime(qiyamWindow.end, timeFormat)}\n` +
      `• Night Duration: ${formatDuration(qiyamWindow.nightDurationMinutes)}` +
      (qiyamWindow.middleOfNight
        ? `\n• Middle of Night: ${formatTime(qiyamWindow.middleOfNight, timeFormat)}`
        : '')

    navigator.clipboard.writeText(text)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }, [qiyamWindow, address, timeFormat])

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          Qiyam
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SettingsDialog
            settings={settings}
            updateSettings={updateSettings}
            timeFormat={timeFormat}
            toggleTimeFormat={toggleTimeFormat}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-md space-y-6">
        {/* Location Selector */}
        <GlassCard className="p-1 space-y-4 overflow-visible relative z-20">
          <div className="p-3">
            <div className="flex bg-muted/50 p-1 rounded-lg mb-4">
              <button
                onClick={handleUseGPS}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  locationMode === 'gps'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <MapPin className="w-4 h-4" />
                GPS
              </button>
              <button
                onClick={() => setLocationMode('search')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  locationMode === 'search'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {locationMode === 'search' ? (
              <div className="relative">
                <Input
                  placeholder="Seach city (e.g. London, Dubai)..."
                  value={searchQuery}
                  onChange={handleSearchInput}
                  className="w-full pl-9"
                  onFocus={() => setShowRecommendations(true)}
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />

                {/* Autocomplete Dropdown */}
                {showRecommendations && (searchQuery.length > 1) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    {isSearching ? (
                      <div className="p-4 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Scanning map...
                      </div>
                    ) : recommendations.length > 0 ? (
                      <div className="max-h-[200px] overflow-y-auto py-1">
                        {recommendations.map((city) => (
                          <button
                            key={city.id}
                            className="w-full px-4 py-2 text-left hover:bg-muted/50 transition-colors flex flex-col gap-0.5"
                            onClick={() => selectCity(city)}
                          >
                            <span className="font-medium text-sm">{city.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[city.admin1, city.country].filter(Boolean).join(', ')}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No cities found
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-2 text-sm text-muted-foreground animate-in fade-in">
                {settings.location.lat === 0 ? (
                  <span>Press GPS to locate</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {address || 'Location set via GPS'}
                  </span>
                )}
              </div>
            )}

            {settings.error && (
              <div className="mt-3 p-3 text-xs bg-destructive/10 text-destructive rounded-md flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="w-4 h-4" />
                {settings.error}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Hero: Qiyam Window */}
        <GlassCard className="p-8 space-y-8 text-center relative overflow-hidden backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 pointer-events-none" />

          <div className="space-y-2 relative">
            <h2 className="text-xs font-semibold text-primary/80 uppercase tracking-[0.2em]">
              Qiyam Window
            </h2>
            {qiyamWindow && (
              <p className="text-xs text-muted-foreground">
                Optimal time for night prayer
              </p>
            )}
          </div>

          {isLoadingPrayerTimes ? (
            <div className="space-y-4 py-4">
              <div className="h-16 w-32 mx-auto bg-muted/60 rounded-xl animate-pulse" />
              <div className="h-4 w-24 mx-auto bg-muted/60 rounded animate-pulse" />
            </div>
          ) : prayerError ? (
            <div className="py-6 space-y-2">
              <p className="text-destructive font-medium">Unable to load times</p>
              <p className="text-xs text-muted-foreground">Check your connection or try another location</p>
            </div>
          ) : qiyamWindow ? (
            <div className="space-y-6 animate-in zoom-in-50 duration-500 relative">
              <div className="space-y-1">
                <div className="text-6xl font-bold tracking-tighter tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                  {formatTime(qiyamWindow.start, timeFormat)}
                </div>
                <div className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                  <span>until</span>
                  <span className="text-foreground">{formatTime(qiyamWindow.end, timeFormat)}</span>
                  <span>(Fajr)</span>
                </div>
              </div>

              {/* Countdown & Status */}
              <div className="py-2">
                <Countdown targetDate={qiyamWindow.start} endDate={qiyamWindow.end} />
              </div>

              {/* Night Progress */}
              {prayerTimes && (
                <div className="space-y-2 px-4">
                  <NightProgress
                    start={settings.convention === 'standard' ? prayerTimes.Maghrib : prayerTimes.Isha}
                    end={prayerTimes.Fajr}
                    timeFormat={timeFormat}
                  />
                </div>
              )}

              <div className="pt-6 border-t border-border/40">
                <div className="grid grid-cols-2 gap-8 text-left">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Night Duration</p>
                    <p className="text-lg font-medium tabular-nums">{formatDuration(qiyamWindow.nightDurationMinutes)}</p>
                  </div>
                  {qiyamWindow.middleOfNight && (
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Middle of Night</p>
                      <p className="text-lg font-medium tabular-nums">{formatTime(qiyamWindow.middleOfNight, timeFormat)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Set your location to see the Qiyam window</p>
            </div>
          )}
        </GlassCard>

        {/* Prayer Times Summary */}
        {prayerTimes && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Reference Times</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Maghrib', time: prayerTimes.Maghrib },
                { label: 'Isha', time: prayerTimes.Isha },
                { label: 'Fajr', time: prayerTimes.Fajr },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/40 text-center hover:bg-muted/60 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="font-semibold tabular-nums">{formatTime(item.time, timeFormat)}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Virtues Section */}
        <VirtuesCard />

        {/* Actions */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl border-dashed hover:border-solid hover:bg-muted/50 transition-all font-medium"
            onClick={handleCopy}
            disabled={!qiyamWindow}
          >
            {showCopied ? (
              <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                Copied to clipboard
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Copy Summary
              </span>
            )}
          </Button>
        </div>

        {/* Dev Tools */}
        <DevToolsAccordion
          qiyamWindow={qiyamWindow}
          prayerTimes={prayerTimes}
          settings={settings}
        />
      </div>
    </div>
  )
}

function SettingsDialog({
  settings,
  updateSettings,
  timeFormat,
  toggleTimeFormat,
}: {
  settings: ReturnType<typeof useSettings>['settings']
  updateSettings: ReturnType<typeof useSettings>['updateSettings']
  timeFormat: '12h' | '24h'
  toggleTimeFormat: () => void
}) {
  const [open, setOpen] = useState(false)

  const methods = [
    { id: 1, name: 'Islamic Society of North America (ISNA)' },
    { id: 2, name: 'Muslim World League (MWL)' },
    { id: 3, name: 'Umm al-Qura University, Makkah' },
    { id: 4, name: 'Egyptian General Authority of Survey' },
    { id: 5, name: 'Karachi, Pakistan' },
    { id: 7, name: 'Tehran, Iran (Institute of Geophysics)' },
    { id: 8, name: 'Jafari ( Shia Ithna-Ashari )' },
    { id: 9, name: 'Gulf Region' },
    { id: 10, name: 'Kuwait' },
    { id: 11, name: 'Qatar' },
    { id: 12, name: 'Majlis Ugama Islam, Singapore' },
    { id: 13, name: 'Union des Organisations Islamiques de France' },
    { id: 14, name: 'Diyanet İşleri Başkanlığı, Turkey' },
    { id: 15, name: 'Spiritual Administration of Muslims of Russia' },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="hover:bg-muted/50 rounded-full">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure calculation method and display preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Calculation Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Calculation Method</Label>
            <Select
              value={String(settings.methodId)}
              onValueChange={(value) => updateSettings({ methodId: parseInt(value) })}
            >
              <SelectTrigger id="method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={String(method.id)}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Qiyam Convention */}
          <div className="space-y-2">
            <Label>Qiyam Convention</Label>
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-lg">
              <button
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-all",
                  settings.convention === 'standard'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:bg-background/50"
                )}
                onClick={() => updateSettings({ convention: 'standard' })}
              >
                Standard
              </button>
              <button
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-all",
                  settings.convention === 'alternative'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:bg-background/50"
                )}
                onClick={() => updateSettings({ convention: 'alternative' })}
              >
                Alternative
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              Standard (Maghrib → Fajr) vs Alternative (Isha → Fajr)
            </p>
          </div>

          {/* Time Format */}
          <div className="flex items-center justify-between">
            <Label>Time Format</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTimeFormat}
            >
              {timeFormat === '12h' ? '12-hour' : '24-hour'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DevToolsAccordion({
  qiyamWindow,
  prayerTimes,
  settings,
}: {
  qiyamWindow: ReturnType<typeof calculateQiyamWindow> | null
  prayerTimes: ReturnType<typeof usePrayerTimes>['data'] | null
  settings: ReturnType<typeof useSettings>['settings']
}) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer text-center text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-8">
        Ref: {settings.location.lat.toFixed(2)}, {settings.location.lng.toFixed(2)} | M{settings.methodId}
      </summary>
      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-[10px] space-y-1 font-mono text-left">
        {qiyamWindow && (
          <>
            <p>Start: {qiyamWindow.start.toISOString()}</p>
            <p>End: {qiyamWindow.end.toISOString()}</p>
          </>
        )}
        <p>Method ID: {settings.methodId}</p>
      </div>
    </details>
  )
}
function Countdown({ targetDate, endDate }: { targetDate: Date, endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null)
  const [isPast, setIsPast] = useState(false)
  const [isEnded, setIsEnded] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = targetDate.getTime()
      const end = endDate.getTime()

      if (now >= end) {
        setIsEnded(true)
        setIsPast(false)
        setTimeLeft(null)
        return
      }

      if (now >= target) {
        setIsPast(true)
        setIsEnded(false)
        setTimeLeft(null)
        return
      }

      const diff = target - now
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft({ hours, minutes, seconds })
      setIsPast(false)
      setIsEnded(false)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [targetDate, endDate])

  if (isEnded) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
        Window Ended
      </div>
    )
  }

  if (isPast) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider animate-pulse">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        Current Window Active
      </div>
    )
  }

  if (!timeLeft) return null

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Starts in</p>
      <div className="flex items-center justify-center gap-1 text-sm font-mono font-medium text-primary">
        <span>{timeLeft.hours.toString().padStart(2, '0')}h</span>
        <span className="animate-pulse">:</span>
        <span>{timeLeft.minutes.toString().padStart(2, '0')}m</span>
        <span className="animate-pulse">:</span>
        <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>
      </div>
    </div>
  )
}

function NightProgress({ start, end, timeFormat }: { start: Date, end: Date, timeFormat: '12h' | '24h' }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date()
      const s = start.getTime()
      const e = end.getTime()
      const t = now.getTime()

      if (t < s) {
        setProgress(0)
        return
      }
      if (t > e) {
        setProgress(100)
        return
      }

      const total = e - s
      const current = t - s
      setProgress((current / total) * 100)
    }

    updateProgress()
    const timer = setInterval(updateProgress, 60000) // update every minute
    return () => clearInterval(timer)
  }, [start, end])

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <div className="flex flex-col items-start gap-0.5">
          <span>Sunset</span>
          <span className="text-foreground/60 font-mono tracking-tighter lowercase">{formatTime(start, timeFormat)}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span>Dawn</span>
          <span className="text-foreground/60 font-mono tracking-tighter lowercase">{formatTime(end, timeFormat)}</span>
        </div>
      </div>
      <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/40 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function VirtuesCard() {
  const [virtue, setVirtue] = useState({ text: '', source: '' })

  useEffect(() => {
    setVirtue(getVirtue())
  }, [])

  return (
    <GlassCard className="p-5 border-none bg-primary/5 hover:bg-primary/10 transition-colors">
      <div className="space-y-3">
        <p className="text-sm italic leading-relaxed text-foreground/80">
          "{virtue.text}"
        </p>
        {virtue.source && (
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
            — {virtue.source}
          </p>
        )}
      </div>
    </GlassCard>
  )
}
function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-9 h-9" />

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full hover:bg-muted/50 relative overflow-hidden group"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <div className="relative h-5 w-5 transition-transform duration-500 group-hover:rotate-12">
        {isDark ? (
          <Sun className="w-5 h-5 text-yellow-400 fill-yellow-400/20 animate-in zoom-in duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-slate-700 fill-slate-700/10 animate-in zoom-in duration-300" />
        )}
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
