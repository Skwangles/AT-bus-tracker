import React from 'react'
import ReactDOM from 'react-dom/client'
import './css/index.css'
import VirtualTour from './components/VirtualTour.tsx'
import './css/App.css'
import posthog from 'posthog-js'

// Initialize PostHog
posthog.init(
  process.env.POSTHOG_API_KEY || 'YOUR_POSTHOG_API_KEY', // Replace with your PostHog API key
  {
    api_host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') posthog.debug()
    },
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
      recordCrossOriginIframes: false
    }
  }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VirtualTour />
  </React.StrictMode>
)
