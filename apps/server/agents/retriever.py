"""
Agent 3: 知识检索（ChromaDB RAG）
"""
import json
from langchain.tools import tool
from services.chroma import collection


@tool
def search_component_docs(dsl_json: str, component_lib: str = "element-plus") -> str:
    """
    从 ChromaDB 知识库检索组件文档，附加到 DSL 中。
    输入: DSL JSON + 组件库名称
    输出: 附加了文档的 DSL JSON
    """
    try:
        dsl = json.loads(dsl_json) if isinstance(dsl_json, str) else dsl_json
        components = dsl.get("components", [])

        # 收集所有组件类型
        component_types = set()

        def collect_types(comps):
            for c in comps:
                ct = c.get("type", "")
                if ct and ct not in ("container", "box", "text"):
                    component_types.add(ct)
                if c.get("children"):
                    collect_types(c["children"])

        collect_types(components)

        # 对每个类型检索文档
        docs = {}
        for comp_type in component_types:
            query = f"{component_lib} {comp_type} 组件 API 用法 示例"
            results = collection.query(query_texts=[query], n_results=2)
            if results["ids"] and results["ids"][0]:
                docs[comp_type] = results["documents"][0][0][:800]

        dsl["componentDocs"] = docs
        dsl["componentLib"] = component_lib
        return json.dumps(dsl, ensure_ascii=False, indent=2)
    except Exception as e:
        dsl_json_str = dsl_json if isinstance(dsl_json, str) else json.dumps(dsl_json)
        return json.dumps({"error": str(e), "dsl": dsl_json_str})
