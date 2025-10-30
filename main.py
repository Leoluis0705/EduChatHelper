import asyncio, os
import pandas as pd
import yaml

from settings import paths, sheets, modelconf
from educhat_client import EduChatClient
from aggregator import aggregate_all
from report_builder import write_excel, write_markdown
from prompts import CONTENT_TABLE_SYSTEM, CONTENT_TABLE_USER_TMPL, STRUCTURE_TABLE_SYSTEM, STRUCTURE_TABLE_USER_TMPL
from pydantic import BaseModel

def load_rubrics_yaml(path:str):
    if not os.path.exists(path): return None
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def load_text_sheet(df: pd.DataFrame, text_cols=("text","内容","ocr_text")) -> str:
    for col in text_cols:
        if col in df.columns:
            vals = [str(x) for x in df[col].dropna().tolist()]
            if vals: return "\n".join(vals)
    return "\n".join([" ".join(map(str, r)) for r in df.astype(str).values.tolist()])

def stringify_rubric(items):
    lines=[]
    for x in items:
        d = []
        if x.get("维度"): d.append(f"维度:{x['维度']}")
        if "满分" in x: d.append(f"满分:{x['满分']}")
        if x.get("评分要点"): d.append("要点:"+"、".join(x["评分要点"]))
        if x.get("扣分示例"): d.append("扣分:"+"、".join(x["扣分示例"]))
        lines.append("；".join(d))
    return "\n".join(lines)

class Row(BaseModel):
    维度:str; 满分:int; 得分:int; 扣分原因:str; 建议:str

def clear_output_directory():
    """清除out文件夹及其内容"""
    import shutil
    from settings import paths
    
    output_dir = paths.OUTPUT_DIR
    if os.path.exists(output_dir):
        print(f"正在清除输出目录: {output_dir}")
        shutil.rmtree(output_dir)
        print("输出目录已清除")
    else:
        print(f"输出目录不存在，无需清除: {output_dir}")

def clear_outputs_directory():
    """清除outputs文件夹及其内容"""
    import shutil
    
    outputs_dir = "outputs"
    if os.path.exists(outputs_dir):
        print(f"正在清除outputs目录: {outputs_dir}")
        shutil.rmtree(outputs_dir)
        print("outputs目录已清除")
    else:
        print(f"outputs目录不存在，无需清除: {outputs_dir}")

def main():
    global os
    # 获取考试名称和老师账号
    exam_name = os.environ.get('EXAM_NAME', '').strip()
    teacher_username = os.environ.get('TEACHER_USERNAME', '').strip()
    
    # 如果指定了考试名称，创建对应的输出目录结构
    if exam_name:
        # 创建安全的文件夹名称（移除非法字符）
        safe_exam_name = "".join(ch for ch in exam_name if ch not in '\\/:*?"<>|').strip()
        if not safe_exam_name:
            safe_exam_name = "未命名考试"
        
        # 如果有老师账号，添加到文件夹名称
        if teacher_username:
            safe_teacher_name = "".join(ch for ch in teacher_username if ch not in '\\/:*?"<>|').strip()
            if safe_teacher_name:
                safe_exam_name = f"{safe_exam_name}_{safe_teacher_name}"
        
        # 创建考试特定的输出目录
        exam_output_dir = os.path.join("out", safe_exam_name)
        exam_outputs_dir = os.path.join("outputs", safe_exam_name)
        
        # 确保目录存在
        os.makedirs(exam_output_dir, exist_ok=True)
        os.makedirs(exam_outputs_dir, exist_ok=True)
        
        print(f"考试名称: {exam_name}")
        print(f"老师账号: {teacher_username or '未指定'}")
        print(f"输出目录: {exam_output_dir}")
        print(f"处理目录: {exam_outputs_dir}")
    else:
        exam_output_dir = "out"
        exam_outputs_dir = "outputs"
        print("未指定考试名称，使用默认输出目录")
    
    # 检查服务器连接状态
    try:
        import requests
        response = requests.get("http://localhost:3000/api/status", timeout=10)
        if response.status_code != 200:
            raise ConnectionError("服务器连接异常")
        print("✅ 服务器连接正常")
    except Exception as e:
        print(f"❌ 服务器连接失败: {str(e)}")
        print("请确保服务器正在运行在端口3000上")
        exit(1)
    
    # 步骤1：设置环境变量，让处理模块使用正确的路径
    os.environ['EXAM_NAME'] = exam_name
    if teacher_username:
        os.environ['TEACHER_USERNAME'] = teacher_username
    
    # 检查中间文件状态，决定需要执行哪些处理步骤
    intermediate_excel_path = os.path.join(exam_outputs_dir, "output.xlsx")
    processed_excel_path = os.path.join(exam_outputs_dir, "output_processed.xlsx")
    
    # 检查是否需要执行PDF提取
    if not os.path.exists(intermediate_excel_path):
        print("正在从PDF提取数据...")
        from extract_to_excel import main as extract_main
        extract_main()
        print("PDF数据提取完成")
    else:
        print("检测到中间Excel文件，跳过PDF提取")
    
    # 检查是否需要执行Excel处理
    if not os.path.exists(processed_excel_path):
        print("正在处理Excel数据...")
        from process_excel import main as process_main
        process_main()
        print("Excel数据处理完成")
    else:
        print("检测到已处理的Excel文件，跳过Excel处理")
    
    # 总是执行学生互评处理（因为这是最后一步，需要确保数据完整）
    print("正在处理学生互评和教师评价数据...")
    from student_teacher_review import process_student_peer_review
    process_student_peer_review()
    print("学生互评和教师评价数据处理完成")
    
    # 步骤2：更新全局路径设置，使用考试特定的输出目录
    from settings import paths
    paths.update_paths(exam_output_dir)
    print(f"✅ 已更新输出路径：{paths.OUTPUT_DIR}")
    
    # 步骤3：继续原有的main函数逻辑
    input_excel = processed_excel_path
    if not os.path.exists(input_excel):
        raise FileNotFoundError(f"INPUT_EXCEL not found: {input_excel}")

    xl = pd.ExcelFile(input_excel)
    def read_sheet(name: str) -> pd.DataFrame:
        if name in xl.sheet_names: return xl.parse(sheet_name=name)
        for s in xl.sheet_names:
            if name.lower() in s.lower(): return xl.parse(sheet_name=s)
        # 如果找不到匹配的工作表，尝试使用第一个工作表
        if xl.sheet_names:
            return xl.parse(sheet_name=xl.sheet_names[0])
        return pd.DataFrame()

    grammar_df = read_sheet(sheets.GRAMMAR_TABLE)
    student_df = read_sheet(sheets.STUDENT_OCR)
    teacher_df = read_sheet(sheets.TEACHER_OCR)
    # 统一清洗列名空格
    if grammar_df is not None and not grammar_df.empty: grammar_df = grammar_df.rename(columns=lambda c: str(c).strip())
    if student_df is not None and not student_df.empty: student_df = student_df.rename(columns=lambda c: str(c).strip())
    if teacher_df is not None and not teacher_df.empty: teacher_df = teacher_df.rename(columns=lambda c: str(c).strip())
    rubric_content_df = read_sheet(sheets.RUBRIC_CONTENT)
    rubric_structure_df = read_sheet(sheets.RUBRIC_STRUCTURE)

    # 为语法表新增「原文与姓名」列（尽可能自动识别列名）
    def _pick_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
        for c in candidates:
            if c in df.columns: return c
        return None
    name_col = _pick_col(grammar_df, ["姓名","学生姓名","name","Name"])
    text_col = _pick_col(grammar_df, ["我的原文","原文","text","内容","ocr_text","作文原文"])
    if grammar_df is not None and not grammar_df.empty:
        if name_col is None and student_df is not None and not student_df.empty:
            name_col = _pick_col(student_df, ["姓名","学生姓名","name","Name"])
        if text_col is None and student_df is not None and not student_df.empty:
            text_col = _pick_col(student_df, ["原文","text","内容","ocr_text","作文原文"])
        if ("姓名" in grammar_df.columns) and ("我的原文" in grammar_df.columns):
            grammar_df["原文与姓名"] = grammar_df["我的原文"].astype(str).str.strip() + " —— " + grammar_df["姓名"].astype(str).str.strip()
        elif name_col and text_col:
            try:
                grammar_df["原文与姓名"] = grammar_df[text_col].astype(str).str.strip() + " —— " + grammar_df[name_col].astype(str).str.strip()
            except Exception:
                grammar_df["原文与姓名"] = grammar_df.astype(str).agg(" ".join, axis=1)

    # 改为逐行处理，每个学生单独生成 Markdown
    def _get_student_name(row: pd.Series) -> str:
        # 精确匹配
        for c in ["姓名","学生姓名","name","Name"]:
            if c in row.index and pd.notna(row[c]) and str(row[c]).strip():
                return str(row[c]).strip()
        # 模糊匹配包含"姓名"
        for c in row.index:
            sc = str(c)
            if ("姓名" in sc) and pd.notna(row[c]) and str(row[c]).strip():
                return str(row[c]).strip()
        return "未命名学生"

    # 预取教师评语按姓名映射
    teacher_map = {}
    if teacher_df is not None and not teacher_df.empty:
        for _, tr in teacher_df.iterrows():
            # 教师表优先取"姓名"
            tname = str(tr["姓名"]).strip() if ("姓名" in tr.index and pd.notna(tr["姓名"])) else _get_student_name(tr)
            teacher_map.setdefault(tname, [])
            # 选取教师文本列
            t_text = ""
            for c in ["评语","老师评语","teacher_text","text","内容","ocr_text"]:
                if c in tr.index and pd.notna(tr[c]):
                    t_text = str(tr[c]); break
            if t_text:
                teacher_map[tname].append(t_text)

    y = load_rubrics_yaml(paths.RUBRICS_YAML) or {}
    platform = y.get("meta",{}).get("platform","天学网")
    grade = y.get("meta",{}).get("grade","高中三年级")
    task_type = os.environ.get("TASK_TYPE", y.get("meta",{}).get("task_type","议论文"))
    if isinstance(task_type, list): task_type = task_type[0]

    penalties = y.get("penalties",{})
    anchors = y.get("anchors",{}).get("level_bands",[])
    grade_map = y.get("grade_map",{})
    weights = y.get("weights",{"grammar":30,"content":35,"structure":35})

    # 选择体裁覆盖的rubric，否则回退到core或Excel
    genre = (y.get("genre_overrides",{}).get(task_type) or {})
    content_items = genre.get("content") or y.get("content_rubric_core") or rubric_content_df.to_dict(orient="records")
    structure_items = genre.get("structure") or y.get("structure_rubric_core") or rubric_structure_df.to_dict(orient="records")
    content_text = stringify_rubric(content_items)
    structure_text = stringify_rubric(structure_items)

    # 子体裁与格式配置（需先于 prompts 构造）
    subgenre = os.environ.get("SUBGENRE","").strip()
    genre_all = y.get("genre_overrides",{}).get(task_type) or {}
    sub_conf = {}
    if subgenre and isinstance(genre_all.get("subgenres"), dict):
        sub_conf = genre_all["subgenres"].get(subgenre,{}) or {}
    required_fields = sub_conf.get("required_fields", genre_all.get("required_fields", []))
    format_penalties = sub_conf.get("penalties", genre_all.get("penalties", {}))
    format_tips = sub_conf.get("format_tips", genre_all.get("format_tips", []))

    # 拼接 prompts
    # 按学生行生成 prompts
    # cohesion hints

    connectives = ", ".join((y.get("lexical_cohesion",{}).get("connectives_advanced") or [])[:16])
    cohesion_extra = {
        "reference_substitution": y.get("lexical_cohesion",{}).get("reference_substitution",[]),
        "parallelism_examples": y.get("lexical_cohesion",{}).get("parallelism_examples",[])
    }
    # 结构 prompt 模板按学生填充在循环中

    client = EduChatClient()

    async def run():
        # 逐行处理学生
        import json
        from pydantic import ValidationError
        from report_builder import write_excel, write_markdown

        # 初始化变量以避免作用域问题
        ct = None
        st = None
        summary = None
        content_json = None
        structure_json = None

        # 若学生表为空，直接保留原有行为
        if student_df is None or student_df.empty:
            student_text = load_text_sheet(student_df) if student_df is not None and not student_df.empty else ""
            teacher_text = load_text_sheet(teacher_df) if teacher_df is not None and not teacher_df.empty else ""
            content_user = CONTENT_TABLE_USER_TMPL.format(
                subgenre_hint=("/"+subgenre if subgenre else ""),
                required_fields=required_fields,
                format_penalties=format_penalties,
                platform=platform, grade=grade, task_type=task_type,
                rubric_text=content_text,
                grade_map=grade_map, anchors=anchors, penalties=penalties,
                student_text=student_text
            )
            structure_user = STRUCTURE_TABLE_USER_TMPL.format(
                subgenre_hint=("/"+subgenre if subgenre else ""),
                required_fields=required_fields,
                format_penalties=format_penalties,
                format_tips=format_tips,
                platform=platform, grade=grade, task_type=task_type,
                rubric_text=structure_text,
                connectives=connectives,
                cohesion_extra=cohesion_extra,
                teacher_text=teacher_text,
                student_text=student_text
            )
            resp1 = await client.acomplete(CONTENT_TABLE_SYSTEM, content_user)
            content_json = json.loads(resp1)
            resp2 = await client.acomplete(STRUCTURE_TABLE_SYSTEM, structure_user)
            structure_json = json.loads(resp2)
            try:
                content_rows = [Row.model_validate(r) for r in content_json.get("content_table",[])]
            except ValidationError:
                content_rows = [Row(维度=r.get("维度","-"), 满分=int(r.get("满分",0)), 得分=int(r.get("得分",0)), 扣分原因=str(r.get("扣分原因","")), 建议=str(r.get("建议",""))) for r in content_json.get("content_table",[])]
            try:
                structure_rows = [Row.model_validate(r) for r in structure_json.get("structure_table",[])]
            except ValidationError:
                structure_rows = [Row(维度=r.get("维度","-"), 满分=int(r.get("满分",0)), 得分=int(r.get("得分",0)), 扣分原因=str(r.get("扣分原因","")), 建议=str(r.get("建议",""))) for r in structure_json.get("structure_table",[])]
            summary = await aggregate_all(client, grammar_df, content_json, structure_json, weights, grade_map)
            class CT(BaseModel):
                content_table:list[Row]; 总分:int; 等级:str
            class ST(BaseModel):
                structure_table:list[Row]; 总分:int; 等级:str
            ct = CT(content_table=content_rows, 总分=int(content_json.get("总分",0)), 等级=str(content_json.get("等级","")))
            st = ST(structure_table=structure_rows, 总分=int(structure_json.get("总分",0)), 等级=str(structure_json.get("等级","")))
            write_excel(paths.OUTPUT_EXCEL, grammar_df, ct, st, summary.model_dump(), content_format=content_json, structure_format=structure_json)
            write_markdown(paths.OUTPUT_REPORT_MD, grammar_df, ct, st, summary.model_dump(), content_format=content_json, structure_format=structure_json)
            print(f"✅ Done. Excel: {paths.OUTPUT_EXCEL}  Markdown: {paths.OUTPUT_REPORT_MD}")
            return

        # 正常逐学生输出（以 grammar_table 每一行作为学生）
        source_df = grammar_df if grammar_df is not None and not grammar_df.empty else student_df
        for idx, row in source_df.iterrows():
            # 姓名读取：精确"姓名"优先，随后模糊匹配
            s_name = str(row["姓名"]).strip() if ("姓名" in row.index and pd.notna(row["姓名"]) and str(row["姓名"]).strip()) else _get_student_name(row)
            # 原文读取：精确"我的原文"，其次任何包含"原文"的列
            if ("我的原文" in row.index) and pd.notna(row["我的原文"]) and str(row["我的原文"]).strip():
                s_text = str(row["我的原文"]).strip()
            else:
                s_text = ""
                for c in row.index:
                    if ("原文" in str(c)) and pd.notna(row[c]) and str(row[c]).strip():
                        s_text = str(row[c]).strip()
                        break
                if not s_text:
                    for c in ["text","内容","ocr_text","作文原文"]:
                        if c in row.index and pd.notna(row[c]) and str(row[c]).strip():
                            s_text = str(row[c]).strip(); break
            # 匹配教师评语
            t_text = "\n".join([t for t in teacher_map.get(s_name, []) if t]) if teacher_map else ""
            # 清理文件名非法字符
            safe_name = "".join(ch for ch in s_name if ch not in '\\/:*?"<>|').strip() or "未命名学生"
            content_user = CONTENT_TABLE_USER_TMPL.format(
                subgenre_hint=("/"+subgenre if subgenre else ""),
                required_fields=required_fields,
                format_penalties=format_penalties,
                platform=platform, grade=grade, task_type=task_type,
                rubric_text=content_text,
                grade_map=grade_map, anchors=anchors, penalties=penalties,
                student_text=s_text
            )
            structure_user = STRUCTURE_TABLE_USER_TMPL.format(
                subgenre_hint=("/"+subgenre if subgenre else ""),
                required_fields=required_fields,
                format_penalties=format_penalties,
                format_tips=format_tips,
                platform=platform, grade=grade, task_type=task_type,
                rubric_text=structure_text,
                connectives=connectives,
                cohesion_extra=cohesion_extra,
                teacher_text=t_text,
                student_text=s_text
            )
            # 调模型
            resp1 = await client.acomplete(CONTENT_TABLE_SYSTEM, content_user)
            content_json = json.loads(resp1)
            resp2 = await client.acomplete(STRUCTURE_TABLE_SYSTEM, structure_user)
            structure_json = json.loads(resp2)
            # 规范化
            try:
                content_rows = [Row.model_validate(r) for r in content_json.get("content_table",[])]
            except ValidationError:
                content_rows = [Row(维度=r.get("维度","-"), 满分=int(r.get("满分",0)), 得分=int(r.get("得分",0)), 扣分原因=str(r.get("扣分原因","")), 建议=str(r.get("建议",""))) for r in content_json.get("content_table",[])]
            try:
                structure_rows = [Row.model_validate(r) for r in structure_json.get("structure_table",[])]
            except ValidationError:
                structure_rows = [Row(维度=r.get("维度","-"), 满分=int(r.get("满分",0)), 得分=int(r.get("得分",0)), 扣分原因=str(r.get("扣分原因","")), 建议=str(r.get("建议",""))) for r in structure_json.get("structure_table",[])]
            # 汇总（可按需过滤该学生的语法子集；若无法匹配姓名则使用全表）
            gdf = grammar_df
            if name_col and grammar_df is not None and (name_col in grammar_df.columns):
                _filtered = grammar_df[grammar_df[name_col].astype(str).str.strip() == s_name]
                gdf = _filtered if not _filtered.empty else grammar_df
            summary = await aggregate_all(client, gdf, content_json, structure_json, weights, grade_map)
            # 导出每人 Markdown 到 ./out/学生姓名.md
            class CT(BaseModel):
                content_table:list[Row]; 总分:int; 等级:str
            class ST(BaseModel):
                structure_table:list[Row]; 总分:int; 等级:str
            ct = CT(content_table=content_rows, 总分=int(content_json.get("总分",0)), 等级=str(content_json.get("等级","")))
            st = ST(structure_table=structure_rows, 总分=int(structure_json.get("总分",0)), 等级=str(structure_json.get("等级","")))
            md_path = os.path.join(paths.OUTPUT_DIR, f"{safe_name}.md")
            write_markdown(md_path, gdf, ct, st, summary.model_dump(), content_format=content_json, structure_format=structure_json)
            print(f"✅ 报告生成：{md_path}")

        # 保留汇总 Excel（选用全体语法表与最后一次评分作占位）
        

    asyncio.run(run())
    
    # 最后一步：将outputs文件夹里的output_processed.xlsx拷贝到out文件夹中对应的考试文件夹
    if exam_name:
        # 源文件路径 - 处理模块生成的output_processed.xlsx
        source_file = os.path.join(exam_outputs_dir, "output_processed.xlsx")
        # 目标文件路径 - out文件夹中的考试文件夹
        target_file = os.path.join(exam_output_dir, "output_processed.xlsx")
        
        # 如果源文件存在且目标文件不存在，才进行拷贝
        if os.path.exists(source_file) and not os.path.exists(target_file):
            import shutil
            shutil.copy2(source_file, target_file)
            print(f"✅ 已拷贝output_processed.xlsx到out文件夹：{target_file}")
        else:
            print("✅ output_processed.xlsx已位于正确位置，无需拷贝")

if __name__ == '__main__':
    main()