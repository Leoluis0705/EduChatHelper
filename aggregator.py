from __future__ import annotations
import json
from typing import Dict, Any, List
import pandas as pd
from pydantic import BaseModel, ValidationError

from educhat_client import EduChatClient
from prompts import AGGREGATE_SYSTEM, AGGREGATE_USER_TMPL

class SummaryOut(BaseModel):
    格式检查: list[dict] | None = None
    本次评价: Dict[str, Any]
    易错点: List[str]
    亮点: List[str]
    学生画像: Dict[str, Any]
    前几次作文评价: List[Dict[str, Any]] = []

async def aggregate_all(client: EduChatClient, grammar_df: pd.DataFrame, content_json: Dict[str, Any], structure_json: Dict[str, Any], weights: Dict[str,int], grade_map: Dict[str, List[int]]) -> SummaryOut:
    user = AGGREGATE_USER_TMPL.format(
        grammar_table=grammar_df.to_dict(orient="records"),
        content_table=content_json,
        structure_table=structure_json,
        weights=weights,
        grade_map=grade_map
    )
    resp = await client.acomplete(AGGREGATE_SYSTEM, user)
    data = json.loads(resp)
    try:
        return SummaryOut.model_validate(data)
    except ValidationError:
        return SummaryOut(
            本次评价=data.get("本次评价", {"总分": 0, "等级": "", "简评": ""}),
            易错点=data.get("易错点", []),
            亮点=data.get("亮点", []),
            学生画像=data.get("学生画像", {}),
            前几次作文评价=data.get("前几次作文评价", []),
        )
