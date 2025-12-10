import React from 'react';
import { X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-4 z-50 w-[400px] max-w-[90vw] bg-white border border-gray-200 shadow-sm text-sm text-black">
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
        <h2 className="font-medium text-base">About</h2>
        <button 
          onClick={onClose}
          className="hover:bg-gray-100 p-1 rounded transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <p>
          Type is a directed typing experiment. You choose the
          direction the letters flow.
        </p>

        <div>
          <h3 className="font-medium mb-2">Controls</h3>
          <ul className="list-disc pl-5 space-y-1 text-gray-800">
            <li>Use the mouse or arrow keys to set the target</li>
            <li>Type to place the letters</li>
            <li>Enter to start a new line</li>
            <li>
              Escape to go into navigation mode where you can
              select, move and delete lines. Double click on a line
              to edit it
            </li>
          </ul>
        </div>

        <p className="pt-2">
          A <a href="#" className="underline decoration-1 underline-offset-2 hover:text-gray-600">Constraint Systems</a> project
        </p>
      </div>
    </div>
  );
};
