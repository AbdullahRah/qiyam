'use client'

import { useState, useEffect, useCallback } from 'react'
import { QiyamSettings } from '@/types'
import mixpanel from 'mixpanel-browser'

const STORAGE_KEY = 'qiyam-settings'

const DEFAULT_SETTINGS: QiyamSettings = {
  location: { lat: 40.7128, lng: -74.0060 }, // Default: New York
  methodId: 2, // MWL
  convention: 'standard',
  timeFormat: '12h',
}

function loadSettings(): QiyamSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    console.error('Failed to load settings from localStorage')
  }

  return DEFAULT_SETTINGS
}

function saveSettings(settings: QiyamSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    console.error('Failed to save settings to localStorage')
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<QiyamSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    setIsLoaded(true)
  }, [])

  // Update settings
  const updateSettings = useCallback((updates: Partial<QiyamSettings>) => {
    if (updates.methodId) {
      mixpanel.track('Conversion', {
        'Conversion Type': 'Method Change',
        'method_id': updates.methodId
      });
    }
    if (updates.convention) {
      mixpanel.track('Conversion', {
        'Conversion Type': 'Convention Change',
        'convention': updates.convention
      });
    }

    setSettings((prev) => {
      const updated = { ...prev, ...updates }
      saveSettings(updated)
      return updated
    })
  }, [])

  // Toggle time format
  const toggleTimeFormat = useCallback(() => {
    updateSettings({
      timeFormat: settings.timeFormat === '12h' ? '24h' : '12h',
    })
  }, [settings.timeFormat, updateSettings])

  return {
    settings,
    updateSettings,
    toggleTimeFormat,
    isLoaded,
  }
}
