import React from 'react'
import ReactDOM from 'react-dom/client'
import './css/index.css'
import VirtualTour from './components/VirtualTour.tsx'
import './css/App.css'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VirtualTour />
  </React.StrictMode>
)
