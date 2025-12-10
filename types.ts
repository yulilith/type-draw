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
}

export enum AppMode {
  TYPING = 'TYPING',
  NAVIGATION = 'NAVIGATION',
}
