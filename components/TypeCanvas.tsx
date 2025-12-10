import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppMode, Line, Point, Char } from '../types';
import { usePartySocket } from '../hooks/usePartySocket';
import { RemoteCursors } from './RemoteCursors';

interface TypeCanvasProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const LETTER_SPACING = 12; // Distance between letters
const ARROW_SPEED = 20; // Pixels to move target per arrow key press
const SNAP_THRESHOLD = Math.PI / 12; // ~15 degrees - snap to horizontal if within this angle

export const TypeCanvas: React.FC<TypeCanvasProps> = ({ mode, setMode }) => {
  // --- Multi-user State ---
  const {
    isConnected,
    currentUser,
    remoteUsers,
    lines,
    setLines,
    sendCursor,
    addLine,
    updateLine,
    deleteLines,
  } = usePartySocket('main');

  // --- Local State ---
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  
  // The global "cursor" target position (where letters flow towards)
  const [targetPos, setTargetPos] = useState<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
  // Using refs for values needed in event listeners to avoid stale closures without frequent re-renders
  const modeRef = useRef(mode);
  const activeLineIdRef = useRef(activeLineId);
  const linesRef = useRef(lines);
  const targetPosRef = useRef(targetPos);
  const currentUserRef = useRef(currentUser);
  
  // Update refs when state changes
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { activeLineIdRef.current = activeLineId; }, [activeLineId]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { targetPosRef.current = targetPos; }, [targetPos]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // --- Helpers ---

  const createLine = (x: number, y: number): Line => {
    const user = currentUserRef.current;
    return {
      id: Math.random().toString(36).substr(2, 9),
      chars: [],
      x,
      y,
      userId: user?.id || 'local',
      color: user?.color || '#000000',
      fontSize: user?.fontSize || 16,
      fontFamily: user?.fontFamily || 'sans-serif',
    };
  };

  const getActiveLineHead = (): Point => {
    const currentLines = linesRef.current;
    const activeId = activeLineIdRef.current;
    if (!activeId) return targetPosRef.current;

    const line = currentLines.find(l => l.id === activeId);
    if (!line) return targetPosRef.current;

    if (line.chars.length === 0) {
      return { x: line.x, y: line.y };
    }

    const lastChar = line.chars[line.chars.length - 1];
    return { x: line.x + lastChar.x, y: line.y + lastChar.y };
  };

  // --- Event Handlers ---

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const newPos = { x: e.clientX, y: e.clientY };
    setTargetPos(newPos);
    sendCursor(newPos);
  }, [sendCursor]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentMode = modeRef.current;
    const activeId = activeLineIdRef.current;
    const user = currentUserRef.current;

    // --- Mode Switching ---
    if (e.key === 'Escape') {
      if (currentMode === AppMode.TYPING) {
        setMode(AppMode.NAVIGATION);
        setActiveLineId(null);
        setSelectedLineIds(new Set());
      } else {
        setMode(AppMode.TYPING);
      }
      return;
    }

    // --- Navigation Mode Controls ---
    if (currentMode === AppMode.NAVIGATION) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Only delete lines that belong to the current user
        const toDelete: string[] = [];
        selectedLineIds.forEach(id => {
          const line = linesRef.current.find(l => l.id === id);
          if (line && line.userId === user?.id) {
            toDelete.push(id);
          }
        });
        
        if (toDelete.length > 0) {
          setLines(linesRef.current.filter(l => !toDelete.includes(l.id)));
          deleteLines(toDelete);
        }
        setSelectedLineIds(new Set());
      }
      return;
    }

    // --- Typing Mode Controls ---
    if (currentMode === AppMode.TYPING) {
      
      // Arrow keys to move target
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setTargetPos(prev => {
          const move = { x: 0, y: 0 };
          if (e.key === 'ArrowUp') move.y = -ARROW_SPEED;
          if (e.key === 'ArrowDown') move.y = ARROW_SPEED;
          if (e.key === 'ArrowLeft') move.x = -ARROW_SPEED;
          if (e.key === 'ArrowRight') move.x = ARROW_SPEED;
          const newPos = { x: prev.x + move.x, y: prev.y + move.y };
          sendCursor(newPos);
          return newPos;
        });
        return;
      }

      // Enter: Start new line
      if (e.key === 'Enter') {
        setActiveLineId(null); 
        return;
      }

      // Backspace: Remove last char
      if (e.key === 'Backspace') {
        if (activeId) {
          const line = linesRef.current.find(l => l.id === activeId);
          // Only allow editing own lines
          if (line && line.userId === user?.id) {
            const newChars = line.chars.slice(0, -1);
            if (newChars.length === 0) {
              // Remove the line entirely
              const newLines = linesRef.current.filter(l => l.id !== activeId);
              setLines(newLines);
              deleteLines([activeId]);
              setActiveLineId(null);
            } else {
              const updatedLine = { ...line, chars: newChars };
              const newLines = linesRef.current.map(l => 
                l.id === activeId ? updatedLine : l
              );
              setLines(newLines);
              updateLine(updatedLine);
            }
          }
        }
        return;
      }

      // Typing characters
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        let currentLineId = activeId;
        let currentLine = linesRef.current.find(l => l.id === currentLineId);

        // Can only continue typing on own lines
        if (currentLine && currentLine.userId !== user?.id) {
          currentLine = undefined;
          currentLineId = null;
        }

        // If no active line, or active line not found, start a new one at cursor
        if (!currentLineId || !currentLine) {
          const newLine = createLine(targetPosRef.current.x, targetPosRef.current.y);
          currentLineId = newLine.id;
          currentLine = newLine;
          setActiveLineId(newLine.id);
          
          // Add the first character
          const finalChar: Char = {
            id: Math.random().toString(36).substr(2, 9),
            value: e.key,
            x: 0,
            y: 0,
          };
          const lineWithChar = { ...newLine, chars: [finalChar] };
          const newLines = [...linesRef.current, lineWithChar];
          setLines(newLines);
          addLine(lineWithChar);
          return;
        }

        // Calculate position for new char
        let startX = 0;
        let startY = 0;

        if (currentLine.chars.length > 0) {
          const lastChar = currentLine.chars[currentLine.chars.length - 1];
          startX = lastChar.x;
          startY = lastChar.y;
        }

        // Global position of the "head" of the line
        const globalHeadX = currentLine.x + startX;
        const globalHeadY = currentLine.y + startY;

        // Vector to target
        const dx = targetPosRef.current.x - globalHeadX;
        const dy = targetPosRef.current.y - globalHeadY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If there's not enough space for a new letter (distance to target is too small), don't add it
        if (currentLine.chars.length > 0 && distance < LETTER_SPACING) {
          return;
        }

        let angle = Math.atan2(dy, dx);

        // Snap to horizontal line if angle is close enough
        // Check if close to 0 (right) or π/-π (left)
        if (Math.abs(angle) < SNAP_THRESHOLD) {
          angle = 0; // Snap to horizontal right
        } else if (Math.abs(angle - Math.PI) < SNAP_THRESHOLD || Math.abs(angle + Math.PI) < SNAP_THRESHOLD) {
          angle = dx >= 0 ? 0 : Math.PI; // Snap to horizontal left
        }

        // New relative position
        const newCharX = startX + Math.cos(angle) * LETTER_SPACING;
        const newCharY = startY + Math.sin(angle) * LETTER_SPACING;

        const finalChar: Char = {
          id: Math.random().toString(36).substr(2, 9),
          value: e.key,
          x: currentLine.chars.length === 0 ? 0 : newCharX,
          y: currentLine.chars.length === 0 ? 0 : newCharY,
        };

        // Update the line
        const updatedLine = { ...currentLine, chars: [...currentLine.chars, finalChar] };
        const newLines = linesRef.current.map(l => 
          l.id === currentLineId ? updatedLine : l
        );
        setLines(newLines);
        updateLine(updatedLine);
      }
    }
  }, [setMode, selectedLineIds, setLines, addLine, updateLine, deleteLines, sendCursor]); 

  // Attach global listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseMove, handleKeyDown]);


  // --- Dragging Logic for Navigation ---
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  const handleLineMouseDown = (e: React.MouseEvent, lineId: string) => {
    e.stopPropagation(); // Prevent stage click

    if (mode === AppMode.NAVIGATION) {
        // Select logic
        setSelectedLineIds(prev => {
          const newSet = new Set(prev);
          if (e.shiftKey) {
            if (newSet.has(lineId)) newSet.delete(lineId);
            else newSet.add(lineId);
          } else {
            newSet.clear();
            newSet.add(lineId);
          }
          return newSet;
        });

        // Start Drag - only for own lines
        const line = lines.find(l => l.id === lineId);
        if (line && line.userId === currentUser?.id) {
          setDraggingLineId(lineId);
          setDragOffset({
            x: e.clientX - line.x,
            y: e.clientY - line.y
          });
        }
    } else if (mode === AppMode.TYPING) {
        // In typing mode, clicking a line selects it to continue typing (only own lines)
        const line = lines.find(l => l.id === lineId);
        if (line && line.userId === currentUser?.id) {
          setActiveLineId(lineId);
        }
    }
  };

  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (mode === AppMode.TYPING) {
      // Click on background -> Start new line at this position
      setActiveLineId(null);
      setTargetPos({ x: e.clientX, y: e.clientY });
    } else if (mode === AppMode.NAVIGATION) {
      // Click on background -> Deselect all
      setSelectedLineIds(new Set());
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (draggingLineId && mode === AppMode.NAVIGATION) {
      const line = lines.find(l => l.id === draggingLineId);
      if (line && line.userId === currentUser?.id) {
        const updatedLine = {
          ...line,
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        };
        const newLines = lines.map(l => 
          l.id === draggingLineId ? updatedLine : l
        );
        setLines(newLines);
        updateLine(updatedLine);
      }
    }
  };

  const handleStageMouseUp = () => {
    setDraggingLineId(null);
  };

  const handleLineDoubleClick = (e: React.MouseEvent, lineId: string) => {
    e.stopPropagation();
    const line = lines.find(l => l.id === lineId);
    // Only allow editing own lines
    if (line && line.userId === currentUser?.id) {
      setMode(AppMode.TYPING);
      setActiveLineId(lineId);
      setSelectedLineIds(new Set());
    }
  };

  // --- Rendering ---
  
  const head = getActiveLineHead();

  return (
    <div 
      className="w-full h-screen bg-white overflow-hidden cursor-crosshair"
      onMouseDown={handleStageMouseDown}
      onMouseUp={handleStageMouseUp}
      onMouseMove={handleStageMouseMove}
    >
      <svg className="w-full h-full pointer-events-none">
        {/* Draw Guide Line in Typing Mode */}
        {mode === AppMode.TYPING && activeLineId && (
          <line 
            x1={head.x} 
            y1={head.y} 
            x2={targetPos.x} 
            y2={targetPos.y} 
            stroke={currentUser?.color || '#ff0000'} 
            strokeWidth="1" 
            strokeOpacity="0.2"
          />
        )}
        
        {/* Target Cursor Indicator - uses user's color */}
        {mode === AppMode.TYPING && (
          <circle 
            cx={targetPos.x} 
            cy={targetPos.y} 
            r={8} 
            fill={currentUser?.color || 'orange'} 
          />
        )}

        {/* Remote Users' Cursors */}
        <RemoteCursors users={remoteUsers} />

        {/* Draw Lines */}
        {lines.map(line => {
          const isSelected = selectedLineIds.has(line.id);
          const isOwnLine = line.userId === currentUser?.id;
          
          return (
            <g 
              key={line.id} 
              transform={`translate(${line.x}, ${line.y})`}
              className={`pointer-events-auto select-none transition-opacity ${mode === AppMode.NAVIGATION && isOwnLine ? 'cursor-move hover:opacity-70' : ''}`}
              onMouseDown={(e) => handleLineMouseDown(e, line.id)}
              onDoubleClick={(e) => handleLineDoubleClick(e, line.id)}
            >
              {/* Invisible Hit Area for easier selection */}
              {mode === AppMode.NAVIGATION && (
                 <path 
                   d={`M${line.chars.map(c => `${c.x},${c.y}`).join(' L')}`} 
                   stroke="transparent" 
                   strokeWidth="20" 
                   fill="none" 
                 />
              )}
              
              {/* Selection Highlight */}
              {isSelected && mode === AppMode.NAVIGATION && (
                 <path 
                   d={line.chars.length > 1 ? `M${line.chars.map(c => `${c.x},${c.y}`).join(' L')}` : ''} 
                   stroke="#e5e7eb" 
                   strokeWidth="18" 
                   strokeLinecap="round"
                   fill="none" 
                 />
              )}

              {/* Text - uses line's color, font, and size */}
              {line.chars.map((char) => (
                <text
                  key={char.id}
                  x={char.x}
                  y={char.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={line.color}
                  fontSize={line.fontSize}
                  fontFamily={line.fontFamily}
                >
                  {char.value}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Status indicator */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400 pointer-events-none select-none flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span 
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          {Object.keys(remoteUsers).length > 0 && (
            <span>• {Object.keys(remoteUsers).length + 1} users online</span>
          )}
        </div>
        <div>{mode === AppMode.TYPING ? 'TYPING' : 'NAVIGATION'} MODE</div>
        {currentUser && (
          <div className="flex items-center gap-1">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: currentUser.color }}
            />
            <span style={{ fontFamily: currentUser.fontFamily, fontSize: '10px' }}>
              {currentUser.fontFamily} • {currentUser.fontSize}px
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
