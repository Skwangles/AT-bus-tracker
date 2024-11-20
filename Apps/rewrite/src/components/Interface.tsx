import { useEffect, useState } from 'react';
import { Compass, Loader2, Database } from 'lucide-react';
import { useTourStore } from '../store';

export const Interface = () => {
  const { currentNode, loading, error, initialized, initialize } = useTourStore();
  const [useApi, setUseApi] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    baseURL: '',
    apiKey: ''
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!initialized && !loading) {
      initialize();
    }
  }, [initialized, loading]);

  const handleSwitch = async () => {
    if (useApi && !apiConfig.baseURL) {
      alert('Please provide an API URL');
      return;
    }
    await initialize(useApi, apiConfig);
  };

  if (error) {
    return (
      <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="container mx-auto flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Compass className="w-6 h-6" />
            <span className="font-medium">{currentNode?.name}</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm opacity-75">
              Position: ({currentNode?.x}, {currentNode?.y}, {currentNode?.z})
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Database className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showConfig && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl">
          <h3 className="text-lg font-semibold mb-4">Data Source Configuration</h3>
          <div className="space-y-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useApi}
                onChange={(e) => setUseApi(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Use Remote API</span>
            </label>
            
            {useApi && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API URL
                  </label>
                  <input
                    type="text"
                    value={apiConfig.baseURL}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, baseURL: e.target.value }))}
                    placeholder="https://api.example.com"
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Your API key"
                    className="mt-1 w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitch}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};