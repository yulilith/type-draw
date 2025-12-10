import type * as Party from "partykit/server";

// User styling options
const COLORS = ['#A6CEE3', '#1F78B4', '#B2DF8A', '#33A02C', '#FB9A99', '#E31A1C', '#FDBF6F'];
const FONT_SIZES = [11, 18, 28];
const FONT_FAMILIES = ['Space Mono', 'Playfair Display', 'Inter'];

interface Point {
  x: number;
  y: number;
}

interface User {
  id: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  cursor: Point;
}

interface Char {
  id: string;
  value: string;
  x: number;
  y: number;
}

interface Line {
  id: string;
  chars: Char[];
  x: number;
  y: number;
  userId: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

interface RoomState {
  users: Record<string, User>;
  lines: Line[];
}

// Message types
type ClientMessage =
  | { type: 'cursor'; cursor: Point }
  | { type: 'lines'; lines: Line[] }
  | { type: 'addLine'; line: Line }
  | { type: 'updateLine'; line: Line }
  | { type: 'deleteLines'; lineIds: string[] };

type ServerMessage =
  | { type: 'init'; userId: string; user: User; state: RoomState }
  | { type: 'userJoined'; user: User }
  | { type: 'userLeft'; userId: string }
  | { type: 'cursor'; userId: string; cursor: Point }
  | { type: 'sync'; lines: Line[] }
  | { type: 'addLine'; line: Line }
  | { type: 'updateLine'; line: Line }
  | { type: 'deleteLines'; lineIds: string[] };

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getUnusedOrRandom<T>(options: T[], usedValues: T[]): T {
  const unused = options.filter(opt => !usedValues.includes(opt));
  if (unused.length > 0) {
    return randomChoice(unused);
  }
  return randomChoice(options);
}

export default class TypeDrawServer implements Party.Server {
  state: RoomState = {
    users: {},
    lines: [],
  };

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const currentUsers = Object.values(this.state.users);
    const userCount = currentUsers.length;

    // Get currently used values
    const usedColors = currentUsers.map(u => u.color);
    const usedFonts = currentUsers.map(u => u.fontFamily);
    const usedSizes = currentUsers.map(u => u.fontSize);

    // Assign color: unique if ≤7 users (we have 7 colors)
    const color = userCount < COLORS.length 
      ? getUnusedOrRandom(COLORS, usedColors)
      : randomChoice(COLORS);

    // Assign font: unique if ≤3 users (we have 3 fonts)
    const fontFamily = userCount < FONT_FAMILIES.length
      ? getUnusedOrRandom(FONT_FAMILIES, usedFonts)
      : randomChoice(FONT_FAMILIES);

    // Assign font size: unique if ≤3 users (we have 3 sizes)
    const fontSize = userCount < FONT_SIZES.length
      ? getUnusedOrRandom(FONT_SIZES, usedSizes)
      : randomChoice(FONT_SIZES);

    const user: User = {
      id: conn.id,
      color,
      fontSize,
      fontFamily,
      cursor: { x: 0, y: 0 },
    };

    this.state.users[conn.id] = user;

    // Send init message with user info and current state
    const initMessage: ServerMessage = {
      type: 'init',
      userId: conn.id,
      user,
      state: this.state,
    };
    conn.send(JSON.stringify(initMessage));

    // Broadcast to others that a new user joined
    const joinMessage: ServerMessage = {
      type: 'userJoined',
      user,
    };
    this.room.broadcast(JSON.stringify(joinMessage), [conn.id]);

    console.log(`User ${conn.id} connected with color ${user.color}`);
  }

  onClose(conn: Party.Connection) {
    // Remove user from state
    delete this.state.users[conn.id];

    // Broadcast that user left
    const leaveMessage: ServerMessage = {
      type: 'userLeft',
      userId: conn.id,
    };
    this.room.broadcast(JSON.stringify(leaveMessage));

    console.log(`User ${conn.id} disconnected`);
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as ClientMessage;

      switch (data.type) {
        case 'cursor': {
          // Update user cursor in state
          if (this.state.users[sender.id]) {
            this.state.users[sender.id].cursor = data.cursor;
          }

          // Broadcast cursor position to all other users
          const cursorMessage: ServerMessage = {
            type: 'cursor',
            userId: sender.id,
            cursor: data.cursor,
          };
          this.room.broadcast(JSON.stringify(cursorMessage), [sender.id]);
          break;
        }

        case 'addLine': {
          // Add line to state
          this.state.lines.push(data.line);

          // Broadcast to all other users
          const addMessage: ServerMessage = {
            type: 'addLine',
            line: data.line,
          };
          this.room.broadcast(JSON.stringify(addMessage), [sender.id]);
          break;
        }

        case 'updateLine': {
          // Update line in state
          const lineIndex = this.state.lines.findIndex(l => l.id === data.line.id);
          if (lineIndex !== -1) {
            this.state.lines[lineIndex] = data.line;
          }

          // Broadcast to all other users
          const updateMessage: ServerMessage = {
            type: 'updateLine',
            line: data.line,
          };
          this.room.broadcast(JSON.stringify(updateMessage), [sender.id]);
          break;
        }

        case 'deleteLines': {
          // Remove lines from state
          this.state.lines = this.state.lines.filter(
            l => !data.lineIds.includes(l.id)
          );

          // Broadcast to all other users
          const deleteMessage: ServerMessage = {
            type: 'deleteLines',
            lineIds: data.lineIds,
          };
          this.room.broadcast(JSON.stringify(deleteMessage), [sender.id]);
          break;
        }

        case 'lines': {
          // Full sync from a user (used after major changes)
          // Update only lines owned by this user
          const otherLines = this.state.lines.filter(l => l.userId !== sender.id);
          const userLines = data.lines.filter(l => l.userId === sender.id);
          this.state.lines = [...otherLines, ...userLines];

          // Broadcast sync to all other users
          const syncMessage: ServerMessage = {
            type: 'sync',
            lines: this.state.lines,
          };
          this.room.broadcast(JSON.stringify(syncMessage), [sender.id]);
          break;
        }
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  }
}

TypeDrawServer satisfies Party.Worker;

