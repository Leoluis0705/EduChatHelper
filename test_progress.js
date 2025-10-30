const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试进度条接口的逻辑
async function testProgressLogic() {
    const examName = '第五次';
    const teacherUsername = 'teacher';
    
    console.log('测试进度条接口逻辑...');
    console.log('考试名称:', examName);
    console.log('老师账号:', teacherUsername);
    
    // 构建Excel文件路径
    let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
    if (teacherUsername) {
        const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
        if (safeTeacherName) {
            safeExamName = `${safeExamName}_${safeTeacherName}`;
        }
    }
    
    const processedExcelPath = path.join(__dirname, 'outputs', safeExamName, 'output_processed.xlsx');
    const outputXlsxPath = path.join(__dirname, 'outputs', safeExamName, 'output.xlsx');
    const uploadedExcelPath = path.join(__dirname, 'in', '1.xlsx');
    
    console.log('检查文件路径:');
    console.log('1. processedExcelPath:', processedExcelPath, '- 存在:', fs.existsSync(processedExcelPath));
    console.log('2. outputXlsxPath:', outputXlsxPath, '- 存在:', fs.existsSync(outputXlsxPath));
    console.log('3. uploadedExcelPath:', uploadedExcelPath, '- 存在:', fs.existsSync(uploadedExcelPath));
    
    // 测试Python脚本执行
    if (fs.existsSync(processedExcelPath)) {
        console.log('\n测试读取Excel文件...');
        
        const pythonScript = `
import pandas as pd
import sys

try:
    excel_file = "${processedExcelPath}"
    df = pd.read_excel(excel_file)
    # 学生总人数（不用减一）
    row_count = len(df)
    print(f"Excel文件行数: {row_count}")
    print(f"列名: {list(df.columns)}")
    if row_count > 0:
        print("前几行数据:")
        for i in range(min(3, row_count)):
            print(f"第{i+1}行: {dict(df.iloc[i])}")
except Exception as e:
    print(f"读取失败: {str(e)}")
    print(9)
`;
        
        const pythonProcess = spawn('./venv/bin/python3', ['-c', pythonScript], {
            cwd: __dirname
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('Python stdout:', data.toString().trim());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.log('Python stderr:', data.toString().trim());
        });
        
        pythonProcess.on('close', (code) => {
            console.log('Python进程退出码:', code);
            console.log('完整输出:', output);
            console.log('错误输出:', errorOutput);
        });
        
        pythonProcess.on('error', (error) => {
            console.error('执行Python脚本失败:', error);
        });
    } else {
        console.log('Excel文件不存在，无法测试');
    }
}

// 测试out目录结构
function testOutDirectory() {
    const outDir = path.join(__dirname, 'out');
    console.log('\n测试out目录结构...');
    console.log('out目录路径:', outDir);
    console.log('out目录存在:', fs.existsSync(outDir));
    
    if (fs.existsSync(outDir)) {
        const files = fs.readdirSync(outDir);
        console.log('out目录内容:', files);
        
        // 检查是否有考试特定目录
        const examName = '第五次';
        const teacherUsername = 'teacher';
        let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
        if (teacherUsername) {
            const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
            if (safeTeacherName) {
                safeExamName = `${safeExamName}_${safeTeacherName}`;
            }
        }
        
        const examDir = path.join(outDir, safeExamName);
        console.log('考试目录路径:', examDir);
        console.log('考试目录存在:', fs.existsSync(examDir));
        
        if (fs.existsSync(examDir)) {
            const examFiles = fs.readdirSync(examDir);
            console.log('考试目录内容:', examFiles);
            console.log('MD文件数量:', examFiles.filter(file => file.endsWith('.md')).length);
        }
    }
}

// 运行测试
async function runTests() {
    console.log('开始测试进度条接口...\n');
    
    await testProgressLogic();
    testOutDirectory();
    
    console.log('\n测试完成');
}

runTests().catch(console.error);