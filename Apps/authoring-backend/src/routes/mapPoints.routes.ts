import { Router } from 'express';
import { 
  hideMapPoint, 
  showMapPoint, 
  getHiddenPoints, 
  getClusteringSuggestions, 
  applyClusteringSuggestions 
} from '../controllers/mapPoints.controller';

const router = Router();

// Route to hide a point from the map
router.delete('/api/v1/maps/:location/points', hideMapPoint as any);

// Route to show a point on the map
router.post('/api/v1/maps/:location/points', showMapPoint as any);

// Route to get hidden points for a location
router.get('/api/v1/maps/:location/hidden-points', getHiddenPoints as any);

// Route to get clustering suggestions
router.get('/api/v1/maps/:location/clustering', getClusteringSuggestions as any);

// Route to apply clustering suggestions
router.post('/api/v1/maps/:location/clustering', applyClusteringSuggestions as any);

export default router; 