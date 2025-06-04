import React from 'react'
import ReactDOM from 'react-dom/client'
import './css/index.css'
import './css/App.css'
import VirtualTourContent from './components/VirtualTour'
import './i18n/i18n'  // Import i18n configuration

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VirtualTourContent />
  </React.StrictMode>
)
