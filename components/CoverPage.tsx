
import React from 'react';
import { SketchButton } from './HandDrawnUI';

interface Props {
  onStart: () => void;
}

export const CoverPage: React.FC<Props> = ({ onStart }) => {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#f7f5f0] flex flex-col items-center justify-center">
      
      {/* Background Layer: Hand-drawn Sketch Effect */}
      <div 
        className="absolute inset-0 z-0 opacity-20 bg-cover bg-center grayscale contrast-125"
        style={{
            // Using a high-quality architectural sketch/blueprint style image
            backgroundImage: "url('https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=2940&auto=format&fit=crop')"
        }}
      />
      
      {/* Texture Overlay: Grid Paper */}
      <div className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      {/* Vignette */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(247,245,240,1)_90%)] pointer-events-none"></div>

      {/* Main Content Card */}
      <div className="relative z-10 max-w-3xl w-full px-6 animate-fade-in">
        <div className="bg-white/80 backdrop-blur-sm border-4 border-gray-900 p-12 text-center shadow-[10px_10px_0px_0px_rgba(30,30,30,0.9)] transform rotate-[-1deg] hover:rotate-0 transition-transform duration-500 ease-out">
            
            {/* Logo Mark */}
            <div className="w-16 h-16 bg-black mx-auto mb-6 flex items-center justify-center shadow-lg">
                <span className="text-white font-hand font-bold text-4xl">A</span>
            </div>

            <h1 className="font-hand text-6xl md:text-7xl font-bold tracking-tight text-gray-900 mb-2">
              ArchiAudit <span className="text-3xl text-gray-500 font-normal">Pro</span>
            </h1>
            
            <div className="h-1 w-32 bg-gray-900 mx-auto mb-6"></div>

            <p className="font-hand text-2xl text-gray-700 mb-2">
              AI-Driven Residential Design Review
            </p>
            <p className="font-hand text-lg text-gray-500 mb-10">
              专业住宅平面图审核与优化 · 你的私人AI设计总监
            </p>

            {/* Feature List (Subtle) */}
            <div className="flex justify-center gap-8 mb-10 text-gray-600 font-hand text-sm uppercase tracking-widest">
                <span className="flex items-center gap-1">✦ Design Audit</span>
                <span className="flex items-center gap-1">✦ Layout Optimization</span>
                <span className="flex items-center gap-1">✦ Gemini 2.5 Flash</span>
            </div>

            <div className="flex justify-center">
                <SketchButton 
                    onClick={onStart} 
                    className="text-2xl px-16 py-4 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-105 active:scale-95"
                >
                    Enter Studio / 进入设计室
                </SketchButton>
            </div>
        </div>
      </div>

      {/* Footer copyright on cover */}
      <div className="absolute bottom-6 text-gray-400 font-hand text-sm z-10">
        &copy; 2024 ArchiAudit Design Studio. Powered by Google GenAI.
      </div>
    </div>
  );
};
