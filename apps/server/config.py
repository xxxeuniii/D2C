"""
D2C Backend - 集中配置管理
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API 配置
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY", "")
SILICONFLOW_BASE_URL = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")

# 模型配置
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
CODE_LLM_MODEL = os.getenv("CODE_LLM_MODEL", "deepseek-ai/DeepSeek-V3")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# 路径配置
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "output")

os.makedirs(CHROMA_PATH, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
