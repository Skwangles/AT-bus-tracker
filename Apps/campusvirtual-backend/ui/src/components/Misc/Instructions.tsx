import React from 'react'
import '../../css/Instructions.css'
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  MousePointer,
  MapPin,
  Search,
  Map,
  User,
  LogOut,
  Circle,
  Square,
  RotateCcw,
  Info,
} from 'react-feather'
import { useTranslation } from 'react-i18next'

interface InstructionsProps {
  point: { keyframe_id: number; location: string; ts: string }
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  className?: string
}

const isMobile = () => window.innerWidth <= 768

const Instructions: React.FC<InstructionsProps> = ({
  point,
  isOpen,
  setIsOpen,
  className = '',
}) => {
  const { t } = useTranslation('common');
  const mobile = isMobile()
  return (
    <div className={`stats-container ${className}`}>
      {isOpen && (
        <div className="stats">
          <h3 className="stats-heading">{t('instructions.title')}</h3>
          <ul className="instructions-list">
            {mobile ? (
              <>
                <li>
                  <MousePointer className="instruction-icon" />
                  <span>{t('instructions.navigation.mobile.look')}</span>
                </li>
              </>
            ) : (
              <>
                <li>
                  <span className="flex items-center gap-2">
                    <span className="key">W</span>
                    <span className="key">A</span>
                    <span className="key">S</span>
                    <span className="key">D</span>
                  </span>
                  <span>{t('instructions.navigation.desktop.move')}</span>
                </li>
                <li>
                  <span className="flex items-center gap-1">
                    <ArrowUp size={16} />
                    <ArrowLeft size={16} />
                    <ArrowDown size={16} />
                    <ArrowRight size={16} />
                  </span>
                  <span>{t('instructions.navigation.desktop.look')}</span>
                </li>
                <li>
                  <MousePointer className="instruction-icon" />
                  <span>{t('instructions.navigation.desktop.drag')}</span>
                </li>
              </>
            )}
            <li>
              <Circle className="instruction-icon" color="#ff4444" />
              <span>{t('instructions.navigation.jump')}</span>
            </li>
            <li>
              <MapPin className="instruction-icon" />
              <span>{t('instructions.navigation.location')}</span>
            </li>
          </ul>

          <h3 className="stats-heading">{t('instructions.search.title')}</h3>
          <ul className="instructions-list">
            <li>
              <Search className="instruction-icon" />
              <span>{t('instructions.search.useSearch')}</span>
            </li>
            <li>
              <Square className="instruction-icon" color="#ffd700" />
              <RotateCcw className="instruction-icon" color="#ffd700" />
              <span>{t('instructions.search.destination')}</span>
            </li>
            <li>
              <Circle className="instruction-icon" color="#4444ff" />
              <span>{t('instructions.search.path')}</span>
            </li>
          </ul>

          <h3 className="stats-heading">{t('instructions.map.title')}</h3>
          <ul className="instructions-list">
            <li>
              <Map className="instruction-icon" />
              <span>{t('instructions.map.open')}</span>
            </li>
            <li>
              <div className="map-legend">
                <div className="legend-item">
                  <User className="instruction-icon" />
                  <span>{t('instructions.map.legend.position')}</span>
                </div>
                <div className="legend-item">
                  <LogOut className="instruction-icon" />
                  <span>{t('instructions.map.legend.nextRegion')}</span>
                </div>
                <div className="legend-item">
                  <Circle className="instruction-icon" color="#ff4444" />
                  <span>{t('instructions.map.legend.viewingPoint')}</span>
                </div>
                <div className="legend-item">
                  <Circle className="instruction-icon" color="#4444ff" />
                  <span>{t('instructions.map.legend.highlightedPath')}</span>
                </div>
              </div>
            </li>
          </ul>

          <h3 className="stats-heading">{t('instructions.help.title')}</h3>
          <ul className="instructions-list">
            <li>
              <Info className="instruction-icon" />
              <span>{t('instructions.help.toggle')}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default Instructions
