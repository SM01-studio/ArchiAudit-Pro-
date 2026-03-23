
import React, { useState } from 'react';
import { AppStep, OptimizationRequest, AnalysisReport, OptimizedOption } from './types';
import { StepInput } from './components/StepInput';
import { StepAnalysis } from './components/StepAnalysis';
import { StepOptimization } from './components/StepOptimization';
import { StepFinal } from './components/StepFinal';
import { CoverPage } from './components/CoverPage';

const App: React.FC = () => {
  // Start at COVER page
  const [step, setStep] = useState<AppStep>(AppStep.COVER);
  const [requestData, setRequestData] = useState<OptimizationRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisReport | null>(null);
  const [selectedOption, setSelectedOption] = useState<OptimizedOption | null>(null);

  const handleStart = () => {
    setStep(AppStep.INPUT);
  };

  const handleInputComplete = (data: OptimizationRequest) => {
    setRequestData(data);
    setStep(AppStep.ANALYZING);
  };

  const handleAnalysisComplete = (report: AnalysisReport) => {
    setAnalysisResult(report);
    setStep(AppStep.OPTIMIZING);
  };

  const handleOptionSelect = (option: OptimizedOption) => {
    setSelectedOption(option);
    setStep(AppStep.FINAL);
  };

  const handleRestart = () => {
    setRequestData(null);
    setAnalysisResult(null);
    setSelectedOption(null);
    setStep(AppStep.INPUT);
  };

  const isCover = step === AppStep.COVER;

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-gray-900 font-sans">
      
      {/* Header - Hidden on Cover Page */}
      {!isCover && (
        <header className="bg-white border-b-2 border-gray-800 p-4 shadow-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleRestart}>
              <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center text-white font-bold font-hand text-xl">A</div>
              <h1 className="font-hand text-2xl font-bold tracking-tight">ArchiAudit <span className="text-sm font-normal text-gray-500">Pro</span></h1>
            </div>
            <div className="hidden md:flex gap-4 text-sm font-hand font-bold text-gray-500">
               <span className={step === AppStep.INPUT ? "text-black underline" : ""}>1. Input</span>
               <span>&rarr;</span>
               <span className={step === AppStep.ANALYZING || step === AppStep.ANALYSIS_RESULT ? "text-black underline" : ""}>2. Audit</span>
               <span>&rarr;</span>
               <span className={step === AppStep.OPTIMIZING || step === AppStep.OPTIMIZATION_SELECTION ? "text-black underline" : ""}>3. Optimize</span>
               <span>&rarr;</span>
               <span className={step === AppStep.FINAL ? "text-black underline" : ""}>4. Final</span>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={isCover ? "w-full" : "container mx-auto px-4 py-8 pb-20"}>
        {step === AppStep.COVER && (
           <CoverPage onStart={handleStart} />
        )}

        {step === AppStep.INPUT && (
          <StepInput onComplete={handleInputComplete} />
        )}

        {step === AppStep.ANALYZING && requestData && (
          <StepAnalysis request={requestData} onComplete={handleAnalysisComplete} />
        )}

        {step === AppStep.OPTIMIZING && requestData && analysisResult && (
          <StepOptimization 
            request={requestData} 
            analysisReport={analysisResult} 
            onSelect={handleOptionSelect} 
          />
        )}

        {step === AppStep.FINAL && selectedOption && requestData && (
          <StepFinal 
            initialOption={selectedOption} 
            originalImage={requestData.image} 
            onRestart={handleRestart} 
          />
        )}
      </main>

      {/* Footer - Hidden on Cover Page */}
      {!isCover && (
        <footer className="fixed bottom-0 w-full bg-[#333] text-[#f7f5f0] py-2 text-center font-hand text-sm z-40">
          Powered by Google Gemini 2.5 Flash &middot; Architectural Design AI
        </footer>
      )}
    </div>
  );
};

export default App;
