# ArchiAudit Pro 开发日志

## 2026-03-23

### 项目概述
ArchiAudit Pro - 住宅平面图 AI 审计和优化工具
- 从 Google AI Studio 移植到 Siliang AI LAB 平台
- 添加后端 API 代理、集成主门户认证

### 改造内容

| 文件 | 改动 |
|------|------|
| `backend/app.py` | 新建 - Flask 后端 (API 代理 + 认证中间件) |
| `backend/requirements.txt` | 新建 - Python 依赖 |
| `backend/.env.example` | 新建 - 环境变量模板 |
| `services/geminiService.ts` | 重写 - 改为调用后端 API |
| `vite.config.ts` | 修改 - 移除 API Key，添加环境变量 |
| `.env.example` | 新建 - 前端环境变量模板 |
| `deploy/siliang-archiaudit.service` | 新建 - Systemd 服务配置 |
| `deploy/nginx.conf` | 新建 - Nginx 路由配置 |
| `vercel.json` | 新建 - Vercel 部署配置 |

### 部署信息
- **子域名**: `archiaudit.siliang.cfd`
- **后端端口**: 5003
- **服务器**: 47.79.0.228 (阿里云)

### 当前进度
- [x] 从 GitHub 克隆源码
- [x] 创建后端 Flask 应用
- [x] 添加认证中间件
- [x] 重写前端 API 服务
- [x] 移除前端 API Key 暴露
- [x] 创建部署配置文件
- [ ] 本地测试
- [ ] 部署后端到阿里云服务器
- [ ] 部署前端到 Vercel
- [ ] 配置 DNS 子域名
- [ ] 添加到主门户 Dashboard
- [ ] 数据库添加应用记录

### 下一步工作
1. 本地测试：`npm install && npm run dev`
2. 上传后端到服务器：`/www/siliang-ai-lab/archiaudit/`
3. 配置 Systemd 服务
4. 配置 Nginx 路由
5. 部署前端到 Vercel
6. 配置 DNS：`archiaudit.siliang.cfd`
7. 在数据库 `apps` 表添加应用记录
8. 分配用户权限

## 2026-03-24

### 本地测试修复

#### 修复的问题
1. **底部文字修改** - 将 "Powered by GEMINI 3" 改为 "© 2026 ArchiAudit . Powered by Ma Siliang"
2. **图片超出窗口** - 修改 StepOptimization.tsx，使用固定高度 `h-[600px]` 和 `max-w-full max-h-full object-contain`
3. **生图失败** - 修复前端重复添加 base64 前缀的 bug

#### 新增功能：需求填写步骤

在分析结果后、优化前增加需求填写步骤，让用户指定户型优化需求。

**新增文件**：
- `components/StepRequirements.tsx` - 需求填写组件

**修改文件**：
- `types.ts` - 添加 `LayoutRequirements` 类型和 `REQUIREMENTS` 步骤
- `App.tsx` - 添加需求填写步骤流程
- `services/geminiService.ts` - 发送 requirements 到后端
- `backend/app.py` - 接收并使用需求数据生成优化方案

**需求表内容**：
1. 户型内部墙体（单选）：所有不变 / 剪力墙不变 / 全部可变
2. 客厅（单选）：单客厅 / 双客厅
3. 卧室（单选）：1-4个
4. 书房（单选）：无 / 1个
5. 功能房（多选）：琴房、画室、舞蹈房、电竞房、洗衣房
6. 卫生间（单选）：1公卫 / 1公卫+1主卫 / 1公卫+2主卫 / 1公卫+3主卫
7. 厨房（单选）：开放式西厨 / 封闭式中厨 / 两者兼备
8. 阳台（单选）：有阳台门 / 无阳台门
9. 玄关收纳（多选）：收纳柜 / 800库
10. 其他要求（文本框）

### 2026-03-24 (续) - API 迁移与 Bug 修复

#### 1. Gemini → GLM-4.6V 迁移
将视觉分析 API 从 Google Gemini 迁移到智谱 AI GLM-4.6V。

**修改文件**：
- `backend/.env` - 更新 API 配置
  ```
  GLM_API_KEY=65bef9ad1e1e4ff2a385c353bce6d972.7dIezHIPSYU2TdY6
  GLM_API_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/chat/completions
  GLM_MODEL=glm-4.6v-flashx
  ```
- `backend/app.py` - 添加 `call_glm_api()` 函数，使用 OpenAI 兼容格式调用

#### 2. 图像生成 API 更换为 LinkAPI
将图像生成 API 从 apicore.ai 更换为 LinkAPI。

**配置信息**：
```
IMAGE_API_KEY=sk-UM2pn3uKLuCCWvHXvPCukBvtzhWQyHe33roTFBMrKM9ypb1i
IMAGE_API_ENDPOINT=https://api.linkapi.ai/v1/chat/completions
IMAGE_MODEL=gemini-3-pro-image-preview
```

#### 3. 加载页面计时器
为 Step 2 (Audit) 和 Step 5 (Optimize) 添加实时计时器。

**修改文件**：
- `components/StepAnalysis.tsx` - 添加 `startTimeRef`, `elapsedTime` 状态，分离 useEffect hooks
- `components/StepOptimization.tsx` - 同样添加计时器

**实现方式**：将原来的单个 useEffect 拆分为三个独立的 useEffect：
1. 日志动画/阶段更新
2. 计时器更新
3. API 调用（使用 `useRef` 防止重复调用）

#### 4. 修复 React StrictMode 双重 API 调用
使用 `useRef` 标记 API 是否已调用，防止 StrictMode 双重渲染导致的重复请求。

```typescript
const apiCallMade = useRef(false);

useEffect(() => {
  if (apiCallMade.current) return;
  apiCallMade.current = true;
  // API 调用...
}, [request]);
```

#### 5. 修复 Optimization Brief 编辑保存无效
添加 `savedPrompt` 状态来持久化用户编辑的内容。

**修改文件**：`components/StepOptimizationBrief.tsx`
```typescript
const [savedPrompt, setSavedPrompt] = useState<string | null>(null);
const currentPrompt = isEditing ? editedPrompt : (savedPrompt || generatePrompt);

const handleEditSave = () => {
  setSavedPrompt(editedPrompt);
  setIsEditing(false);
};
```

#### 6. 修复需求不一致问题
当 requirements 变化时重置 savedPrompt，确保显示最新的生成内容。

```typescript
useEffect(() => {
  setSavedPrompt(null);
}, [requirements]);
```

#### 7. 两步生成标注（待测试）
实现两步生成流程：
1. 第一步：并行生成两个优化图像
2. 第二步：使用 GLM-4.6V 分析生成的图像，返回准确的标注位置

**修改文件**：`backend/app.py`
- 添加 `analyze_generated_image()` 函数
- 使用 `ThreadPoolExecutor` 并行生成图像

#### 8. 修复图像提取问题（待测试）
LinkAPI 返回的图像格式为 `![image](data:image/jpeg;base64,...)`，需要支持 markdown 包裹的 data URL。

**修改文件**：`backend/app.py` - `call_image_api()` 函数
```python
# Markdown format with data URL: ![Image](data:image/...;base64,...)
md_data_match = re.search(r'!\[.*?\]\((data:image/[^;]+;base64,[A-Za-z0-9+/=]+)\)', content)
if md_data_match:
    return md_data_match.group(1)
```

#### 9. 修复图生图 API 端点问题
发现 `gemini-3-pro-image-preview` 模型不支持 `/v1/images/generations` 端点（只支持 imagen 模型）。

**解决方案**：改用 `chat/completions` 端点进行图像生成和图生图编辑。

**修改文件**：`backend/app.py` - `call_image_api()` 函数
```python
# 构建 chat/completions 请求
if image_base64:
    # 图生图模式 - 使用 OpenAI 兼容的消息格式
    payload = {
        'model': IMAGE_MODEL,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': prompt},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image_base64}'}}
            ]
        }]
    }
```

**测试结果**：
- `chat/completions` 端点支持 `gemini-3-pro-image-preview` 模型
- 图生图功能正常工作，响应格式为 `![image](data:image/jpeg;base64,...)`
- 响应时间约 30-60 秒

### 待解决问题
1. ~~验证图生图功能是否能按 prompt 修改平面图布局~~
2. 验证红色标注是否正确生成

---

## 2026-03-24 (深夜) - 图生图 API 格式修复

### 问题反馈
用户测试发现图生图功能存在以下问题：
1. **外墙被修改** - 外框不能变，但优化后在户外外框之外加了800库收纳
2. **内墙未调整** - 要求重新优化内墙，但没有任何调整
3. **房间数量不对** - 与用户要求不符

**怀疑原因**：OpenAI 兼容格式可能无法正确传递图像给 Gemini 进行图生图编辑。

### 解决方案：改用原生 Gemini API 格式

**修改文件**：`backend/app.py` - `call_image_api()` 函数

**关键改动**：
```python
# 从 OpenAI 兼容格式
# /v1/chat/completions + messages[].content[].image_url

# 改为原生 Gemini API 格式
gemini_endpoint = IMAGE_API_ENDPOINT.replace(
    '/v1/chat/completions',
    '/v1beta/models/gemini-3-pro-image-preview:generateContent'
)

payload = {
    'contents': [{
        'parts': [
            {'inlineData': {'mimeType': 'image/jpeg', 'data': image_base64}},
            {'text': prompt}
        ]
    }],
    'generationConfig': {
        'responseModalities': ['IMAGE'],
        'imageConfig': {'imageSize': '1K'}
    }
}

# 响应解析
# candidates[0].content.parts[0].inlineData.data
```

### Prompt 优化
简化 `create_image_prompt()` 函数，强调约束条件：
- 外墙必须完全不变
- 内墙必须按需求重绘
- 明确房间数量要求

### 当前状态
- [x] 修改 API 格式为原生 Gemini
- [x] 优化 Prompt 约束条件
- [x] 重启后端服务器
- [ ] **待测试**：验证图生图是否正确工作

### 当前配置
- **视觉分析**: GLM-4.6V-flashx (智谱AI)
- **图像生成**: gemini-3-pro-image-preview (LinkAPI) - **原生 Gemini API 端点**
- **后端端口**: 5003
- **前端端口**: 3000

---

## 2026-03-25

### GLM-5 集成用于 Prompt 生成

根据用户需求，添加了 GLM-5 文本模型用于优化 Prompt 的生成。

#### 修改内容

**1. 后端配置 (`backend/.env`)**
- 将视觉模型从 `glm-4.6v-flashx` 升级到 `glm-4.6v` (旗舰版)
- 新增 GLM-5 API 配置用于 Prompt 生成

```
# 智谱AI GLM-4.6V API (视觉理解模型 - 旗舰版)
GLM_API_KEY=65bef9ad1e1e4ff2a385c353bce6d972.7dIezHIPSYU2TdY6
GLM_API_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_MODEL=glm-4.6v

# 智谱AI GLM-5 API (文本模型 - 用于Prompt生成)
GLM5_API_KEY=1eb57d2a1c1f4db5a7a0f821a5119ce3.qbo0sF4xBTzT7sBs
GLM5_API_ENDPOINT=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM5_MODEL=glm-5
```

**2. 后端代码 (`backend/app.py`)**
- 添加 `call_glm5_api()` 函数用于调用 GLM-5 文本模型
- 新增 `/api/archiaudit/generate-prompt` 端点
- 该端点接收 requirements 和 analysisItems，使用 GLM-5 生成优化的 Prompt
- Prompt 按优先级排列：底层规则 > 用户需求 > 分析问题
- 支持中英双语格式输出

**3. 前端 API 服务 (`services/geminiService.ts`)**
- 新增 `generateOptimizationPrompt()` 函数调用后端 API

**4. 前端组件 (`components/StepOptimizationBrief.tsx`)**
- 组件加载时自动调用后端 API 生成优化的 Prompt
- 显示加载状态："正在使用 GLM-5 生成优化指令..."
- 如果 API 调用失败，自动回退到本地模板生成
- 加载完成前禁用"确认并生成优化方案"按钮

#### 功能流程
1. 用户填写需求单 → 进入 StepOptimizationBrief
2. 前端调用 `/api/archiaudit/generate-prompt` 发送需求数据
3. 后端使用 GLM-5 按优先级重组 Prompt（底层规则 + 用户需求 + 分析结果）
4. 返回优化后的中英双语 Prompt
5. 前端显示优化后的 Prompt，用户可手动编辑
6. 确认后将英文部分发送给 Gemini API 进行图生图

### 当前配置
- **视觉分析**: GLM-4.6V (智谱AI - 旗舰版)
- **Prompt生成**: GLM-5 (智谱AI)
- **图像生成**: gemini-3-pro-image-preview (LinkAPI)
- **后端端口**: 5003
- **前端端口**: 3000

---

## 2026-03-25 (续) - 统一使用 Gemini 模型

### API 统一迁移

将所有模型统一迁移到 Gemini via LinkAPI，以获得更好的图生图效果。

**配置更新 (`backend/.env`)**:
```
# Gemini API via LinkAPI (统一使用 Gemini 模型)
GEMINI_API_KEY=sk-UM2pn3uKLuCCWvHXvPCukBvtzhWQyHe33roTFBMrKM9ypb1i
GEMINI_API_ENDPOINT=https://api.linkapi.ai/v1/chat/completions

# 文本/视觉模型 - 用于户型图片分析和Prompt重新生成
GEMINI_TEXT_MODEL=gemini-3.1-flash-lite-preview

# 图像生成模型 - 用于Prompt图生图
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
```

**代码改动 (`backend/app.py`)**:
1. 移除 GLM_API_KEY, GLM5_API_KEY, IMAGE_API_KEY 配置
2. 统一使用 GEMINI_API_KEY 和 GEMINI_API_ENDPOINT
3. `call_gemini_api()` - 使用 OpenAI 兼容格式调用 gemini-3.1-flash-lite-preview
4. `call_glm_api()` 和 `call_glm5_api()` - 改为 `call_gemini_api()` 的别名
5. `call_image_api()` - 使用原生 Gemini API 格式调用 gemini-3.1-flash-image-preview

**模型用途**:
| 任务 | 模型 |
|------|------|
| 户型图片分析 | gemini-3.1-flash-lite-preview |
| Prompt 重新生成 | gemini-3.1-flash-lite-preview |
| 图生图优化 | gemini-3.1-flash-image-preview |

### 当前配置
- **视觉分析**: gemini-3.1-flash-lite-preview (LinkAPI)
- **Prompt生成**: gemini-3.1-flash-lite-preview (LinkAPI)
- **图像生成**: gemini-3.1-flash-image-preview (LinkAPI)
- **后端端口**: 5003
- **前端端口**: 3000

---

## 2026-03-25 (续续) - UI优化与功能增强

### 1. UI 文案优化

将加载提示中的具体模型名称替换为通用表述：

| 文件 | 修改前 | 修改后 |
|------|--------|--------|
| `StepOptimizationBrief.tsx` | GLM-5 生成 | AI 生成 |
| `StepAnalysis.tsx` | GLM-4.6V Vision Model | GEMINI Model |
| `CoverPage.tsx` | GEMINI 3 | GEMINI 3.1 |

### 2. 新增位置标记功能

在 StepFinal（最终确认/重绘）步骤中添加了交互式位置标记功能：

**功能说明**：
- 点击"添加标记"按钮进入标记模式
- 在优化图上点击添加蓝色数字标记 (1, 2, 3...)
- 点击标记可删除，或点击"清除全部"
- 在输入框中使用 `@1`, `@2` 引用标记位置
- 发送时自动将 @n 转换为坐标信息，AI 知道要修改哪个位置

**修改文件**：
- `components/StepFinal.tsx`
  - 新增 `Marker` 接口定义
  - 新增 `markers`, `markerMode` 状态
  - 新增 `handleImageClick` 点击处理函数
  - 新增 `buildFeedbackWithContext` 函数将 @n 转换为位置描述
  - 添加标记按钮和标记列表 UI

### 3. 修复标记位置偏移问题

**问题**：使用 `object-contain` 时，图片实际显示区域与 img 元素边界不一致，导致点击坐标计算偏差。

**解决方案**：
```typescript
// 计算 object-contain 模式下的实际显示区域和偏移
const naturalRatio = naturalWidth / naturalHeight;
const displayRatio = displayWidth / displayHeight;

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
```

### 4. 加强图像生成 Prompt 约束

**问题**：
1. Option B 方案经常超出户型外框
2. 内墙优化不够，AI 没有按需求重绘内墙

**解决方案** - 大幅加强 Prompt：

1. **新增 RULE 0 - 最高优先级**：
   ```
   ⛔⛔⛔ RULE 0 - THE MOST CRITICAL RULE ⛔⛔⛔
   THE OUTER BOUNDARY MUST REMAIN EXACTLY THE SAME.
   - DO NOT extend any wall outward
   - All new rooms must be INSIDE the original outline
   ```

2. **Option B 专门警告区块**：
   - 明确"激进"的含义是内部布局重组，不是扩展边界
   - 列出可以做的和不能做的事项
   - 添加分步骤流程确保先描边、再清内墙、最后重绘

3. **内墙处理流程** - 更详细的步骤说明：
   - 先识别外边界
   - 擦除所有内墙
   - 在原始轮廓内重新绘制

**修改文件**：
- `backend/app.py` - `create_image_prompt()` 函数

### 当前状态
- [x] 统一使用 Gemini 模型 (LinkAPI)
- [x] UI 文案优化
- [x] 位置标记功能
- [x] 标记偏移修复
- [x] Prompt 约束加强 - **外框问题已解决 ✅**
- [ ] 🔴 **内墙优化无效 - 首要问题**

### 🔴🔴🔴 首要问题：内墙无法修改

**问题描述**：
- AI 无法删除或修改内墙
- 即使使用位置标记 `@1` 精确定位要删除的墙体，AI 仍然没有删除
- 内墙基本保持原样，没有按需求重新绘制

**已尝试的方案**：
1. Prompt 中强调 "ERASE ALL internal walls first"
2. 分步骤说明：先擦除、再重绘
3. 添加位置标记功能精确定位
4. 以上方案均无效

**可能原因**：
1. Gemini 图生图模型的编辑能力有限，倾向于保持原图结构
2. 需要更强的方式告诉模型"这是要删除的区域"
3. 可能需要考虑其他模型或方法（如：先生成蒙版再编辑）

**下次工作重点**：
1. 🔴 **解决内墙无法修改的问题**（最高优先级）
2. 可能的方案：
   - 尝试更直接的 Prompt 表述
   - 考虑使用图像蒙版标记删除区域
   - 评估是否需要更换模型或 API

---

## 2026-03-26

### 问题根源分析（来自 Gemini 团队反馈）

经过与 Gemini 团队探讨，明确了 AI 无法修改内墙的根本原因：

1. **视觉结构权重高于文本权重**
   - 图生图模型优先保留原图的骨架和轮廓
   - 墙体的黑线是非常强烈且明显的视觉特征
   - 文本提示（"去掉墙"）和原图视觉特征冲突时，模型优先"服从"原图

2. **缺乏真实的建筑与空间逻辑**
   - 图像模型本质上是视觉像素模型，不是物理或建筑模型
   - 不具备建筑师"打通两个小房间合并成大横厅"的空间拓扑计算能力
   - 更擅长"表面功夫"（渲染、加家具），而非深度的"空间重构"

3. **未明确的"留白"区域**
   - 仅用文字说"去掉墙体"，模型不知道去掉后该填补什么
   - 没有明确的遮罩（Masking），模型很难凭空想象拆墙后的连贯画面
   - 为避免生成崩坏的图像，模型选择保守策略——保持原样

### 解决方案：前端擦除工具

根据 Gemini 团队建议，实现用户手动擦除内墙的功能：
- 用户在发送给 AI 前，用白色画笔涂掉想拆除的内墙
- 生成"空白底图"再发给 AI
- AI 就能在"空白画布"上按需求重新绘制布局

### 实现内容

**新增文件**：
- `components/StepWallErase.tsx` - 墙体擦除组件
  - Canvas 绑定图片，支持白色画笔绘制
  - 画笔大小调节（滑块）
  - 撤销/重做功能（历史记录）
  - 清除全部 / 重置原图
  - 支持鼠标和触摸屏
  - 复用 StepFinal.tsx 的 object-contain 偏移计算逻辑

**修改文件**：
- `types.ts` - 添加 `WALL_ERASE` 步骤到 `AppStep` 枚举
- `App.tsx` - 集成新步骤
  - 添加 `erasedImage` 状态
  - `handleRequirementsComplete`：根据 `wallType` 决定是否进入擦除步骤
  - `handleWallEraseComplete`：更新 `requestData.image` 为擦除后的图片
  - `handleWallEraseSkip`：跳过擦除，使用原图
  - 更新 Header 步骤导航（1-7 步）

### 新步骤流程

```
1. Input → 2. Audit → 3. Reqs → 4. Erase → 5. Brief → 6. Optimize → 7. Final
```

**条件逻辑**：
- 如果 `wallType === 'all_fixed'`（所有墙体不变）→ 跳过擦除步骤
- 否则 → 进入擦除步骤

### 数据流

```
StepRequirements (用户选择 wallType)
    ↓
StepWallErase (NEW)
    ↓ 如果 wallType !== 'all_fixed'，用户擦除内墙
    ↓ erasedImageBase64 替换 requestData.image
StepOptimizationBrief
    ↓
StepOptimization (发送擦除后的图片给 AI)
```

### 当前状态
- [x] 创建 StepWallErase 组件
- [x] 集成到主流程
- [x] 本地测试无编译错误
- [ ] **待测试**：验证擦除功能是否解决内墙修改问题

---

## 2026-03-26 (续) - StepFinal 重绘功能强化

### 问题反馈

用户测试 StepFinal 的"对话调整"功能，发现 AI 不遵守设计规则：

1. **卫生间数量错误** - 选择"1公卫+1主卫"，却生成3个卫生间
2. **暗卫问题** - 卫生间出现在户型中间，没有窗户
3. **外墙门窗变化** - 外墙（外框）线上的门或窗被修改
4. **房间无门** - 出现没有门的房间
5. **浴缸位置错误** - 浴缸放在没有门的区域
6. **主卫门位置错误** - 主卧卫生间门开在客厅内，而非主卧内
7. **玄关位置混乱** - 玄关位置乱放
8. **家具缺失** - 有房间空着什么都没放置

### 解决方案

#### 1. 统一规则系统

将 `/refine` 端点改用完整的规则系统（RULE 0-13），与 `/optimize` 端点保持一致。

**修改文件**: `backend/app.py`

**新增共享函数**:
```python
def get_space_standards(positioning: str = "IMPROVEMENT") -> str:
    """返回空间尺寸标准"""
    # 根据定位返回不同的尺寸要求

def get_base_rules(bedroom_count: str, bathroom_count: str, positioning: str) -> str:
    """返回基础设计规则 (RULE 0-13)"""
    # 完整的 14 条规则
```

**规则内容**:
| 规则 | 说明 |
|------|------|
| RULE 0 | 外边界必须完全不变 |
| RULE 1 | 严格遵守用户指定的房间数量 |
| RULE 2 | 卫生间必须有窗户（原始外墙） |
| RULE 3 | 每个房间必须有门 |
| RULE 4 | 主卧卫生间门必须开在主卧内 |
| RULE 5 | 厨房必须有窗户 |
| RULE 6 | 客厅必须朝南 |
| RULE 7 | 浴缸只能放在有门的卫生间内 |
| RULE 8 | 玄关必须在进户门位置 |
| RULE 9 | 所有房间必须放置家具 |
| RULE 10-13 | 空间尺寸标准 |

#### 2. 加强警告区块

在规则开头添加醒目的警告框：

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⛔⛔⛔ STOP! READ THIS BEFORE YOU DRAW ANYTHING! ⛔⛔⛔                       ║
║  TWO MOST COMMON MISTAKES THAT CAUSE COMPLETE FAILURE:                      ║
║  ❌ MISTAKE 1: Drawing MORE bathrooms than user specified                   ║
║  ❌ MISTAKE 2: Drawing bathrooms without windows on ORIGINAL OUTER WALL    ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### 3. 局部修改模式

**擦除区域模式** (`hasErasedAreas: true`):
- 当用户在 StepFinal 中擦除了部分区域
- AI 只修改擦除的区域，其他区域保持不变
- Prompt 强调：`ONLY modify the ERASED areas`

**位置标签模式** (`hasLocationMarkers: true`):
- 当用户添加了位置标签 (@1, @2...)
- AI 只修改标签标记的位置
- Prompt 强调：`ONLY modify the MARKED locations`

#### 4. 前端参数传递

**修改文件**: `services/geminiService.ts`

```typescript
export const refineOptimization = async (
  currentOption: OptimizedOption,
  userFeedback: string,
  positioning?: string,
  requirements?: any,
  hasErasedAreas?: boolean,
  locationMarkers?: { id: number; x: number; y: number }[]
): Promise<OptimizedOption>
```

**修改文件**: `components/StepFinal.tsx`

```typescript
// 添加 props
interface Props {
  initialOption: OptimizedOption;
  originalImage: string;
  positioning?: string;  // 新增
  requirements?: any;    // 新增
  onRestart: () => void;
}

// handleRefine 中传递所有参数
const updatedOption = await refineOptimization(
  { ...currentOption, imageUrl: imageToUse },
  feedbackWithContext,
  positioning,
  requirements,
  hasErased,
  markers
);
```

**修改文件**: `App.tsx`

```tsx
<StepFinal
  initialOption={selectedOption}
  originalImage={originalImage || requestData.image}
  positioning={requestData.positioning}      // 新增
  requirements={layoutRequirements || undefined}  // 新增
  onRestart={handleRestart}
/>
```

### 测试结果

**已解决**:
- [x] `/refine` 端点使用完整规则系统
- [x] 局部修改模式（擦除区域、位置标签）
- [x] 前端传递 positioning 和 requirements

**仍存在问题**:
- [ ] 🔴 卫生间数量仍比需求数量多一个
- [ ] 🔴 暗卫问题仍会出现
- [ ] 🔴 玄关位置可能乱放
- [ ] 🔴 外墙可能乱开门
- [ ] 🔴 部分房间可能没有放置家具

### 分析

AI 模型（Gemini 图生图）对复杂规则的理解和执行仍有局限：
1. 文本规则的权重低于视觉特征
2. 模型缺乏真实的建筑空间逻辑
3. 需要更强的约束方式（如蒙版、分步生成等）

### 当前配置
- **视觉分析**: gemini-3.1-flash-lite-preview (LinkAPI)
- **Prompt生成**: gemini-3.1-flash-lite-preview (LinkAPI)
- **图像生成**: gemini-3.1-flash-image-preview (LinkAPI)
- **后端端口**: 5003
- **前端端口**: 3000

---

## 2026-03-27 - V1.1 规则精简

### 改动内容

精简图生图 Prompt 中的设计规则，减少 Token 数量以提升 AI 对关键约束的遵从度。

#### `get_space_standards()` 精简
- 改善型/奢享型空间标准从列表格式改为 Markdown 表格
- 行数从 ~60行 缩减为 ~25行

#### `get_base_rules()` 精简（核心改动）
- RULE 0-13 + 底部重复列表（共25条，~250行）→ R0-R7（8条，~25行）
- 合并项：
  - R0: 外边界 + 外墙门窗（原 RULE 0 + RULE 2）
  - R2: 内墙重绘（原 RULE 3，去掉楼梯规则 RULE 4）
  - R3: 房间数量（原 RULE 5 + RULE 6）
  - R4: 卫生间规范（原 RULE 7，去掉重复的计数教学和固定设施图解框）
  - R5: 朝向分区（原 RULE 9 + RULE 13）
  - R6: 门与通道（原 RULE 8 + RULE 10 + RULE 11）
  - R7: 收纳与家具（原 RULE 12 + 底部列表）
- 删除：底部 MANDATORY DESIGN RULES 完全重复列表、~30处强调标记（仅R0保留1处）
- Token 减少约 70%

### 未修改
- `/generate-prompt` 端点的 11 条分析规则保持不变（用途不同，已较简洁）
- `/optimize` 和 `/refine` 端点调用方式完全兼容，无需改动

### 版本标记：V1.1
