import React, { useState } from 'react';
import { TypeCanvas } from './components/TypeCanvas';
import { AboutModal } from './components/AboutModal';
import { AppMode } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.TYPING);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // If in navigation mode, clicking background doesn't do much, handled in Canvas
  
  return (
    <div className="relative w-screen h-screen bg-white">
      
      {/* Canvas Layer */}
      <TypeCanvas mode={mode} setMode={setMode} />

      {/* UI Layer */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {!isAboutOpen && (
        <button
          onClick={() => setIsAboutOpen(true)}
          className="fixed top-4 left-4 z-40 text-sm font-medium hover:underline"
        >
          About
        </button>
      )}
    </div>
  );
}

export default App;
