import React, { useState, useRef, useEffect, useCallback } from 'react';
import { OptimizedOption, LayoutRequirements } from '../types';
import { SketchButton, SketchCard, SketchInput } from './HandDrawnUI';
import { refineOptimization } from '../services/geminiService';

interface Marker {
  id: number;
  x: number;  // percentage 0-100
  y: number;  // percentage 0-100
}

interface Props {
  initialOption: OptimizedOption;
  originalImage: string;
  positioning?: string;  // 户型定位：IMPROVEMENT 或 LUXURY
  requirements?: LayoutRequirements;  // 用户需求
  onRestart: () => void;
}

export const StepFinal: React.FC<Props> = ({ initialOption, originalImage, positioning, requirements, onRestart }) => {
  const [currentOption, setCurrentOption] = useState<OptimizedOption>(initialOption);
  const [isRefining, setIsRefining] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerMode, setMarkerMode] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Erase 功能状态
  const [eraseMode, setEraseMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [erasedImageBase64, setErasedImageBase64] = useState<string | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const eraseCanvasRef = useRef<HTMLCanvasElement>(null);
  const eraseContainerRef = useRef<HTMLDivElement>(null);
  const originalImageDataRef = useRef<string | null>(null);

  // 初始化擦除 Canvas
  useEffect(() => {
    if (!eraseMode || !eraseCanvasRef.current) return;

    const canvas = eraseCanvasRef.current;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([imageData]);
        setHistoryIndex(0);
        originalImageDataRef.current = currentOption.imageUrl;
      }
    };
    const imgSrc = currentOption.imageUrl.startsWith('data:')
      ? currentOption.imageUrl
      : `data:image/jpeg;base64,${currentOption.imageUrl}`;
    img.src = imgSrc;
  }, [eraseMode, currentOption.imageUrl]);

  // 擦除绘图
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = eraseCanvasRef.current;
    const container = eraseContainerRef.current;
    if (!canvas || !container) return null;

    const rect = container.getBoundingClientRect();
    const naturalRatio = canvas.width / canvas.height;
    const displayRatio = rect.width / Math.min(rect.height, 500);
    const displayHeight = Math.min(rect.height, 500);

    let actualWidth: number, actualHeight: number, offsetX: number, offsetY: number;

    if (naturalRatio > displayRatio) {
      actualWidth = rect.width;
      actualHeight = rect.width / naturalRatio;
      offsetX = 0;
      offsetY = (displayHeight - actualHeight) / 2;
    } else {
      actualHeight = displayHeight;
      actualWidth = displayHeight * naturalRatio;
      offsetX = (rect.width - actualWidth) / 2;
      offsetY = 0;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    if (clickX < 0 || clickX > actualWidth || clickY < 0 || clickY > actualHeight) {
      return null;
    }

    const scaleX = canvas.width / actualWidth;
    const scaleY = canvas.height / actualHeight;

    return {
      x: clickX * scaleX,
      y: clickY * scaleY
    };
  }, []);

  const saveToHistory = useCallback(() => {
    const canvas = eraseCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), imageData]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleEraseMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!eraseMode) return;
    setIsDrawing(true);
    saveToHistory();
    handleEraseDraw(e);
  };

  const handleEraseDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !eraseMode) return;

    const canvas = eraseCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const scale = canvas.width / canvas.getBoundingClientRect().width;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, (brushSize / 2) * scale, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleEraseMouseUp = () => {
    setIsDrawing(false);
  };

  const undoErase = () => {
    if (historyIndex <= 0) return;
    const canvas = eraseCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const resetErase = () => {
    const canvas = eraseCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new Image();
    img.onload = () => {
      if (ctx && canvas) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([imageData]);
        setHistoryIndex(0);
      }
    };
    const imgSrc = currentOption.imageUrl.startsWith('data:')
      ? currentOption.imageUrl
      : `data:image/jpeg;base64,${currentOption.imageUrl}`;
    img.src = imgSrc;
  };

  const applyErase = () => {
    const canvas = eraseCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];
    setErasedImageBase64(base64);
    setEraseMode(false);
  };

  const cancelErase = () => {
    setEraseMode(false);
    setErasedImageBase64(null);
  };

  // 点击图片添加标记（修复 object-contain 偏移问题）
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!markerMode || !imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();

    // 获取图片自然尺寸和显示尺寸
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // 计算实际显示的图片区域（考虑 object-contain）
    const naturalRatio = naturalWidth / naturalHeight;
    const displayRatio = displayWidth / displayHeight;

    let actualWidth, actualHeight, offsetX, offsetY;

    if (naturalRatio > displayRatio) {
      // 图片更宽，上下有空白
      actualWidth = displayWidth;
      actualHeight = displayWidth / naturalRatio;
      offsetX = 0;
      offsetY = (displayHeight - actualHeight) / 2;
    } else {
      // 图片更高，左右有空白
      actualHeight = displayHeight;
      actualWidth = displayHeight * naturalRatio;
      offsetX = (displayWidth - actualWidth) / 2;
      offsetY = 0;
    }

    // 计算相对于实际图片的点击位置
    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    // 检查是否点击在图片范围内
    if (clickX < 0 || clickX > actualWidth || clickY < 0 || clickY > actualHeight) {
      return; // 点击在空白区域，忽略
    }

    const x = (clickX / actualWidth) * 100;
    const y = (clickY / actualHeight) * 100;

    const newMarker: Marker = {
      id: markers.length + 1,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    };

    setMarkers([...markers, newMarker]);
    setMarkerMode(false);
  };

  // 清除所有标记
  const clearMarkers = () => {
    setMarkers([]);
  };

  // 删除单个标记
  const removeMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id));
  };

  // 构建带位置信息的反馈
  const buildFeedbackWithContext = (): string => {
    if (markers.length === 0) return chatInput;

    // 替换 @1, @2 等为位置描述
    let feedback = chatInput;
    markers.forEach(marker => {
      const regex = new RegExp(`@${marker.id}`, 'g');
      const locationDesc = `[位置${marker.id}: 图片坐标(${marker.x}%, ${marker.y}%)]`;
      feedback = feedback.replace(regex, locationDesc);
    });

    // 添加所有标记位置信息
    const markerInfo = markers.map(m => `标记${m.id}: 坐标(${m.x}%, ${m.y}%)`).join('; ');
    return `${feedback}\n\n[用户在图片上标记的位置: ${markerInfo}]`;
  };

  const handleRefine = async () => {
    if (!chatInput.trim()) return;
    setIsProcessingChat(true);
    setErrorMessage(null);

    try {
        const feedbackWithContext = buildFeedbackWithContext();
        // 使用擦除后的图片（如果有），否则使用当前图片
        const imageToUse = erasedImageBase64 || currentOption.imageUrl;
        // 如果有擦除区域，告诉后端只修改擦除部分
        const hasErased = !!erasedImageBase64;
        // 传递位置标签（如果有）
        const updatedOption = await refineOptimization(
          { ...currentOption, imageUrl: imageToUse },
          feedbackWithContext,
          positioning,  // 传递户型定位
          requirements,  // 传递用户需求
          hasErased,  // 传递是否擦除了部分区域
          markers  // 传递位置标签列表
        );
        setCurrentOption(updatedOption);
        setChatInput('');
        setMarkers([]); // 清除标记
        setErasedImageBase64(null); // 清除擦除后的图片
    } catch (err) {
        setErrorMessage("Failed to redraw plan. Please try a different instruction or check connection. / 重绘失败，请重试。");
        console.error(err);
    } finally {
        setIsProcessingChat(false);
    }
  };

  const handleDownload = () => {
      const link = document.createElement('a');
      // Check if imageUrl already has data: prefix to avoid double prefix
      link.href = currentOption.imageUrl.startsWith('data:')
          ? currentOption.imageUrl
          : `data:image/jpeg;base64,${currentOption.imageUrl}`;
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
            <h2 className="font-hand text-3xl font-bold">7. Final Review / 最终确认</h2>
        </div>

        {/* Display Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <SketchCard title="Original / 原图">
                 <img src={originalImage.startsWith('data:') ? originalImage : `data:image/jpeg;base64,${originalImage}`} className="w-full h-auto object-contain" alt="Original" />
             </SketchCard>
             <SketchCard title="Selected Optimization / 选定方案" className="bg-[#fff9e6]">
                 <div className="relative min-h-[300px] flex items-center justify-center">
                    {isProcessingChat && (
                        <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
                            <p className="font-hand font-bold">Redrawing Plan... / 正在重绘平面图...</p>
                        </div>
                    )}
                    {/* 标记模式提示 */}
                    {markerMode && (
                        <div className="absolute top-2 left-2 right-2 bg-yellow-400 text-black text-sm px-3 py-2 rounded font-hand z-30 text-center">
                            👆 点击图片添加标记点 / Click on image to add marker
                        </div>
                    )}
                    <div className="relative inline-block">
                        <img
                            ref={imageRef}
                            src={currentOption.imageUrl.startsWith('data:') ? currentOption.imageUrl : `data:image/jpeg;base64,${currentOption.imageUrl}`}
                            className={`w-full h-auto transition-opacity duration-300 ${isProcessingChat ? 'opacity-50' : 'opacity-100'} ${markerMode ? 'cursor-crosshair' : ''}`}
                            alt="Optimized"
                            onClick={handleImageClick}
                            style={{ display: 'block' }}
                        />
                        {/* 用户添加的标记点 */}
                        {markers.map((marker) => (
                            <div
                                key={marker.id}
                                className="absolute w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-lg cursor-pointer hover:bg-blue-800 transition-colors z-10"
                                style={{
                                    left: `${marker.x}%`,
                                    top: `${marker.y}%`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeMarker(marker.id);
                                }}
                                title={`标记 ${marker.id} - 点击删除`}
                            >
                                {marker.id}
                            </div>
                        ))}
                    </div>
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

                        {/* 标记功能说明 */}
                        <div className="bg-white p-3 rounded border border-blue-200 text-sm">
                            <p className="font-hand font-bold text-blue-800 mb-2">📍 位置标记功能 / Location Markers</p>
                            <div className="flex flex-wrap gap-2 items-center">
                                <button
                                    onClick={() => setMarkerMode(!markerMode)}
                                    className={`px-3 py-1 rounded font-hand text-sm border-2 transition-colors ${
                                        markerMode
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                    }`}
                                >
                                    {markerMode ? '取消标记' : '添加标记'}
                                </button>
                                {markers.length > 0 && (
                                    <button
                                        onClick={clearMarkers}
                                        className="px-3 py-1 rounded font-hand text-sm border-2 border-red-400 text-red-500 hover:bg-red-50"
                                    >
                                        清除全部 ({markers.length})
                                    </button>
                                )}
                                <span className="text-gray-500 text-xs">使用 @1, @2 在输入框中引用标记位置</span>
                            </div>
                            {markers.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {markers.map(m => (
                                        <span key={m.id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                            @{m.id} ({m.x}%, {m.y}%)
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 擦除功能 */}
                        <div className="bg-white p-3 rounded border border-green-200 text-sm">
                            <p className="font-hand font-bold text-green-800 mb-2">🧹 擦除功能 / Erase Tool</p>
                            <p className="text-gray-600 text-xs mb-2">涂掉想删除的内容，AI 会根据擦除后的图片重新绘制</p>
                            <div className="flex flex-wrap gap-2 items-center">
                                <button
                                    onClick={() => setEraseMode(!eraseMode)}
                                    className={`px-3 py-1 rounded font-hand text-sm border-2 transition-colors ${
                                        eraseMode
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-white text-green-600 border-green-600 hover:bg-green-50'
                                    }`}
                                >
                                    {eraseMode ? '取消擦除' : '擦除内容'}
                                </button>
                                {eraseMode && (
                                    <>
                                        <input
                                            type="range"
                                            min="10"
                                            max="80"
                                            value={brushSize}
                                            onChange={(e) => setBrushSize(Number(e.target.value))}
                                            className="w-20"
                                        />
                                        <span className="text-xs text-gray-500">{brushSize}px</span>
                                        <button
                                            onClick={undoErase}
                                            disabled={historyIndex <= 0}
                                            className="px-2 py-1 rounded text-xs border border-gray-300 disabled:opacity-30"
                                        >
                                            撤销
                                        </button>
                                        <button
                                            onClick={resetErase}
                                            className="px-2 py-1 rounded text-xs border border-gray-300"
                                        >
                                            重置
                                        </button>
                                    </>
                                )}
                                {erasedImageBase64 && !eraseMode && (
                                    <span className="text-green-600 text-xs">✓ 已擦除，将在更新时使用</span>
                                )}
                            </div>
                            {eraseMode && (
                                <div
                                    ref={eraseContainerRef}
                                    className="mt-3 relative bg-gray-100 rounded overflow-hidden"
                                    style={{ maxHeight: '500px', cursor: 'crosshair' }}
                                >
                                    <canvas
                                        ref={eraseCanvasRef}
                                        onMouseDown={handleEraseMouseDown}
                                        onMouseMove={handleEraseDraw}
                                        onMouseUp={handleEraseMouseUp}
                                        onMouseLeave={handleEraseMouseUp}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '500px',
                                            objectFit: 'contain',
                                            display: 'block',
                                            margin: '0 auto'
                                        }}
                                    />
                                    <div className="mt-2 flex justify-end gap-2 p-2 bg-white border-t">
                                        <button
                                            onClick={cancelErase}
                                            className="px-3 py-1 rounded text-sm border border-gray-300 hover:bg-gray-50"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={applyErase}
                                            className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700"
                                        >
                                            确认擦除
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <SketchInput
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="E.g. @1 扩大主卫... / Make the bathroom at @1 larger..."
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
