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
        <h2 className="font-medium text-base">HOW TO USE</h2>
        <button 
          onClick={onClose}
          className="hover:bg-gray-100 p-1 rounded transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <ul className="list-disc pl-5 space-y-1 text-gray-800">
            <li>Use your cursor to set the target position</li>
            <li>Type to place the letters along the path created by your cursor</li>
            <li>Enter to start a new line</li>
            <li>
              Escape to go into navigation mode where you can
              select, move and delete lines. Double click on a line
              to edit it
            </li>
            <li>Right-click on a line to erase it</li>
            <li>See other users' cursors and lines on your canvas</li>
            <li>Use the Flow button to start the animation</li>
            <li>Use the Save button to download your canvas as PNG</li>
            <li>Use the Clear button to erase all your lines</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
