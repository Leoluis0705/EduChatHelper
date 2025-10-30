from __future__ import annotations
import os, json, pandas as pd
from typing import Dict, Any, List

def _ensure_dir(p: str):
    d = os.path.dirname(p);  os.makedirs(d, exist_ok=True)

def _rows_to_df(rows: List[Dict[str, Any]], cols: List[str]) -> pd.DataFrame:
    if not rows: return pd.DataFrame(columns=cols)
    df = pd.DataFrame(rows)
    for c in cols:
        if c not in df.columns: df[c] = ""
    return df[cols]

def write_excel(path: str, grammar_df: pd.DataFrame, ct, st, summary: Dict[str, Any],
                content_format: Dict[str, Any] | None = None,
                structure_format: Dict[str, Any] | None = None):
    _ensure_dir(path)
    with pd.ExcelWriter(path, engine="xlsxwriter") as w:
        if grammar_df is not None and not grammar_df.empty:
            grammar_df.to_excel(w, sheet_name="grammar", index=False)
        pd.DataFrame([r if isinstance(r, dict) else getattr(r,'__dict__',{}) for r in getattr(ct,"content_table", [])])\
            .to_excel(w, sheet_name="content", index=False)
        pd.DataFrame([r if isinstance(r, dict) else getattr(r,'__dict__',{}) for r in getattr(st,"structure_table", [])])\
            .to_excel(w, sheet_name="structure", index=False)
        pd.DataFrame([
            {"类型":"内容","总分":getattr(ct,"总分",""),"等级":getattr(ct,"等级","")},
            {"类型":"结构","总分":getattr(st,"总分",""),"等级":getattr(st,"等级","")}
        ]).to_excel(w, sheet_name="section_totals", index=False)

        cf, sf = (content_format or {}), (structure_format or {})
        _rows_to_df(cf.get("format_check",[]), ["缺失项","扣分"]).to_excel(w, sheet_name="format_content", index=False)
        _rows_to_df(sf.get("format_check",[]), ["缺失项","扣分"]).to_excel(w, sheet_name="format_structure", index=False)
        pd.DataFrame([
            {"类型":"内容格式扣分","合计":cf.get("format_deductions",0)},
            {"类型":"结构格式扣分","合计":sf.get("format_deductions",0)}
        ]).to_excel(w, sheet_name="format_summary", index=False)
        pd.DataFrame([summary]).to_excel(w, sheet_name="summary", index=False)

def write_markdown(path: str, grammar_df: pd.DataFrame, ct, st, summary: Dict[str, Any],
                   content_format: Dict[str, Any] | None = None,
                   structure_format: Dict[str, Any] | None = None):
    _ensure_dir(path)
    cf, sf = (content_format or {}), (structure_format or {})
    lines = []
    lines += [ "# 作文批改报告", "",
               "## 分项得分",
               f"- 内容：{getattr(ct,'总分','')}（等级：{getattr(ct,'等级','')}）",
               f"- 结构：{getattr(st,'总分','')}（等级：{getattr(st,'等级','')}）", "" ]
    def mk_check(name, arr):
        if not arr: return f"- **{name}**：✅ 无缺失项"
        return "- **{}**：\n{}".format(name, "".join([f"  - 缺失「{x.get('缺失项','')}」：-{x.get('扣分',0)}分\n" for x in arr]))
    lines += [ "## 格式检查",
               mk_check("内容格式", cf.get("format_check", [])),
               mk_check("结构格式", sf.get("format_check", [])),
               f"- **格式扣分合计**：内容 {cf.get('format_deductions',0)} 分；结构 {sf.get('format_deductions',0)} 分",
               "" ]
    bj = summary.get("本次评价", {})
    lines += [ "## 综合评价",
               f"- **总分**：{bj.get('总分','')}  **等级**：{bj.get('等级','')}" ]
    if bj.get("简评"): lines.append(f"- **简评**：{bj['简评']}")
    if summary.get("亮点"):
        lines.append("\n### 亮点（优先肯定）")
        for i,x in enumerate(summary["亮点"],1): lines.append(f"{i}. {x}")
    if summary.get("易错点"):
        lines.append("\n### 易错点（具体可改方向）")
        for i,x in enumerate(summary["易错点"],1): lines.append(f"{i}. {x}")
    if summary.get("学生画像"):
        sp = summary["学生画像"]; lines.append("\n### 学生画像（学习建议）")
        lines.append(f"- 词汇水平：{sp.get('词汇水平','')}")
        lines.append(f"- 写作风格：{sp.get('写作风格','')}")
        if sp.get("建议方向"):
            lines.append("- 建议方向：")
            for i,s in enumerate(sp["建议方向"],1): lines.append(f"  {i}. {s}")
    with open(path,"w",encoding="utf-8") as f: f.write("\n".join(lines))
