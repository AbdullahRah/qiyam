'use client'

import mixpanel from 'mixpanel-browser'
import { useEffect, type ReactNode } from 'react'

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        // Since Mixpanel is initialized in the head by next/script, 
        // we can proceed directly to tracking.

        // Create a profile for this anonymous user so they appear in the Explore/Users tab
        mixpanel.people.set({
            'Last Seen': new Date().toISOString(),
            'User Type': 'Anonymous visitor'
        });

        // Track the start of their visit explicitly
        mixpanel.track('Session Start');

        if (process.env.NODE_ENV === 'development') {
            console.log('AnalyticsProvider: Session tracked');
        }
    }, [])

    return <>{children}</>
}
