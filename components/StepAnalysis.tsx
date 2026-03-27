import React, { useEffect, useState, useRef } from 'react';
import { AnalysisReport, OptimizationRequest } from '../types';
import { analyzeFloorPlan } from '../services/geminiService';
import { SketchButton, SketchCard, SketchBadge } from './HandDrawnUI';

interface Props {
  request: OptimizationRequest;
  onComplete: (report: AnalysisReport) => void;
}

// 格式化时间为 mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const StepAnalysis: React.FC<Props> = ({ request, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiCallMade = useRef(false);
  const startTimeRef = useRef(Date.now());

  // 日志动画 - 始终运行
  useEffect(() => {
    const steps = [
        "Initializing Design Director Agent...",
        "Identifying Plan Type & Constraints...",
        "Connecting to GEMINI Model...",
        "ANALYZING: Layout Structure...",
        "ANALYZING: Room Dimensions...",
        "Comparing plan against luxury standards...",
        "Analyzing Circulation & Sightlines...",
        "Generating Master Architect Report..."
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            const stepElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setLogs(prev => [...prev, `[${formatTime(stepElapsed)}] ${steps[currentStep]}`]);
            currentStep++;
            // Auto scroll
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        } else {
            clearInterval(interval);
        }
    }, 800); // 稍微加快一点

    return () => clearInterval(interval);
  }, []);

  // 计时器 - 始终运行
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // API 调用 - 只调用一次
  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (apiCallMade.current) return;
    apiCallMade.current = true;

    analyzeFloorPlan(request)
        .then(data => {
            const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

            // 检查是否是 fallback 响应（服务繁忙）
            if (data.summary && data.summary.includes('currently experiencing high traffic')) {
              setLogs(prev => [...prev, `[${formatTime(totalElapsed)}] WARN: API busy, using fallback`]);
              setError('Analysis service is busy. Please try again.');
              setLoading(false);
              return;
            }

            setLogs(prev => [...prev, `[${formatTime(totalElapsed)}] ✓ Analysis Complete!`]);
            // Wait a moment before showing results
            setTimeout(() => {
                setReport(data);
                setLoading(false);
            }, 500);
        })
        .catch(err => {
            const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            console.error('Analysis failed:', err);
            setLogs(prev => [...prev, `[${formatTime(totalElapsed)}] ERROR: ${err.message || 'Analysis failed'}`]);
            setTimeout(() => {
                setError(err.message || 'Analysis failed. Please check your connection and try again.');
                setLoading(false);
            }, 1000);
        });
  }, [request]);

  if (loading) {
    return (
        <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <h2 className="font-hand text-3xl font-bold animate-pulse">Analyzing Floor Plan... / 正在分析...</h2>
              <span className="font-mono text-2xl font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded">
                {formatTime(elapsedTime)}
              </span>
            </div>
            <SketchCard className="bg-black text-green-400 font-mono text-left h-64 overflow-y-auto" >
                <div ref={scrollRef} className="space-y-2">
                    {logs.filter(Boolean).map((log, i) => (
                        <div key={i} className={`flex items-center gap-2 ${log?.includes('ERROR') ? 'text-red-400' : log?.includes('WARN') ? 'text-yellow-400' : log?.includes('✓') ? 'text-green-300' : ''}`}>
                            <span>{'>'}</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            </SketchCard>
            <p className="font-hand text-gray-500 text-sm">Powered by GEMINI Model</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="font-hand text-3xl font-bold text-red-600">Analysis Failed / 分析失败</h2>
            <SketchCard className="bg-red-50 border-red-300">
                <p className="font-hand text-lg text-red-700">{error}</p>
                <p className="font-hand text-sm text-gray-600 mt-2">请检查网络连接或后端服务是否正常运行</p>
            </SketchCard>
            <SketchButton onClick={() => window.location.reload()}>
                Retry / 重试
            </SketchButton>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
        <div className="flex justify-between items-end">
            <div>
                <h2 className="font-hand text-3xl font-bold">2. Director's Audit / 总监审核</h2>
                <p className="font-hand text-gray-600">Review the findings before optimization.</p>
            </div>
            <SketchButton onClick={() => report && onComplete(report)}>
                Start Optimization / 开始优化 &rarr;
            </SketchButton>
        </div>

        <SketchCard className="space-y-4 !bg-[#fff9e6]">
            <h3 className="font-hand text-xl font-bold border-b border-gray-300 pb-2">Executive Summary / 总结</h3>
            <p className="font-hand text-lg leading-relaxed">{report?.summary}</p>
            <p className="font-hand text-lg leading-relaxed text-gray-600">{report?.summaryCn}</p>
            <div className="flex gap-2 mt-2">
                <SketchBadge text="Google Search Verified" color="bg-blue-200" />
                <SketchBadge text="Standard: 2024 Residential" color="bg-green-200" />
            </div>
        </SketchCard>

        <div className="grid grid-cols-1 gap-4">
            {report?.items.map((item, idx) => (
                <div key={idx} className={`border-2 border-gray-800 rounded-sm p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] flex gap-4 ${item.status === 'fail' ? 'bg-red-50' : item.status === 'warning' ? 'bg-yellow-50' : 'bg-green-50'}`}>
                    <div className="shrink-0 pt-1">
                        {item.status === 'fail' && <span className="text-2xl">❌</span>}
                        {item.status === 'warning' && <span className="text-2xl">⚠️</span>}
                        {item.status === 'pass' && <span className="text-2xl">✅</span>}
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-bold font-hand uppercase text-sm tracking-wider">{item.category}</span>
                            <span className="text-gray-400">|</span>
                            <span className="font-bold font-hand text-sm">{item.categoryCn}</span>
                        </div>
                        <p className="font-hand font-bold text-gray-900">{item.observation}</p>
                        <p className="font-hand text-gray-600">{item.observationCn}</p>
                    </div>
                </div>
            ))}
        </div>
        
        <div className="flex justify-center pt-8">
            <SketchButton onClick={() => report && onComplete(report)} className="px-12 py-4 text-xl">
                 Next Step: Optimize / 下一步：优化
            </SketchButton>
        </div>
    </div>
  );
};
