"""
Agent 3: 知识检索（ChromaDB RAG）+ 反幻觉过滤
"""
import json
from langchain_core.tools import tool
from services.chroma import collection
from agents.anti_hallucination import filter_retrieval_results


@tool
def search_component_docs(dsl_json: str, component_lib: str = "element-plus") -> str:
    """
    从 ChromaDB 知识库检索组件文档，附加到 DSL 中。
    包含相关性过滤和反幻觉校验。
    """
    try:
        dsl = json.loads(dsl_json) if isinstance(dsl_json, str) else dsl_json
        components = dsl.get("components", [])

        component_types = set()

        def collect_types(comps):
            for c in comps:
                ct = c.get("type", "")
                if ct and ct not in ("container", "box", "text"):
                    component_types.add(ct)
                if c.get("children"):
                    collect_types(c["children"])

        collect_types(components)

        docs = {}
        for comp_type in component_types:
            query = f"{component_lib} {comp_type} 组件 API 用法 示例"
            results = collection.query(query_texts=[query], n_results=3)

            # 反幻觉第一层：相关性过滤
            filtered = filter_retrieval_results(comp_type, results, min_score=0.5)
            if filtered:
                docs[comp_type] = filtered[0]  # 取最相关的一个

        dsl["componentDocs"] = docs
        dsl["componentLib"] = component_lib
        return json.dumps(dsl, ensure_ascii=False, indent=2)
    except Exception as e:
        dsl_json_str = dsl_json if isinstance(dsl_json, str) else json.dumps(dsl_json)
        return json.dumps({"error": str(e), "dsl": dsl_json_str})
