
export enum AppStep {
  COVER = 'COVER',
  INPUT = 'INPUT',
  ANALYZING = 'ANALYZING',
  ANALYSIS_RESULT = 'ANALYSIS_RESULT',
  REQUIREMENTS = 'REQUIREMENTS', // 需求填写步骤
  WALL_ERASE = 'WALL_ERASE', // 墙体擦除步骤
  OPTIMIZATION_BRIEF = 'OPTIMIZATION_BRIEF', // 新增：优化清单确认步骤
  OPTIMIZING = 'OPTIMIZING',
  OPTIMIZATION_SELECTION = 'OPTIMIZATION_SELECTION',
  REFINE = 'REFINE',
  FINAL = 'FINAL'
}

export enum PlanType {
  SINGLE = 'SINGLE', // 单户型平面
  CORE_TUBE = 'CORE_TUBE' // 整层带核心筒平面
}

export enum Positioning {
  IMPROVEMENT = 'IMPROVEMENT', // 改善
  LUXURY = 'LUXURY' // 奢享
}

export enum OptimizationMode {
  STANDARD = 'STANDARD', // 常规优化
  SPECIAL = 'SPECIAL' // 专项优化
}

// 户型需求配置
export interface LayoutRequirements {
  // 户型内部墙体
  wallType: 'all_fixed' | 'structural_only' | 'all_flexible';

  // 户型配置
  livingRoom: 'single' | 'double';
  bedrooms: 1 | 2 | 3 | 4;
  studyRoom: 'none' | 'one';
  functionRooms: string[]; // 琴房、画室、舞蹈房、电竞房、洗衣房
  bathroom: 'one_public' | 'one_public_one_master' | 'one_public_two_master' | 'one_public_three_master';
  kitchen: 'open_western' | 'closed_chinese' | 'both';
  balcony: 'with_door' | 'no-door';
  entranceStorage: string[]; // 玄关收纳柜、玄关小房间（800库）
  otherRequirements?: string;
}

export interface OptimizationRequest {
  image: string; // Base64
  planType: PlanType;
  positioning: Positioning;
  mode: OptimizationMode;
  specialRequirements?: string;
  requirements?: LayoutRequirements; // 新增
}

export interface AnalysisItem {
  category: string;
  categoryCn: string;
  status: 'pass' | 'fail' | 'warning';
  observation: string;
  observationCn: string;
}

export interface AnalysisReport {
  summary: string;
  summaryCn: string;
  items: AnalysisItem[];
}

export interface OptimizedOption {
  id: string;
  imageUrl: string; // Base64 or URL
  annotations: Array<{
    id: number;
    text: string;
    textCn: string;
    location?: { x: number, y: number }; // Percentage 0-100
  }>;
}

export interface OptimizationResult {
  option1: OptimizedOption;
  option2: OptimizedOption;
}
