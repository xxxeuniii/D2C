"""
D2C Backend - 集中配置管理
"""
import os
from dotenv import load_dotenv

# 确保从正确的 .env 文件加载（兼容从任意工作目录启动）
_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_path)

# 也加载根目录的 .env（可能包含 FIGMA_TOKEN 等配置）
_root_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
if os.path.exists(_root_env):
    load_dotenv(_root_env, override=False)  # override=False 不覆盖已有配置

# API 配置
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "")
SILICONFLOW_BASE_URL = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")
FIGMA_TOKEN = os.getenv("FIGMA_TOKEN", "")  # Figma Personal Access Token

# 模型配置
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
CODE_LLM_MODEL = os.getenv("CODE_LLM_MODEL", "deepseek-ai/DeepSeek-V3")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# 设置 openai / chromadb 需要的环境变量（兼容新版库）
if SILICONFLOW_API_KEY:
    os.environ.setdefault("OPENAI_API_KEY", SILICONFLOW_API_KEY)
    os.environ.setdefault("CHROMA_OPENAI_API_KEY", SILICONFLOW_API_KEY)

# 路径配置
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "output")

os.makedirs(CHROMA_PATH, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
