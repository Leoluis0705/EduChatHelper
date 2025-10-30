import re
import os
from pathlib import Path
from typing import Dict, List, Tuple
import pdfplumber
from openpyxl import Workbook


ROOT = Path(__file__).resolve().parent.parent  # 项目根目录
PDF_PATH = Path("./in/1.pdf")

# 获取考试名称和老师账号，设置考试特定的输出路径
exam_name = os.environ.get('EXAM_NAME', '').strip()
teacher_username = os.environ.get('TEACHER_USERNAME', '').strip()

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
    
    OUTPUT_XLSX = Path("outputs") / safe_exam_name / "output.xlsx"
else:
    OUTPUT_XLSX = Path("outputs") / "output.xlsx"


HeaderRegex = re.compile(
    r"学校：(?P<school>.*?)\s+班级：(?P<class>.*?)\s+姓名：(?P<name>.*?)\s+学号：(?P<id>.*?)\s+作答时间：(?P<time>.*)"
)

ScoreRegex = re.compile(
    r"得分：(?P<score>\d+)(?:（.*?）)?"
)

PageMarkerRegex = re.compile(r"第\s*\d+\s*页\s*/\s*共\s*\d+\s*页")


def normalize_text(text: str) -> str:
    # 统一换行与空格，保留中文字符
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # 去除尾部多余空行
    lines = [l.rstrip() for l in text.split("\n")]
    return "\n".join(lines).strip()


def split_sections(page_text: str) -> Dict[str, str]:
    """
    从单页文本中按段落切分：我的原文 / 语法错误 / 单句点评 / 更多表达
    允许段落缺失，返回字典。
    """
    # 若有页尾标记，截断到标记之前
    m = PageMarkerRegex.search(page_text)
    if m:
        page_text = page_text[:m.start()].strip()

    # 段落标题索引
    # 标题可能独占一行，使用分组查找起止位置
    titles = {
        "mine": "我的原文",
        "errors": "语法错误",
        "comments": "单句点评",
        "more": "更多表达",
    }

    # 找到每个标题的起始位置
    positions: Dict[str, int] = {}
    for key, title in titles.items():
        m = re.search(rf"(^|\n){re.escape(title)}(\s*|\n)", page_text)
        if m:
            positions[key] = m.start()
    # 根据出现顺序切分
    ordered = sorted([(key, pos) for key, pos in positions.items()], key=lambda x: x[1])

    sections = {"mine": "", "errors": "", "comments": "", "more": ""}
    if not ordered:
        return sections

    # 依序取片段
    for i, (key, start_pos) in enumerate(ordered):
        end_pos = len(page_text) if i == len(ordered) - 1 else ordered[i + 1][1]
        # 切掉标题本身行
        block = page_text[start_pos:end_pos].strip()
        # 去除首个标题文字与紧随其后的换行
        block = re.sub(rf"^{re.escape(titles[key])}\s*\n?", "", block)
        sections[key] += (block.strip() + ("\n" if block.strip() else ""))

    # 清理末尾多余换行
    for k in sections.keys():
        sections[k] = sections[k].strip()

    return sections


def parse_header(page_text: str) -> Tuple[Dict[str, str], int]:
    """
    解析页首的基本信息与得分。
    返回 (info_dict, score_int or -1)
    """
    # 取首 3 行用于匹配头部（更稳健）
    head_block = "\n".join(page_text.split("\n")[:3])
    info = {
        "school": "",
        "class": "",
        "name": "",
        "id": "",
        "time": "",
    }
    score_val = -1

    m = HeaderRegex.search(head_block)
    if m:
        info.update(m.groupdict())

    # 得分可能在较靠前位置
    m2 = ScoreRegex.search(page_text)
    if m2:
        try:
            score_val = int(m2.group("score"))
        except Exception:
            score_val = -1

    return info, score_val


def aggregate_student_data(pages: List[str]) -> List[Dict[str, str]]:
    """
    将多页数据按学生聚合。
    key = (school, class, name, id, time)
    sections 累加。
    """
    agg: Dict[Tuple[str, str, str, str, str], Dict[str, str]] = {}

    for page_text in pages:
        norm = normalize_text(page_text)
        info, score = parse_header(norm)
        # 若无法识别学生基本信息，跳过该页
        key = (info["school"], info["class"], info["name"], info["id"], info["time"])
        if all(key) is False:
            # 尝试宽松：如果缺少部分，但存在姓名与学号则也聚合
            if info["name"] and info["id"]:
                key = (info["school"], info["class"], info["name"], info["id"], info["time"])
            else:
                # 无法确定归属，跳过
                continue

        secs = split_sections(norm)

        if key not in agg:
            agg[key] = {
                "school": info["school"],
                "class": info["class"],
                "name": info["name"],
                "id": info["id"],
                "time": info["time"],
                "score": str(score if score >= 0 else ""),
                "mine": "",
                "errors": "",
                "comments": "",
                "more": "",
            }
        else:
            # 若此前未取到得分，这次有则更新
            if not agg[key]["score"] and score >= 0:
                agg[key]["score"] = str(score)

        # 追加段落内容（跨页累加）
        for field in ["mine", "errors", "comments", "more"]:
            part = secs.get(field, "")
            if part:
                if agg[key][field]:
                    agg[key][field] += "\n" + part
                else:
                    agg[key][field] = part

    # 转为列表并排序（按姓名、学号）
    rows = list(agg.values())
    rows.sort(key=lambda r: (r["class"], r["name"], r["id"]))
    return rows


def write_excel(rows: List[Dict[str, str]], path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "grammar_table"

    headers = [
        "序号",
        "学校",
        "班级",
        "姓名",
        "学号",
        "作答时间",
        "得分",
        "我的原文",
        "语法错误",
        "单句点评",
        "更多表达",
    ]
    ws.append(headers)

    for idx, r in enumerate(rows, start=1):
        ws.append([
            idx,
            r.get("school", ""),
            r.get("class", ""),
            r.get("name", ""),
            r.get("id", ""),
            r.get("time", ""),
            r.get("score", ""),
            r.get("mine", ""),
            r.get("errors", ""),
            r.get("comments", ""),
            r.get("more", ""),
        ])

    # 可选：自动列宽（简单估计）
    for col in ws.columns:
        max_len = 10
        column = col[0].column_letter
        for cell in col:
            try:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            except Exception:
                pass
        ws.column_dimensions[column].width = min(max_len + 2, 60)

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main():
    if not PDF_PATH.exists():
        print(f"未找到 PDF 文件：{PDF_PATH}")
        return

    pages_text: List[str] = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            txt = page.extract_text() or ""
            if not txt.strip():
                # 若为扫描版或文本为空，提示并继续
                txt = ""
            pages_text.append(txt)

    rows = aggregate_student_data(pages_text)
    if not rows:
        print("未解析到有效学生数据，请确认PDF格式是否与示例一致。")
        return

    write_excel(rows, OUTPUT_XLSX)
    print(f"已生成：{OUTPUT_XLSX}，共 {len(rows)} 位同学。")


if __name__ == "__main__":
    main()