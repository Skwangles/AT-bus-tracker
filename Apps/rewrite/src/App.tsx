import { Scene } from './components/Scene';
import { Interface } from './components/Interface';
import { Minimap } from './components/Minimap';
import { Search } from './components/Search';

function App() {
  return (
    <div className="w-full h-screen relative">
      <Scene />
      <Interface />
      <Minimap />
      <Search />
    </div>
  );
}

export default App;