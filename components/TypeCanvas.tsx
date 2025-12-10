import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppMode, Line, Point, Char } from '../types';
import { usePartySocket } from '../hooks/usePartySocket';
import { RemoteCursors } from './RemoteCursors';
import { Download, Trash2, Play, Pause } from 'lucide-react';

interface TypeCanvasProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const LETTER_SPACING = 12; // Distance between letters

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

  // Convert line characters into an SVG path string for textPath animation
  const getLinePath = (line: Line): string => {
    if (line.chars.length < 2) return '';
    return `M ${line.chars.map(c => `${c.x},${c.y}`).join(' L ')}`;
  };

  // Calculate the total length of a line path (for animation timing)
  const getLineLength = (line: Line): number => {
    if (line.chars.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < line.chars.length; i++) {
      const dx = line.chars[i].x - line.chars[i - 1].x;
      const dy = line.chars[i].y - line.chars[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

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

  // Helper function to add a single character to the canvas
  const addCharToCanvas = useCallback((charValue: string, activeId: string | null): { newActiveId: string | null; newLine?: Line } => {
    const user = currentUserRef.current;
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
      
      // Add the first character
      const finalChar: Char = {
        id: Math.random().toString(36).substr(2, 9),
        value: charValue,
        x: 0,
        y: 0,
      };
      const lineWithChar = { ...newLine, chars: [finalChar] };
      const newLines = [...linesRef.current, lineWithChar];
      setLines(newLines);
      addLine(lineWithChar);
      return { newActiveId: newLine.id, newLine: lineWithChar };
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
      return { newActiveId: currentLineId };
    }

    const angle = Math.atan2(dy, dx);

    // New relative position
    const newCharX = startX + Math.cos(angle) * LETTER_SPACING;
    const newCharY = startY + Math.sin(angle) * LETTER_SPACING;

    const finalChar: Char = {
      id: Math.random().toString(36).substr(2, 9),
      value: charValue,
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
    return { newActiveId: currentLineId };
  }, [setLines, addLine, updateLine]);

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
        const result = addCharToCanvas(e.key, activeId);
        if (result.newActiveId !== activeId) {
          setActiveLineId(result.newActiveId);
        }
      }
    }
  }, [setMode, selectedLineIds, setLines, addLine, updateLine, deleteLines, sendCursor, addCharToCanvas]);

  // Handle paste events
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const currentMode = modeRef.current;
    
    // Only handle paste in typing mode
    if (currentMode !== AppMode.TYPING) return;
    
    e.preventDefault();
    
    const clipboardText = e.clipboardData?.getData('text');
    if (!clipboardText) return;
    
    // Filter out newlines and other control characters, keep only printable chars
    const chars = clipboardText.split('').filter(char => char.length === 1 && char >= ' ');
    
    if (chars.length === 0) return;
    
    let currentActiveId = activeLineIdRef.current;
    
    // Add each character from the pasted text
    for (const char of chars) {
      const result = addCharToCanvas(char, currentActiveId);
      currentActiveId = result.newActiveId;
    }
    
    // Update the active line ID to the final state
    setActiveLineId(currentActiveId);
  }, [addCharToCanvas]); 

  // Attach global listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleMouseMove, handleKeyDown, handlePaste]);


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

  // --- Save Canvas as PNG ---
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSave = useCallback(() => {
    if (!svgRef.current) return;

    const svgElement = svgRef.current;
    const rect = svgElement.getBoundingClientRect();
    
    // Create a new clean SVG with only the text content
    const cleanSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cleanSvg.setAttribute('width', rect.width.toString());
    cleanSvg.setAttribute('height', rect.height.toString());
    cleanSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Add white background
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'white');
    cleanSvg.appendChild(bgRect);

    // Only copy line groups (marked with data-line-id)
    const lineGroups = svgElement.querySelectorAll('[data-line-id]');
    lineGroups.forEach(group => {
      const clonedGroup = group.cloneNode(true) as SVGGElement;
      // Remove hit area and selection highlight paths, keep only text
      const pathsToRemove = clonedGroup.querySelectorAll('path');
      pathsToRemove.forEach(p => p.remove());
      cleanSvg.appendChild(clonedGroup);
    });

    // Convert to data URL
    const svgData = new XMLSerializer().serializeToString(cleanSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create canvas and draw
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Add date stamp in bottom-right corner
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#9ca3af'; // gray-400
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(dateStr, canvas.width - 16, canvas.height - 12);
        
        // Download
        const link = document.createElement('a');
        link.download = `type-draw-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  // --- Clear Modal State ---
  const [showClearModal, setShowClearModal] = useState(false);

  // --- Animation State ---
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClearMyWork = useCallback(() => {
    const user = currentUserRef.current;
    if (!user) return;

    // Get all line IDs that belong to the current user
    const userLineIds = linesRef.current
      .filter(line => line.userId === user.id)
      .map(line => line.id);

    if (userLineIds.length > 0) {
      // Remove user's lines from local state
      const remainingLines = linesRef.current.filter(line => line.userId !== user.id);
      setLines(remainingLines);
      deleteLines(userLineIds);
    }
    
    setActiveLineId(null);
    setSelectedLineIds(new Set());
    setShowClearModal(false);
  }, [setLines, deleteLines]);

  const handleClearAll = useCallback(() => {
    const allLineIds = linesRef.current.map(line => line.id);
    
    if (allLineIds.length > 0) {
      setLines([]);
      deleteLines(allLineIds);
    }
    
    setActiveLineId(null);
    setSelectedLineIds(new Set());
    setShowClearModal(false);
  }, [setLines, deleteLines]);

  // --- Right-click to Erase Line ---
  const handleLineContextMenu = useCallback((e: React.MouseEvent, lineId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const user = currentUserRef.current;
    const line = linesRef.current.find(l => l.id === lineId);
    
    // Only allow erasing own lines
    if (line && user && line.userId === user.id) {
      const newLines = linesRef.current.filter(l => l.id !== lineId);
      setLines(newLines);
      deleteLines([lineId]);
      
      if (activeLineIdRef.current === lineId) {
        setActiveLineId(null);
      }
      setSelectedLineIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(lineId);
        return newSet;
      });
    }
  }, [setLines, deleteLines]);

  // --- Rendering ---
  
  const head = getActiveLineHead();

  return (
    <div 
      className="w-full h-screen bg-white overflow-hidden cursor-crosshair"
      onMouseDown={handleStageMouseDown}
      onMouseUp={handleStageMouseUp}
      onMouseMove={handleStageMouseMove}
    >
      <svg ref={svgRef} className="w-full h-full pointer-events-none">
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
              data-line-id={line.id}
              transform={`translate(${line.x}, ${line.y})`}
              className={`pointer-events-auto select-none transition-opacity ${mode === AppMode.NAVIGATION && isOwnLine ? 'cursor-move hover:opacity-70' : ''}`}
              onMouseDown={(e) => handleLineMouseDown(e, line.id)}
              onDoubleClick={(e) => handleLineDoubleClick(e, line.id)}
              onContextMenu={(e) => handleLineContextMenu(e, line.id)}
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
              {isAnimating && line.chars.length >= 2 ? (
                <>
                  {/* Define path for textPath animation */}
                  <defs>
                    <path
                      id={`path-${line.id}`}
                      d={getLinePath(line)}
                      fill="none"
                    />
                  </defs>
                  {/* Animated text along path - duplicated for seamless loop */}
                  <text
                    fill={line.color}
                    fontSize={line.fontSize}
                    fontFamily={line.fontFamily}
                    dominantBaseline="middle"
                    style={{ letterSpacing: `${LETTER_SPACING * 0.6}px` }}
                  >
                    <textPath
                      href={`#path-${line.id}`}
                      startOffset="0%"
                    >
                      <animate
                        attributeName="startOffset"
                        from="-50%"
                        to="0%"
                        dur={`${Math.max(2, getLineLength(line) / 60)}s`}
                        repeatCount="indefinite"
                      />
                      {/* Duplicate text for seamless looping */}
                      {line.chars.map(c => c.value).join('') + '   ' + line.chars.map(c => c.value).join('')}
                    </textPath>
                  </text>
                </>
              ) : (
                line.chars.map((char) => (
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
                ))
              )}
            </g>
          );
        })}
      </svg>

      {/* Action buttons */}
      <div className="fixed top-4 right-4 z-40 flex gap-4">
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          title={isAnimating ? "Stop animation" : "Start flow animation"}
        >
          {isAnimating ? <Pause size={14} /> : <Play size={14} />}
          <span>{isAnimating ? 'Stop' : 'Flow'}</span>
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          title="Save as PNG"
        >
          <Download size={14} />
          <span>Save</span>
        </button>
        <button
          onClick={() => setShowClearModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          title="Clear canvas"
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
      </div>

      {/* Clear Confirmation Dropdown */}
      {showClearModal && (
        <div className="fixed top-12 right-4 z-50 w-48 bg-white border border-gray-200 shadow-sm text-sm">
          <button
            onClick={handleClearMyWork}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
          >
            Clear my work
          </button>
          <button
            onClick={handleClearAll}
            className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 transition-colors"
          >
            Clear all
          </button>
          <button
            onClick={() => setShowClearModal(false)}
            className="w-full px-4 py-2 text-left text-gray-400 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            Cancel
          </button>
        </div>
      )}

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
