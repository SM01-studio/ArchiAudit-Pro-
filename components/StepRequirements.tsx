import React, { useState } from 'react';
import { LayoutRequirements, AnalysisReport } from '../types';
import { SketchButton, SketchCard } from './HandDrawnUI';

interface Props {
  analysisReport: AnalysisReport;
  onComplete: (requirements: LayoutRequirements) => void;
}

export const StepRequirements: React.FC<Props> = ({ analysisReport, onComplete }) => {
  const [requirements, setRequirements] = useState<LayoutRequirements>({
    wallType: 'structural_only',
    livingRoom: 'single',
    bedrooms: 2,
    studyRoom: 'none',
    functionRooms: [],
    bathroom: 'one_public_one_master',
    kitchen: 'closed_chinese',
    balcony: 'with-door',
    entranceStorage: [],
    otherRequirements: '',
  });

  const handleMultiSelect = (field: keyof Pick<LayoutRequirements, 'functionRooms' | 'entranceStorage'>, value: string) => {
    setRequirements(prev => {
      const current = prev[field] as string[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const handleSubmit = () => {
    onComplete(requirements);
  };

  // 选项配置
  const wallTypeOptions = [
    { value: 'all_fixed', label: '所有内部墙体不变', labelCn: '所有内部墙体不变' },
    { value: 'structural_only', label: '黑色填充墙体（剪力墙）不变，未填充墙体可变', labelCn: '剪力墙不变，其他可变' },
    { value: 'all_flexible', label: '所有内部墙体都可变化', labelCn: '所有墙体可变' },
  ];

  const livingRoomOptions = [
    { value: 'single', label: '单客厅' },
    { value: 'double', label: '双客厅' },
  ];

  const bedroomOptions = [1, 2, 3, 4];

  const studyRoomOptions = [
    { value: 'none', label: '无书房' },
    { value: 'one', label: '1个书房' },
  ];

  const functionRoomOptions = [
    { value: '琴房', label: '琴房' },
    { value: '画室', label: '画室' },
    { value: '舞蹈房', label: '舞蹈房' },
    { value: '电竞房', label: '电竞房' },
    { value: '洗衣房', label: '洗衣房' },
  ];

  const bathroomOptions = [
    { value: 'one_public', label: '1个公用卫生间' },
    { value: 'one_public_one_master', label: '1公卫+1主卫' },
    { value: 'one_public_two_master', label: '1公卫+2主卫' },
    { value: 'one_public_three_master', label: '1公卫+3主卫' },
  ];

  const kitchenOptions = [
    { value: 'open_western', label: '开放式西厨' },
    { value: 'closed_chinese', label: '封闭式中厨' },
    { value: 'both', label: '开放式西厨+封闭式中厨' },
  ];

  const balconyOptions = [
    { value: 'with-door', label: '有阳台门' },
    { value: 'no-door', label: '无阳台门' },
  ];

  const entranceStorageOptions = [
    { value: '玄关收纳柜', label: '玄关收纳柜' },
    { value: '玄关小房间（800库）', label: '玄关小房间（800库）' },
  ];

  // 生成单选按钮组
  const RadioGroup = <T extends string>({
    options,
    value,
    onChange,
    name,
  }: {
    options: { value: T; label: string; labelCn?: string }[];
    value: T;
    onChange: (v: T) => void;
    name: string;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label
          key={String(opt.value)}
          className={`cursor-pointer px-3 py-2 border-2 rounded font-hand text-sm transition-all ${
            value === opt.value
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="hidden"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );

  // 生成多选按钮组
  const CheckboxGroup = ({
    options,
    value,
    onChange,
    name,
  }: {
    options: { value: string; label: string }[];
    value: string[];
    onChange: (v: string) => void;
    name: string;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`cursor-pointer px-3 py-2 border-2 rounded font-hand text-sm transition-all ${
            value.includes(opt.value)
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
          }`}
        >
          <input
            type="checkbox"
            name={name}
            value={opt.value}
            checked={value.includes(opt.value)}
            onChange={() => onChange(opt.value)}
            className="hidden"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6 animate-fade-in px-4">
      <div className="text-center space-y-2">
        <h2 className="font-hand text-3xl font-bold">3. Requirements / 优化需求</h2>
        <p className="font-hand text-gray-600">请填写您的户型优化需求，我们将根据您的选择进行优化设计</p>
      </div>

      {/* 分析结果摘要 */}
      <SketchCard className="bg-gray-50">
        <h4 className="font-hand font-bold text-lg mb-2">AI 分析摘要 / Analysis Summary</h4>
        <p className="font-hand text-gray-700">{analysisReport.summaryCn || analysisReport.summary}</p>
      </SketchCard>

      {/* 需求表单 */}
      <SketchCard className="space-y-6">
        {/* 1. 户型内部墙体 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            1. 户型内部墙体 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={wallTypeOptions}
            value={requirements.wallType}
            onChange={(v) => setRequirements(prev => ({ ...prev, wallType: v }))}
            name="wallType"
          />
        </div>

        {/* 2. 客厅 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            2. 客厅 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={livingRoomOptions}
            value={requirements.livingRoom}
            onChange={(v) => setRequirements(prev => ({ ...prev, livingRoom: v }))}
            name="livingRoom"
          />
        </div>

        {/* 3. 卧室 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            3. 卧室 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={bedroomOptions.map(n => ({ value: n as 1|2|3|4, label: `${n}个卧室` }))}
            value={requirements.bedrooms}
            onChange={(v) => setRequirements(prev => ({ ...prev, bedrooms: v }))}
            name="bedrooms"
          />
        </div>

        {/* 4. 书房 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            4. 书房 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={studyRoomOptions}
            value={requirements.studyRoom}
            onChange={(v) => setRequirements(prev => ({ ...prev, studyRoom: v }))}
            name="studyRoom"
          />
        </div>

        {/* 5. 功能房 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            5. 功能房 <span className="text-gray-500 text-sm font-normal">(可多选)</span>
          </h4>
          <CheckboxGroup
            options={functionRoomOptions}
            value={requirements.functionRooms}
            onChange={(v) => handleMultiSelect('functionRooms', v)}
            name="functionRooms"
          />
        </div>

        {/* 6. 卫生间 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            6. 卫生间 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={bathroomOptions}
            value={requirements.bathroom}
            onChange={(v) => setRequirements(prev => ({ ...prev, bathroom: v }))}
            name="bathroom"
          />
        </div>

        {/* 7. 厨房 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            7. 厨房 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={kitchenOptions}
            value={requirements.kitchen}
            onChange={(v) => setRequirements(prev => ({ ...prev, kitchen: v }))}
            name="kitchen"
          />
        </div>

        {/* 8. 阳台 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            8. 阳台 <span className="text-gray-500 text-sm font-normal">(单选)</span>
          </h4>
          <RadioGroup
            options={balconyOptions}
            value={requirements.balcony}
            onChange={(v) => setRequirements(prev => ({ ...prev, balcony: v }))}
            name="balcony"
          />
        </div>

        {/* 9. 玄关收纳 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            9. 玄关收纳 <span className="text-gray-500 text-sm font-normal">(可多选)</span>
          </h4>
          <CheckboxGroup
            options={entranceStorageOptions}
            value={requirements.entranceStorage}
            onChange={(v) => handleMultiSelect('entranceStorage', v)}
            name="entranceStorage"
          />
        </div>

        {/* 10. 其他要求 */}
        <div className="space-y-3">
          <h4 className="font-hand font-bold text-lg border-b border-gray-300 pb-2">
            10. 其他要求 <span className="text-gray-500 text-sm font-normal">(如有其他要求请填写)</span>
          </h4>
          <textarea
            value={requirements.otherRequirements}
            onChange={(e) => setRequirements(prev => ({ ...prev, otherRequirements: e.target.value }))}
            placeholder="例如：需要增加储物空间、希望主卧有衣帽间等..."
            className="w-full h-24 p-3 border-2 border-gray-300 rounded font-hand focus:border-black focus:outline-none resize-none"
          />
        </div>
      </SketchCard>

      {/* 提交按钮 */}
      <div className="flex justify-center pt-4">
        <SketchButton onClick={handleSubmit} className="px-12 text-xl">
          Confirm & Start Optimization / 确认并开始优化
        </SketchButton>
      </div>
    </div>
  );
};
