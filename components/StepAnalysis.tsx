import React, { useEffect, useState, useRef } from 'react';
import { AnalysisReport, OptimizationRequest } from '../types';
import { analyzeFloorPlan } from '../services/geminiService';
import { SketchButton, SketchCard, SketchBadge } from './HandDrawnUI';

interface Props {
  request: OptimizationRequest;
  onComplete: (report: AnalysisReport) => void;
}

export const StepAnalysis: React.FC<Props> = ({ request, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate a terminal-like process log before showing results
    const steps = [
        "Initializing Design Director Agent...",
        "Identifying Plan Type & Constraints...",
        "Connecting to Google Search Knowledge Base...",
        "SEARCHING: 'Residential Layout Standards 2024'...",
        "SEARCHING: 'Optimal Dimensions for Luxury Housing'...",
        "Comparing plan against retrieved standards...",
        "Analyzing Circulation & Sightlines...",
        "Generating Master Architect Report..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            setLogs(prev => [...prev, steps[currentStep]]);
            currentStep++;
            // Auto scroll
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        } else {
            clearInterval(interval);
        }
    }, 1000); // Slightly slower to allow read

    // Call API
    analyzeFloorPlan(request).then(data => {
        // Wait for logs to finish mostly
        setTimeout(() => {
            setReport(data);
            setLoading(false);
        }, steps.length * 1000 + 500);
    });

    return () => clearInterval(interval);
  }, [request]);

  if (loading) {
    return (
        <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="font-hand text-3xl font-bold animate-pulse">Analyzing Floor Plan... / 正在分析...</h2>
            <SketchCard className="bg-black text-green-400 font-mono text-left h-64 overflow-y-auto" >
                <div ref={scrollRef} className="space-y-2">
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span>{'>'}</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            </SketchCard>
            <p className="font-hand text-gray-500 text-sm">Powered by Google Search Grounding & Gemini</p>
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
