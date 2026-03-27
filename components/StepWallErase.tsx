import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SketchButton, SketchCard } from './HandDrawnUI';

interface Props {
  imageBase64: string;
  onComplete: (erasedImageBase64: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
}

interface Dimensions {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  actualWidth: number;
  actualHeight: number;
  offsetX: number;
  offsetY: number;
}

export const StepWallErase: React.FC<Props> = ({
  imageBase64,
  onComplete,
  onSkip,
  onBack
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);

  const [dimensions, setDimensions] = useState<Dimensions>({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    actualWidth: 0,
    actualHeight: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // 初始化 Canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      originalImageRef.current = img;

      // 保存初始状态到历史
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([imageData]);
      setHistoryIndex(0);

      setDimensions(prev => ({
        ...prev,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));

      setIsLoading(false);
    };
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  }, [imageBase64]);

  // 计算 object-contain 偏移
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = dimensions;

    if (naturalWidth === 0 || naturalHeight === 0) return;

    const displayWidth = rect.width;
    const displayHeight = Math.min(600, rect.height || 600);

    const naturalRatio = naturalWidth / naturalHeight;
    const displayRatio = displayWidth / displayHeight;

    let actualWidth: number, actualHeight: number, offsetX: number, offsetY: number;

    if (naturalRatio > displayRatio) {
      actualWidth = displayWidth;
      actualHeight = displayWidth / naturalRatio;
      offsetX = 0;
      offsetY = (displayHeight - actualHeight) / 2;
    } else {
      actualHeight = displayHeight;
      actualWidth = displayHeight * naturalRatio;
      offsetX = (displayWidth - actualWidth) / 2;
      offsetY = 0;
    }

    setDimensions(prev => ({
      ...prev,
      displayWidth,
      displayHeight,
      actualWidth,
      actualHeight,
      offsetX,
      offsetY,
    }));
  }, [dimensions.naturalWidth, dimensions.naturalHeight]);

  // 监听容器尺寸变化
  useEffect(() => {
    if (!isLoading) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isLoading, updateDimensions]);

  // 屏幕坐标转 Canvas 坐标
  const screenToCanvas = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const { offsetX, offsetY, actualWidth, actualHeight, naturalWidth, naturalHeight } = dimensions;

    const clickX = clientX - rect.left - offsetX;
    const clickY = clientY - rect.top - offsetY;

    // 检查是否在图片范围内
    if (clickX < 0 || clickX > actualWidth || clickY < 0 || clickY > actualHeight) {
      return null;
    }

    // 转换为 Canvas 坐标
    const scaleX = naturalWidth / actualWidth;
    const scaleY = naturalHeight / actualHeight;

    return {
      x: clickX * scaleX,
      y: clickY * scaleY
    };
  }, [dimensions]);

  // 绘制
  const draw = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const coords = screenToCanvas(clientX, clientY);
    if (!coords) return;

    const { naturalWidth, actualWidth } = dimensions;
    const scale = naturalWidth / actualWidth;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, (brushSize / 2) * scale, 0, Math.PI * 2);
    ctx.fill();
  }, [screenToCanvas, brushSize, dimensions]);

  // 保存到历史
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), imageData]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // 鼠标事件
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    saveToHistory();
    draw(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    draw(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // 触摸事件
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    saveToHistory();
    const touch = e.touches[0];
    draw(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    draw(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  // 撤销
  const undo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  // 重做
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  // 清除全部（涂白）
  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    saveToHistory();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // 重置为原图
  const resetToOriginal = () => {
    const img = originalImageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!img || !canvas || !ctx) return;

    saveToHistory();
    ctx.drawImage(img, 0, 0);
  };

  // 完成并导出
  const handleComplete = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];
    onComplete(base64);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 animate-fade-in px-4">
      {/* 标题 */}
      <div className="text-center space-y-2">
        <h2 className="font-hand text-3xl font-bold">4. Erase Walls / 擦除内墙</h2>
        <p className="font-hand text-gray-600">
          用白色画笔涂掉想拆除的内墙，帮助 AI 理解您的需求
        </p>
      </div>

      {/* 工具栏 */}
      <SketchCard className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-hand font-bold">画笔大小:</span>
          <input
            type="range"
            min="10"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-32 accent-gray-800"
          />
          <span className="font-hand text-sm w-12">{brushSize}px</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SketchButton
            variant="secondary"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="text-sm px-3 py-1 opacity-50 disabled:opacity-30"
          >
            撤销
          </SketchButton>
          <SketchButton
            variant="secondary"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="text-sm px-3 py-1 opacity-50 disabled:opacity-30"
          >
            重做
          </SketchButton>
          <SketchButton
            variant="secondary"
            onClick={clearAll}
            className="text-sm px-3 py-1"
          >
            清除全部
          </SketchButton>
          <SketchButton
            variant="secondary"
            onClick={resetToOriginal}
            className="text-sm px-3 py-1"
          >
            重置原图
          </SketchButton>
        </div>
      </SketchCard>

      {/* Canvas 区域 */}
      <SketchCard className="p-0 overflow-hidden">
        <div
          ref={containerRef}
          className="relative bg-gray-100 flex items-center justify-center min-h-[400px] max-h-[600px]"
          style={{ cursor: isLoading ? 'default' : 'crosshair' }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin"></div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              maxWidth: '100%',
              maxHeight: '600px',
              objectFit: 'contain',
            }}
          />
        </div>
      </SketchCard>

      {/* 提示信息 */}
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-md p-4 font-hand text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
        <p className="font-bold text-yellow-800">操作提示 / Tips:</p>
        <ul className="list-disc list-inside text-yellow-700 mt-2 space-y-1">
          <li>涂掉想拆除的内墙，AI 会根据空白区域重新设计布局</li>
          <li>保留不想拆除的墙体（如承重墙、外墙）</li>
          <li>擦除不准确时，可点击"重置原图"重新开始</li>
        </ul>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-center gap-4 pt-4 flex-wrap">
        {onBack && (
          <SketchButton variant="secondary" onClick={onBack}>
            返回上一步
          </SketchButton>
        )}
        {onSkip && (
          <SketchButton variant="secondary" onClick={onSkip}>
            跳过 / 不擦除
          </SketchButton>
        )}
        <SketchButton onClick={handleComplete} className="px-8">
          确认并继续
        </SketchButton>
      </div>
    </div>
  );
};
