
import React, { useState, useEffect } from 'react';
import { AppStep, OptimizationRequest, AnalysisReport, OptimizedOption, LayoutRequirements } from './types';
import { StepInput } from './components/StepInput';
import { StepAnalysis } from './components/StepAnalysis';
import { StepRequirements } from './components/StepRequirements';
import { StepOptimizationBrief } from './components/StepOptimizationBrief';
import { StepOptimization } from './components/StepOptimization';
import { StepFinal } from './components/StepFinal';
import { StepWallErase } from './components/StepWallErase';
import { CoverPage } from './components/CoverPage';
import { verifyAuth, redirectToLogin } from './services/authService';

const App: React.FC = () => {
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    verifyAuth().then(({ valid }) => {
      if (!valid) {
        redirectToLogin();
      } else {
        setIsAuthChecked(true);
      }
    });
  }, []);

  if (!isAuthChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0f' }}>
        <div style={{ color: '#a0a0b0', fontSize: '1.1rem' }}>验证登录中...</div>
      </div>
    );
  }

  // Start at COVER page
  const [step, setStep] = useState<AppStep>(AppStep.COVER);
  const [requestData, setRequestData] = useState<OptimizationRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisReport | null>(null);
  const [layoutRequirements, setLayoutRequirements] = useState<LayoutRequirements | null>(null);
  const [selectedOption, setSelectedOption] = useState<OptimizedOption | null>(null);
  const [confirmedPrompt, setConfirmedPrompt] = useState<string>(''); // 新增：确认后的优化指令
  const [erasedImage, setErasedImage] = useState<string | null>(null); // 擦除后的图片
  const [originalImage, setOriginalImage] = useState<string | null>(null); // 原始图片（Erase 前）

  const handleStart = () => {
    setStep(AppStep.INPUT);
  };

  const handleInputComplete = (data: OptimizationRequest) => {
    setRequestData(data);
    setOriginalImage(data.image); // 保存原始图片
    setStep(AppStep.ANALYZING);
  };

  const handleAnalysisComplete = (report: AnalysisReport) => {
    setAnalysisResult(report);
    setStep(AppStep.REQUIREMENTS); // 跳转到需求填写步骤
  };

  const handleRequirementsComplete = (requirements: LayoutRequirements) => {
    setLayoutRequirements(requirements);
    // 更新 requestData 包含 requirements
    if (requestData) {
      setRequestData({ ...requestData, requirements });
    }
    // 根据墙体类型决定是否需要擦除步骤
    if (requirements.wallType === 'all_fixed') {
      // 所有墙体不变，跳过擦除步骤
      setStep(AppStep.OPTIMIZATION_BRIEF);
    } else {
      // 需要修改墙体，进入擦除步骤
      setStep(AppStep.WALL_ERASE);
    }
  };

  const handleWallEraseComplete = (erasedImageBase64: string) => {
    setErasedImage(erasedImageBase64);
    // 更新 requestData 的图片为擦除后的图片
    if (requestData) {
      setRequestData({ ...requestData, image: erasedImageBase64 });
    }
    setStep(AppStep.OPTIMIZATION_BRIEF);
  };

  const handleWallEraseSkip = () => {
    // 用户选择跳过，使用原图
    setErasedImage(null);
    setStep(AppStep.OPTIMIZATION_BRIEF);
  };

  const handleWallEraseBack = () => {
    setStep(AppStep.REQUIREMENTS);
  };

  const handleBriefComplete = (prompt: string) => {
    setConfirmedPrompt(prompt);
    setStep(AppStep.OPTIMIZING);
  };

  const handleBriefBack = () => {
    // 如果之前有擦除步骤，返回擦除步骤；否则返回需求填写
    if (layoutRequirements && layoutRequirements.wallType !== 'all_fixed') {
      setStep(AppStep.WALL_ERASE);
    } else {
      setStep(AppStep.REQUIREMENTS);
    }
  };

  const handleOptionSelect = (option: OptimizedOption) => {
    setSelectedOption(option);
    setStep(AppStep.FINAL);
  };

  const handleRestart = () => {
    setRequestData(null);
    setAnalysisResult(null);
    setLayoutRequirements(null);
    setSelectedOption(null);
    setConfirmedPrompt('');
    setErasedImage(null);
    setOriginalImage(null);
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
            <div className="hidden md:flex gap-2 text-sm font-hand font-bold text-gray-500">
               <span className={step === AppStep.INPUT ? "text-black underline" : ""}>1. Input</span>
               <span>&rarr;</span>
               <span className={step === AppStep.ANALYZING || step === AppStep.ANALYSIS_RESULT ? "text-black underline" : ""}>2. Audit</span>
               <span>&rarr;</span>
               <span className={step === AppStep.REQUIREMENTS ? "text-black underline" : ""}>3. Reqs</span>
               <span>&rarr;</span>
               <span className={step === AppStep.WALL_ERASE ? "text-black underline" : ""}>4. Erase</span>
               <span>&rarr;</span>
               <span className={step === AppStep.OPTIMIZATION_BRIEF ? "text-black underline" : ""}>5. Brief</span>
               <span>&rarr;</span>
               <span className={step === AppStep.OPTIMIZING || step === AppStep.OPTIMIZATION_SELECTION ? "text-black underline" : ""}>6. Optimize</span>
               <span>&rarr;</span>
               <span className={step === AppStep.FINAL ? "text-black underline" : ""}>7. Final</span>
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

        {step === AppStep.REQUIREMENTS && analysisResult && (
          <StepRequirements
            analysisReport={analysisResult}
            onComplete={handleRequirementsComplete}
          />
        )}

        {step === AppStep.WALL_ERASE && requestData && (
          <StepWallErase
            imageBase64={erasedImage || requestData.image}
            onComplete={handleWallEraseComplete}
            onSkip={handleWallEraseSkip}
            onBack={handleWallEraseBack}
          />
        )}

        {step === AppStep.OPTIMIZATION_BRIEF && layoutRequirements && analysisResult && requestData && (
          <StepOptimizationBrief
            requirements={layoutRequirements}
            analysisReport={analysisResult}
            request={requestData}
            onComplete={handleBriefComplete}
            onBack={handleBriefBack}
          />
        )}

        {step === AppStep.OPTIMIZING && requestData && analysisResult && (
          <StepOptimization
            request={requestData}
            analysisReport={analysisResult}
            confirmedPrompt={confirmedPrompt}
            originalImage={originalImage}
            onSelect={handleOptionSelect}
          />
        )}

        {step === AppStep.FINAL && selectedOption && requestData && (
          <StepFinal
            initialOption={selectedOption}
            originalImage={originalImage || requestData.image}
            positioning={requestData.positioning}
            requirements={layoutRequirements || undefined}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Footer - Hidden on Cover Page */}
      {!isCover && (
        <footer className="fixed bottom-0 w-full bg-[#333] text-[#f7f5f0] py-2 text-center font-hand text-sm z-40">
          &copy; 2026 ArchiAudit . Powered by Ma Siliang
        </footer>
      )}
    </div>
  );
};

export default App;
