import React, { useState, useMemo, useEffect } from 'react';
import { LayoutRequirements, AnalysisReport, OptimizationRequest } from '../types';
import { SketchButton, SketchCard, SketchInput } from './HandDrawnUI';
import { generateOptimizationPrompt } from '../services/geminiService';

interface Props {
  requirements: LayoutRequirements;
  analysisReport: AnalysisReport;
  request: OptimizationRequest;
  onComplete: (confirmedPrompt: string) => void;
  onBack: () => void;
}

// 墙体选项的中文映射
const wallTypeLabels: Record<string, string> = {
  'all_fixed': '所有内部墙体和内门不变',
  'structural_only': '剪力墙（黑色填充）不变，非承重墙和户内门可变',
  'all_flexible': '所有内墙体和户内门都可变化',
};

// 其他选项的中文映射
const livingRoomLabels: Record<string, string> = {
  'single': '单客厅',
  'double': '双客厅',
};

const studyRoomLabels: Record<string, string> = {
  'none': '无书房',
  'one': '1个书房',
};

const bathroomLabels: Record<string, string> = {
  'one_public': '1个公用卫生间',
  'one_public_one_master': '1公卫+1主卫',
  'one_public_two_master': '1公卫+2主卫',
  'one_public_three_master': '1公卫+3主卫',
};

const kitchenLabels: Record<string, string> = {
  'open_western': '开放式西厨',
  'closed_chinese': '封闭式中厨',
  'both': '开放式西厨+封闭式中厨',
};

const balconyLabels: Record<string, string> = {
  'with-door': '有阳台门',
  'no-door': '无阳台门',
};

// 底层基础规则（中英文）
const BASE_RULES = `## 🔒 底层基础规则 / MANDATORY RULES (最高优先级 / HIGHEST PRIORITY)

1. 【外框锁定 / OUTER WALLS】所有户型外框（外墙）不能改变，必须完全锁定，不可扩展或修改！
   / Keep EXACT same outer boundary. DO NOT extend or modify outer walls!

2. 【进户门 / ENTRANCE DOOR】进户门位置一般不变，如有特别需求只能在原墙面平移1米内
   / Keep same position. If must move, only slide within 1 meter on same wall.

3. 【内墙策略 / INTERNAL WALLS】所有户型内墙首先考虑全部拆除，重新根据功能布置
   / REMOVE ALL internal walls first, then redraw based on requirements.

4. 【主卧优先 / MASTER BEDROOM】主卧室优先考虑「主卧+步入式衣帽间+大卫生间」的套间配置
   / Priority = Master Bedroom + Walk-in Closet + Large Bathroom (suite style).

5. 【厨房优先 / KITCHEN】厨房优先考虑开放式厨房布置
   / Priority = Open kitchen layout.

6. 【客厅设计 / LIVING ROOM】客厅不建议采用带书桌功能的做法
   / Do NOT add desk/workspace in living room.

7. 【阳台外扩 / BALCONY】如果是超大阳台，需要将原有阳台门外扩，加大客厅空间
   / If balcony is oversized, extend living room by removing balcony door.

8. 【大卫生间配置 / MASTER BATHROOM】双台盆+冲淋房+马桶+浴缸
   / Double vanity + Shower stall + Toilet + Bathtub.

9. 【公卫配置 / PUBLIC BATHROOM】干湿分离卫生间，卫生间门采用移门
   / Wet/dry separation, use sliding door.

10. 【收纳必须 / STORAGE REQUIRED】
    - 门口玄关收纳柜 / Entrance hall storage cabinet
    - 户内800库收纳空间 / 800mm deep storage room
    - 每个卧室衣柜 / Wardrobe in each bedroom

11. 【数量严格遵守 / ROOM COUNT】必须严格遵守需求单填写的配置数量
    / Follow user requirements EXACTLY. Bedroom count includes master. Bathroom count includes all.`;

export const StepOptimizationBrief: React.FC<Props> = ({
  requirements,
  analysisReport,
  request,
  onComplete,
  onBack,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');

  // 生成优化清单Prompt（包含底层规则+需求单+分析结果）
  const generatePrompt = useMemo(() => {
    console.log('Generating prompt with requirements:', requirements);

    // 1. 用户需求清单（第二优先级）
    const requirementsList = [
      `【墙体调整/WALLS】${wallTypeLabels[requirements.wallType] || requirements.wallType}`,
      `【客厅/LIVING】${livingRoomLabels[requirements.livingRoom] || requirements.livingRoom}`,
      `【卧室/BEDROOMS】⚠️ ${requirements.bedrooms}个卧室（必须严格遵守数量！）`,
      `【书房/STUDY】${studyRoomLabels[requirements.studyRoom] || requirements.studyRoom}`,
      `【功能房/FUNCTION】${requirements.functionRooms.length > 0 ? requirements.functionRooms.join('、') : '无'}`,
      `【卫生间/BATHROOMS】⚠️ ${bathroomLabels[requirements.bathroom] || requirements.bathroom}（必须严格遵守数量！）`,
      `【厨房/KITCHEN】${kitchenLabels[requirements.kitchen] || requirements.kitchen}`,
      `【阳台/BALCONY】${balconyLabels[requirements.balcony] || requirements.balcony}`,
      `【玄关收纳/ENTRANCE】${requirements.entranceStorage.length > 0 ? requirements.entranceStorage.join('、') : '无'}`,
    ];

    if (requirements.otherRequirements) {
      requirementsList.push(`【其他需求/OTHER】${requirements.otherRequirements}`);
    }

    // 2. 分析结果（第三优先级，仅供参考）
    const analysisItems = analysisReport.items
      .filter(item => item.status === 'fail' || item.status === 'warning')
      .map(item => `- 【${item.categoryCn}】${item.observationCn}`);

    // 3. 组装完整Prompt
    const prompt = `${BASE_RULES}

---

## 📋 用户需求清单 / USER REQUIREMENTS (第二优先级 / SECOND PRIORITY)

${requirementsList.join('\n')}

---

## 📊 现有问题分析 / ANALYSIS RESULT (第三优先级 / THIRD PRIORITY - 仅供参考)

${analysisItems.length > 0 ? analysisItems.join('\n') : '（无明显问题 / No obvious issues）'}

---

## ⚠️ 关键提醒 / KEY REMINDERS

1. 外框绝对不能变！/ OUTER WALLS MUST NOT CHANGE!
2. 卧室数量：${requirements.bedrooms}个 / Bedroom count: ${requirements.bedrooms}
3. 卫生间数量：${requirements.bathroom.includes('one_public_one_master') ? '2个(1公卫+1主卫)' : requirements.bathroom.includes('one_public_two_master') ? '3个(1公卫+2主卫)' : requirements.bathroom.includes('one_public_three_master') ? '4个(1公卫+3主卫)' : '1个公卫'} / Bathroom count as specified
4. 内墙必须按需求重绘！/ Internal walls MUST be redrawn according to requirements!`;

    return prompt;
  }, [requirements, analysisReport]);

  useEffect(() => {
    console.log('Requirements changed, resetting savedPrompt');
    setSavedPrompt(null);
    setGeneratedPrompt(''); // Reset generated prompt when requirements change
  }, [requirements]);

  // 调用后端 API 生成优化 Prompt
  useEffect(() => {
    const fetchPrompt = async () => {
      setIsLoadingPrompt(true);
      try {
        const result = await generateOptimizationPrompt(
          requirements,
          analysisReport.items.filter(item => item.status === 'fail' || item.status === 'warning')
        );
        if (result.success) {
          setGeneratedPrompt(result.prompt);
          console.log(`Prompt generated by ${result.source}`);
        }
      } catch (error) {
        console.error('Failed to generate prompt:', error);
        // Fallback to local generation
      } finally {
        setIsLoadingPrompt(false);
      }
    };

    fetchPrompt();
  }, [requirements, analysisReport.items]);

  const currentPrompt = isEditing ? editedPrompt : (savedPrompt || generatedPrompt || generatePrompt);

  const handleEditStart = () => {
    setEditedPrompt(currentPrompt);
    setIsEditing(true);
  };

  const handleEditSave = () => {
    setSavedPrompt(editedPrompt);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedPrompt('');
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const modification = `\n\n### 用户补充要求 / ADDITIONAL NOTES\n${chatInput}`;
      const newPrompt = currentPrompt + modification;
      setEditedPrompt(newPrompt);
      setSavedPrompt(newPrompt);
      setIsEditing(false);
      setChatInput('');
      setIsProcessing(false);
    }, 800);
  };

  const handleConfirm = () => {
    onComplete(currentPrompt);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 animate-fade-in px-4">
      <div className="text-center space-y-2">
        <h2 className="font-hand text-3xl font-bold">5. Optimization Brief / 优化清单</h2>
        <p className="font-hand text-gray-600">请确认优化指令（底层规则 + 需求单 + 分析结果）</p>
      </div>

      {/* Prompt 显示/编辑区域 */}
      <SketchCard className="space-y-4">
        <div className="flex justify-between items-center border-b border-gray-300 pb-2">
          <h4 className="font-hand font-bold text-lg">📝 完整优化指令 / Full Optimization Prompt</h4>
          {!isEditing && (
            <button
              onClick={handleEditStart}
              className="font-hand text-sm text-blue-600 hover:text-blue-800 underline"
            >
              手动编辑 / Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-[500px] p-4 border-2 border-gray-300 rounded font-mono text-sm focus:border-black focus:outline-none resize-none whitespace-pre-wrap"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleEditCancel}
                className="font-hand text-gray-500 hover:text-black"
              >
                取消 / Cancel
              </button>
              <SketchButton onClick={handleEditSave} variant="primary">
                保存修改 / Save
              </SketchButton>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-[600px] overflow-y-auto">
            {isLoadingPrompt ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin mr-3"></div>
                <span className="text-gray-500">正在使用 AI 生成优化指令...</span>
              </div>
            ) : (
              currentPrompt
            )}
          </div>
        )}
      </SketchCard>

      {/* AI 助手聊天窗口 */}
      <SketchCard title="AI Assistant / AI 助手" className="bg-blue-50">
        <div className="space-y-4">
          <p className="font-hand text-gray-600 text-sm">
            告诉AI您想如何调整优化指令，例如："增加一个衣帽间"、"把主卧面积扩大"等
          </p>
          <div className="min-h-[60px] text-sm text-gray-500 font-hand italic">
            AI将根据您的输入自动修改优化指令...
          </div>
          <div className="flex gap-3">
            <SketchInput
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="例如：需要增加一个独立的衣帽间..."
              disabled={isProcessing}
              className="flex-1"
            />
            <SketchButton
              onClick={handleChatSubmit}
              disabled={isProcessing || !chatInput.trim()}
            >
              {isProcessing ? '处理中...' : '修改 / Update'}
            </SketchButton>
          </div>
        </div>
      </SketchCard>

      {/* 操作按钮 */}
      <div className="flex justify-center gap-6 pt-4">
        <SketchButton variant="secondary" onClick={onBack}>
          返回修改需求 / Back
        </SketchButton>
        <SketchButton onClick={handleConfirm} className="px-12" disabled={isLoadingPrompt}>
          确认并生成优化方案 / Confirm & Generate
        </SketchButton>
      </div>
    </div>
  );
};
