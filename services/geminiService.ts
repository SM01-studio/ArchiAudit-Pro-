/**
 * ArchiAudit Pro - API Service
 * All Gemini API calls are proxied through the backend for security
 */

import { AnalysisReport, OptimizationRequest, OptimizationResult, OptimizedOption } from "../types";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.siliang.cfd/api/archiaudit';
const MAIN_PORTAL = 'https://siliang.cfd';

/**
 * Get authentication token from localStorage or URL params
 */
const getAuthToken = (): string | null => {
  // Try localStorage first
  const token = localStorage.getItem('auth_token');
  if (token) return token;

  // Try URL params (for cross-domain navigation)
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('auth_token');
};

/**
 * Make authenticated API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized
  if (response.status === 401) {
    // Redirect to main portal for login
    window.location.href = `${MAIN_PORTAL}/index.html?from=subapp`;
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Verify authentication status
 */
export async function verifyAuth(): Promise<boolean> {
  try {
    await apiRequest<{ valid: boolean }>('/verify');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<{ status: string; gemini_configured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

/**
 * Analyze floor plan
 */
export const analyzeFloorPlan = async (request: OptimizationRequest): Promise<AnalysisReport> => {
  return apiRequest<AnalysisReport>('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      image: request.image,
      planType: request.planType,
      positioning: request.positioning,
      specialRequirements: request.specialRequirements,
    }),
  });
};

/**
 * Generate optimization options
 */
export const generateOptimizations = async (
  request: OptimizationRequest,
  analysis: AnalysisReport,
  confirmedPrompt?: string
): Promise<OptimizationResult> => {
  return apiRequest<OptimizationResult>('/optimize', {
    method: 'POST',
    body: JSON.stringify({
      image: request.image,
      analysis: analysis,
      requirements: request.requirements,
      positioning: request.positioning, // 新增：户型定位（IMPROVEMENT/LUXURY）
      confirmedPrompt,
    }),
  });
};

/**
 * Refine optimization based on user feedback
 * @param currentOption 当前优化方案
 * @param userFeedback 用户反馈
 * @param positioning 户型定位（IMPROVEMENT/LUXURY）
 * @param requirements 用户需求（用于获取卧室/卫生间数量）
 * @param hasErasedAreas 用户是否擦除了部分区域（如果为true，AI只修改擦除区域）
 * @param locationMarkers 位置标签列表 [{id, x, y}, ...]
 */
export const refineOptimization = async (
  currentOption: OptimizedOption,
  userFeedback: string,
  positioning?: string,
  requirements?: any,
  hasErasedAreas?: boolean,
  locationMarkers?: { id: number; x: number; y: number }[]
): Promise<OptimizedOption> => {
  const result = await apiRequest<{ imageUrl: string; annotations: any[] }>('/refine', {
    method: 'POST',
    body: JSON.stringify({
      imageUrl: currentOption.imageUrl,
      feedback: userFeedback,
      annotations: currentOption.annotations,
      positioning: positioning || 'IMPROVEMENT',
      requirements: requirements || {},
      hasErasedAreas: hasErasedAreas || false,
      hasLocationMarkers: locationMarkers && locationMarkers.length > 0,
      locationMarkers: locationMarkers || [],
    }),
  });

  return {
    ...currentOption,
    imageUrl: result.imageUrl,
    annotations: result.annotations,
  };
};

/**
 * Generate optimization prompt using GLM-5
 */
export const generateOptimizationPrompt = async (
  requirements: any,
  analysisItems: any[]
): Promise<{ success: boolean; prompt: string; source: string }> => {
  return apiRequest<{ success: boolean; prompt: string; source: string }>('/generate-prompt', {
    method: 'POST',
    body: JSON.stringify({
      requirements,
      analysisItems,
    }),
  });
};
