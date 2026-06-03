"""
多 Agent 流水线串联（Chain）
Agent1(清洗:Python) → Agent2(结构化:Python) → Agent3(检索:Python)
    → Agent4(生成:LLM) → Agent5(验证:AST+LLM)
"""
import json
from langchain.schema.runnable import RunnableLambda
from agents.cleaner import clean_figma_data
from agents.converter import convert_to_dsl
from agents.retriever import search_component_docs
from agents.generator import generate_page_code
from agents.validator import validate_and_fix


def create_pipeline():
    """创建 5 Agent 流水线"""

    def agent1_clean(input_dict: dict) -> dict:
        """Agent 1: 数据清洗（Python 代码，不用 LLM）"""
        print("[Agent 1/5] 数据清洗中 (Python 代码)...")
        cleaned = clean_figma_data(input_dict.get("figma_raw", ""))
        input_dict["cleaned_data"] = json.dumps(cleaned, ensure_ascii=False)
        input_dict["agent1_status"] = "completed"
        return input_dict

    def agent2_convert(input_dict: dict) -> dict:
        """Agent 2: 结构化转换（Python 规则引擎，不用 LLM）"""
        print("[Agent 2/5] 结构化转换中 (Python 规则引擎)...")
        cleaned = json.loads(input_dict.get("cleaned_data", "{}"))
        dsl = convert_to_dsl(
            cleaned,
            input_dict.get("framework", "react"),
            input_dict.get("componentLib", "element-plus"),
        )
        input_dict["dsl"] = json.dumps(dsl, ensure_ascii=False, indent=2)
        input_dict["agent2_status"] = "completed"
        return input_dict

    def agent3_retrieve(input_dict: dict) -> dict:
        """Agent 3: 知识检索（Python + ChromaDB）"""
        print("[Agent 3/5] 知识检索中 (ChromaDB RAG)...")
        dsl = input_dict.get("dsl", "")
        component_lib = input_dict.get("componentLib", "element-plus")
        dsl_with_docs = search_component_docs.invoke({"dsl_json": dsl, "component_lib": component_lib})
        input_dict["dsl_with_docs"] = dsl_with_docs
        input_dict["agent3_status"] = "completed"
        return input_dict

    def agent4_generate(input_dict: dict) -> dict:
        """Agent 4: 代码生成（DeepSeek-V3 LLM）"""
        print("[Agent 4/5] 代码生成中 (DeepSeek-V3)...")
        dsl_with_docs = input_dict.get("dsl_with_docs", "")
        framework = input_dict.get("framework", "react")
        code = generate_page_code.invoke({"dsl_with_docs": dsl_with_docs, "framework": framework})
        input_dict["generated_code"] = code
        input_dict["agent4_status"] = "completed"
        return input_dict

    def agent5_validate(input_dict: dict) -> dict:
        """Agent 5: 测试验证（AST + LLM 双重检查）"""
        print("[Agent 5/5] 测试验证中 (AST + LLM)...")
        code = input_dict.get("generated_code", "")
        result = validate_and_fix.invoke(code)
        input_dict["validation_result"] = result
        input_dict["agent5_status"] = "completed"
        return input_dict

    pipeline = (
        RunnableLambda(agent1_clean)
        | RunnableLambda(agent2_convert)
        | RunnableLambda(agent3_retrieve)
        | RunnableLambda(agent4_generate)
        | RunnableLambda(agent5_validate)
    )

    return pipeline
