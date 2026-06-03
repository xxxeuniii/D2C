"""
ChromaDB 向量数据库服务
"""
import chromadb
from chromadb.utils import embedding_functions
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, EMBEDDING_MODEL, CHROMA_PATH

# Embedding 函数
sf_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=SILICONFLOW_API_KEY,
    api_base=SILICONFLOW_BASE_URL,
    model_name=EMBEDDING_MODEL,
)

# ChromaDB 客户端
chroma_client = chromadb.PersistentClient(
    path=CHROMA_PATH,
    settings=chromadb.config.Settings(anonymized_telemetry=False),
)

# 集合
collection = chroma_client.get_or_create_collection(
    name="design_specs",
    embedding_function=sf_ef,
)


def get_collection_count() -> int:
    """获取集合中文档数量"""
    return collection.count()
