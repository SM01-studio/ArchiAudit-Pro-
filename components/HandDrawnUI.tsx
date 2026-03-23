import React from 'react';

// Common Styles
// Font must be loaded in index.html (Patrick Hand or similar)
export const HAND_DRAWN_BORDER = "border-2 border-gray-800 rounded-md";
export const HAND_DRAWN_SHADOW = "shadow-[3px_3px_0px_0px_rgba(30,30,30,0.8)]";
export const HAND_DRAWN_HOVER = "transition-all duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(30,30,30,0.8)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export const SketchButton: React.FC<ButtonProps> = ({ children, variant = 'primary', fullWidth, className = '', ...props }) => {
  const baseStyle = `${HAND_DRAWN_BORDER} ${HAND_DRAWN_SHADOW} ${HAND_DRAWN_HOVER} px-6 py-2 font-hand font-bold text-lg flex items-center justify-center gap-2`;
  const bgStyle = variant === 'primary' ? 'bg-[#ffda79] text-gray-900' : 'bg-white text-gray-800';
  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button className={`${baseStyle} ${bgStyle} ${widthStyle} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const SketchCard: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => {
  return (
    <div className={`${HAND_DRAWN_BORDER} ${HAND_DRAWN_SHADOW} bg-[#fdfaf5] p-6 ${className}`}>
      {title && <h3 className="font-hand text-xl font-bold mb-4 border-b-2 border-gray-800 pb-2 border-dashed">{title}</h3>}
      {children}
    </div>
  );
};

export const SketchInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input 
      {...props} 
      className={`font-hand text-lg w-full bg-transparent border-b-2 border-gray-600 focus:border-black focus:outline-none py-2 px-1 ${props.className}`} 
    />
  );
};

export const SketchBadge: React.FC<{ text: string; color?: string }> = ({ text, color = 'bg-blue-100' }) => (
  <span className={`${HAND_DRAWN_BORDER} ${color} px-3 py-1 text-sm font-hand font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]`}>
    {text}
  </span>
);
