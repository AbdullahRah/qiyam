'use client'

import mixpanel from 'mixpanel-browser'
import { type ReactNode } from 'react'

const MIXPANEL_TOKEN = '84ec27c80608f55aee0db7d2c0d4d19f'

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
    mixpanel.init(MIXPANEL_TOKEN, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: true,
        persistence: 'localStorage',
        autocapture: true,
        record_sessions_percent: 100,
        ignore_dnt: true, // Ensure tracking works even with DNT enabled
        api_host: "https://api-js.mixpanel.com",
    })

    if (process.env.NODE_ENV === 'development') {
        console.log('Mixpanel Initialized with token:', MIXPANEL_TOKEN);
    }
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    return <>{children}</>
}
