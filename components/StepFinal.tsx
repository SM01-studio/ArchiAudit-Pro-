import React, { useState } from 'react';
import { OptimizedOption } from '../types';
import { SketchButton, SketchCard, SketchInput } from './HandDrawnUI';
import { refineOptimization } from '../services/geminiService';

interface Props {
  initialOption: OptimizedOption;
  originalImage: string;
  onRestart: () => void;
}

export const StepFinal: React.FC<Props> = ({ initialOption, originalImage, onRestart }) => {
  const [currentOption, setCurrentOption] = useState<OptimizedOption>(initialOption);
  const [isRefining, setIsRefining] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRefine = async () => {
    if (!chatInput.trim()) return;
    setIsProcessingChat(true);
    setErrorMessage(null);
    
    try {
        const updatedOption = await refineOptimization(currentOption, chatInput);
        setCurrentOption(updatedOption);
        setChatInput('');
    } catch (err) {
        setErrorMessage("Failed to redraw plan. Please try a different instruction or check connection. / 重绘失败，请重试。");
        console.error(err);
    } finally {
        setIsProcessingChat(false);
    }
  };

  const handleDownload = () => {
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${currentOption.imageUrl}`;
      link.download = `ArchiAudit_Optimized_${currentOption.id}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (isDone) {
      return (
          <div className="max-w-2xl mx-auto text-center space-y-8 animate-fade-in pt-12">
              <h1 className="font-hand text-4xl font-bold">Optimization Complete!</h1>
              <h2 className="font-hand text-2xl text-gray-600">优化完成</h2>
              <div className="p-8 border-4 border-gray-800 rounded-lg shadow-xl bg-white rotate-1">
                 <p className="font-hand text-xl mb-4">Your optimized plan is ready.</p>
                 <SketchButton fullWidth variant='primary' onClick={handleDownload}>
                    Download Image / 下载图片
                 </SketchButton>
                 <p className="font-hand text-xs text-gray-400 mt-2">Saved as JPEG</p>
              </div>
              <SketchButton variant='secondary' onClick={onRestart}>Start New Project / 开始新项目</SketchButton>
          </div>
      )
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8 animate-fade-in">
         <div className="text-center">
            <h2 className="font-hand text-3xl font-bold">4. Final Review / 最终确认</h2>
        </div>

        {/* Display Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <SketchCard title="Original / 原图">
                 <img src={`data:image/jpeg;base64,${originalImage}`} className="w-full h-auto object-contain" alt="Original" />
             </SketchCard>
             <SketchCard title="Selected Optimization / 选定方案" className="bg-[#fff9e6]">
                 <div className="relative min-h-[300px] flex items-center justify-center">
                    {isProcessingChat && (
                        <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
                            <p className="font-hand font-bold">Redrawing Plan... / 正在重绘平面图...</p>
                        </div>
                    )}
                    <img 
                        src={`data:image/jpeg;base64,${currentOption.imageUrl}`} 
                        className={`w-full h-auto object-contain mb-4 transition-opacity duration-300 ${isProcessingChat ? 'opacity-50' : 'opacity-100'}`} 
                        alt="Optimized" 
                    />
                 </div>
                 
                 <div className="space-y-2">
                     {currentOption.annotations.map((ann) => (
                         <div key={ann.id} className="flex gap-2 text-sm border-b border-gray-200 pb-1">
                             <span className="font-bold text-red-500">{ann.id}.</span>
                             <div className="flex flex-col">
                                <span>{ann.text}</span>
                                <span className="text-gray-500 text-xs">{ann.textCn}</span>
                             </div>
                         </div>
                     ))}
                 </div>
             </SketchCard>
        </div>

        {/* Actions */}
        {!isRefining ? (
            <div className="flex justify-center gap-6 mt-8">
                <SketchButton variant='secondary' onClick={() => setIsRefining(true)}>
                    Further Optimization / 进一步优化
                </SketchButton>
                <SketchButton variant='primary' className="px-12" onClick={() => setIsDone(true)}>
                    Complete / 完成
                </SketchButton>
            </div>
        ) : (
            <div className="mt-8 animate-slide-up">
                <SketchCard title="Refinement Chat / 对话调整" className="bg-blue-50">
                    <div className="flex flex-col gap-4">
                        <p className="font-hand text-gray-700">
                            Tell the architect what to adjust. The AI will <b>redraw</b> the plan.
                            <br/><span className="text-xs text-red-500">* Note: Complex redraws may take 10-20 seconds.</span>
                        </p>
                        <div className="flex gap-4">
                            <SketchInput 
                                value={chatInput} 
                                onChange={(e) => setChatInput(e.target.value)} 
                                placeholder="E.g. Make the master bathroom larger... / 例如：扩大主卫..."
                                disabled={isProcessingChat}
                            />
                            <SketchButton onClick={handleRefine} disabled={isProcessingChat || !chatInput}>
                                {isProcessingChat ? 'Drawing...' : 'Update / 更新'}
                            </SketchButton>
                        </div>
                        {errorMessage && (
                            <p className="text-red-500 font-hand font-bold">{errorMessage}</p>
                        )}
                        <button onClick={() => setIsRefining(false)} className="text-sm underline font-hand text-gray-500 self-start">
                            Cancel / 取消
                        </button>
                    </div>
                </SketchCard>
            </div>
        )}
    </div>
  );
};
