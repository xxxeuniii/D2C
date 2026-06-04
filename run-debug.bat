@echo off
chcp 65001 >nul
title D2C - Agent 逐步调试

cd /d "e:\interview\D2C\apps\server"

echo.
echo ============================================================
echo   D2C Agent 逐步调试 - 查看每步输入输出
echo ============================================================
echo.

call venv\Scripts\activate.bat

python -c "import json, os, sys, time; os.chdir(r'e:\interview\D2C\apps\server'); sys.path.insert(0, '.'); print('Step 0: Figma 数据'); f=open(r'e:\interview\D2C\apps\server\chroma_data\figma_cache_dEDv2fBxzJ9Gbsbhv2XSZP.json','r',encoding='utf-8'); fr=f.read(); fd=json.loads(fr); print(f'  大小: {len(fr)} 字符, 文件: {fd.get(\"name\",\"N/A\")}'); print(); print('Agent 1: 数据清洗'); from agents.cleaner import clean_figma_data, enhance_cleaned_data_with_llm; t=time.time(); c=clean_figma_data(fr); c=enhance_cleaned_data_with_llm(c); print(f'  耗时: {time.time()-t:.2f}s, 节点: {len(c.get(\"tree\",{}).get(\"children\",[]))}'); print(); print('Agent 2: 结构化转换'); from agents.converter import convert_to_dsl, enhance_dsl_with_llm; t=time.time(); d=convert_to_dsl(c,'react','element-plus'); d=enhance_dsl_with_llm(d,'react','element-plus'); print(f'  耗时: {time.time()-t:.2f}s, 组件: {len(d.get(\"components\",[]))}'); print(); print('Agent 3: 知识检索'); from agents.retriever import search_component_docs; t=time.time(); ds=json.dumps(d,ensure_ascii=False); dw=search_component_docs.invoke({'dsl_json':ds,'component_lib':'element-plus'}); print(f'  耗时: {time.time()-t:.2f}s'); print(); print('Agent 4: 代码生成'); from agents.generator import generate_page_code; t=time.time(); code=generate_page_code.invoke({'dsl_with_docs':dw,'framework':'react'}); print(f'  耗时: {time.time()-t:.2f}s, 代码: {len(code)} 字符'); print(code[:2000]); print(); print('Agent 5: 测试验证'); from agents.validator import validate_and_fix; t=time.time(); v=validate_and_fix.invoke(code); print(f'  耗时: {time.time()-t:.2f}s'); print(v[:500])"

pause
