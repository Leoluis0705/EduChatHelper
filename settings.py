import os
from dataclasses import dataclass

@dataclass
class Paths:
    def __post_init__(self):
        # 获取考试名称和老师账号
        exam_name = os.environ.get('EXAM_NAME', '').strip()
        teacher_username = os.environ.get('TEACHER_USERNAME', '').strip()
        
        # 如果指定了考试名称，创建对应的输出目录结构
        if exam_name:
            # 创建安全的文件夹名称（移除非法字符）
            safe_exam_name = "".join(ch for ch in exam_name if ch not in '\\/:*?"<>|').strip()
            if not safe_exam_name:
                safe_exam_name = "未命名考试"
            
            # 添加老师账号到文件夹名称
            if teacher_username:
                safe_teacher_name = "".join(ch for ch in teacher_username if ch not in '\\/:*?"<>|').strip()
                if safe_teacher_name:
                    safe_exam_name = f"{safe_exam_name}_{safe_teacher_name}"
            
            # 设置考试特定的输出目录
            self.OUTPUT_DIR = os.path.join("./out", safe_exam_name)
            self.INPUT_EXCEL = os.path.join("./outputs", safe_exam_name, "output_processed.xlsx")
        else:
            self.OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "./out")
            self.INPUT_EXCEL = os.environ.get("INPUT_EXCEL", "./outputs/output_processed.xlsx")
        
        # 确保目录存在
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)
        os.makedirs(os.path.dirname(self.INPUT_EXCEL), exist_ok=True)
        
        # 设置其他路径（这些路径可以在运行时动态更新）
        self.OUTPUT_EXCEL = os.path.join(self.OUTPUT_DIR, "tables.xlsx")
        self.OUTPUT_REPORT_MD = os.path.join(self.OUTPUT_DIR, "report.md")
        self.RUBRICS_YAML = os.environ.get("RUBRICS_YAML", "./rubrics/rubrics.yaml")
    
    def update_paths(self, output_dir):
        """动态更新输出路径"""
        self.OUTPUT_DIR = output_dir
        self.OUTPUT_EXCEL = os.path.join(output_dir, "tables.xlsx")
        self.OUTPUT_REPORT_MD = os.path.join(output_dir, "report.md")
        # 确保目录存在
        os.makedirs(self.OUTPUT_DIR, exist_ok=True)

@dataclass
class Sheets:
    GRAMMAR_TABLE: str = os.environ.get("SHEET_GRAMMAR", "grammar_table")
    STUDENT_OCR: str   = os.environ.get("SHEET_STUDENT_OCR", "student_ocr")
    TEACHER_OCR: str   = os.environ.get("SHEET_TEACHER_OCR", "teacher_ocr")
    RUBRIC_CONTENT: str   = os.environ.get("SHEET_RUBRIC_CONTENT", "rubric_content")
    RUBRIC_STRUCTURE: str = os.environ.get("SHEET_RUBRIC_STRUCTURE", "rubric_structure")
    HISTORY_SUMMARY: str  = os.environ.get("SHEET_HISTORY", "history")

@dataclass
class ModelConf:
    MODE: str = os.environ.get("MODEL_MODE", "http")
    MODEL_NAME: str = os.environ.get("MODEL_NAME", "deepseek-chat")
    OPENAI_BASE_URL: str = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
    OPENAI_API_KEY: str  = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_ORG: str = os.environ.get("OPENAI_ORG", "")
    OPENAI_PROJECT: str = os.environ.get("OPENAI_PROJECT", "")
    MAX_TOKENS: int = int(os.environ.get("MAX_TOKENS", "1024"))
    TEMPERATURE: float = float(os.environ.get("TEMPERATURE", "0.2"))
    TIMEOUT: int = int(os.environ.get("HTTP_TIMEOUT", "120"))
    RETRIES: int = int(os.environ.get("HTTP_RETRIES", "3"))
    RETRY_BACKOFF: float = float(os.environ.get("HTTP_RETRY_BACKOFF", "1.5"))
    TASK_TYPE: str = os.environ.get("TASK_TYPE", "议论文")  # ★ 体裁
    SUBGENRE: str = os.environ.get("SUBGENRE", "").strip()

paths = Paths()
sheets = Sheets()
modelconf = ModelConf()

# SUBGENRE 已在 ModelConf 数据类中声明
