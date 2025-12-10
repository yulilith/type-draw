export interface Point {
  x: number;
  y: number;
}

export interface Char {
  id: string;
  value: string;
  x: number;
  y: number;
}

export interface Line {
  id: string;
  chars: Char[];
  x: number; // Origin X offset for the whole line
  y: number; // Origin Y offset for the whole line
  // Multi-user properties
  userId: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

export interface User {
  id: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  cursor: Point;
}

export enum AppMode {
  TYPING = 'TYPING',
  NAVIGATION = 'NAVIGATION',
}

// Message types for PartyKit communication
export type ClientMessage =
  | { type: 'cursor'; cursor: Point }
  | { type: 'lines'; lines: Line[] }
  | { type: 'addLine'; line: Line }
  | { type: 'updateLine'; line: Line }
  | { type: 'deleteLines'; lineIds: string[] };

export type ServerMessage =
  | { type: 'init'; userId: string; user: User; state: { users: Record<string, User>; lines: Line[] } }
  | { type: 'userJoined'; user: User }
  | { type: 'userLeft'; userId: string }
  | { type: 'cursor'; userId: string; cursor: Point }
  | { type: 'sync'; lines: Line[] }
  | { type: 'addLine'; line: Line }
  | { type: 'updateLine'; line: Line }
  | { type: 'deleteLines'; lineIds: string[] };
