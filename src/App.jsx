import React, { useState } from 'react';
import Landing from './components/Landing';
import Host from './components/Host';
import Player from './components/Player';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('landing');
  return (
    <div className="app-wrap">
      <div className="app-inner">
        {screen === 'landing' && <Landing onHost={() => setScreen('host')} onPlayer={() => setScreen('player')} />}
        {screen === 'host' && <Host onBack={() => setScreen('landing')} />}
        {screen === 'player' && <Player onBack={() => setScreen('landing')} />}
      </div>
    </div>
  );
}
