import pandas as pd
from pathlib import Path
import os

def process_student_peer_review():
    """
    处理学生互评和教师评价：
    1. 读取in/1.xlsx的学号和分数数据
    2. 读取outputs/output_processed.xlsx的grammar_table表的学号
    3. 根据分数匹配生成对应的学生互评和教师评价
    4. 在output_processed.xlsx中创建student_ocr和teacher_ocr表
    """
    
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
        
        output_file = Path("outputs") / safe_exam_name / "output_processed.xlsx"
    else:
        output_file = Path("outputs") / "output_processed.xlsx"
    
    # 文件路径
    input_file = Path("in") / "1.xlsx"
    
    # 检查文件是否存在
    if not input_file.exists():
        print(f"错误：找不到输入文件 {input_file}")
        return
    
    if not output_file.exists():
        print(f"错误：找不到输出文件 {output_file}")
        return
    
    try:
        # 读取输入文件中的学生数据
        print("正在读取输入文件...")
        input_df = pd.read_excel(input_file)
        
        # 检查必要的列是否存在
        if "学号" not in input_df.columns:
            print("错误：输入文件中缺少'学号'列")
            return
            
        # 检查分数列是否存在（可能有换行符）
        score_column_2 = None
        score_column_3 = None
        
        for col in input_df.columns:
            if "2题" in col and "6.0" in col:
                score_column_2 = col
            elif "3题" in col and "6.0" in col:
                score_column_3 = col
        
        if score_column_2 is None:
            print("错误：输入文件中缺少包含'2题'和'6.0'的分数列")
            print(f"可用列名: {list(input_df.columns)}")
            return
            
        if score_column_3 is None:
            print("错误：输入文件中缺少包含'3题'和'6.0'的分数列")
            print(f"可用列名: {list(input_df.columns)}")
            return
        
        # 读取输出文件中的grammar_table表
        print("正在读取grammar_table表...")
        try:
            grammar_df = pd.read_excel(output_file, sheet_name="grammar_table")
        except ValueError:
            print("错误：output_processed.xlsx中找不到grammar_table表")
            return
        
        # 检查grammar_table表中是否有学号列
        if "学号" not in grammar_df.columns:
            print("错误：grammar_table表中缺少'学号'列")
            return
        
        # 创建学生互评和教师评价映射字典
        student_review_map = {}
        teacher_review_map = {}
        
        # 处理每个学生的分数和评语
        for index, row in input_df.iterrows():
            student_id = row["学号"]
            score_2 = row[score_column_2]
            score_3 = row[score_column_3]
            
            # 根据第2题分数生成学生互评
            if score_2 == 5:
                student_review = "覆盖了所有内容要点，表述清楚、合理；"
            elif score_2 == 4:
                student_review = "覆盖了所有内容要点，表述比较清楚、合理；"
            elif score_2 == 3:
                student_review = "覆盖了大部分内容要点，有个别地方表述不够清楚、合理。"
            elif score_2 == 2:
                student_review = "遗漏或未清楚表述一些内容要点，或一些内容与写作目的不相关。"
            elif score_2 == 1:
                student_review = "遗漏或未清楚表述大部分内容要点，或大部分内容与写作目的不相关。"
            else:
                student_review = "分数异常，无法生成评语"
            
            # 根据第3题分数生成教师评价
            if score_3 == 5:
                teacher_review = "有效地使用了语句间衔接手段，全文结构清晰，意义连贯。"
            elif score_3 == 4:
                teacher_review = "比较有效地使用了语句间衔接手段，全文结构比较清晰，意义比较连贯。"
            elif score_3 == 3:
                teacher_review = "基本有效地使用了语句间衔接手段，全文结构基本清晰，意义基本连贯。"
            elif score_3 == 2:
                teacher_review = "几乎不能有效地使用语句间衔接手段，全文结构不够清晰，意义不够连贯。信息未能清楚地传达给读者。"
            elif score_3 == 1:
                teacher_review = "几乎没有使用语句间衔接手段，全文结构不清晰，意义不连贯。"
            else:
                teacher_review = "分数异常，无法生成评语"
            
            student_review_map[student_id] = student_review
            teacher_review_map[student_id] = teacher_review
        
        # 创建student_ocr和teacher_ocr表的数据
        student_ocr_data = []
        teacher_ocr_data = []
        
        # 按照grammar_table表的顺序匹配学生
        for index, row in grammar_df.iterrows():
            student_id = row["学号"]
            student_review = student_review_map.get(student_id, "未找到该学生的分数信息")
            teacher_review = teacher_review_map.get(student_id, "未找到该学生的分数信息")
            
            student_ocr_data.append({
                "学生互评情况": student_review
            })
            
            teacher_ocr_data.append({
                "老师评价": teacher_review
            })
        
        # 创建DataFrame
        student_ocr_df = pd.DataFrame(student_ocr_data)
        teacher_ocr_df = pd.DataFrame(teacher_ocr_data)
        
        # 使用openpyxl引擎打开现有文件并添加新表
        with pd.ExcelWriter(output_file, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
            student_ocr_df.to_excel(writer, sheet_name='student_ocr', index=False)
            teacher_ocr_df.to_excel(writer, sheet_name='teacher_ocr', index=False)
        
        print(f"处理完成！已在 {output_file} 中创建 student_ocr 和 teacher_ocr 表")
        print(f"共处理了 {len(student_ocr_data)} 名学生的互评和教师评价")
        
    except Exception as e:
        print(f"处理过程中出现错误：{str(e)}")

if __name__ == "__main__":
    process_student_peer_review()