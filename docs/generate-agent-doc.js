const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, TableOfContents
} = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function makeCell(text, width, opts = {}) {
  const runs = [];
  if (opts.bold) {
    runs.push(new TextRun({ text, bold: true, font: "Arial", size: 20 }));
  } else {
    runs.push(new TextRun({ text, font: "Arial", size: 20 }));
  }
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: runs })],
  });
}

function headerCell(text, width) {
  return makeCell(text, width, { bold: true, shading: "2E75B6" });
}

function codeBlock(code) {
  const paragraphs = [];
  paragraphs.push(new Paragraph({
    spacing: { before: 80, after: 0 },
    children: [new TextRun({ text: code, font: "Courier New", size: 18 })],
  }));
  return paragraphs;
}

function bullet(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

function normalPara(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 20, ...(opts.bold ? { bold: true } : {}) })],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: "1A1C26" })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: "2E75B6" })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: "333333" })],
  });
}

// ---- Build Document ----

const children = [];

// ========================
// COVER PAGE
// ========================
children.push(new Paragraph({ spacing: { before: 3000 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "D2C Multi-Agent Pipeline", font: "Arial", size: 56, bold: true, color: "1A1C26" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "多 Agent 协同流水线技术文档", font: "Arial", size: 40, color: "2E75B6" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
  children: [new TextRun({ text: "Design to Code — 从 Figma 设计稿到可运行前端代码", font: "Arial", size: 24, color: "666666" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 600 },
  children: [new TextRun({ text: "版本 0.4.0 | 2026-06-04", font: "Arial", size: 22, color: "999999" })],
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// TABLE OF CONTENTS
// ========================
children.push(heading1("目录"));
children.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 1: OVERVIEW
// ========================
children.push(heading1("第一章 项目概述"));

children.push(heading2("1.1 项目定位"));
children.push(normalPara("D2C（Design to Code）是一个基于 LangChain 多 Agent 架构的自动化前端代码生成平台。平台将 Figma 设计稿到前端代码的转换过程拆解为 5 个独立的 Agent，每个 Agent 各司其职，通过流水线协同工作，实现端到端的自动化代码生成。"));
children.push(normalPara("核心流程：输入 Figma 设计链接 → 5 个 AI Agent 协同工作 → 输出可运行的前端代码"));
children.push(normalPara("支持的框架：React 18 / Vue 2 / Next.js"));
children.push(normalPara("支持的组件库：Element Plus / Ant Design / shadcn/ui"));

children.push(heading2("1.2 技术栈"));
const techStackData = [
  ["层级", "技术选型"],
  ["前端", "Next.js 14 + React 18 + TypeScript + Tailwind CSS"],
  ["后端", "FastAPI (Python)"],
  ["AI 框架", "LangChain (Agent / Tool / Memory / Chain)"],
  ["通用 LLM", "Qwen2.5-7B (SiliconFlow)"],
  ["代码生成 LLM", "DeepSeek-V3 (8192 tokens, SiliconFlow)"],
  ["Embedding 模型", "BGE-M3 (SiliconFlow)"],
  ["向量数据库", "ChromaDB (本地持久化)"],
  ["代码分析", "AST 静态分析 + LLM 深度审查"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 6360],
    rows: techStackData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0 ? headerCell(cell, j === 0 ? 3000 : 6360) : makeCell(cell, j === 0 ? 3000 : 6360)
        ),
      })
    ),
  })
);

children.push(heading2("1.3 架构总览"));
children.push(normalPara("平台采用前后端分离架构，包含三个独立服务："));
children.push(bullet("前端服务（Next.js）：端口 3000，提供用户交互界面、Agent 流水线可视化、Figma 导入、知识库管理等功能", "bullets"));
children.push(bullet("后端服务（FastAPI）：端口 8080，核心 5 Agent 流水线、ChromaDB 向量检索、LLM 调用、Figma API 代理", "bullets"));
children.push(bullet("RAG Worker 服务（FastAPI）：端口 8081，预留文档向量化服务接口", "bullets"));

children.push(normalPara("数据流采用 BFF（Backend For Frontend）模式：前端通过 Next.js API Route 转发请求到 FastAPI 后端，保证安全性并支持中间层数据处理。"));

children.push(heading2("1.4 5 Agent 流水线"));
children.push(normalPara("流水线采用 LangChain 的 Chain 管道模式，使用 | 运算符串联 5 个 RunnableLambda。每个 Agent 接收上游输出，处理后写入新的字段，通过共享 dict 传递数据。流水线严格顺序执行，后一个 Agent 依赖前一个输出。"));
children.push(normalPara("流水线数据流：", { bold: true }));
children.push(normalPara("{figma_raw, framework, componentLib}"));
children.push(normalPara("  → Agent 1 写入 cleaned_data"));
children.push(normalPara("  → Agent 2 写入 dsl"));
children.push(normalPara("  → Agent 3 写入 dsl_with_docs"));
children.push(normalPara("  → Agent 4 写入 generated_code"));
children.push(normalPara("  → Agent 5 写入 validation_result"));

const agentOverviewData = [
  ["编号", "名称", "实现方式", "使用 LLM", "确定性", "状态"],
  ["Agent 1", "数据清洗", "Python 代码直接操作 JSON", "否", "100%", "生产级"],
  ["Agent 2", "结构化转换", "Python 规则引擎", "否", "100%", "生产级"],
  ["Agent 3", "知识检索", "Python + ChromaDB", "否", "100%", "生产级"],
  ["Agent 4", "代码生成", "DeepSeek-V3 LLM", "是", "非确定", "可运行"],
  ["Agent 5", "测试验证", "AST 静态分析 + LLM 深度审查", "部分", "部分", "生产级"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 1500, 2800, 1060, 1060, 1140],
    rows: agentOverviewData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [800, 1500, 2800, 1060, 1060, 1140][j])
            : makeCell(cell, [800, 1500, 2800, 1060, 1060, 1140][j])
        ),
      })
    ),
  })
);

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 2: AGENT 1
// ========================
children.push(heading1("第二章 Agent 1：数据清洗"));

children.push(heading2("2.1 核心职责"));
children.push(normalPara("Agent 1 负责清洗 Figma REST API 返回的原始 JSON 数据，去掉前端渲染不需要的冗余字段，将 Figma 内部格式（0-1 RGBA、Effect、Auto Layout 等）转换为前端可直接使用的 CSS 属性（hex/rgba、box-shadow、Flexbox 等）。"));

children.push(heading2("2.2 核心设计理念：确定性优于概率"));
children.push(normalPara("Agent 1 是整个流水线中最重要的设计决策之一——不使用 LLM，完全用 Python 代码处理数据清洗。这是因为：", { bold: true }));
children.push(bullet("确定性要求：数据清洗是确定性的映射任务（字段筛选、格式转换），不存在需要「理解」或「推理」的环节。LLM 每次可能产生不同结果，代码 100% 确定。", "bullets"));
children.push(bullet("性能要求：Figma 文件可能包含数千个节点。Python 代码毫秒级处理，LLM 需要秒级网络调用。", "bullets"));
children.push(bullet("成本考量：LLM 消耗 Token，大文件可能超出 Token 限制。Python 代码免费且无限制。", "bullets"));
children.push(bullet("可维护性：Prompt 调优依赖经验，代码逻辑清晰、可测试、可复用。", "bullets"));

children.push(normalPara("核心原则：能用代码解决的问题，不要用 AI。这是 Agent 开发中最重要的工程原则之一。", { bold: true }));

children.push(heading2("2.3 技术实现"));

children.push(heading3("2.3.1 入口函数"));
children.push(normalPara("clean_figma_data_python(raw_data: str) -> dict", { bold: true }));
children.push(normalPara("接收原始 Figma JSON 字符串，解析后调用 _clean_node() 递归清洗整个文档树，最后附加元信息（fileName、lastModified、cleanedAt）返回。"));
children.push(normalPara("文件位置：apps/server/main.py 第 331-352 行"));

children.push(heading3("2.3.2 核心递归函数"));
children.push(normalPara("_clean_node(node: dict) -> Optional[dict]", { bold: true }));
children.push(normalPara("递归清洗单个 Figma 节点，返回清洗后的 dict 或 None（节点不可见时）。处理流程如下："));

children.push(bullet("可见性检查：如果 visible 为 false，直接返回 None，跳过整个子树", "bullets"));
children.push(bullet("基础信息提取：name、type", "bullets"));
children.push(bullet("尺寸提取：从 absoluteBoundingBox 提取 width/height（去掉 x/y 坐标）", "bullets"));
children.push(bullet("透明度提取：仅当 opacity != 1 时保留", "bullets"));
children.push(bullet("填充色转换：_extract_color() 将 Figma RGBA(0-1) 转为 CSS hex 或 rgba", "bullets"));
children.push(bullet("描边转换：_extract_stroke_color() 提取第一个 SOLID 描边颜色", "bullets"));
children.push(bullet("圆角提取：cornerRadius → borderRadius", "bullets"));
children.push(bullet("阴影转换：_extract_shadow() 只保留 DROP_SHADOW，转为 CSS box-shadow", "bullets"));
children.push(bullet("自动布局映射：layoutMode → display:flex + flexDirection + gap + padding + justifyContent + alignItems", "bullets"));
children.push(bullet("文本节点处理：提取 text、fontSize、fontFamily、fontWeight、color", "bullets"));
children.push(bullet("组件标记：COMPONENT/INSTANCE/COMPONENT_SET 标记 isComponent", "bullets"));
children.push(bullet("递归子节点：对每个 child 递归调用 _clean_node()", "bullets"));

children.push(heading3("2.3.3 辅助函数"));
const helperFuncData = [
  ["函数名", "职责", "输入", "输出"],
  ["_extract_color()", "Figma RGBA → CSS 颜色", "fill dict {r,g,b,a}", "CSS hex 或 rgba 字符串"],
  ["_extract_shadow()", "Figma Effect → CSS box-shadow", "effect dict", "CSS box-shadow 字符串"],
  ["_extract_stroke_color()", "Figma Stroke → CSS 颜色", "stroke dict", "CSS hex 字符串"],
  ["_extract_font_weight()", "字体粗细推断", "style dict", "CSS font-weight 数值"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 2500, 2200, 2460],
    rows: helperFuncData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [2200, 2500, 2200, 2460][j])
            : makeCell(cell, [2200, 2500, 2200, 2460][j])
        ),
      })
    ),
  })
);

children.push(heading3("2.3.4 需要移除的字段"));
children.push(normalPara("顶层移除字段（TOP_LEVEL_REMOVE，共 17 个）：", { bold: true }));
children.push(normalPara("id, lastModified, version, description, editorType, styleType, remote, scrollBehavior, componentPropertyDefinitions, constraints, layoutGrids, exportSettings, transitionNodeID, transitionDuration, transitionEasing, isAsset, backgroundColor, prototypeStartNodeID, flowStartingPoints, prototypeDevice"));
children.push(normalPara("这些字段是 Figma 文件的元信息或内部编辑器属性，前端渲染完全不需要。"));

children.push(normalPara("节点级移除字段（NODE_REMOVE，约 50 个）：", { bold: true }));
children.push(normalPara("包括 pluginData、sharedPluginData（插件数据）、layoutSizingHorizontal/Vertical（Figma 的 HUG/FIXED 模式）、clipsContent（Figma 裁剪）、rectangleCornerRadii 等独立圆角属性、textAutoResize/lineHeightPx 等文本引擎属性、blendMode、strokeAlign 等。这些字段对前端渲染无用，或前端有对应的 CSS 方案替代。"));

children.push(heading3("2.3.5 自动布局到 Flexbox 映射"));
const layoutMapData = [
  ["Figma 属性", "CSS 属性", "映射规则"],
  ["layoutMode = HORIZONTAL", "display: flex; flex-direction: row", "水平布局 → flex row"],
  ["layoutMode = VERTICAL", "display: flex; flex-direction: column", "垂直布局 → flex column"],
  ["itemSpacing", "gap", "子元素间距 → CSS gap"],
  ["paddingTop/Right/Bottom/Left", "padding", "四向内边距 → padding 简写"],
  ["primaryAxisAlignItems", "justifyContent", "MIN→flex-start, CENTER→center, MAX→flex-end, SPACE_BETWEEN→space-between"],
  ["counterAxisAlignItems", "alignItems", "MIN→flex-start, CENTER→center, MAX→flex-end"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 3200, 3360],
    rows: layoutMapData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [2800, 3200, 3360][j])
            : makeCell(cell, [2800, 3200, 3360][j])
        ),
      })
    ),
  })
);

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 3: AGENT 2
// ========================
children.push(heading1("第三章 Agent 2：结构化转换"));

children.push(heading2("3.1 核心职责"));
children.push(normalPara("Agent 2 将清洗后的 Figma 节点树转换为组件 DSL（Domain Specific Language，领域描述语言），让后续的 LLM 代码生成环节更容易理解设计意图。DSL 将 Figma 原始节点类型（FRAME、RECTANGLE 等）映射为语义化的组件类型（container、button、input 等）。"));

children.push(heading2("3.2 核心设计理念：语义化中间层"));
children.push(normalPara("Agent 2 同样不使用 LLM，完全采用 Python 规则引擎。核心理念是：", { bold: true }));
children.push(bullet("降低 LLM 理解成本：Figma 原始节点（FRAME、RECTANGLE）语义模糊，DSL 将其映射为明确的组件类型（button、input、card），LLM 更容易理解设计意图", "bullets"));
children.push(bullet("解耦设计源与代码输出：DSL 作为中间层，隔离了 Figma 数据格式的变化，后续 Agent 只需理解 DSL", "bullets"));
children.push(bullet("命名规范的重要性：设计师的图层命名直接影响组件推断准确率。建议使用 button、input、card 等语义化命名", "bullets"));
children.push(bullet("确定性转换：规则引擎 100% 确定，同输入必然同输出", "bullets"));

children.push(heading2("3.3 技术实现"));

children.push(heading3("3.3.1 入口函数"));
children.push(normalPara("convert_to_dsl_python(cleaned_data: dict, framework: str, component_lib: str) -> dict", { bold: true }));
children.push(normalPara("接收清洗后的数据、目标框架和组件库名称，遍历顶层子节点调用 _node_to_dsl_component()，返回包含 pageName、framework、componentLib、components 的完整 DSL。"));

children.push(heading3("3.3.2 组件类型推断"));
children.push(normalPara("_infer_component_type(node: dict) -> str", { bold: true }));
children.push(normalPara("类型推断分三级优先级："));
children.push(bullet("TEXT 类型优先：如果 Figma 类型是 TEXT，直接返回 'text'", "bullets"));
children.push(bullet("命名关键词匹配：检查图层名（忽略空格、连字符、下划线）中是否包含已知关键词。支持 20+ 种组件类型：button/btn、input/textfield、checkbox、radio、select/dropdown、table、modal/dialog、tab/tabs、card、menu、navbar、sidebar、form、image/icon、avatar、badge/tag、pagination、slider、switch/toggle、breadcrumb、header、footer、list、divider、tooltip、popover、progress、loading/spinner", "bullets"));
children.push(bullet("默认类型映射：TYPE_MAP 将 Figma 类型映射到 DSL 类型（FRAME→container、RECTANGLE→box、COMPONENT→component 等）", "bullets"));

children.push(heading3("3.3.3 DSL 输出结构"));
children.push(normalPara("每个 DSL 组件包含以下字段："));
children.push(bullet("name：组件名称（来自 Figma 图层名）", "bullets"));
children.push(bullet("type：推断的组件类型（container/button/input/text 等）", "bullets"));
children.push(bullet("styles：CSS 样式集合（width、height、backgroundColor、borderRadius、flexDirection、gap、padding、fontSize 等）", "bullets"));
children.push(bullet("props：组件属性（text、componentName 等）", "bullets"));
children.push(bullet("layout：布局信息（mode、hasAutoLayout）", "bullets"));
children.push(bullet("children：递归子组件", "bullets"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 4: AGENT 3
// ========================
children.push(heading1("第四章 Agent 3：知识检索"));

children.push(heading2("4.1 核心职责"));
children.push(normalPara("Agent 3 从 ChromaDB 知识库中检索组件库文档，附加到 DSL 中，为 Agent 4 的代码生成提供参考。这是典型的 RAG（Retrieval-Augmented Generation，检索增强生成）模式。"));

children.push(heading2("4.2 核心设计理念：RAG 检索增强"));
children.push(normalPara("Agent 3 体现了 RAG 模式在 Agent 开发中的关键价值：", { bold: true }));
children.push(bullet("突破 LLM 知识边界：LLM 的训练数据可能不包含最新版本的组件库文档，RAG 可以检索任意上传的文档", "bullets"));
children.push(bullet("降低幻觉风险：有文档作为参考，LLM 生成代码时会使用正确的 API 签名和属性名", "bullets"));
children.push(bullet("知识可管理：用户可以通过上传文档来更新知识库，无需重新训练模型", "bullets"));
children.push(bullet("确定性检索：ChromaDB 的向量检索结果在相同索引和查询下是确定的", "bullets"));

children.push(heading2("4.3 技术实现"));

children.push(heading3("4.3.1 检索流程"));
children.push(normalPara("search_component_docs(dsl_json: str, component_lib: str) -> str", { bold: true }));
children.push(bullet("解析 DSL JSON，递归遍历所有 components，收集所有非基础组件类型（排除 container、box、text）", "bullets"));
children.push(bullet("对每个组件类型，构造检索查询：'{组件库名} {组件类型} 组件 API 用法 示例'", "bullets"));
children.push(bullet("调用 collection.query() 在 ChromaDB 中检索，取 top-2 结果", "bullets"));
children.push(bullet("将检索到的文档片段（前 800 字符）附加到 DSL 的 componentDocs 字段", "bullets"));
children.push(bullet("返回完整的 DSL JSON（包含 componentDocs）", "bullets"));

children.push(heading3("4.3.2 技术栈"));
children.push(bullet("向量数据库：ChromaDB（本地持久化存储）", "bullets"));
children.push(bullet("Embedding 模型：BGE-M3（通过 SiliconFlow API）", "bullets"));
children.push(bullet("Collection 名称：design_specs", "bullets"));
children.push(bullet("检索数量：top-2（每个组件类型）", "bullets"));

children.push(heading2("4.4 文档管理 API"));
children.push(normalPara("Agent 3 的知识库通过以下 API 进行管理："));
const ragApiData = [
  ["方法", "路径", "说明"],
  ["GET", "/api/rag/documents", "获取所有已上传文档列表"],
  ["POST", "/api/rag/upload", "上传文档（支持文本、Markdown）"],
  ["POST", "/api/rag/search", "搜索知识库（手动查询）"],
  ["DELETE", "/api/rag/documents/{id}", "删除指定文档"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1200, 3000, 5160],
    rows: ragApiData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [1200, 3000, 5160][j])
            : makeCell(cell, [1200, 3000, 5160][j])
        ),
      })
    ),
  })
);

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 5: AGENT 4
// ========================
children.push(heading1("第五章 Agent 4：代码生成"));

children.push(heading2("5.1 核心职责"));
children.push(normalPara("Agent 4 是整个流水线的核心——根据 DSL + 组件文档生成完整的前端页面代码。这是唯一必须使用 LLM 的环节，因为代码生成需要创造性推理和对 DSL 的语义理解。"));

children.push(heading2("5.2 核心设计理念：专用模型策略"));
children.push(normalPara("Agent 4 采用双模型策略，体现了 Agent 开发中「因任务选模型」的重要原则：", { bold: true }));
children.push(bullet("通用任务使用 Qwen2.5-7B：成本低、响应快，用于简单问答和文档摘要", "bullets"));
children.push(bullet("代码生成使用 DeepSeek-V3：更强的代码生成能力，8192 tokens 输出窗口支持长代码，温度 0.3 保证质量稳定", "bullets"));
children.push(bullet("成本优化：不是所有 Agent 都需要最强的模型，按任务需求分配模型可以大幅降低 API 成本", "bullets"));

children.push(heading2("5.3 技术实现"));

children.push(heading3("5.3.1 生成函数"));
children.push(normalPara("generate_page_code(dsl_with_docs: str, framework: str) -> str", { bold: true }));
children.push(normalPara("构造精心设计的 Prompt，包含以下要素："));

children.push(bullet("角色设定：'你是一个资深前端开发'——设定专业角色提升代码质量", "bullets"));
children.push(bullet("输入数据：DSL + 组件文档（截断至 6000 字符避免超 Token 限制）", "bullets"));
children.push(bullet("框架指定：Vue 2 + Options API + Element Plus 或 React 18 + TypeScript + Hooks", "bullets"));
children.push(bullet("设计系统：暗色主题（背景 #0D1117、文字 #E6EDF3、边框 rgba(255,255,255,0.1)）", "bullets"));
children.push(bullet("约束条件：严格按 DSL 组件结构排列、遵循组件库 API、使用 Tailwind CSS、完整可运行", "bullets"));
children.push(bullet("输出格式：'只输出代码，不要任何解释'——防止 LLM 添加冗余文字", "bullets"));

children.push(heading3("5.3.2 LLM 配置"));
const llmConfigData = [
  ["参数", "值", "说明"],
  ["model", "deepseek-ai/DeepSeek-V3", "专用代码生成模型"],
  ["temperature", "0.3", "较低温度保证代码稳定性和一致性"],
  ["max_tokens", "8192", "大输出窗口支持长代码文件"],
  ["base_url", "https://api.siliconflow.cn/v1", "SiliconFlow API"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 2800, 4360],
    rows: llmConfigData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [2200, 2800, 4360][j])
            : makeCell(cell, [2200, 2800, 4360][j])
        ),
      })
    ),
  })
);

children.push(heading2("5.4 Prompt 工程要点"));
children.push(normalPara("Agent 4 的 Prompt 设计是代码质量的关键。以下是重要原则：", { bold: true }));
children.push(bullet("明确的角色设定：让 LLM 进入专业开发者的思维模式", "bullets"));
children.push(bullet("结构化约束：分层次列出要求（框架 → 设计系统 → 组件结构 → API 规范 → 样式方案 → 输出格式）", "bullets"));
children.push(bullet("输出格式控制：明确要求「只输出代码」，防止 Markdown 标记和解释文字混入代码", "bullets"));
children.push(bullet("设计系统内置：在 Prompt 中内置暗色主题的色板值，而不是让 LLM 自行选择颜色", "bullets"));
children.push(bullet("Token 预算管理：输入 DSL 截断至 6000 字符，避免超出上下文窗口", "bullets"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 6: AGENT 5
// ========================
children.push(heading1("第六章 Agent 5：测试验证"));

children.push(heading2("6.1 核心职责"));
children.push(normalPara("Agent 5 负责验证 Agent 4 生成的代码质量，并自动修复发现的问题。采用双重验证机制：先用 Python AST 静态分析做确定性检查，再用 LLM 做深度语义审查。"));

children.push(heading2("6.2 核心设计理念：双重验证"));
children.push(normalPara("Agent 5 体现了 Agent 开发中「混合验证」的设计模式：", { bold: true }));
children.push(bullet("第一层——确定性检查（AST 静态分析）：括号匹配、标签闭合、导入检查、安全扫描、列表 key 检查。这些是确定性的语法规则，Python 代码处理更可靠。", "bullets"));
children.push(bullet("第二层——语义审查（LLM）：组件库 API 正确性、TypeScript 类型完整性、可访问性、响应式设计、性能问题。这些需要语义理解，LLM 更适合。", "bullets"));
children.push(bullet("互补优势：AST 保证基本语法正确，LLM 保证代码质量和可维护性", "bullets"));
children.push(bullet("成本控制：AST 分析免费且毫秒级，只在需要时调用 LLM", "bullets"));

children.push(heading2("6.3 技术实现"));

children.push(heading3("6.3.1 AST 静态分析"));
children.push(normalPara("_ast_syntax_check(code: str) -> List[str]", { bold: true }));
children.push(normalPara("纯 Python 实现的 5 项静态检查："));

const astCheckData = [
  ["检查项", "检测方法", "严重级别"],
  ["括号匹配", "栈遍历检测 { }、( )、[ ] 配对", "ERROR"],
  ["标签闭合", "正则匹配 HTML/JSX 标签，栈验证闭合", "ERROR/WARNING"],
  ["导入检查", "检测 Vue/React 组件缺少 import/export", "WARNING"],
  ["安全扫描", "检测 dangerouslySetInnerHTML、v-html、eval()", "ERROR/WARNING"],
  ["列表 key", "检测 .map() 渲染缺少 key 属性", "WARNING"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 4760, 2800],
    rows: astCheckData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [1800, 4760, 2800][j])
            : makeCell(cell, [1800, 4760, 2800][j])
        ),
      })
    ),
  })
);

children.push(heading3("6.3.2 LLM 深度审查"));
children.push(normalPara("validate_and_fix(code: str) -> str", { bold: true }));
children.push(normalPara("在 AST 分析之后，调用 DeepSeek-V3 进行深度审查。LLM 检查清单包括："));
children.push(bullet("组件库 API 用法是否正确（如 el-button 的属性名是否拼写正确）", "bullets"));
children.push(bullet("TypeScript 类型是否完整（Props 接口、事件类型等）", "bullets"));
children.push(bullet("可访问性检查（alt 属性、aria-label、role 属性）", "bullets"));
children.push(bullet("响应式设计检查（是否使用相对单位、媒体查询）", "bullets"));
children.push(bullet("性能问题检查（多余的 re-render、大列表是否需要虚拟滚动）", "bullets"));
children.push(normalPara("LLM 审查使用 code_llm（DeepSeek-V3），温度 0.3，max_tokens 8192。如果代码无问题且 AST 已通过，输出 'PASSED'；否则输出问题列表和修复后的完整代码。"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 7: RAG WORKER
// ========================
children.push(heading1("第七章 RAG Worker 服务"));

children.push(heading2("7.1 服务概述"));
children.push(normalPara("RAG Worker 是一个独立的 FastAPI 微服务（端口 8081），专门负责文档向量化和 Embedding 相关任务。将 RAG 处理与主后端解耦，便于独立扩展和维护。"));

children.push(heading2("7.2 技术实现"));
children.push(normalPara("当前实现为精简版，核心代码仅 33 行，提供两个端点："));
children.push(bullet("GET /health：服务健康检查", "bullets"));
children.push(bullet("POST /api/rag/embed：文档向量化接口（预留，可接入 OpenAI Embedding 或本地模型）", "bullets"));
children.push(normalPara("文件位置：apps/agent/agent.py"));

children.push(heading2("7.3 设计理念"));
children.push(bullet("微服务解耦：将 Embedding 计算独立为单独服务，避免阻塞主流水线", "bullets"));
children.push(bullet("可替换性：Embedding 接口预留，可根据需求切换不同的 Embedding 模型", "bullets"));
children.push(bullet("独立扩展：RAG Worker 可独立部署到 GPU 服务器进行大规模向量化", "bullets"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 8: PIPELINE
// ========================
children.push(heading1("第八章 流水线串联机制"));

children.push(heading2("8.1 技术架构"));
children.push(normalPara("流水线使用 LangChain 的 Chain 管道模式实现。每个 Agent 被包装为 RunnableLambda，通过 | 运算符串联。"));
children.push(normalPara("核心函数：create_multi_agent_pipeline()（第 695-760 行）"));
children.push(normalPara("每个 Agent 的内部函数："));

const pipelineFuncData = [
  ["函数名", "对应 Agent", "核心操作", "输出字段"],
  ["agent1_clean", "Agent 1", "调用 clean_figma_data_python()", "cleaned_data, agent1_status"],
  ["agent2_convert", "Agent 2", "调用 convert_to_dsl_python()", "dsl, agent2_status"],
  ["agent3_retrieve", "Agent 3", "调用 search_component_docs.invoke()", "dsl_with_docs, agent3_status"],
  ["agent4_generate", "Agent 4", "调用 generate_page_code.invoke()", "generated_code, agent4_status"],
  ["agent5_validate", "Agent 5", "调用 validate_and_fix.invoke()", "validation_result, agent5_status"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 1200, 3060, 3100],
    rows: pipelineFuncData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [2000, 1200, 3060, 3100][j])
            : makeCell(cell, [2000, 1200, 3060, 3100][j])
        ),
      })
    ),
  })
);

children.push(heading2("8.2 执行模式"));
children.push(normalPara("严格顺序执行：后一个 Agent 依赖前一个输出，因此必须按顺序执行。如果中间 Agent 失败，后续仍会继续执行（当前版本无错误传播中断机制，生产中应添加）。"));

children.push(heading2("8.3 主 API 端点"));
children.push(normalPara("POST /api/pipeline/run：运行完整 5 Agent 流水线", { bold: true }));
children.push(normalPara("请求参数："));
children.push(bullet("url (string)：Figma 文件链接", "bullets"));
children.push(bullet("framework (string)：目标框架，可选 react/vue2", "bullets"));
children.push(bullet("componentLib (string)：组件库，可选 element-plus/ant-design/shadcn-ui", "bullets"));
children.push(bullet("figmaToken (string, 可选)：Figma Personal Access Token", "bullets"));
children.push(normalPara("响应包含：runId、status、steps（每步状态）、result（code + validation）"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 9: AGENT DEVELOPMENT GUIDE
// ========================
children.push(heading1("第九章 Agent 开发注意事项"));

children.push(heading2("9.1 什么时候用 LLM，什么时候不用"));
children.push(normalPara("这是 Agent 开发中最核心的决策。判断标准如下：", { bold: true }));

const llmDecisionData = [
  ["场景", "推荐方式", "原因"],
  ["数据清洗/格式转换", "Python 代码", "确定性任务，不需要 AI"],
  ["规则匹配/字段映射", "Python 代码", "规则引擎 100% 确定"],
  ["向量检索/数据库查询", "Python 代码", "数据库操作天然确定"],
  ["代码生成/内容创作", "LLM", "需要创造性推理"],
  ["代码审查/语义分析", "AST + LLM 混合", "语法用代码，语义用 LLM"],
  ["文本总结/翻译", "LLM", "需要语言理解"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 2200, 4560],
    rows: llmDecisionData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [2600, 2200, 4560][j])
            : makeCell(cell, [2600, 2200, 4560][j])
        ),
      })
    ),
  })
);

children.push(heading2("9.2 模型选择策略"));
children.push(bullet("按任务难度分配模型：简单任务用 7B 模型，代码生成用专业模型，避免一刀切", "bullets"));
children.push(bullet("温度参数控制：代码生成用低温度（0.1-0.3），创意任务用高温度（0.7-1.0）", "bullets"));
children.push(bullet("Token 预算管理：输入截断、输出限制、分块处理大文件", "bullets"));
children.push(bullet("Fallback 机制：主模型不可用时自动切换到备用模型", "bullets"));

children.push(heading2("9.3 Prompt 工程"));
children.push(bullet("角色设定：明确告知 LLM 它的身份（资深前端/代码审查专家），激活对应领域知识", "bullets"));
children.push(bullet("结构化输出：要求 JSON、代码块、特定格式，方便后续解析", "bullets"));
children.push(bullet("约束明确：列出必须遵守的规则和禁止的行为", "bullets"));
children.push(bullet("示例驱动：提供输入-输出示例，Few-Shot 提示显著提升质量", "bullets"));
children.push(bullet("输出格式控制：'只输出代码，不要任何解释' 这类指令非常重要", "bullets"));

children.push(heading2("9.4 错误处理与鲁棒性"));
children.push(bullet("每个 Agent 必须独立处理异常，单个 Agent 失败不应导致整个流水线崩溃", "bullets"));
children.push(bullet("LLM 调用必须设置超时和重试机制（本项目使用 httpx 30s 超时）", "bullets"));
children.push(bullet("LLM 输出必须做格式校验，不能假设输出总是合法的 JSON/代码", "bullets"));
children.push(bullet("关键路径使用确定性代码做 fallback，LLM 不可用时降级处理", "bullets"));

children.push(heading2("9.5 性能优化"));
children.push(bullet("避免不必要的 LLM 调用：能用代码解决的问题坚决不用 LLM", "bullets"));
children.push(bullet("缓存策略：相同输入缓存 LLM 结果，减少重复调用", "bullets"));
children.push(bullet("并行化：不依赖彼此结果的 Agent 可以并行执行", "bullets"));
children.push(bullet("输入精简：传给 LLM 的数据只保留必要信息，去除冗余字段", "bullets"));

children.push(heading2("9.6 可观测性"));
children.push(bullet("日志记录：每个 Agent 的执行时间、输入输出大小、LLM Token 消耗", "bullets"));
children.push(bullet("状态追踪：流水线运行时实时更新步骤状态（running/completed/error）", "bullets"));
children.push(bullet("指标监控：Agent 成功率、平均耗时、Token 消耗趋势", "bullets"));
children.push(bullet("调试友好：保留中间结果（cleaned_data、dsl、dsl_with_docs），方便问题排查", "bullets"));

children.push(heading2("9.7 安全注意事项"));
children.push(bullet("Prompt Injection 防护：用户输入的数据要做清洗，防止注入恶意指令", "bullets"));
children.push(bullet("输出安全扫描：生成的代码必须检查 XSS 风险（dangerouslySetInnerHTML、v-html、eval）", "bullets"));
children.push(bullet("API Key 管理：使用环境变量存储，不硬编码在代码中", "bullets"));
children.push(bullet("速率限制：对 LLM API 调用添加速率控制，防止费用失控", "bullets"));

children.push(heading2("9.8 测试策略"));
children.push(bullet("确定性 Agent（1/2/3）：使用单元测试验证输入-输出映射正确性", "bullets"));
children.push(bullet("LLM Agent（4/5）：使用 Golden Test（标准输入-预期输出对）和人工评审", "bullets"));
children.push(bullet("流水线集成测试：端到端测试完整 Figma URL → 代码输出流程", "bullets"));
children.push(bullet("回归测试：每次 Prompt 修改后重新运行测试套件", "bullets"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========================
// CHAPTER 10: APPENDIX
// ========================
children.push(heading1("第十章 附录"));

children.push(heading2("10.1 项目结构"));
const projectTree = [
  "D2C/",
  "├── apps/",
  "│   ├── web/                         # 前端 (Next.js 14)",
  "│   │   ├── app/(dashboard)/",
  "│   │   │   ├── agent/page.tsx       # Agent 流水线页面",
  "│   │   │   ├── knowledge/page.tsx   # 知识库管理页面",
  "│   │   │   └── api/rag/route.ts     # RAG BFF 代理",
  "│   │   ├── components/",
  "│   │   │   ├── agent/AgentSteps.tsx # Agent 步骤可视化",
  "│   │   │   └── layout/Sidebar.tsx   # 侧边栏导航",
  "│   │   ├── lib/",
  "│   │   │   ├── api/agent.ts         # Agent API 客户端",
  "│   │   │   ├── api/rag.ts           # RAG API 客户端",
  "│   │   │   ├── store/figmaStore.ts  # Figma 状态管理",
  "│   │   │   └── store/ragStore.ts    # RAG 状态管理",
  "│   │   └── types/index.ts           # 全局类型定义",
  "│   ├── server/                      # 后端 (FastAPI)",
  "│   │   ├── main.py                  # ★ 核心：5 Agent 流水线实现",
  "│   │   ├── requirements.txt",
  "│   │   └── .env                     # API Keys",
  "│   └── agent/                       # RAG Worker",
  "│       └── agent.py                 # 文档向量化服务",
  "├── scripts/                         # 启动脚本",
  "│   ├── start-frontend.bat",
  "│   ├── start-backend.bat",
  "│   └── start-agent.bat",
  "├── docs/                            # 文档",
  "├── start-all.bat                    # 一键启动",
  "└── README.md",
];
for (const line of projectTree) {
  const isFile = line.includes(".") && !line.endsWith("/");
  children.push(new Paragraph({
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text: line, font: "Courier New", size: 18, color: isFile ? "2E75B6" : "333333" })],
  }));
}

children.push(heading2("10.2 API 接口汇总"));
const apiSummaryData = [
  ["方法", "路径", "说明", "所属服务"],
  ["GET", "/health", "服务健康检查", "后端 (8080)"],
  ["POST", "/api/pipeline/run", "运行完整 5 Agent 流水线", "后端 (8080)"],
  ["GET", "/api/pipeline/run/{id}", "查询流水线状态", "后端 (8080)"],
  ["GET", "/api/rag/documents", "获取知识库文档列表", "后端 (8080)"],
  ["POST", "/api/rag/upload", "上传文档到知识库", "后端 (8080)"],
  ["POST", "/api/rag/search", "搜索知识库", "后端 (8080)"],
  ["DELETE", "/api/rag/documents/{id}", "删除文档", "后端 (8080)"],
  ["POST", "/api/figma/analyze", "Figma 文件直接解析", "后端 (8080)"],
  ["GET", "/health", "服务健康检查", "RAG Worker (8081)"],
  ["POST", "/api/rag/embed", "文档向量化", "RAG Worker (8081)"],
];
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1000, 3000, 3000, 2360],
    rows: apiSummaryData.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          i === 0
            ? headerCell(cell, [1000, 3000, 3000, 2360][j])
            : makeCell(cell, [1000, 3000, 3000, 2360][j])
        ),
      })
    ),
  })
);

children.push(heading2("10.3 环境配置"));
children.push(normalPara("apps/server/.env 配置项：", { bold: true }));
children.push(bullet("SILICONFLOW_API_KEY：SiliconFlow API 密钥（必填）", "bullets"));
children.push(bullet("SILICONFLOW_BASE_URL：API 地址，默认 https://api.siliconflow.cn/v1", "bullets"));
children.push(bullet("LLM_MODEL：通用 LLM 模型，默认 Qwen/Qwen2.5-7B-Instruct", "bullets"));
children.push(bullet("CODE_LLM_MODEL：代码生成模型，默认 deepseek-ai/DeepSeek-V3", "bullets"));
children.push(bullet("EMBEDDING_MODEL：Embedding 模型，默认 BAAI/bge-m3", "bullets"));

children.push(heading2("10.4 快速启动"));
children.push(normalPara("1. 注册 SiliconFlow 账号获取 API Key", "bullets"));
children.push(normalPara("2. 编辑 apps/server/.env，填入 API Key", "bullets"));
children.push(normalPara("3. 双击 start-all.bat 启动全部服务", "bullets"));
children.push(normalPara("4. 浏览器打开 http://localhost:3000", "bullets"));

// ========================
// BUILD
// ========================

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 },
        paragraph: { spacing: { line: 360 } },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1A1C26" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0, format: LevelFormat.BULLET, text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 4 } },
              children: [
                new TextRun({ text: "D2C Multi-Agent Pipeline — 技术文档", font: "Arial", size: 18, color: "999999", italics: true }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "— ", font: "Arial", size: 18, color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "999999" }),
                new TextRun({ text: " —", font: "Arial", size: 18, color: "999999" }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "e:/Demo/D2C/docs/D2C-Agent-Technical-Documentation.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Document generated: " + outPath);
});
