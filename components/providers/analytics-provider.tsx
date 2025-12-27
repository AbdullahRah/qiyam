'use client'

import mixpanel from 'mixpanel-browser'
import { useEffect, type ReactNode } from 'react'

const MIXPANEL_TOKEN = '84ec27c80608f55aee0db7d2c0d4d19f'

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        mixpanel.init(MIXPANEL_TOKEN, {
            debug: process.env.NODE_ENV === 'development',
            track_pageview: true,
            persistence: 'localStorage',
            autocapture: true,
            record_sessions_percent: 100,
        })
    }, [])

    return <>{children}</>
}
