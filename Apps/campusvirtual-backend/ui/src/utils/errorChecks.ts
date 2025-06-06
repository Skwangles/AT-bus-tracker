import { API_PREFIX } from '../consts';

export const checkWebGLSupport = (): boolean => {
  console.log('Checking WebGL support...');
  try {
    const canvas = document.createElement('canvas');
    const hasWebGL = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
    console.log('WebGL support:', hasWebGL);
    return hasWebGL;
  } catch (e) {
    console.error('WebGL check failed:', e);
    return false;
  }
};

export const checkServerConnectivity = async (): Promise<boolean> => {
  console.log('Checking server connectivity...');
  try {
    const response = await fetch(`${API_PREFIX}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add a timeout to prevent long waits
      signal: AbortSignal.timeout(5000)
    });
    console.log('Server response:', response.ok);
    return response.ok;
  } catch (e) {
    console.error('Server connectivity check failed:', e);
    return false;
  }
}; 