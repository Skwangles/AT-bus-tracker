import { useTranslation } from 'react-i18next'
import ClearIcon from '@mui/icons-material/Clear'

export default function ClearPathfindingButton({ showButton, handleClearPath }: { showButton: boolean, handleClearPath: () => void }) {
    const { t } = useTranslation('common')
    
    return (
        <>
        {showButton && (
          <div 
            className="fixed z-[997] flex justify-center"
            style={{
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '10px',
            }}
          >
            <button
              className="px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-200 hover:shadow-xl flex items-center gap-2"
              style={{ 
                background: '#F87171',
                color: 'white', 
                border: 'none',
                backdropFilter: 'blur(10px)',
              }}
              onClick={handleClearPath}
              aria-label="Clear pathfinding"
            >
              <ClearIcon sx={{ fontSize: 20 }} />
              {t('pathfinding.clear', 'Clear Path')}
            </button>
          </div>
        )}
        </>
    )
}