import React from 'react';
import { User } from '../types';

interface RemoteCursorsProps {
  users: Record<string, User>;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({ users }) => {
  return (
    <>
      {Object.values(users).map((user: User) => (
        <g key={user.id} transform={`translate(${user.cursor.x}, ${user.cursor.y})`}>
          {/* Cursor pointer shape */}
          <path
            d="M0,0 L0,16 L4,12 L8,20 L10,19 L6,11 L12,11 Z"
            fill={user.color}
            stroke="white"
            strokeWidth="1"
            style={{
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
          />
          {/* User color indicator dot */}
          <circle
            cx={16}
            cy={-4}
            r={6}
            fill={user.color}
            stroke="white"
            strokeWidth="2"
          />
        </g>
      ))}
    </>
  );
};

