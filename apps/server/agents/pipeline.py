"""
多 Agent 流水线 — 双模式支持

模式 1 (Simple Chain)：5 个 RunnableLambda 串联
    速度快，确定性高，适合快速原型

模式 2 (Agent Mode)：Tool + 自主决策，流水线完成后可多轮对话修改
    流水线阶段：5 Agent 自主 Think→Act→Observe
    Chat 阶段：用户多轮对话迭代修改代码（Memory 记住对话历史）
"""
import json
from langchain.schema.runnable import RunnableLambda
from agents.cleaner import clean_figma_data, enhance_cleaned_data_with_llm
from agents.converter import convert_to_dsl, enhance_dsl_with_llm
from agents.retriever import search_component_docs
from agents.generator import generate_page_code
from agents.validator import validate_and_fix


def create_pipeline():
    """Simple Chain 模式：5 个 RunnableLambda 串联"""
    def agent1_clean(input_dict: dict) -> dict:
        print("[Agent 1/5] 数据清洗中 (Python 代码)...")
        cleaned = clean_figma_data(input_dict.get("figma_raw", ""))
        print("[Agent 1/5] LLM 语义增强中...")
        cleaned = enhance_cleaned_data_with_llm(cleaned)
        input_dict["cleaned_data"] = json.dumps(cleaned, ensure_ascii=False)
        input_dict["agent1_status"] = "completed"
        return input_dict

    def agent2_convert(input_dict: dict) -> dict:
        print("[Agent 2/5] 结构化转换中 (Python 规则引擎)...")
        cleaned = json.loads(input_dict.get("cleaned_data", "{}"))
        dsl = convert_to_dsl(
            cleaned,
            input_dict.get("framework", "react"),
            input_dict.get("componentLib", "element-plus"),
        )
        print("[Agent 2/5] LLM 语义增强中...")
        dsl = enhance_dsl_with_llm(
            dsl,
            input_dict.get("framework", "react"),
            input_dict.get("componentLib", "element-plus"),
        )
        input_dict["dsl"] = json.dumps(dsl, ensure_ascii=False, indent=2)
        input_dict["agent2_status"] = "completed"
        return input_dict

    def agent3_retrieve(input_dict: dict) -> dict:
        print("[Agent 3/5] 知识检索中 (ChromaDB RAG)...")
        dsl = input_dict.get("dsl", "")
        component_lib = input_dict.get("componentLib", "element-plus")
        dsl_with_docs = search_component_docs.invoke(
            {"dsl_json": dsl, "component_lib": component_lib}
        )
        input_dict["dsl_with_docs"] = dsl_with_docs
        input_dict["agent3_status"] = "completed"
        return input_dict

    def agent4_generate(input_dict: dict) -> dict:
        print("[Agent 4/5] 代码生成中 (DeepSeek-V3)...")
        dsl_with_docs = input_dict.get("dsl_with_docs", "")
        framework = input_dict.get("framework", "react")
        code = generate_page_code.invoke(
            {"dsl_with_docs": dsl_with_docs, "framework": framework}
        )
        input_dict["generated_code"] = code
        input_dict["agent4_status"] = "completed"
        return input_dict

    def agent5_validate(input_dict: dict) -> dict:
        print("[Agent 5/5] 测试验证中 (AST + LLM)...")
        code = input_dict.get("generated_code", "")
        result = validate_and_fix.invoke(code)
        input_dict["validation_result"] = result
        input_dict["agent5_status"] = "completed"
        return input_dict

    return (
        RunnableLambda(agent1_clean)
        | RunnableLambda(agent2_convert)
        | RunnableLambda(agent3_retrieve)
        | RunnableLambda(agent4_generate)
        | RunnableLambda(agent5_validate)
    )


def create_agent_pipeline():
    """
    Agent 模式流水线。
    
    流水线完成后，Chat Agent 自动初始化（带 Memory），
    用户可以通过 POST /api/pipeline/chat 多轮对话修改代码。
    """
    from agents.orchestrator import get_orchestrator

    orchestrator = get_orchestrator()

    def run_agent_pipeline(input_dict: dict) -> dict:
        figma_raw = input_dict.get("figma_raw", "")
        framework = input_dict.get("framework", "react")
        component_lib = input_dict.get("componentLib", "element-plus")

        result = orchestrator.run_pipeline(figma_raw, framework, component_lib)

        input_dict["generated_code"] = result.get("generated_code", "")
        input_dict["validation_result"] = result.get("validation_result", "")
        input_dict["agent_results"] = result.get("agents", [])
        input_dict["pipeline_mode"] = "agent"

        for ar in result.get("agents", []):
            input_dict[f"agent{ar['agent']}_status"] = ar["status"]

        return input_dict

    return RunnableLambda(run_agent_pipeline)
