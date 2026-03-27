"""
ArchiAudit Pro Backend
Flask application for floor plan analysis and optimization

Deploy: api.siliang.cfd/api/archiaudit/
"""

import os
import json
import re
import base64
import requests
from functools import wraps
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load .env file for local development
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    print(f"[INFO] Loaded .env from {env_path}")
except ImportError:
    print("[INFO] python-dotenv not installed, using system environment")

app = Flask(__name__)
CORS(app, origins=['https://archiaudit.siliang.cfd', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'])

# Configuration - Gemini API via LinkAPI (统一使用 Gemini 模型)
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_API_ENDPOINT = os.environ.get('GEMINI_API_ENDPOINT', 'https://api.linkapi.ai/v1/chat/completions')
GEMINI_TEXT_MODEL = os.environ.get('GEMINI_TEXT_MODEL', 'gemini-3.1-flash-lite-preview')  # 文本/视觉模型
GEMINI_IMAGE_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image-preview')  # 图像生成模型
MAIN_PORTAL_API = os.environ.get('MAIN_PORTAL_API', 'https://api.siliang.cfd')

# Validate required configuration
if not GEMINI_API_KEY:
    print("[WARN] GEMINI_API_KEY not set - all API calls will fail")

# Check if in development mode
DEV_MODE = os.environ.get('DEV_MODE', 'false').lower() == 'true'


# ============ Shared Design Rules (用于 /optimize 和 /refine) ============

def get_space_standards(positioning: str = "IMPROVEMENT") -> str:
    """根据户型定位返回空间标准"""
    if positioning == "LUXURY":
        return """
## SPACE STANDARDS (LUXURY / 奢享型):
| Room | Min Area | Min Size |
|------|----------|----------|
| Master Bedroom (主卧) | 18-25㎡ | 3.6×5.0m, 含衣帽间+主卫 |
| Other Bedrooms (次卧) | 12-18㎡ | 3.0×4.0m |
| Living Room (客厅) | 25-40㎡ | 宽≥4.5m, LDK一体优先 |
| Kitchen (厨房) | 8-12㎡ | 需有窗, 中岛优先 |
| Master Bath (主卫) | 6-10㎡ | 双台盆+淋浴1500×1500+浴缸 |
| Guest Bath (公卫) | 5-7㎡ | 单台盆+淋浴1000×1000 |
| 800库 Storage | 1.5-2.5㎡ | 深≥800mm |
| Entrance Cabinet (玄关柜) | 深400-600mm | 宽≥1.5m"""
    else:
        return """
## SPACE STANDARDS (IMPROVEMENT / 改善型):
| Room | Min Area | Min Size |
|------|----------|----------|
| Master Bedroom (主卧) | 12-18㎡ | 3.0×4.0m, 含衣帽间+主卫 |
| Other Bedrooms (次卧) | 8-12㎡ | 2.8×3.5m |
| Living Room (客厅) | 18-25㎡ | 宽≥3.6m |
| Kitchen (厨房) | 5-8㎡ | 需有窗 |
| Master Bath (主卫) | 4-6㎡ | 双台盆+淋浴+浴缸 |
| Guest Bath (公卫) | 3-5㎡ | 单台盆+淋浴900×900 |
| 800库 Storage | 1-2㎡ | 深≥800mm |
| Entrance Cabinet (玄关柜) | 深400-600mm | 宽≥1.2m |"""


def get_base_rules(bedroom_count: str = "as specified", bathroom_count: str = "as specified", positioning: str = "IMPROVEMENT") -> str:
    """返回基础设计规则 (R0-R7, 精简版)"""
    space_standards = get_space_standards(positioning)

    return f"""## DESIGN RULES

⛔ R0 - OUTER BOUNDARY: 外轮廓完全不变，不得向外延伸或修改形状。外墙上的门窗位置固定。

R1 - ENTRANCE DOOR: 入户门位置、朝向不可修改。

R2 - INTERNAL WALLS: 擦除全部内墙 → 仅保留外轮廓 → 在轮廓内按需求重新绘制内墙。

R3 - ROOM COUNT: 卧室 {bedroom_count} 间，卫生间 {bathroom_count} 间（总数=公卫+主卫），不多不少。

R4 - BATHROOM:
  - 主卫：在主卧套内，门从主卧内开；双台盆+马桶+淋浴+浴缸，干湿分离（浴缸在湿区）
  - 公卫：从公共区域可达；单台盆+马桶+淋浴
  - 所有卫生间必须有外窗（禁止暗卫、禁止内墙开窗）

R5 - ORIENTATION:
  - 南侧(下方)：客厅、所有卧室
  - 北侧(上方)：厨房、书房、多功能房、公卫
  - 厨房必须有外窗

R6 - DOORS:
  - 每个封闭房间必须有门
  - 门不得被墙、柜子、家具遮挡
  - 入户门不对任何房门（需玄关/隔断遮挡）

R7 - STORAGE & FURNITURE:
  - 玄关柜：对门放置或近入户门
  - 800库：近入户门，需有门（是房间不是家具），深≥800mm
  - 每间卧室配衣柜

{space_standards}"""

# ============ Authentication Middleware ============

def verify_token_with_portal(token: str) -> dict:
    """Verify token with main portal API"""
    try:
        response = requests.get(
            f"{MAIN_PORTAL_API}/api/auth/me",
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        app.logger.error(f"Token verification failed: {e}")
        return None


def require_auth(f):
    """Authentication decorator - verifies token with main portal"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Development mode: allow all requests without auth
        if DEV_MODE:
            request.user = {'id': 1, 'username': 'dev-user'}
            return f(*args, **kwargs)

        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401

        token = auth_header.replace('Bearer ', '')

        # Verify token with main portal
        user_data = verify_token_with_portal(token)
        if not user_data:
            return jsonify({'error': 'Invalid or expired token'}), 401

        request.user = user_data.get('user', {})
        return f(*args, **kwargs)
    return decorated_function


# ============ Helper Functions ============

def call_gemini_api(prompt: str, image_base64: str = None) -> str:
    """Call Gemini API via LinkAPI (OpenAI-compatible format) for text/vision tasks"""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    headers = {
        'Authorization': f'Bearer {GEMINI_API_KEY}',
        'Content-Type': 'application/json'
    }

    # Build message content
    content = []
    if image_base64:
        # Remove data URL prefix if present
        if image_base64.startswith('data:'):
            image_base64 = image_base64.split(',', 1)[1]
        # OpenAI-compatible format with image_url
        content.append({
            'type': 'image_url',
            'image_url': {
                'url': f'data:image/jpeg;base64,{image_base64}'
            }
        })
    content.append({'type': 'text', 'text': prompt})

    payload = {
        'model': GEMINI_TEXT_MODEL,
        'messages': [{'role': 'user', 'content': content}],
        'temperature': 0.5,
        'max_tokens': 8192
    }

    try:
        # Disable proxy for this request
        no_proxy = {'http': None, 'https': None}
        response = requests.post(
            GEMINI_API_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=180,
            proxies=no_proxy
        )
        response.raise_for_status()
        result = response.json()

        # Debug logging
        app.logger.info(f"Gemini API response keys: {result.keys()}")

        # Extract text from OpenAI-compatible response
        if 'choices' in result and len(result['choices']) > 0:
            return result['choices'][0]['message']['content']
        raise ValueError("No response content from Gemini API")

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Gemini API error: {e}")
        raise Exception(f"Gemini API call failed: {str(e)}")


# call_glm_api 已被 call_gemini_api 替代
# 保留别名以兼容旧代码
def call_glm_api(prompt: str, image_base64: str = None) -> str:
    """别名函数，调用 call_gemini_api"""
    return call_gemini_api(prompt, image_base64)


# call_glm5_api 已被 call_gemini_api 替代
# 保留别名以兼容旧代码
def call_glm5_api(prompt: str) -> str:
    """别名函数，调用 call_gemini_api 进行文本生成"""
    return call_gemini_api(prompt)


def call_image_api(prompt: str, image_base64: str = None) -> str:
    """Generate image using LinkAPI Gemini image model"""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    headers = {
        'Authorization': f'Bearer {GEMINI_API_KEY}',
        'Content-Type': 'application/json'
    }

    # Remove data URL prefix if present
    if image_base64 and image_base64.startswith('data:'):
        image_base64 = image_base64.split(',', 1)[1]

    # 使用原生 Gemini API 格式进行图生图
    # gemini-3.1-flash-image-preview 使用 v1beta 端点
    gemini_endpoint = GEMINI_API_ENDPOINT.replace('/v1/chat/completions', f'/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent')

    if image_base64:
        # 图生图模式 - 使用原生 Gemini inlineData 格式
        payload = {
            'contents': [{
                'parts': [
                    {'inlineData': {'mimeType': 'image/jpeg', 'data': image_base64}},
                    {'text': prompt}
                ]
            }],
            'generationConfig': {
                'responseModalities': ['IMAGE'],
                'imageConfig': {
                    'imageSize': '1K'
                }
            }
        }
        app.logger.info(f"Using native Gemini API format with input image for image-to-image editing")
        app.logger.info(f"Model: {GEMINI_IMAGE_MODEL}")
        # 打印完整的Prompt内容用于调试
        app.logger.info(f"=== FULL PROMPT SENT TO GEMINI ===")
        app.logger.info(prompt[:2000] if len(prompt) > 2000 else prompt)
        app.logger.info(f"=== END PROMPT ===")
    else:
        # 纯文本生图模式
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'responseModalities': ['IMAGE'],
                'imageConfig': {
                    'imageSize': '1K'
                }
            }
        }
        app.logger.info(f"Using native Gemini API format for text-to-image")

    try:
        # Disable proxy for this request
        no_proxy = {'http': None, 'https': None}
        response = requests.post(
            gemini_endpoint,
            headers=headers,
            json=payload,
            timeout=300,
            proxies=no_proxy
        )
        response.raise_for_status()
        result = response.json()

        # Debug: log the response structure
        app.logger.info(f"Gemini API response keys: {result.keys()}")

        # 处理原生 Gemini API 响应格式
        if 'candidates' in result and len(result['candidates']) > 0:
            candidate = result['candidates'][0]
            content = candidate.get('content', {})
            parts = content.get('parts', [])

            for part in parts:
                if 'inlineData' in part:
                    inline_data = part['inlineData']
                    mime_type = inline_data.get('mimeType', 'image/jpeg')
                    data = inline_data.get('data')
                    if data:
                        app.logger.info(f"Got inlineData from Gemini API response, mime: {mime_type}")
                        return f"data:{mime_type};base64,{data}"

            # 如果没有找到 inlineData，检查是否有文本内容（可能是错误信息）
            for part in parts:
                if 'text' in part:
                    text = part['text']
                    app.logger.warning(f"Gemini returned text instead of image: {text[:200]}")
                    # 尝试从 markdown 格式中提取
                    md_data_match = re.search(r'!\[.*?\]\((data:image/[^;]+;base64,[^)]+)\)', text)
                    if md_data_match:
                        return md_data_match.group(1)

        # 备用：尝试 OpenAI 兼容格式（如果 LinkAPI 使用这个格式）
        if 'choices' in result and len(result['choices']) > 0:
            choice = result['choices'][0]
            message = choice.get('message', {})
            content = message.get('content', '')

            if isinstance(content, str):
                md_data_match = re.search(r'!\[.*?\]\((data:image/[^;]+;base64,[^)]+)\)', content)
                if md_data_match:
                    app.logger.info("Found markdown-wrapped base64 data URL in OpenAI format")
                    return md_data_match.group(1)

        raise ValueError("No image found in API response")

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Image API error: {e}")
        raise Exception(f"Image API call failed: {str(e)}")


def fetch_image_as_base64(url: str) -> str:
    """Fetch image from URL and return as base64 data URL"""
    try:
        app.logger.info(f"Fetching image from: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        content_type = response.headers.get('Content-Type', 'image/jpeg')
        b64_data = base64.b64encode(response.content).decode('utf-8')
        app.logger.info(f"Image fetched successfully, size: {len(b64_data)} chars")

        return f'data:{content_type};base64,{b64_data}'
    except Exception as e:
        app.logger.error(f"Failed to fetch image: {e}")
        raise


# ============ API Routes ============

@app.route('/health', methods=['GET'])
@app.route('/api/archiaudit/health', methods=['GET'])
def health_check():
    """Health check endpoint - no auth required"""
    return jsonify({
        'status': 'ok',
        'service': 'archiaudit',
        'gemini_configured': GEMINI_API_KEY is not None,
        'text_model': GEMINI_TEXT_MODEL,
        'image_model': GEMINI_IMAGE_MODEL
    })


@app.route('/verify', methods=['GET'])
@app.route('/api/archiaudit/verify', methods=['GET'])
def verify_token():
    """Verify token with main portal"""
    auth_header = request.headers.get('Authorization', '')

    if not auth_header.startswith('Bearer '):
        return jsonify({'valid': False, 'error': 'Missing token'}), 401

    token = auth_header.replace('Bearer ', '')

    # Development mode: accept dev-token
    if DEV_MODE and token == 'dev-token':
        return jsonify({'valid': True, 'user': {'id': 1, 'username': 'dev-user'}})

    # Verify token with main portal
    user_data = verify_token_with_portal(token)
    if user_data:
        return jsonify({'valid': True, 'user': user_data.get('user', {})})

    return jsonify({'valid': False, 'error': 'Invalid token'}), 401


@app.route('/sessions', methods=['GET'])
@app.route('/api/archiaudit/sessions', methods=['GET'])
@require_auth
def get_sessions():
    """Session info endpoint"""
    return jsonify({
        'active': True,
        'user': request.user,
    })


@app.route('/generate-prompt', methods=['POST'])
@app.route('/api/archiaudit/generate-prompt', methods=['POST'])
@require_auth
def generate_optimization_prompt():
    """Generate optimized prompt using GLM-5 with priority ordering"""

    data = request.get_json()
    requirements = data.get('requirements', {})
    analysis_items = data.get('analysisItems', [])

    # 构建基础规则（第一优先级）- 中英双语
    base_rules = """## 🔒 底层基础规则 / MANDATORY RULES (最高优先级 / HIGHEST PRIORITY)

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
    / Follow user requirements EXACTLY. Bedroom count includes master. Bathroom count includes all."""

    # 格式化用户需求（第二优先级）- 中英双语
    req_items_cn = []
    req_items_en = []

    if requirements:
        # 墙体
        wall_map = {
            'all_fixed': ('所有内部墙体和内门不变', 'All internal walls and doors remain unchanged'),
            'structural_only': ('剪力墙（黑色填充）不变，非承重墙和户内门可变', 'Structural walls (black filled) fixed, partitions and doors can change'),
            'all_flexible': ('所有内墙体和户内门都可变化', 'All internal walls and doors can be modified')
        }
        if requirements.get('wallType'):
            cn, en = wall_map.get(requirements['wallType'], (requirements['wallType'], requirements['wallType']))
            req_items_cn.append(f"墙体调整: {cn}")
            req_items_en.append(f"WALLS: {en}")

        # 客厅
        living_map = {
            'single': ('单客厅', 'Single living room'),
            'double': ('双客厅', 'Double living room')
        }
        if requirements.get('livingRoom'):
            cn, en = living_map.get(requirements['livingRoom'], (requirements['livingRoom'], requirements['livingRoom']))
            req_items_cn.append(f"客厅: {cn}")
            req_items_en.append(f"LIVING ROOM: {en}")

        # 卧室
        if requirements.get('bedrooms'):
            req_items_cn.append(f"🔴 卧室数量: {requirements['bedrooms']}个（必须严格遵守！）")
            req_items_en.append(f"🔴 BEDROOMS: MUST draw EXACTLY {requirements['bedrooms']} bedroom(s)!")

        # 书房
        study_map = {
            'none': ('无书房', 'No study room'),
            'one': ('1个书房', '1 study room')
        }
        if requirements.get('studyRoom'):
            cn, en = study_map.get(requirements['studyRoom'], (requirements['studyRoom'], requirements['studyRoom']))
            req_items_cn.append(f"书房: {cn}")
            req_items_en.append(f"STUDY ROOM: {en}")

        # 功能房
        if requirements.get('functionRooms') and len(requirements['functionRooms']) > 0:
            rooms = ', '.join(requirements['functionRooms'])
            req_items_cn.append(f"功能房: {rooms}")
            req_items_en.append(f"FUNCTION ROOMS: {rooms}")

        # 卫生间
        bathroom_map = {
            'one_public': ('1个公用卫生间', '1 public bathroom'),
            'one_public_one_master': ('1公卫+1主卫', '1 public + 1 master bathroom (2 total)'),
            'one_public_two_master': ('1公卫+2主卫', '1 public + 2 master bathrooms (3 total)'),
            'one_public_three_master': ('1公卫+3主卫', '1 public + 3 master bathrooms (4 total)')
        }
        if requirements.get('bathroom'):
            cn, en = bathroom_map.get(requirements['bathroom'], (requirements['bathroom'], requirements['bathroom']))
            req_items_cn.append(f"🔴 卫生间: {cn}（必须严格遵守！）")
            req_items_en.append(f"🔴 BATHROOMS: MUST draw EXACTLY {en}!")

        # 厨房
        kitchen_map = {
            'open_western': ('开放式西厨', 'Open western kitchen'),
            'closed_chinese': ('封闭式中厨', 'Closed Chinese kitchen'),
            'both': ('开放式西厨+封闭式中厨', 'Open western + Closed Chinese kitchen')
        }
        if requirements.get('kitchen'):
            cn, en = kitchen_map.get(requirements['kitchen'], (requirements['kitchen'], requirements['kitchen']))
            req_items_cn.append(f"厨房: {cn}")
            req_items_en.append(f"KITCHEN: {en}")

        # 阳台
        balcony_map = {
            'with-door': ('有阳台门', 'With balcony door'),
            'no-door': ('无阳台门', 'Without balcony door')
        }
        if requirements.get('balcony'):
            cn, en = balcony_map.get(requirements['balcony'], (requirements['balcony'], requirements['balcony']))
            req_items_cn.append(f"阳台: {cn}")
            req_items_en.append(f"BALCONY: {en}")

        # 玄关收纳
        if requirements.get('entranceStorage') and len(requirements['entranceStorage']) > 0:
            storage = ', '.join(requirements['entranceStorage'])
            req_items_cn.append(f"玄关收纳: {storage}")
            req_items_en.append(f"ENTRANCE STORAGE: {storage}")

        # 其他要求
        if requirements.get('otherRequirements'):
            req_items_cn.append(f"其他需求: {requirements['otherRequirements']}")
            req_items_en.append(f"OTHER REQUIREMENTS: {requirements['otherRequirements']}")

    # 格式化分析结果（第三优先级）- 中英双语
    analysis_items_cn = []
    analysis_items_en = []
    if analysis_items:
        problem_items = [item for item in analysis_items if item.get('status') in ['fail', 'warning']]
        for item in problem_items:
            cn_text = item.get('observationCn', item.get('observation', ''))
            en_text = item.get('observation', '')
            category = item.get('categoryCn', item.get('category', ''))
            analysis_items_cn.append(f"- 【{category}】{cn_text}")
            analysis_items_en.append(f"- [{item.get('category', category)}] {en_text}")

    # 组装中英双语的文本
    requirements_text_cn = "\n".join([f"- {item}" for item in req_items_cn]) if req_items_cn else "无特定需求"
    requirements_text_en = "\n".join([f"- {item}" for item in req_items_en]) if req_items_en else "No specific requirements"
    analysis_text_cn = "\n".join(analysis_items_cn) if analysis_items_cn else "无明显问题"
    analysis_text_en = "\n".join(analysis_items_en) if analysis_items_en else "No obvious issues"

    # 使用 Gemini 生成优化后的 Prompt
    if GEMINI_API_KEY:
        try:
            glm5_prompt = f"""你是一个专业的建筑设计师助手。请根据以下三部分内容，生成一个**融合后**的户型优化指令。

**重要要求：**
1. **融合而非拼接**：将三个优先级的内容融合成一个连贯的指令，不要简单拼接
2. **冲突处理**：如果第三优先级（分析问题）与第一或第二优先级冲突，**删除冲突的分析项**，以第一/第二优先级为准
3. **中英双语**：每条规则必须同时有中文和英文两个版本
4. **强调约束**：卧室数量、卫生间数量等必须严格遵守的要求用🔴标记

--- 第一优先级：底层基础规则（不可违反）---
{base_rules}

--- 第二优先级：用户需求清单（必须遵守）---
中文：
{requirements_text_cn}

English:
{requirements_text_en}

--- 第三优先级：现有问题分析（仅供参考，如有冲突则删除）---
中文：
{analysis_text_cn}

English:
{analysis_text_en}

请生成一个**完整融合**的优化指令，格式要求：
- 使用中英双语（每条规则先中文后英文）
- 移除与第一/第二优先级冲突的分析项
- 用🔴标记必须严格遵守的约束条件
- 结构清晰，便于AI图像生成模型理解"""

            optimized_prompt = call_glm5_api(glm5_prompt)
            return jsonify({
                'success': True,
                'prompt': optimized_prompt,
                'source': 'gemini'
            })
        except Exception as e:
            app.logger.error(f"GLM-5 prompt generation failed: {e}")
            # Fallback to template-based generation
            pass

    # Fallback: 使用模板生成（中英双语）
    fallback_prompt = f"""{base_rules}

---

## 📋 用户需求清单 / USER REQUIREMENTS (第二优先级 / SECOND PRIORITY)

**中文 / Chinese:**
{requirements_text_cn}

**English:**
{requirements_text_en}

---

## 📊 现有问题分析 / ANALYSIS RESULT (第三优先级 / THIRD PRIORITY - 仅供参考 / For Reference Only)

**中文 / Chinese:**
{analysis_text_cn}

**English:**
{analysis_text_en}

---

## ⚠️ 关键提醒 / KEY REMINDERS

🔴 1. 外框绝对不能变！/ OUTER WALLS MUST NOT CHANGE!
🔴 2. 卧室数量：{requirements.get('bedrooms', 'N/A')}个 / Bedroom count: EXACTLY {requirements.get('bedrooms', 'as specified')}
🔴 3. 卫生间数量：按需求配置 / Bathroom count: As specified above
🔴 4. 内墙必须按需求重绘！/ Internal walls MUST be redrawn according to requirements!"""

    return jsonify({
        'success': True,
        'prompt': fallback_prompt,
        'source': 'fallback'
    })


@app.route('/analyze', methods=['POST'])
@app.route('/api/archiaudit/analyze', methods=['POST'])
@require_auth
def analyze_floor_plan():
    """Analyze floor plan image"""
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API not configured'}), 500

    data = request.get_json()
    image_base64 = data.get('image')
    plan_type = data.get('planType', 'SINGLE')
    positioning = data.get('positioning', 'IMPROVEMENT')
    special_requirements = data.get('specialRequirements', '')

    if not image_base64:
        return jsonify({'error': 'Image is required'}), 400

    prompt = f"""Task: Deep Architectural Audit.
Context: Type={plan_type}, Position={positioning}, SpecialReq={special_requirements or 'None'}.

ACTIONS:
1. Analyze the floor plan image carefully.
2. Critique the floor plan against luxury housing standards.
3. Identify issues in categories: Layout, Circulation, Lighting, Storage, Privacy, Functionality.

IMPORTANT: You MUST respond with ONLY a valid JSON object, no markdown formatting, no code blocks.
The JSON must match this structure exactly:
{{
  "summary": "Brief English summary of overall assessment",
  "summaryCn": "中文总结",
  "items": [
    {{
      "category": "Category Name",
      "categoryCn": "分类名称",
      "status": "pass" or "fail" or "warning",
      "observation": "English description of the issue or positive aspect",
      "observationCn": "中文描述"
    }}
  ]
}}

Provide 4-8 items covering different aspects. Mark obvious problems as "fail", potential issues as "warning", and good aspects as "pass".
Remember: Output ONLY the JSON object, nothing else."""

    try:
        text = call_glm_api(prompt, image_base64)

        # Clean up response - remove markdown code blocks if present
        text = text.strip()
        if text.startswith('```'):
            # Remove markdown code blocks
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
        text = text.strip()

        result = json.loads(text)
        return jsonify(result)
    except json.JSONDecodeError as e:
        app.logger.error(f"Failed to parse GLM response: {e}, raw text: {text[:500]}")
        return jsonify({'error': f'Failed to parse AI response: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f"Analysis failed: {e}")
        # Return error instead of fallback - let frontend handle retry
        return jsonify({'error': f'Analysis service error: {str(e)}. Please try again.'}), 500


def format_requirements_prompt(requirements: dict) -> str:
    """将需求表转换为 prompt 文本"""
    if not requirements:
        return ""

    parts = []
    parts_en = []

    # 墙体类型 - 强调变化
    wall_map = {
        'all_fixed': ('所有内部墙体不变 / All internal walls fixed', 'All internal walls must remain unchanged'),
        'structural_only': ('黑色填充墙体（剪力墙）不变，未填充墙体可变 / Structural walls fixed, partitions flexible', 'Structural walls (black filled) must stay, partition walls CAN be moved or removed'),
        'all_flexible': ('所有内部墙体都可变化 / All internal walls can change', 'ALL internal walls CAN be moved, removed, or added')
    }
    if requirements.get('wallType'):
        wall_info = wall_map.get(requirements['wallType'], (requirements['wallType'], requirements['wallType']))
        parts.append(f"【墙体/Walls】{wall_info[0]}")
        parts_en.append(f"WALLS: {wall_info[1]}")

    # 客厅
    living_map = {'single': ('单客厅 / Single living room', 'EXACTLY 1 living room'), 'double': ('双客厅 / Double living room', 'EXACTLY 2 living rooms (formal + family)')}
    if requirements.get('livingRoom'):
        info = living_map.get(requirements['livingRoom'], (requirements['livingRoom'], requirements['livingRoom']))
        parts.append(f"【客厅/Living】{info[0]}")
        parts_en.append(f"LIVING ROOM: {info[1]}")

    # 卧室 - 强调具体数量
    if requirements.get('bedrooms'):
        parts.append(f"【卧室/Bedrooms】{requirements['bedrooms']}个卧室 / {requirements['bedrooms']} bedroom(s)")
        parts_en.append(f"BEDROOMS: MUST draw EXACTLY {requirements['bedrooms']} bedroom(s), NOT more, NOT less!")

    # 书房
    study_map = {
        'none': ('无书房 / No study room', 'NO study room - do NOT draw any study room'),
        'one': ('1个书房 / 1 study room', 'MUST include EXACTLY 1 study room')
    }
    if requirements.get('studyRoom'):
        info = study_map.get(requirements['studyRoom'], (requirements['studyRoom'], requirements['studyRoom']))
        parts.append(f"【书房/Study】{info[0]}")
        parts_en.append(f"STUDY ROOM: {info[1]}")

    # 功能房
    if requirements.get('functionRooms') and len(requirements['functionRooms']) > 0:
        rooms = ', '.join(requirements['functionRooms'])
        parts.append(f"【功能房/Function】{rooms}")
        parts_en.append(f"FUNCTION ROOMS: Must include: {rooms}")

    # 卫生间 - 强调具体数量
    bathroom_map = {
        'one_public': ('1个公用卫生间 / 1 public bathroom', 'EXACTLY 1 public bathroom, NO master bathroom'),
        'one_public_one_master': ('1公卫+1主卫 / 1 public + 1 master bathroom', 'EXACTLY 2 bathrooms total: 1 public + 1 master'),
        'one_public_two_master': ('1公卫+2主卫 / 1 public + 2 master bathrooms', 'EXACTLY 3 bathrooms total: 1 public + 2 master'),
        'one_public_three_master': ('1公卫+3主卫 / 1 public + 3 master bathrooms', 'EXACTLY 4 bathrooms total: 1 public + 3 master')
    }
    if requirements.get('bathroom'):
        info = bathroom_map.get(requirements['bathroom'], (requirements['bathroom'], requirements['bathroom']))
        parts.append(f"【卫生间/Bathroom】{info[0]}")
        parts_en.append(f"BATHROOMS: {info[1]}")

    # 厨房
    kitchen_map = {
        'open_western': ('开放式西厨 / Open western kitchen', 'Open concept western kitchen (no walls between kitchen and dining)'),
        'closed_chinese': ('封闭式中厨 / Closed Chinese kitchen', 'Closed Chinese kitchen with walls'),
        'both': ('开放式西厨+封闭式中厨 / Both kitchens', 'BOTH open western kitchen AND closed Chinese kitchen')
    }
    if requirements.get('kitchen'):
        info = kitchen_map.get(requirements['kitchen'], (requirements['kitchen'], requirements['kitchen']))
        parts.append(f"【厨房/Kitchen】{info[0]}")
        parts_en.append(f"KITCHEN: {info[1]}")

    # 阳台
    balcony_map = {'with-door': ('有阳台门 / With balcony door', 'Balcony with door'), 'no-door': ('无阳台门 / No balcony door', 'Balcony without door')}
    if requirements.get('balcony'):
        info = balcony_map.get(requirements['balcony'], (requirements['balcony'], requirements['balcony']))
        parts.append(f"【阳台/Balcony】{info[0]}")
        parts_en.append(f"BALCONY: {info[1]}")

    # 玄关收纳
    if requirements.get('entranceStorage') and len(requirements['entranceStorage']) > 0:
        storage = ', '.join(requirements['entranceStorage'])
        parts.append(f"【玄关收纳/Entrance】{storage}")
        parts_en.append(f"ENTRANCE STORAGE: {storage}")

    # 其他要求
    if requirements.get('otherRequirements'):
        parts.append(f"【其他/Other】{requirements['otherRequirements']}")
        parts_en.append(f"OTHER REQUIREMENTS: {requirements['otherRequirements']}")

    # 组合中英文
    result = "=== USER REQUIREMENTS (MUST FOLLOW EXACTLY) ===\n"
    result += "\n".join(parts_en) + "\n\n"
    result += "=== 中文需求 ===\n"
    result += "\n".join(parts)

    return result


@app.route('/optimize', methods=['POST'])
@app.route('/api/archiaudit/optimize', methods=['POST'])
@require_auth
def generate_optimizations():
    """Generate optimization options"""
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API not configured'}), 500

    data = request.get_json()
    image_base64 = data.get('image')
    requirements = data.get('requirements', {})
    confirmed_prompt = data.get('confirmedPrompt')
    positioning = data.get('positioning', 'IMPROVEMENT')  # 获取户型定位：IMPROVEMENT 或 LUXURY

    if not image_base64:
        return jsonify({'error': 'Image is required'}), 400

    # 格式化需求为 prompt
    requirements_text = format_requirements_prompt(requirements)

    # Generate strategies using GLM-4.6V
    logic_prompt = f"""Role: Senior Architect.
Task: Create 2 rational renovation strategies based on the floor plan image.

**IMPORTANT - USER REQUIREMENTS (HIGHEST PRIORITY):**
{requirements_text if requirements_text else 'No specific requirements provided.'}

ANALYSIS INSTRUCTION:
- **Black Solid Walls** = Structural (Keep).
- **Thin Lines** = Partitions (Remove/Move).

REQUIRED OUTPUT:
You MUST respond with ONLY a valid JSON object, no markdown formatting, no code blocks.
The JSON must match this structure exactly:
{{
  "option1": {{
    "description": "Description of conservative approach",
    "annotations": [
      {{ "id": 1, "text": "Change description", "textCn": "中文描述", "location": {{ "x": 20, "y": 30 }} }}
    ]
  }},
  "option2": {{
    "description": "Description of creative approach",
    "annotations": [
      {{ "id": 1, "text": "Change description", "textCn": "中文描述", "location": {{ "x": 50, "y": 50 }} }}
    ]
  }}
}}

STRATEGY 1: "Conservative / 稳健方案"
- Respect user requirements strictly.
- Fix functionality issues (e.g. storage, door swing).
- Ensure entrance is clear.
- Optimize furniture size.

STRATEGY 2: "Creative / 创意方案"
- Apply user requirements with creative solutions.
- **Demolish thin walls** to create Open Kitchen (LDK) or larger Master Suite.
- **Check**: Is the Kitchen blocking the entrance? If yes, MOVE IT.
- Improve flow between rooms.

**CRITICAL**: Each option MUST include 4-6 annotations with locations (x,y as 0-100 percentage).
Remember: Output ONLY the JSON object, nothing else."""

    # Default strategies based on user requirements
    default_strategies = {
        "option1": {
            "description": f"Conservative optimization based on requirements: {requirements_text[:200] if requirements_text else 'General layout optimization'}",
            "annotations": []
        },
        "option2": {
            "description": f"Creative redesign based on requirements: {requirements_text[:200] if requirements_text else 'Open plan renovation'}",
            "annotations": []
        }
    }

    strategies = default_strategies.copy()
    raw_text = ""

    try:
        raw_text = call_glm_api(logic_prompt, image_base64)

        # Clean up response - remove markdown code blocks if present
        text = raw_text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
        text = text.strip()

        # Try to parse JSON
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            strategies = parsed
            app.logger.info("Successfully parsed strategy response")
    except json.JSONDecodeError as e:
        app.logger.error(f"Failed to parse strategy response: {e}, attempting partial parse")
        # Try to extract descriptions from partial JSON
        try:
            # Try to find option1 description
            opt1_match = re.search(r'"option1"\s*:\s*\{[^}]*"description"\s*:\s*"([^"]+)"', raw_text, re.DOTALL)
            if opt1_match:
                strategies["option1"]["description"] = opt1_match.group(1)
            # Try to find option2 description
            opt2_match = re.search(r'"option2"\s*:\s*\{[^}]*"description"\s*:\s*"([^"]+)"', raw_text, re.DOTALL)
            if opt2_match:
                strategies["option2"]["description"] = opt2_match.group(1)
            app.logger.info("Partial strategy extraction successful")
        except Exception as ex:
            app.logger.error(f"Partial parse also failed: {ex}")
    except Exception as e:
        app.logger.error(f"Strategy logic failed: {e}")

    # Generate images using Gemini
    def create_image_prompt(strategy_type, details, user_requirements="", confirmed_brief="", positioning="IMPROVEMENT"):
        """生成图像prompt，区分保守和激进策略，以及改善型/奢享型定位"""

        # 从user_requirements中提取关键数量
        bedroom_count = "as specified"
        bathroom_count = "as specified"
        if "BEDROOMS: MUST draw EXACTLY" in user_requirements:
            import re
            match = re.search(r'EXACTLY (\d+) bedroom', user_requirements)
            if match:
                bedroom_count = match.group(1)
        if "BATHROOMS:" in user_requirements:
            import re
            match = re.search(r'EXACTLY (\d+) bathrooms', user_requirements)
            if match:
                bathroom_count = match.group(1)

        # 使用共享的规则系统
        base_rules = get_base_rules(bedroom_count, bathroom_count, positioning)

        base_prompt = f"""You are an architect. REDRAW this floor plan image with these changes:

{base_rules}

## USER REQUIREMENTS (MUST FOLLOW):
{user_requirements if user_requirements else 'Use default layout.'}

{f"ADDITIONAL INSTRUCTIONS: {confirmed_brief}" if confirmed_brief else ""}"""

        if strategy_type == "conservative":
            return base_prompt + """

## CONSERVATIVE APPROACH:
- ⚠️ CRITICAL: The outer boundary must remain EXACTLY the same
- ⚠️ FIRST: Erase ALL internal walls, then draw new ones INSIDE the original outline
- Keep main functional zones in similar positions
- Draw new internal walls according to requirements
- All new elements must be INSIDE the original boundary
- If fewer bedrooms needed: convert excess rooms to storage/walk-in closet
- If more bedrooms needed: add partition walls in large spaces
- Optimize furniture placement

## OUTPUT STYLE:
- Black lines on white background
- 2D CAD architectural style
- NO text labels
- Include furniture symbols (bed, sofa, toilet, sink, bathtub)
- Show door swings clearly"""
        else:
            return base_prompt + """

## ⚠️⚠️⚠️ RADICAL APPROACH - EXTRA WARNINGS ⚠️⚠️⚠️

EVEN THOUGH THIS IS A "RADICAL" REDESIGN:
⛔ THE OUTER BOUNDARY MUST STILL REMAIN EXACTLY THE SAME ⛔
⛔ DO NOT EXTEND ANYTHING OUTSIDE THE ORIGINAL OUTLINE ⛔

STEP-BY-STEP PROCESS:
1. FIRST: Trace the EXACT outer boundary from the original image
2. SECOND: Erase ALL internal walls completely
3. THIRD: Redesign the interior layout from scratch
4. FOURTH: All new walls and rooms must be INSIDE the traced boundary
5. FIFTH: Maximize space efficiency within the EXISTING boundary

WHAT "RADICAL" MEANS:
- You can COMPLETELY change the internal layout
- You can REMOVE all internal walls and start fresh
- You can CREATE new room configurations
- You can ADD new bathrooms, walk-in closets, storage

WHAT "RADICAL" DOES NOT MEAN:
- ❌ You CANNOT extend beyond the original outline
- ❌ You CANNOT add space outside the original boundary
- ❌ You CANNOT modify the outer walls

LAYOUT PRIORITIES:
- Maximize master suite (bedroom + walk-in closet + large bathroom)
- Create open LDK (living-dining-kitchen) space
- High-end bathroom designs
- Maximize storage space

## OUTPUT STYLE:
- Black lines on white background
- 2D CAD architectural style
- NO text labels
- Include furniture symbols (bed, sofa, toilet, sink, bathtub)
- Show door swings clearly"""

    # Generate two option images IN PARALLEL for faster processing
    def generate_option1():
        return call_image_api(
            create_image_prompt(
                "conservative",
                strategies.get("option1", {}).get("description", "Conservative optimization"),
                requirements_text,
                confirmed_prompt or "",
                positioning  # 传递户型定位
            ),
            image_base64
        )

    def generate_option2():
        return call_image_api(
            create_image_prompt(
                "radical",
                strategies.get("option2", {}).get("description", "Creative redesign"),
                requirements_text,
                confirmed_prompt or "",
                positioning  # 传递户型定位
            ),
            image_base64
        )

    # 第二步：分析生成的图像，生成准确的标注位置
    def analyze_generated_image(image_url, strategy_name, requirements):
        """使用视觉模型分析生成的图像，返回准确的标注位置和改动说明"""
        prompt = f"""You are analyzing an OPTIMIZED architectural floor plan image.

Your task: Identify 4-6 key DESIGN CHANGES in this optimized floor plan and describe what was changed.

User Requirements that were applied:
{requirements}

Strategy: {strategy_name}

IMPORTANT - Describe CHANGES, not just locations:
- If a bedroom was converted to a study: "Converted bedroom to study room with desk"
- If walls were removed: "Removed partition wall to create open living area"
- If bathroom was added: "Added new master bathroom with shower"
- If storage was added: "Added entrance storage closet"

For each change, provide:
- A unique ID (1, 2, 3, etc.)
- Description of the CHANGE in English (what was modified/added/removed)
- Description of the CHANGE in Chinese
- The approximate location (x, y as percentage 0-100, where 0,0 is top-left corner)

IMPORTANT: You MUST respond with ONLY a valid JSON array, no markdown formatting.
Format:
[
  {{"id": 1, "text": "Redesigned master suite with walk-in closet", "textCn": "重新设计主卧套间，增加衣帽间", "location": {{"x": 30, "y": 40}}}},
  {{"id": 2, "text": "Removed wall to create open kitchen", "textCn": "拆除墙体，打造开放式厨房", "location": {{"x": 50, "y": 60}}}}
]

Output ONLY the JSON array, nothing else."""

        try:
            # 提取 base64 数据
            if image_url.startswith('data:'):
                img_base64 = image_url.split(',', 1)[1]
            else:
                img_base64 = image_url

            response_text = call_glm_api(prompt, img_base64)

            # 清理响应
            response_text = response_text.strip()
            if response_text.startswith('```'):
                lines = response_text.split('\n')
                response_text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
            response_text = response_text.strip()

            annotations = json.loads(response_text)
            app.logger.info(f"Generated {len(annotations)} annotations for {strategy_name}")
            return annotations
        except Exception as e:
            app.logger.error(f"Failed to analyze generated image: {e}")
            return []

    # Parallel execution
    img1 = None
    img2 = None

    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(generate_option1)
        future2 = executor.submit(generate_option2)

        try:
            img1 = future1.result(timeout=300)
            app.logger.info(f"Image 1 generated successfully, length: {len(img1) if img1 else 0}")
        except Exception as e:
            app.logger.error(f"Image 1 generation failed: {e}")

        try:
            img2 = future2.result(timeout=300)
            app.logger.info(f"Image 2 generated successfully, length: {len(img2) if img2 else 0}")
        except Exception as e:
            app.logger.error(f"Image 2 generation failed: {e}")

    # Retry Option B if failed
    if not img2 or len(img2) < 100:
        app.logger.warning("Option B failed, retrying...")
        try:
            img2 = generate_option2()
            app.logger.info(f"Option B retry successful, length: {len(img2) if img2 else 0}")
        except Exception as e:
            app.logger.error(f"Option B retry also failed: {e}")

    # 第二步：分析生成的图像，生成准确的标注
    annotations1 = []
    annotations2 = []

    # 从策略中获取备用标注
    fallback_annotations1 = strategies.get("option1", {}).get("annotations", [])
    fallback_annotations2 = strategies.get("option2", {}).get("annotations", [])

    if img1:
        try:
            app.logger.info("Analyzing Option 1 image for accurate annotations...")
            annotations1 = analyze_generated_image(img1, "Conservative", requirements_text)
            if not annotations1 and fallback_annotations1:
                app.logger.info("Using fallback annotations for option 1 from strategy")
                annotations1 = fallback_annotations1
        except Exception as e:
            app.logger.error(f"Failed to generate annotations for option 1: {e}")
            if fallback_annotations1:
                app.logger.info("Using fallback annotations for option 1 from strategy")
                annotations1 = fallback_annotations1

    if img2:
        try:
            app.logger.info("Analyzing Option 2 image for accurate annotations...")
            annotations2 = analyze_generated_image(img2, "Creative", requirements_text)
            if not annotations2 and fallback_annotations2:
                app.logger.info("Using fallback annotations for option 2 from strategy")
                annotations2 = fallback_annotations2
        except Exception as e:
            app.logger.error(f"Failed to generate annotations for option 2: {e}")
            if fallback_annotations2:
                app.logger.info("Using fallback annotations for option 2 from strategy")
                annotations2 = fallback_annotations2

    # 如果仍然没有标注，生成基本标注
    if not annotations1:
        annotations1 = [
            {"id": 1, "text": "Optimized Layout", "textCn": "优化布局", "location": {"x": 50, "y": 50}},
            {"id": 2, "text": "See description for details", "textCn": "详见描述", "location": {"x": 30, "y": 30}}
        ]
    if not annotations2:
        annotations2 = [
            {"id": 1, "text": "Creative Layout", "textCn": "创意布局", "location": {"x": 50, "y": 50}},
            {"id": 2, "text": "See description for details", "textCn": "详见描述", "location": {"x": 70, "y": 30}}
        ]

    return jsonify({
        "option1": {
            "id": "opt1",
            "imageUrl": img1 or image_base64,
            "annotations": annotations1 if annotations1 else []
        },
        "option2": {
            "id": "opt2",
            "imageUrl": img2 or image_base64,
            "annotations": annotations2 if annotations2 else []
        }
    })


@app.route('/refine', methods=['POST'])
@app.route('/api/archiaudit/refine', methods=['POST'])
@require_auth
def refine_optimization():
    """Refine optimization based on user feedback - 使用与 /optimize 相同的完整规则系统"""
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API not configured'}), 500

    data = request.get_json()
    current_image = data.get('imageUrl')
    user_feedback = data.get('feedback')
    current_annotations = data.get('annotations', [])
    positioning = data.get('positioning', 'IMPROVEMENT')  # 户型定位
    requirements = data.get('requirements', {})  # 用户需求（用于获取卧室/卫生间数量）
    has_erased_areas = data.get('hasErasedAreas', False)  # 用户是否擦除了部分区域
    has_location_markers = data.get('hasLocationMarkers', False)  # 用户是否使用了位置标签
    location_markers = data.get('locationMarkers', [])  # 位置标签列表 [{id, x, y}, ...]

    if not current_image or not user_feedback:
        return jsonify({'error': 'imageUrl and feedback are required'}), 400

    # 从 requirements 中提取卧室和卫生间数量
    bedroom_count = "as specified"
    bathroom_count = "as specified"

    if requirements.get('bedrooms'):
        bedroom_count = str(requirements.get('bedrooms'))

    if requirements.get('bathroom'):
        bathroom_map = {
            'one_public': '1',
            'one_public_one_master': '2',
            'one_public_two_master': '3',
            'one_public_three_master': '4'
        }
        bathroom_count = bathroom_map.get(requirements.get('bathroom'), 'as specified')

    # 获取完整的规则系统
    base_rules = get_base_rules(bedroom_count, bathroom_count, positioning)

    # 构建局部修改规则
    partial_modification_rule = ""

    # 如果用户擦除了部分区域，添加擦除区域修改规则
    if has_erased_areas:
        partial_modification_rule += """

## ⛔⛔⛔ CRITICAL: ERASED AREA MODIFICATION MODE ⛔⛔⛔

The user has ERASED (painted white) specific areas of the floor plan that they want to modify.

YOUR TASK:
1. Look at the input image carefully
2. Identify the WHITE ERASED AREAS (areas painted white by user)
3. ONLY modify the content within the WHITE ERASED AREAS
4. PRESERVE ALL OTHER AREAS EXACTLY as they are in the original

⛔ STRICT RULES FOR ERASED AREA MODIFICATION:
- You MUST copy ALL non-erased areas EXACTLY from the original image
- You MUST NOT modify, move, or change ANY furniture, walls, or elements in non-erased areas
- You MUST ONLY redraw content in the white erased areas
- The white erased areas show where the user wants changes
- Everything else must remain IDENTICAL to the original"""

    # 如果用户使用了位置标签，添加位置标签修改规则
    if has_location_markers and location_markers:
        # 构建位置标签描述
        marker_descriptions = []
        for marker in location_markers:
            marker_id = marker.get('id', '?')
            marker_x = marker.get('x', 0)
            marker_y = marker.get('y', 0)
            # 将坐标转换为图片区域的描述
            x_desc = "left" if marker_x < 33 else "center" if marker_x < 66 else "right"
            y_desc = "top" if marker_y < 33 else "middle" if marker_y < 66 else "bottom"
            marker_descriptions.append(f"  - Marker @{marker_id}: {y_desc}-{x_desc} area (coordinates: {marker_x}%, {marker_y}%)")

        markers_text = "\n".join(marker_descriptions)

        partial_modification_rule += f"""

## ⛔⛔⛔ CRITICAL: LOCATION MARKER MODIFICATION MODE ⛔⛔⛔

The user has placed LOCATION MARKERS (@1, @2, etc.) on specific areas of the floor plan.

USER PLACED MARKERS AT THESE LOCATIONS:
{markers_text}

THE USER'S FEEDBACK REFERENCES THESE MARKERS (e.g., "@1", "@2").

⛔ STRICT RULES FOR LOCATION MARKER MODIFICATION:
1. IDENTIFY the areas marked by @1, @2, etc. based on the coordinates above
2. ONLY MODIFY the areas near the location markers
3. PRESERVE ALL OTHER AREAS EXACTLY as they are in the original
4. The user feedback specifically mentions @1, @2, etc. - these are the ONLY areas to change
5. DO NOT modify any area that is NOT marked with a location marker

EXAMPLE:
- If user says "@1 enlarge bathroom": ONLY modify the bathroom at marker @1 location
- If user says "@1 move wall, @2 add cabinet": ONLY modify areas at @1 and @2
- All other rooms, walls, furniture must remain EXACTLY the same

⛔ IF YOU MODIFY AREAS THAT ARE NOT MARKED, THE RESULT IS INVALID!"""

    # Generate new image - 使用完整的规则系统
    image_prompt = f"""You are an architect. REDRAW this floor plan image with these changes:
{partial_modification_rule}

{base_rules}

## USER REFINEMENT REQUEST (MUST APPLY):
"{user_feedback}"

## CRITICAL REMINDERS FOR REFINEMENT:
1. The OUTER BOUNDARY must remain EXACTLY the same - NO extension outside
2. ALL bathrooms MUST have windows (NO dark bathrooms)
3. ERASE internal walls in the area user wants to modify, then redraw
4. Do NOT add stairs if they don't exist in the original
5. Maintain the bedroom and bathroom count as specified
6. ONLY modify the areas specified by user (erased areas or location markers)

## OUTPUT STYLE:
- Black lines on white background
- 2D CAD architectural style
- NO text labels
- Include furniture symbols (bed, sofa, toilet, sink, bathtub)
- Show door swings clearly"""

    try:
        new_image = call_image_api(image_prompt, current_image)

        return jsonify({
            "imageUrl": new_image,
            "annotations": current_annotations
        })
    except Exception as e:
        app.logger.error(f"Refinement failed: {e}")
        return jsonify({'error': f'Failed to generate new image: {str(e)}'}), 500


# ============ Error Handlers ============

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5003)), debug=True)
