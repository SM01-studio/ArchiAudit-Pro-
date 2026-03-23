import React, { useState, useRef } from 'react';
import { PlanType, Positioning, OptimizationMode, OptimizationRequest } from '../types';
import { SketchButton, SketchCard, SketchInput } from './HandDrawnUI';

interface Props {
  onComplete: (data: OptimizationRequest) => void;
}

export const StepInput: React.FC<Props> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [planType, setPlanType] = useState<PlanType>(PlanType.SINGLE);
  const [positioning, setPositioning] = useState<Positioning>(Positioning.IMPROVEMENT);
  const [mode, setMode] = useState<OptimizationMode>(OptimizationMode.STANDARD);
  const [specialReq, setSpecialReq] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = () => {
    if (!preview) return;
    // Strip base64 prefix for API if needed, but keeping full string for display
    const base64Data = preview.split(',')[1]; 
    
    onComplete({
      image: base64Data,
      planType,
      positioning,
      mode,
      specialRequirements: specialReq
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="font-hand text-3xl font-bold">1. Project Setup / 项目设置</h2>
        <p className="font-hand text-gray-600 text-lg">Upload your floor plan to begin the audit.</p>
      </div>

      <SketchCard className="space-y-6">
        {/* File Upload Area */}
        <div 
          className="border-2 border-dashed border-gray-400 rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition-colors relative"
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <div className="relative">
                <img src={preview} alt="Upload Preview" className="max-h-64 mx-auto object-contain shadow-md transform rotate-1 border-4 border-white" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 transition-opacity">
                    <span className="font-hand bg-white px-3 py-1 rounded">Change / 更换</span>
                </div>
            </div>
          ) : (
            <div className="space-y-2">
               <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               <p className="font-hand text-xl">Click to Upload Plan (JPEG/PDF)</p>
               <p className="font-hand text-sm text-gray-500">点击上传平面图</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/jpeg,image/png,image/jpg" 
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="font-hand font-bold block">Type / 住宅平面类型</label>
            <div className="flex gap-2">
                <SketchButton 
                    variant={planType === PlanType.SINGLE ? 'primary' : 'secondary'} 
                    onClick={() => setPlanType(PlanType.SINGLE)}
                    className="text-sm flex-1"
                >Single / 单户</SketchButton>
                <SketchButton 
                    variant={planType === PlanType.CORE_TUBE ? 'primary' : 'secondary'} 
                    onClick={() => setPlanType(PlanType.CORE_TUBE)}
                    className="text-sm flex-1"
                >Core Tube / 核心筒</SketchButton>
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-hand font-bold block">Positioning / 户型定位</label>
             <div className="flex gap-2">
                <SketchButton 
                    variant={positioning === Positioning.IMPROVEMENT ? 'primary' : 'secondary'} 
                    onClick={() => setPositioning(Positioning.IMPROVEMENT)}
                    className="text-sm flex-1"
                >Improve / 改善</SketchButton>
                <SketchButton 
                    variant={positioning === Positioning.LUXURY ? 'primary' : 'secondary'} 
                    onClick={() => setPositioning(Positioning.LUXURY)}
                    className="text-sm flex-1"
                >Luxury / 奢享</SketchButton>
            </div>
          </div>
        </div>

        <div className="space-y-2">
            <label className="font-hand font-bold block">Optimization Mode / 优化方式</label>
             <div className="flex gap-2">
                <SketchButton 
                    variant={mode === OptimizationMode.STANDARD ? 'primary' : 'secondary'} 
                    onClick={() => setMode(OptimizationMode.STANDARD)}
                    className="flex-1"
                >Standard / 常规</SketchButton>
                <SketchButton 
                    variant={mode === OptimizationMode.SPECIAL ? 'primary' : 'secondary'} 
                    onClick={() => setMode(OptimizationMode.SPECIAL)}
                    className="flex-1"
                >Special / 专项</SketchButton>
            </div>
            <p className="font-hand text-xs text-gray-500">Standard: Holistic functional optimization. Special: Targeted adjustments.</p>
        </div>

        {mode === OptimizationMode.SPECIAL && (
            <div className="space-y-2 animate-slide-down">
                <label className="font-hand font-bold block">Special Requirements / 专项要求</label>
                <SketchInput 
                    placeholder="E.g., I need a larger kitchen... / 例如：我需要更大的厨房..."
                    value={specialReq}
                    onChange={(e) => setSpecialReq(e.target.value)}
                />
            </div>
        )}

        <div className="pt-4">
            <SketchButton fullWidth onClick={handleSubmit} disabled={!preview}>
                Next Step: Analysis / 下一步：分析
            </SketchButton>
        </div>

      </SketchCard>
    </div>
  );
};
