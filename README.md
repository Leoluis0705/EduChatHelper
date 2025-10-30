
# EduChat-R1 智能英语作文批改（本地模型版本）


1) **语法评价**：天学网 PDF → OCR/抽取 → `grammar_table`（Excel）  
2) **内容评价**：学生答题卡 PDF → OCR → 按细则生成**内容评分表**（本项目）  
3) **结构评价**：老师评语 PDF → OCR → 按细则生成**结构评分表**（本项目）  
4) 汇总三表 → 生成**本次作文评价**（总分/等级/亮点/易错点/画像）及（可选）**前几次作文评价**  
5) 报告导出：`outputs/tables.xlsx` + `outputs/report.md`。

本仓库对 **第二/第三模块 + 汇总** 做了完整实现，并支持：
- 本地 **8B** 模型（四分片 `safetensors`）或 **HTTP API** 模式；也可用 **mock** 自检；
- **BnB INT8 / 4bit (NF4)** 或 **半精度** 加载；
- 评分细则 **rubrics.yaml**（体裁→子体裁：邮件/通知/申请/投诉/新闻快讯/深度报道/图表作文/道歉信/祝贺信/简历/备忘录/会议纪要/通知英文版/新闻述评…）；
- 报告新增 **「格式检查」** 板块；人文关怀输出：先表扬后建议；不启用硬性否决。

## 1. 依赖安装
```bash
pip install -r requirements.txt
```

## 2. 准备输入
第一部分程序已生成：`/mnt/data/output_processed.xlsx`（或自行指定）。
- 需包含工作表：`grammar_table`、`student_ocr`、`teacher_ocr`（大小写不敏感，模糊匹配）。

## 3. 权重放置
```
/your_model_dir/
  model-00001-of-00004.safetensors
  model-00002-of-00004.safetensors
  model-00003-of-00004.safetensors
  model-00004-of-00004.safetensors
  model.safetensors.index.json
  config.json, generation_config.json, tokenizer.json, tokenizer_config.json, merges.txt/vocab.json, special_tokens_map.json, chat_template.jinja, ...
```

## 4. 运行（本地模型）
```bash
export MODEL_MODE=python
export MODEL_DIR=/your_model_dir
export USE_QUANT=true         # 显存不够建议 true
export QUANT_BITS=8           # 也可 4（NF4）
export INPUT_EXCEL=/mnt/data/output_processed.xlsx
export RUBRICS_YAML=./rubrics/rubrics.yaml

# 选择体裁 + 子体裁（示例：应用文-邮件）
export TASK_TYPE="应用文"
export SUBGENRE="邮件"

python main.py
```

## 5. 运行（自检/联调）
```bash
export MODEL_MODE=mock
python main.py
```

## 6. 输出
- `outputs/tables.xlsx`：grammar/content/structure/section_totals/format_content/format_structure/format_summary/summary
- `outputs/report.md`：含“格式检查”“亮点”“易错点”等人性化表述

## 7. 重要环境变量
- `MODEL_MODE`：`python`（本地） / `http`（API） / `mock`（自检）
- `MODEL_DIR`：本地权重目录
- `USE_QUANT`：是否启用 BnB 量化（8 或 4 位）
- `QUANT_BITS`：`8` or `4`
- `TASK_TYPE`：体裁（如：议论文/说明文/记叙文/新闻/报告/创意写作/应用文/图表作文）
- `SUBGENRE`：子体裁（如：邮件/通知/邀请/申请/投诉/道歉信/祝贺信/简历/备忘录/会议纪要/通知英文版/新闻快讯/深度报道/研究报告(简版)/新闻述评）

## 8. 与流程图的对齐校验
- ✅ 从 `grammar_table` 读取语法表 → 汇总模块使用  
- ✅ 学生 OCR 文本驱动 **内容评分表**；老师评语文本参与 **结构评分表**  
- ✅ 评分细则由 `rubrics.yaml` 定向化（体裁/子体裁 + 必备字段 + 格式扣分）  
- ✅ 汇总三表 → 生成 **本次评价** + （可选）历史评价  
- ✅ 报告导出（Excel + Markdown），并新增 **格式检查** 板块

若需新增题型或改权重/等级，直接改 `rubrics.yaml` 即可。
