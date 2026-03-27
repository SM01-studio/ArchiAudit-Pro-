import React, { useEffect, useState, useRef } from 'react';
import { AnalysisReport, OptimizationRequest, OptimizationResult, OptimizedOption } from '../types';
import { generateOptimizations } from '../services/geminiService';
import { SketchButton, SketchCard } from './HandDrawnUI';

interface Props {
  request: OptimizationRequest;
  analysisReport: AnalysisReport;
  confirmedPrompt?: string;
  originalImage?: string | null; // 原始图片（Erase 前）
  onSelect: (option: OptimizedOption) => void;
}

// 格式化时间为 mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const StepOptimization: React.FC<Props> = ({ request, analysisReport, confirmedPrompt, originalImage, onSelect }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'option1' | 'option2'>('option1');
  const [retryCount, setRetryCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const apiCallMade = useRef(false);
  const currentRetryCount = useRef(0);
  const startTimeRef = useRef(Date.now());

  // 计时器 - 始终运行
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 阶段更新 - 始终运行
  useEffect(() => {
    setLoadingStage('Analyzing requirements...');
    const stages = [
      { time: 3, stage: 'Generating optimization strategies...' },
      { time: 15, stage: 'Creating Option A: Conservative (this may take 3-5 minutes)...' },
      { time: 60, stage: 'Creating Option B: Radical (parallel processing)...' },
      { time: 180, stage: 'Analyzing generated images for annotations...' },
      { time: 300, stage: 'Almost done, finalizing layouts...' },
    ];
    const stageTimers = stages.map(s => setTimeout(() => setLoadingStage(s.stage), s.time * 1000));
    return () => stageTimers.forEach(t => clearTimeout(t));
  }, [retryCount]);

  // API 调用 - 只调用一次
  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (apiCallMade.current && currentRetryCount.current === retryCount) return;
    currentRetryCount.current = retryCount;
    apiCallMade.current = true;

    setLoading(true);

    generateOptimizations(request, analysisReport, confirmedPrompt)
        .then(data => {
            setLoadingStage('Complete!');
            setResult(data);
            setLoading(false);
            // 重置标记以便下次 retry 可以重新调用
            apiCallMade.current = false;
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
            apiCallMade.current = false;
        });
  }, [retryCount]); // 只依赖 retryCount，其他 props 变化不应该重新请求

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
             <div className="w-16 h-16 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
             <p className="font-hand text-2xl font-bold">Designing Optimizations... / 正在设计优化方案...</p>
             <p className="font-hand text-gray-500">{loadingStage}</p>
             <div className="flex items-center gap-3">
               <span className="font-hand text-gray-400">Elapsed Time / 已用时间:</span>
               <span className="font-mono text-xl font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                 {formatTime(elapsedTime)}
               </span>
             </div>
        </div>
    );
  }

  if (!result) return (
      <div className="text-center py-20">
          <p className="font-hand text-xl text-red-500">Error generating options. Please try again.</p>
          <SketchButton onClick={() => setRetryCount(c => c + 1)} className="mt-4 mx-auto">Retry / 重试</SketchButton>
      </div>
  );

  const currentOption = activeTab === 'option1' ? result.option1 : result.option2;
  const isFailed = !currentOption.imageUrl || currentOption.imageUrl.length < 100;
  // A rough check if image changed.
  const isChanged = currentOption.imageUrl !== request.image;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-fade-in px-4">
        <div className="text-center space-y-2">
            <h2 className="font-hand text-3xl font-bold">6. Optimization Proposals / 优化提案</h2>
            <p className="font-hand text-gray-600">Switch tabs to compare different strategies.</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4">
             <SketchButton 
                variant={activeTab === 'option1' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('option1')}
             >
                Option A: Conservative / 稳健方案
             </SketchButton>
             <SketchButton 
                variant={activeTab === 'option2' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('option2')}
             >
                Option B: Radical / 深度改造
             </SketchButton>
        </div>

        {/* Main Content Area */}
        <div className="bg-white p-4 border-2 border-gray-800 rounded-lg shadow-xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                 {/* BEFORE */}
                 <div className="flex flex-col border-r-2 border-dashed border-gray-300 pr-2">
                      <h3 className="text-center font-hand font-bold text-xl mb-2 bg-gray-200 py-1 rounded flex-shrink-0">BEFORE / 原平面</h3>
                      <div className="h-[600px] flex items-center justify-center overflow-hidden bg-gray-50 border border-gray-200">
                          <img
                            src={`data:image/jpeg;base64,${originalImage || request.image}`}
                            className="max-w-full max-h-full object-contain"
                            alt="Original"
                          />
                      </div>
                 </div>

                 {/* AFTER */}
                 <div className="flex flex-col pl-2">
                      <h3 className="text-center font-hand font-bold text-xl mb-2 bg-[#ffda79] py-1 rounded flex-shrink-0">AFTER / 优化后</h3>
                      <div className="h-[600px] flex items-center justify-center overflow-hidden bg-gray-50 border border-gray-200 relative group">
                          {isFailed ? (
                              <div className="text-center text-red-500 font-hand">Generation Failed</div>
                          ) : (
                              <>
                                <img
                                    src={currentOption.imageUrl.startsWith('data:') ? currentOption.imageUrl : `data:image/jpeg;base64,${currentOption.imageUrl}`}
                                    className="max-w-full max-h-full object-contain"
                                    alt="Optimized"
                                />
                                {!isChanged && (
                                     <div className="absolute top-2 left-2 bg-red-100 text-red-800 text-xs px-2 py-1 font-bold rounded">
                                         No visual changes detected
                                     </div>
                                )}
                              </>
                          )}

                          {/* Annotations Overlay */}
                          {currentOption.annotations.map((ann, i) => {
                             const top = ann.location?.y ?? 50;
                             const left = ann.location?.x ?? 50;
                             return (
                                 <div key={i}
                                      className="absolute w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-lg cursor-help transition-transform hover:scale-125 z-10"
                                      style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
                                      title={`${ann.textCn} (${ann.text})`}
                                  >
                                  {ann.id}
                                 </div>
                             );
                          })}
                      </div>
                 </div>
             </div>
        </div>

        {/* Explanation Card */}
        <SketchCard className="space-y-4">
            <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">Design Changes / 设计变更说明</h4>
            <p className="font-hand text-gray-500 text-sm -mt-2">以下标注说明了各位置的改动内容 / Annotations explain the changes at each location</p>
            {currentOption.annotations.length === 0 ? (
                <p className="font-hand text-gray-500">No specific annotations provided by the AI.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentOption.annotations.map((ann) => (
                        <div key={ann.id} className="flex gap-3 items-start p-2 hover:bg-gray-50 rounded transition-colors">
                            <span className="bg-red-600 text-white w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center font-bold font-hand text-xs mt-1 shadow-sm">{ann.id}</span>
                            <div>
                                <p className="font-hand font-bold text-gray-900 text-lg">{ann.textCn}</p>
                                <p className="font-hand text-gray-500 text-sm">{ann.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SketchCard>

        <div className="flex justify-center gap-4 pt-4">
             <button onClick={() => setRetryCount(c => c + 1)} className="font-hand text-gray-500 underline hover:text-black">
                 Regenerate Images / 重新生成
             </button>
             <SketchButton onClick={() => onSelect(currentOption)} className="px-12">
                 Select This Plan / 选择此方案
             </SketchButton>
        </div>
    </div>
  );
};
