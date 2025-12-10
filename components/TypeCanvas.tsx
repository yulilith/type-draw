import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppMode, Line, Point, Char } from '../types';

interface TypeCanvasProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const LETTER_SPACING = 12; // Distance between letters
const ARROW_SPEED = 20; // Pixels to move target per arrow key press

export const TypeCanvas: React.FC<TypeCanvasProps> = ({ mode, setMode }) => {
  // --- State ---
  const [lines, setLines] = useState<Line[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  
  // The global "cursor" target position (where letters flow towards)
  const [targetPos, setTargetPos] = useState<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
  // Using refs for values needed in event listeners to avoid stale closures without frequent re-renders
  const modeRef = useRef(mode);
  const activeLineIdRef = useRef(activeLineId);
  const linesRef = useRef(lines);
  const targetPosRef = useRef(targetPos);
  
  // Update refs when state changes
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { activeLineIdRef.current = activeLineId; }, [activeLineId]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { targetPosRef.current = targetPos; }, [targetPos]);

  // --- Helpers ---

  const createLine = (x: number, y: number): Line => ({
    id: Math.random().toString(36).substr(2, 9),
    chars: [],
    x,
    y,
  });

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
    setTargetPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentMode = modeRef.current;
    const activeId = activeLineIdRef.current;

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
        // Delete selected lines
        setLines(prev => prev.filter(l => !selectedLineIds.has(l.id)));
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
          return { x: prev.x + move.x, y: prev.y + move.y };
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
          setLines(prev => prev.map(line => {
            if (line.id !== activeId) return line;
            const newChars = line.chars.slice(0, -1);
            return { ...line, chars: newChars };
          }).filter(line => line.chars.length > 0));
        }
        return;
      }

      // Typing characters
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setLines(prev => {
          let newLineList = [...prev];
          let currentLineId = activeId;
          let currentLine = newLineList.find(l => l.id === currentLineId);

          // If no active line, or active line not found, start a new one at cursor
          if (!currentLineId || !currentLine) {
            const newLine = createLine(targetPosRef.current.x, targetPosRef.current.y);
            newLineList.push(newLine);
            currentLineId = newLine.id;
            currentLine = newLine;
            setActiveLineId(newLine.id);
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
          const angle = Math.atan2(dy, dx);

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
          return newLineList.map(l => {
            if (l.id === currentLineId) {
              return { ...l, chars: [...l.chars, finalChar] };
            }
            return l;
          });
        });
      }
    }
  }, [setMode, selectedLineIds]); 

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

        // Start Drag
        const line = lines.find(l => l.id === lineId);
        if (line) {
          setDraggingLineId(lineId);
          setDragOffset({
            x: e.clientX - line.x,
            y: e.clientY - line.y
          });
        }
    } else if (mode === AppMode.TYPING) {
        // In typing mode, clicking a line selects it to continue typing
        setActiveLineId(lineId);
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
      setLines(prev => prev.map(l => {
        if (l.id === draggingLineId) {
          return {
            ...l,
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          };
        }
        return l;
      }));
    }
  };

  const handleStageMouseUp = () => {
    setDraggingLineId(null);
  };

  const handleLineDoubleClick = (e: React.MouseEvent, lineId: string) => {
    e.stopPropagation();
    setMode(AppMode.TYPING);
    setActiveLineId(lineId);
    setSelectedLineIds(new Set());
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
            stroke="#ff0000" 
            strokeWidth="1" 
            strokeOpacity="0.2"
          />
        )}
        
        {/* Target Cursor Indicator */}
        {mode === AppMode.TYPING && (
          <circle 
            cx={targetPos.x} 
            cy={targetPos.y} 
            r={8} 
            fill="orange" 
          />
        )}

        {/* Draw Lines */}
        {lines.map(line => {
          const isSelected = selectedLineIds.has(line.id);
          
          return (
            <g 
              key={line.id} 
              transform={`translate(${line.x}, ${line.y})`}
              className={`pointer-events-auto select-none transition-opacity ${mode === AppMode.NAVIGATION ? 'cursor-move hover:opacity-70' : ''}`}
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

              {/* Text */}
              {line.chars.map((char) => (
                <text
                  key={char.id}
                  x={char.x}
                  y={char.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="black"
                  fontSize="16"
                  className="font-sans"
                >
                  {char.value}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="fixed bottom-4 right-4 text-xs text-gray-400 pointer-events-none select-none">
        {mode === AppMode.TYPING ? 'TYPING' : 'NAVIGATION'} MODE
      </div>
    </div>
  );
};