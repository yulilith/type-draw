import { useEffect, useState, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { User, Line, Point, ClientMessage, ServerMessage } from '../types';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

interface UsePartySocketReturn {
  isConnected: boolean;
  currentUser: User | null;
  remoteUsers: Record<string, User>;
  lines: Line[];
  setLines: (lines: Line[]) => void;
  sendCursor: (cursor: Point) => void;
  addLine: (line: Line) => void;
  updateLine: (line: Line) => void;
  deleteLines: (lineIds: string[]) => void;
}

export function usePartySocket(roomId: string = 'main'): UsePartySocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, User>>({});
  const [lines, setLinesState] = useState<Line[]>([]);
  
  const socketRef = useRef<PartySocket | null>(null);
  const currentUserRef = useRef<User | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Send message helper
  const sendMessage = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Public API methods
  const sendCursor = useCallback((cursor: Point) => {
    sendMessage({ type: 'cursor', cursor });
  }, [sendMessage]);

  const addLine = useCallback((line: Line) => {
    sendMessage({ type: 'addLine', line });
  }, [sendMessage]);

  const updateLine = useCallback((line: Line) => {
    sendMessage({ type: 'updateLine', line });
  }, [sendMessage]);

  const deleteLines = useCallback((lineIds: string[]) => {
    sendMessage({ type: 'deleteLines', lineIds });
  }, [sendMessage]);

  const setLines = useCallback((newLines: Line[]) => {
    setLinesState(newLines);
    // Send full sync for user's lines
    if (currentUserRef.current) {
      const userLines = newLines.filter(l => l.userId === currentUserRef.current?.id);
      sendMessage({ type: 'lines', lines: userLines });
    }
  }, [sendMessage]);

  // Connect to PartyKit
  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      console.log('Connected to PartyKit');
      setIsConnected(true);
    });

    socket.addEventListener('close', () => {
      console.log('Disconnected from PartyKit');
      setIsConnected(false);
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        switch (message.type) {
          case 'init': {
            console.log('Received init:', message.user);
            setCurrentUser(message.user);
            
            // Set remote users (excluding self)
            const others: Record<string, User> = {};
            Object.entries(message.state.users).forEach(([id, user]) => {
              if (id !== message.userId) {
                others[id] = user;
              }
            });
            setRemoteUsers(others);
            
            // Set initial lines
            setLinesState(message.state.lines);
            break;
          }

          case 'userJoined': {
            console.log('User joined:', message.user.id);
            setRemoteUsers(prev => ({
              ...prev,
              [message.user.id]: message.user,
            }));
            break;
          }

          case 'userLeft': {
            console.log('User left:', message.userId);
            setRemoteUsers(prev => {
              const next = { ...prev };
              delete next[message.userId];
              return next;
            });
            break;
          }

          case 'cursor': {
            setRemoteUsers(prev => {
              if (prev[message.userId]) {
                return {
                  ...prev,
                  [message.userId]: {
                    ...prev[message.userId],
                    cursor: message.cursor,
                  },
                };
              }
              return prev;
            });
            break;
          }

          case 'sync': {
            setLinesState(message.lines);
            break;
          }

          case 'addLine': {
            setLinesState(prev => [...prev, message.line]);
            break;
          }

          case 'updateLine': {
            setLinesState(prev => 
              prev.map(l => l.id === message.line.id ? message.line : l)
            );
            break;
          }

          case 'deleteLines': {
            setLinesState(prev => 
              prev.filter(l => !message.lineIds.includes(l.id))
            );
            break;
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });

    return () => {
      socket.close();
    };
  }, [roomId]);

  return {
    isConnected,
    currentUser,
    remoteUsers,
    lines,
    setLines,
    sendCursor,
    addLine,
    updateLine,
    deleteLines,
  };
}

