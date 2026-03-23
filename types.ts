
export enum AppStep {
  COVER = 'COVER',
  INPUT = 'INPUT',
  ANALYZING = 'ANALYZING',
  ANALYSIS_RESULT = 'ANALYSIS_RESULT',
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

export interface OptimizationRequest {
  image: string; // Base64
  planType: PlanType;
  positioning: Positioning;
  mode: OptimizationMode;
  specialRequirements?: string;
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
