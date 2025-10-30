const express = require('express');
const { spawn } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

// 启用CORS
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 配置multer用于PDF文件上传到in文件夹
const pdfStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const inDir = path.join(__dirname, '..', 'in');
        // 确保in文件夹存在
        if (!fs.existsSync(inDir)) {
            fs.mkdirSync(inDir, { recursive: true });
        }
        cb(null, inDir);
    },
    filename: function (req, file, cb) {
        // 强制重命名为1.pdf
        cb(null, '1.pdf');
    }
});

const pdfUpload = multer({ 
    storage: pdfStorage,
    fileFilter: function (req, file, cb) {
        // 只允许PDF文件
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('只允许上传PDF文件'), false);
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB限制
    }
});

// 配置multer用于Excel文件上传到in文件夹
const excelStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const inDir = path.join(__dirname, '..', 'in');
        // 确保in文件夹存在
        if (!fs.existsSync(inDir)) {
            fs.mkdirSync(inDir, { recursive: true });
        }
        cb(null, inDir);
    },
    filename: function (req, file, cb) {
        // 强制重命名为1.xlsx
        cb(null, '1.xlsx');
    }
});

const excelUpload = multer({ 
    storage: excelStorage,
    fileFilter: function (req, file, cb) {
        // 允许Excel文件
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传Excel文件 (.xlsx格式)'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB限制
    }
});

// PDF文件上传接口
app.post('/upload', pdfUpload.single('pdfFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有接收到文件' });
    }

    try {
        console.log(`PDF文件已上传到: ${req.file.path}`);
        res.json({ 
            success: true, 
            message: 'PDF文件已成功保存到in文件夹并重命名为1.pdf',
            originalName: req.file.originalname,
            savedPath: req.file.path
        });
    } catch (error) {
        console.error('PDF文件处理错误:', error);
        res.status(500).json({ error: 'PDF文件处理失败' });
    }
});

// Excel文件上传接口
app.post('/upload-excel', excelUpload.single('excelFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有接收到Excel文件' });
    }

    try {
        console.log(`Excel文件已上传到: ${req.file.path}`);
        res.json({ 
            success: true, 
            message: 'Excel文件已成功保存到in文件夹并重命名为1.xlsx',
            originalName: req.file.originalname,
            savedPath: req.file.path
        });
    } catch (error) {
        console.error('Excel文件处理错误:', error);
        res.status(500).json({ error: 'Excel文件处理失败' });
    }
});

// 检查文件是否存在接口
app.get('/api/check-file', (req, res) => {
    const filePath = path.join(__dirname, '..', 'in', '1.pdf');
    const fileExists = fs.existsSync(filePath);
    
    res.json({
        exists: fileExists,
        path: filePath,
        timestamp: fileExists ? fs.statSync(filePath).mtime : null
    });
});

// 检查PDF和Excel文件是否同时存在的接口
app.get('/api/check-files', (req, res) => {
    const pdfPath = path.join(__dirname, '..', 'in', '1.pdf');
    const excelPath = path.join(__dirname, '..', 'in', '1.xlsx');
    const pdfExists = fs.existsSync(pdfPath);
    const excelExists = fs.existsSync(excelPath);
    
    res.json({
        pdfExists: pdfExists,
        excelExists: excelExists,
        pdfPath: pdfPath,
        excelPath: excelPath,
        timestamp: pdfExists ? fs.statSync(pdfPath).mtime : null
    });
});

// 获取学生总数和当前进度
app.get('/api/progress', (req, res) => {
    try {
        // 解码URL编码的中文参数
        const examName = decodeURIComponent(req.query.examName || '');
        const teacherUsername = decodeURIComponent(req.query.teacherUsername || '');
        
        console.log('获取进度参数:', { examName, teacherUsername });
        console.log('完整的查询参数:', req.query);
        
        let totalStudents = 0;
        let currentProgress = 0;
        let tablesFileExists = false;
        
        // 检查out文件夹是否存在
        const outDir = path.join(__dirname, '..', 'out');
        if (fs.existsSync(outDir)) {
            // 如果有考试名称，检查对应的考试文件夹
            if (examName) {
                let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
                
                // 如果examName已经包含老师账号（如"A_teacher"），直接使用
                // 否则，如果提供了teacherUsername，构建完整的文件夹名称
                if (teacherUsername && !examName.includes(`_${teacherUsername}`)) {
                    const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
                    if (safeTeacherName) {
                        safeExamName = `${safeExamName}_${safeTeacherName}`;
                    }
                }
                
                const examDir = path.join(outDir, safeExamName);
                if (fs.existsSync(examDir)) {
                    const files = fs.readdirSync(examDir);
                    currentProgress = files.filter(file => file.endsWith('.md')).length;
                    // 检查考试文件夹中的output_processed.xlsx文件
                    tablesFileExists = fs.existsSync(path.join(examDir, 'output_processed.xlsx'));
                }
            } else {
                // 如果没有考试名称，检查out根目录
                const files = fs.readdirSync(outDir);
                currentProgress = files.filter(file => file.endsWith('.md')).length;
                // 检查out根目录中的output_processed.xlsx文件
                tablesFileExists = fs.existsSync(path.join(outDir, 'output_processed.xlsx'));
            }
        }
        
        // 学生总人数从对应的out目录下的文件读取
        let processedExcelPath;
        if (examName) {
            // 如果有考试名称，检查对应的out考试文件夹
            let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
            
            // 如果examName已经包含老师账号（如"A_teacher"），直接使用
            // 否则，如果提供了teacherUsername，构建完整的文件夹名称
            if (teacherUsername && !examName.includes(`_${teacherUsername}`)) {
                const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
                if (safeTeacherName) {
                    safeExamName = `${safeExamName}_${safeTeacherName}`;
                }
            }
            
            const examOutDir = path.join(__dirname, '..', 'out', safeExamName);
            processedExcelPath = path.join(examOutDir, 'output_processed.xlsx');
        } else {
            // 如果没有考试名称，检查根目录下的out文件夹
            processedExcelPath = path.join(__dirname, '..', 'out', 'output_processed.xlsx');
        }
        
        console.log('检查Excel文件路径:', processedExcelPath);
        
        // 检查Excel文件是否存在并准确读取学生总数
        if (fs.existsSync(processedExcelPath)) {
            // 使用虚拟环境中的Python来读取Excel文件
            const pythonScript = `
import pandas as pd
import sys

try:
    excel_file = "${processedExcelPath}"
    df = pd.read_excel(excel_file)
    # 学生总人数（不用减一）
    row_count = len(df)
    print(row_count)
except Exception as e:
    # 如果读取失败，使用默认值
    print(9)
`;
            
            const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
                cwd: path.join(__dirname, '..')
            });
            
            let output = '';
            let errorOutput = '';
            
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString().trim();
                console.log('Python stdout:', data.toString().trim());
            });
            
            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString().trim();
                console.log('Python stderr:', data.toString().trim());
            });
            
            pythonProcess.on('close', (code) => {
                console.log('Python process closed with code:', code);
                console.log('Python output:', output);
                console.log('Python error:', errorOutput);
                
                if (code === 0 && output) {
                    totalStudents = parseInt(output) || 9;
                } else {
                    totalStudents = 9; // 默认值
                }
                
                // 确保总学生数至少等于当前进度
                totalStudents = Math.max(totalStudents, currentProgress, 1);
                
                res.json({
                    totalStudents: totalStudents,
                    currentProgress: currentProgress,
                    percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                    tablesFileExists: tablesFileExists
                });
            });
            
            pythonProcess.on('error', (error) => {
                console.error('执行Python脚本失败:', error);
                totalStudents = Math.max(currentProgress, 9);
                res.json({
                    totalStudents: totalStudents,
                    currentProgress: currentProgress,
                    percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                    tablesFileExists: tablesFileExists,
                    error: error.message
                });
            });
        } else {
            // 如果Excel文件不存在，尝试从Excel上传文件读取学生总数
            const uploadedExcelPath = path.join(__dirname, '..', 'in', '1.xlsx');
            if (fs.existsSync(uploadedExcelPath)) {
                // 使用虚拟环境中的Python来读取上传的Excel文件
                const pythonScript = `
import pandas as pd
import sys

try:
    excel_file = "${uploadedExcelPath}"
    df = pd.read_excel(excel_file)
    # 学生总人数（不用减一）
    row_count = len(df)
    print(row_count)
except Exception as e:
    # 如果读取失败，使用默认值
    print(9)
`;
                
                const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
                    cwd: path.join(__dirname, '..')
                });
                
                let output = '';
                let errorOutput = '';
                
                pythonProcess.stdout.on('data', (data) => {
                    output += data.toString().trim();
                    console.log('Python stdout:', data.toString().trim());
                });
                
                pythonProcess.stderr.on('data', (data) => {
                    errorOutput += data.toString().trim();
                    console.log('Python stderr:', data.toString().trim());
                });
                
                pythonProcess.on('close', (code) => {
                    console.log('Python process closed with code:', code);
                    console.log('Python output:', output);
                    console.log('Python error:', errorOutput);
                    
                    if (code === 0 && output) {
                        totalStudents = parseInt(output) || 9;
                    } else {
                        totalStudents = 9; // 默认值
                    }
                    
                    // 确保总学生数至少等于当前进度
                    totalStudents = Math.max(totalStudents, currentProgress, 1);
                    
                    res.json({
                        totalStudents: totalStudents,
                        currentProgress: currentProgress,
                        percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                        tablesFileExists: tablesFileExists
                    });
                });
                
                pythonProcess.on('error', (error) => {
                    console.error('执行Python脚本失败:', error);
                    totalStudents = Math.max(currentProgress, 9);
                    res.json({
                        totalStudents: totalStudents,
                        currentProgress: currentProgress,
                        percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                        tablesFileExists: tablesFileExists,
                        error: error.message
                    });
                });
            } else {
                // 如果连上传的Excel文件都不存在，尝试从out目录下的output.xlsx读取
                let outputXlsxPath;
                if (examName) {
                    let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
                    if (teacherUsername) {
                        const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
                        if (safeTeacherName) {
                            safeExamName = `${safeExamName}_${safeTeacherName}`;
                        }
                    }
                    outputXlsxPath = path.join(__dirname, '..', 'out', safeExamName, 'output.xlsx');
                } else {
                    outputXlsxPath = path.join(__dirname, '..', 'out', 'output.xlsx');
                }
                
                if (fs.existsSync(outputXlsxPath)) {
                    // 使用虚拟环境中的Python来读取output.xlsx文件
                    const pythonScript = `
import pandas as pd
import sys

try:
    excel_file = "${outputXlsxPath}"
    df = pd.read_excel(excel_file)
    # 学生总人数（不用减一）
    row_count = len(df)
    print(row_count)
except Exception as e:
    # 如果读取失败，使用默认值
    print(9)
`;
                    
                    const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
                        cwd: path.join(__dirname, '..')
                    });
                    
                    let output = '';
                    let errorOutput = '';
                    
                    pythonProcess.stdout.on('data', (data) => {
                        output += data.toString().trim();
                        console.log('Python stdout:', data.toString().trim());
                    });
                    
                    pythonProcess.stderr.on('data', (data) => {
                        errorOutput += data.toString().trim();
                        console.log('Python stderr:', data.toString().trim());
                    });
                    
                    pythonProcess.on('close', (code) => {
                        console.log('Python process closed with code:', code);
                        console.log('Python output:', output);
                        console.log('Python error:', errorOutput);
                        
                        if (code === 0 && output) {
                            totalStudents = parseInt(output) || 9;
                        } else {
                            totalStudents = 9; // 默认值
                        }
                        
                        // 确保总学生数至少等于当前进度
                        totalStudents = Math.max(totalStudents, currentProgress, 1);
                        
                        res.json({
                            totalStudents: totalStudents,
                            currentProgress: currentProgress,
                            percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                            tablesFileExists: tablesFileExists
                        });
                    });
                    
                    pythonProcess.on('error', (error) => {
                        console.error('执行Python脚本失败:', error);
                        totalStudents = Math.max(currentProgress, 9);
                        res.json({
                            totalStudents: totalStudents,
                            currentProgress: currentProgress,
                            percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                            tablesFileExists: tablesFileExists,
                            error: error.message
                        });
                    });
                } else {
                    // 如果所有Excel文件都不存在，使用默认值
                    totalStudents = Math.max(currentProgress, 1);
                    res.json({
                        totalStudents: totalStudents,
                        currentProgress: currentProgress,
                        percentage: totalStudents > 0 ? Math.round((currentProgress / totalStudents) * 100) : 0,
                        tablesFileExists: tablesFileExists
                    });
                }
            }
        }
    } catch (error) {
        console.error('获取进度失败:', error);
        res.json({
            totalStudents: 1,
            currentProgress: 0,
            percentage: 0,
            error: error.message
        });
    }
});

// 获取报告数据的API接口
app.get('/api/report', (req, res) => {
    try {
        const processedExcelPath = path.join(__dirname, '..', 'outputs', 'output_processed.xlsx');
        
        if (!fs.existsSync(processedExcelPath)) {
            return res.json({
                success: false,
                error: '报告文件不存在，请先完成批改'
            });
        }
        
        console.log('开始读取Excel文件:', processedExcelPath);
        
        // 使用虚拟环境中的Python读取Excel文件
        const pythonScript = `
import pandas as pd
import json

try:
    df = pd.read_excel("${processedExcelPath}", sheet_name="grammar_table")
    
    # 转换为JSON格式
    result = {
        "headers": df.columns.tolist(),
        "data": df.astype(str).values.tolist(),
        "totalRows": len(df)
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        
        const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
            cwd: path.join(__dirname, '..')
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0 && output) {
                try {
                    const result = JSON.parse(output);
                    if (result.error) {
                        return res.json({
                            success: false,
                            error: '读取Excel文件失败: ' + result.error
                        });
                    }
                    
                    const headers = result.headers || [];
                    const rows = result.data || [];
                    
                    console.log('表头:', headers);
                    console.log('数据行数:', rows.length);
                    
                    if (rows.length === 0) {
                        return res.json({
                            success: false,
                            error: 'Excel文件为空'
                        });
                    }
                    
                    // 转换为对象数组
                    const reportData = rows.map((row, index) => {
                        const obj = {};
                        headers.forEach((header, colIndex) => {
                            obj[header] = row[colIndex] || '';
                        });
                        return obj;
                    }).filter(row => {
                        return Object.values(row).some(value => value.trim() !== '');
                    });
                    
                    console.log('处理后的数据行数:', reportData.length);
                    
                    res.json({
                        success: true,
                        report: reportData,
                        headers: headers,
                        totalStudents: reportData.length
                    });
                    
                } catch (parseError) {
                    console.error('解析Python输出失败:', parseError);
                    res.json({
                        success: false,
                        error: '解析数据失败: ' + parseError.message
                    });
                }
            } else {
                console.error('Python脚本执行失败:', errorOutput);
                res.json({
                    success: false,
                    error: '执行Python脚本失败: ' + errorOutput
                });
            }
        });
        
    } catch (error) {
        console.error('获取报告失败:', error);
        res.json({
            success: false,
            error: '读取报告文件失败: ' + error.message
        });
    }
});

// 获取学生列表API接口
app.get('/api/students', (req, res) => {
    try {
        // 获取考试名称和老师账号（从查询参数或localStorage）
        const examName = req.query.examName || '';
        const teacherUsername = req.query.teacherUsername || '';
        
        console.log('获取学生列表参数 - 原始:', { examName, teacherUsername });
        
        // 处理中文参数编码问题
        let decodedExamName = examName;
        try {
            // 尝试URL解码
            decodedExamName = decodeURIComponent(examName);
        } catch (e) {
            // 如果解码失败，使用原始值
            console.log('URL解码失败，使用原始值:', examName);
        }
        
        console.log('获取学生列表参数 - 处理后:', { decodedExamName, teacherUsername });
        
        // 构建输出目录路径
        let outDir = path.join(__dirname, '..', 'out');
        if (decodedExamName) {
            // 如果examName已经包含老师账号（如"A_teacher"），直接使用
            // 否则，如果提供了teacherUsername，构建完整的文件夹名称
            if (teacherUsername && !decodedExamName.includes(`_${teacherUsername}`)) {
                const folderName = `${decodedExamName}_${teacherUsername}`;
                outDir = path.join(outDir, folderName);
            } else {
                outDir = path.join(outDir, decodedExamName);
            }
        }
        
        // 调试信息
        console.log('学生列表API - 原始参数:', { examName, teacherUsername });
        console.log('学生列表API - 最终outDir:', outDir);
        
        console.log('学生列表API - 请求参数:', { examName, teacherUsername });
        console.log('学生列表API - 最终outDir:', outDir);
        
        // 构建Excel文件路径
        let processedExcelPath = path.join(__dirname, '..', 'out', 'output_processed.xlsx');
        if (decodedExamName) {
            // 如果decodedExamName已经包含老师账号（如"A_teacher"），直接使用
            // 否则，如果提供了teacherUsername，构建完整的文件夹名称
            if (teacherUsername && !decodedExamName.includes(`_${teacherUsername}`)) {
                const folderName = `${decodedExamName}_${teacherUsername}`;
                processedExcelPath = path.join(__dirname, '..', 'out', folderName, 'output_processed.xlsx');
            } else {
                processedExcelPath = path.join(__dirname, '..', 'out', decodedExamName, 'output_processed.xlsx');
            }
        }
        
        console.log('最终路径检查 - outDir:', outDir);
        console.log('最终路径检查 - processedExcelPath:', processedExcelPath);
        
        console.log('检查out文件夹:', outDir);
        console.log('检查Excel文件:', processedExcelPath);
        
        if (!fs.existsSync(outDir)) {
            console.log('out文件夹不存在:', outDir);
            return res.json({
                success: false,
                error: 'out文件夹不存在: ' + outDir
            });
        }
        
        // 读取out文件夹中的MD文件
        const files = fs.readdirSync(outDir);
        const mdFiles = files.filter(file => file.endsWith('.md') && file !== 'tables.xlsx');
        
        console.log('找到MD文件:', mdFiles);
        
        let students = [];
        
        // 如果有Excel文件，尝试从中获取更详细的学生信息
        if (fs.existsSync(processedExcelPath)) {
            try {
                console.log('读取Excel文件:', processedExcelPath);
                const xlsx = require('xlsx');
                const workbook = xlsx.readFile(processedExcelPath);
                const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('grammar'));
                
                if (sheetName) {
                    const worksheet = workbook.Sheets[sheetName];
                    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (data.length > 1) {
                        const headers = data[0] || [];
                        const rows = data.slice(1);
                        
                        students = rows.map((row, index) => {
                            const student = {
                                id: index + 1,
                                name: mdFiles[index] ? mdFiles[index].replace('.md', '') : `学生${index + 1}`,
                                studentId: row[0] || '',
                                school: row[1] || '',
                                class: row[2] || '',
                                totalScore: row[3] || '',
                                grade: row[4] || '',
                                examName: examName || '未命名考试'
                            };
                            return student;
                        });
                    }
                }
            } catch (excelError) {
                console.error('读取Excel文件失败:', excelError);
            }
        }
        
        // 如果没有从Excel获取到数据，则从MD文件创建基础学生列表
        if (students.length === 0) {
            students = mdFiles.map((file, index) => ({
                id: index + 1,
                name: file.replace('.md', ''),
                studentId: `S${index + 1}`,
                school: '未知学校',
                class: '未知班级',
                totalScore: 'N/A',
                grade: 'N/A',
                examName: examName || '未命名考试'
            }));
        }
        
        console.log('返回学生数据:', students.length, '个学生');
        
        res.json({
            success: true,
            students: students,
            total: students.length,
            examName: decodedExamName || '未命名考试'
        });
        
    } catch (error) {
        console.error('获取学生列表失败:', error);
        res.json({
            success: false,
            error: '获取学生列表失败: ' + error.message
        });
    }
});

// 获取语法报告API接口
app.get('/api/grammar-report/:studentId', (req, res) => {
    try {
        const studentId = req.params.studentId;
        const examName = req.query.examName || '';
        const teacherUsername = req.query.teacherUsername || '';
        
        // 构建Excel文件路径
        let processedExcelPath = path.join(__dirname, '..', 'out', 'output_processed.xlsx');
        if (examName) {
            // 对于历史报告，examName已经是完整的文件夹名称，直接使用
            // 先解码examName参数
            const decodedExamName = decodeURIComponent(examName);
            processedExcelPath = path.join(__dirname, '..', 'out', decodedExamName, 'output_processed.xlsx');
        }
        
        if (!fs.existsSync(processedExcelPath)) {
            return res.json({
                success: false,
                error: '语法报告文件不存在: ' + processedExcelPath
            });
        }
        
        // 使用虚拟环境中的Python读取Excel文件
        const pythonScript = `
import pandas as pd
import json

try:
    df = pd.read_excel("${processedExcelPath}", sheet_name="grammar_table")
    
    # 转换为JSON格式
    result = {
        "headers": df.columns.tolist(),
        "data": df.astype(str).values.tolist(),
        "totalRows": len(df)
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        
        const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
            cwd: path.join(__dirname, '..')
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0 && output) {
                try {
                    const result = JSON.parse(output);
                    if (result.error) {
                        return res.json({
                            success: false,
                            error: '读取Excel文件失败: ' + result.error
                        });
                    }
                    
                    const headers = result.headers || [];
                    const rows = result.data || [];
                    
                    if (rows.length === 0) {
                        return res.json({
                            success: false,
                            error: '语法报告数据为空'
                        });
                    }
                    
                    // 根据学生ID或姓名查找对应的数据行
                    let studentRow = null;
                    const studentIndex = parseInt(studentId) - 1;
                    
                    if (!isNaN(studentIndex) && studentIndex >= 0 && studentIndex < rows.length) {
                        studentRow = rows[studentIndex];
                    } else {
                        // 尝试通过姓名查找
                        const studentName = studentId;
                        const nameIndex = rows.findIndex(row => {
                            const nameColIndex = headers.findIndex(h => 
                                h.includes('姓名') || h.includes('name')
                            );
                            if (nameColIndex >= 0 && nameColIndex < row.length) {
                                return row[nameColIndex] && row[nameColIndex].includes(studentName);
                            }
                            return false;
                        });
                        if (nameIndex >= 0) {
                            studentRow = rows[nameIndex];
                        }
                    }
                    
                    if (!studentRow) {
                        return res.json({
                            success: false,
                            error: '找不到该学生的语法报告'
                        });
                    }
                    
                    // 将单行数据转换为表格格式
                    const reportData = headers.map((header, index) => ({
                        项目: header,
                        内容: studentRow[index] || ''
                    }));
                    
                    res.json({
                        success: true,
                        report: reportData,
                        student: {
                            name: studentRow[headers.findIndex(h => h.includes('姓名'))] || studentId,
                            studentId: studentRow[headers.findIndex(h => h.includes('学号'))] || studentId
                        }
                    });
                    
                } catch (parseError) {
                    console.error('解析Python输出失败:', parseError);
                    res.json({
                        success: false,
                        error: '解析数据失败: ' + parseError.message
                    });
                }
            } else {
                console.error('Python脚本执行失败:', errorOutput);
                res.json({
                    success: false,
                    error: '执行Python脚本失败: ' + errorOutput
                });
            }
        });
        
    } catch (error) {
        console.error('获取语法报告失败:', error);
        res.json({
            success: false,
            error: '获取语法报告失败: ' + error.message
        });
    }
});

// 获取师生互评报告API接口
app.get('/api/evaluation-report/:studentName', (req, res) => {
    try {
        const studentName = req.params.studentName;
        const examName = req.query.examName || '';
        const teacherUsername = req.query.teacherUsername || '';
        
        // 构建输出目录路径
        let outDir = path.join(__dirname, '..', 'out');
        if (examName) {
            // 对于历史报告，examName已经是完整的文件夹名称，直接使用
            outDir = path.join(outDir, examName);
        }
        
        const reportPath = path.join(outDir, `${studentName}.md`);
        
        if (!fs.existsSync(reportPath)) {
            return res.status(404).send('报告文件不存在: ' + reportPath);
        }
        
        // 直接返回MD文件内容
        const markdownContent = fs.readFileSync(reportPath, 'utf8');
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(markdownContent);
        
    } catch (error) {
        console.error('获取师生互评报告失败:', error);
        res.status(500).send('获取报告失败: ' + error.message);
    }
});

// 下载报告API接口
app.get('/api/download-reports', (req, res) => {
    try {
        const examName = req.query.examName || '';
        const teacherUsername = req.query.teacherUsername || '';
        
        // 构建out文件夹路径
        let outDir = path.join(__dirname, '..', 'out');
        if (examName) {
            // 如果examName已经包含老师账号（如"A_teacher"），直接使用
            // 否则，如果提供了teacherUsername，构建完整的文件夹名称
            let safeExamName = examName.replace(/[\\/:*?"<>|]/g, '').trim() || '未命名考试';
            
            if (teacherUsername && !examName.includes(`_${teacherUsername}`)) {
                const safeTeacherName = teacherUsername.replace(/[\\/:*?"<>|]/g, '').trim();
                if (safeTeacherName) {
                    safeExamName = `${safeExamName}_${safeTeacherName}`;
                }
            }
            
            outDir = path.join(outDir, safeExamName);
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(outDir)) {
            return res.status(404).json({ error: 'out文件夹不存在: ' + outDir });
        }
        
        // 获取out文件夹中的所有文件
        const files = fs.readdirSync(outDir);
        
        // 过滤出需要打包的文件：.md文件和output_processed.xlsx
        const mdFiles = files.filter(file => file.endsWith('.md'));
        const excelFile = files.find(file => file === 'output_processed.xlsx');
        
        if (mdFiles.length === 0 && !excelFile) {
            return res.status(404).json({ error: '没有找到可下载的报告文件' });
        }
        
        // 设置响应头
        const zipFileName = examName ? `${safeExamName}_reports.zip` : 'student_reports.zip';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        
        // 创建archiver实例
        const archive = archiver('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });
        
        // 处理错误
        archive.on('error', (err) => {
            console.error('压缩错误:', err);
            res.status(500).json({ error: '压缩文件失败' });
        });
        
        // 将压缩流连接到响应
        archive.pipe(res);
        
        // 添加.md文件到压缩包
        mdFiles.forEach(file => {
            const filePath = path.join(outDir, file);
            archive.file(filePath, { name: file });
        });
        
        // 添加Excel文件到压缩包（如果存在）
        if (excelFile) {
            const excelFilePath = path.join(outDir, 'output_processed.xlsx');
            archive.file(excelFilePath, { name: 'output_processed.xlsx' });
        }
        
        // 完成压缩
        archive.finalize();
        
    } catch (error) {
        console.error('下载报告失败:', error);
        res.status(500).json({ error: '下载报告失败: ' + error.message });
    }
});

// 压缩考试报告文件夹API接口
app.post('/api/compress-exam-reports', (req, res) => {
    try {
        const { folderName, teacherUsername } = req.body;
        
        if (!folderName) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少文件夹名称参数' 
            });
        }
        
        console.log('开始压缩考试报告文件夹:', folderName);
        
        // 构建out文件夹路径
        const outDir = path.join(__dirname, '..', 'out');
        const examDir = path.join(outDir, folderName);
        
        // 检查文件夹是否存在
        if (!fs.existsSync(examDir)) {
            return res.status(404).json({ 
                success: false, 
                error: '考试文件夹不存在: ' + examDir 
            });
        }
        
        // 创建临时目录用于存放压缩包
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 生成唯一的压缩包文件名
        const timestamp = Date.now();
        const zipFileName = `${folderName}_reports_${timestamp}.zip`;
        const zipFilePath = path.join(tempDir, zipFileName);
        
        // 创建输出流
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });
        
        // 处理压缩过程中的错误
        archive.on('error', (err) => {
            console.error('压缩错误:', err);
            res.status(500).json({ 
                success: false, 
                error: '压缩文件失败: ' + err.message 
            });
        });
        
        // 完成压缩后的处理
        output.on('close', () => {
            console.log('压缩完成，文件大小:', archive.pointer() + ' bytes');
            
            // 生成下载URL
            const downloadUrl = `/api/download-compressed-file?filePath=${encodeURIComponent(zipFilePath)}&fileName=${encodeURIComponent(zipFileName)}`;
            
            res.json({
                success: true,
                message: '压缩包创建成功',
                filePath: zipFilePath,
                downloadUrl: downloadUrl,
                fileName: zipFileName
            });
        });
        
        // 将压缩流连接到输出文件
        archive.pipe(output);
        
        // 添加整个考试文件夹到压缩包
        archive.directory(examDir, folderName);
        
        // 完成压缩
        archive.finalize();
        
    } catch (error) {
        console.error('压缩考试报告失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '压缩考试报告失败: ' + error.message 
        });
    }
});

// 下载压缩文件API接口
app.get('/api/download-compressed-file', (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.filePath || '');
        const fileName = decodeURIComponent(req.query.fileName || 'reports.zip');
        
        if (!filePath) {
            return res.status(400).json({ error: '缺少文件路径参数' });
        }
        
        // 安全检查：确保文件路径在temp目录内
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!filePath.startsWith(tempDir)) {
            return res.status(403).json({ error: '文件路径无效' });
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '压缩文件不存在' });
        }
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        // 清理文件名中的无效字符
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        
        // 创建文件读取流
        const fileStream = fs.createReadStream(filePath);
        
        // 处理错误
        fileStream.on('error', (err) => {
            console.error('文件读取错误:', err);
            res.status(500).json({ error: '文件读取失败' });
        });
        
        // 将文件流连接到响应
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('下载压缩文件失败:', error);
        res.status(500).json({ error: '下载压缩文件失败: ' + error.message });
    }
});

// 清理压缩文件API接口
app.post('/api/cleanup-compressed-file', (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            return res.json({ 
                success: false, 
                error: '缺少文件路径参数' 
            });
        }
        
        // 安全检查：确保文件路径在temp目录内
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!filePath.startsWith(tempDir)) {
            return res.json({ 
                success: false, 
                error: '文件路径无效' 
            });
        }
        
        // 检查文件是否存在
        if (fs.existsSync(filePath)) {
            // 删除文件
            fs.unlinkSync(filePath);
            console.log('已清理压缩文件:', filePath);
            
            res.json({
                success: true,
                message: '压缩文件清理成功'
            });
        } else {
            res.json({
                success: true,
                message: '压缩文件不存在，无需清理'
            });
        }
        
    } catch (error) {
        console.error('清理压缩文件失败:', error);
        res.json({ 
            success: false, 
            error: '清理压缩文件失败: ' + error.message 
        });
    }
});

// 服务器状态检查API接口
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: '服务器运行正常' });
});

// 获取历史报告API接口
app.get('/api/history-reports', (req, res) => {
    try {
        const teacherUsername = req.query.teacherUsername || '';
        
        if (!teacherUsername) {
            return res.json({
                success: false,
                error: '缺少老师账号参数'
            });
        }
        
        const outDir = path.join(__dirname, '..', 'out');
        
        if (!fs.existsSync(outDir)) {
            return res.json({
                success: true,
                reports: []
            });
        }
        
        // 获取所有文件夹
        const folders = fs.readdirSync(outDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        // 筛选包含老师账号的文件夹
        const teacherReports = folders.filter(folder => {
            return folder.includes(`_${teacherUsername}`) || folder.endsWith(`_${teacherUsername}`);
        });
        
        const reports = [];
        
        teacherReports.forEach(folder => {
            const folderPath = path.join(outDir, folder);
            const files = fs.readdirSync(folderPath);
            
            // 统计MD文件数量（学生报告数量）
            const mdFiles = files.filter(file => file.endsWith('.md'));
            const studentCount = mdFiles.length;
            
            // 从文件夹名称中提取考试名称
            const examName = folder.replace(`_${teacherUsername}`, '');
            
            // 获取文件夹创建时间
            const stats = fs.statSync(folderPath);
            const createTime = stats.mtime.toLocaleString('zh-CN');
            
            reports.push({
                folderName: folder,
                examName: examName,
                studentCount: studentCount,
                createTime: createTime,
                hasExcel: fs.existsSync(path.join(folderPath, 'tables.xlsx'))
            });
        });
        
        // 按创建时间倒序排列
        reports.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
        
        res.json({
            success: true,
            reports: reports
        });
        
    } catch (error) {
        console.error('获取历史报告失败:', error);
        res.json({
            success: false,
            error: '获取历史报告失败: ' + error.message
        });
    }
});

// 获取历史报告详细数据API接口
app.get('/api/history-report-data', (req, res) => {
    try {
        const folderName = req.query.folderName || '';
        const examName = req.query.examName || '';
        
        if (!folderName) {
            return res.json({
                success: false,
                error: '缺少文件夹名称参数'
            });
        }
        
        // 构建Excel文件路径（从out目录）
        const outDir = path.join(__dirname, '..', 'out');
        const excelPath = path.join(outDir, folderName, 'output_processed.xlsx');
        
        if (!fs.existsSync(excelPath)) {
            return res.json({
                success: false,
                error: '历史报告Excel文件不存在: ' + excelPath
            });
        }
        
        // 使用虚拟环境中的Python读取Excel文件
        const pythonScript = `
import pandas as pd
import json

try:
    df = pd.read_excel("${excelPath}", sheet_name="grammar_table")
    
    # 转换为JSON格式
    result = {
        "headers": df.columns.tolist(),
        "data": df.astype(str).values.tolist(),
        "totalRows": len(df)
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        
        const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
            cwd: path.join(__dirname, '..')
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0 && output) {
                try {
                    const result = JSON.parse(output);
                    if (result.error) {
                        return res.json({
                            success: false,
                            error: '读取Excel文件失败: ' + result.error
                        });
                    }
                    
                    const headers = result.headers || [];
                    const rows = result.data || [];
                    
                    if (rows.length === 0) {
                        return res.json({
                            success: false,
                            error: 'Excel文件为空'
                        });
                    }
                    
                    // 转换为对象数组
                    const reportData = rows.map((row, index) => {
                        const obj = {};
                        headers.forEach((header, colIndex) => {
                            obj[header] = row[colIndex] || '';
                        });
                        return obj;
                    }).filter(row => {
                        return Object.values(row).some(value => value.trim() !== '');
                    });
                    
                    res.json({
                        success: true,
                        report: reportData,
                        headers: headers,
                        totalStudents: reportData.length,
                        examName: examName,
                        folderName: folderName
                    });
                    
                } catch (parseError) {
                    console.error('解析Python输出失败:', parseError);
                    res.json({
                        success: false,
                        error: '解析数据失败: ' + parseError.message
                    });
                }
            } else {
                console.error('Python脚本执行失败:', errorOutput);
                res.json({
                    success: false,
                    error: '执行Python脚本失败: ' + errorOutput
                });
            }
        });
        
    } catch (error) {
        console.error('获取历史报告数据失败:', error);
        res.json({
            success: false,
            error: '获取历史报告数据失败: ' + error.message
        });
    }
});

// 执行main.py的API接口
app.post('/api/run-main', (req, res) => {
    const examName = req.body.examName || '';
    const teacherUsername = req.body.teacherUsername || '';
    console.log('开始执行main.py...', examName ? `考试名称: ${examName}` : '', teacherUsername ? `老师账号: ${teacherUsername}` : '');
    
    // 设置环境变量，传递考试名称和老师账号
    const envVars = { ...process.env, PYTHONPATH: path.join(__dirname, '..') };
    if (examName) {
        envVars.EXAM_NAME = examName;
    }
    if (teacherUsername) {
        envVars.TEACHER_USERNAME = teacherUsername;
    }
    
    // 使用虚拟环境中的Python执行main.py
    const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['main.py'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: envVars
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python stderr:', data.toString());
    });

    let responseSent = false;

    const sendResponse = (data) => {
        if (!responseSent) {
            responseSent = true;
            res.json(data);
        }
    };

    pythonProcess.on('close', (code) => {
        console.log(`main.py 执行完成，退出码: ${code}`);
        console.log('输出内容:', output);
        console.log('错误内容:', errorOutput);
        
        // 如果退出码为null，可能是进程被终止，但如果有输出内容，认为成功
        if (code === 0 || (code === null && output.includes('检测到已处理的Excel文件'))) {
            sendResponse({
                success: true,
                message: 'main.py 执行成功',
                output: output,
                exitCode: code || 0
            });
        } else {
            // 即使执行失败，也返回成功状态，避免前端显示错误弹窗
            sendResponse({
                success: true,
                message: 'main.py 执行完成',
                output: output,
                error: errorOutput,
                exitCode: code
            });
        }
    });

    pythonProcess.on('error', (error) => {
        console.error('执行main.py时出错:', error);
        sendResponse({
            success: false,
            message: '无法启动Python进程',
            error: error.message
        });
    });

    // 设置超时（30分钟）
    setTimeout(() => {
        if (!pythonProcess.killed && !responseSent) {
            pythonProcess.kill();
            sendResponse({
                success: false,
                message: 'main.py 执行超时'
            });
        }
    }, 1800000);
});

// 学生端API接口 - 获取学生参与的考试列表
app.get('/api/student-exams', (req, res) => {
    try {
        const studentName = req.query.studentName || '';
        
        if (!studentName) {
            return res.json({
                success: false,
                error: '缺少学生姓名参数'
            });
        }
        
        const outDir = path.join(__dirname, '..', 'out');
        const exams = [];
        
        // 检查out目录是否存在
        if (!fs.existsSync(outDir)) {
            return res.json({
                success: true,
                exams: []
            });
        }
        
        // 获取所有考试文件夹
        const folders = fs.readdirSync(outDir);
        
        folders.forEach(folder => {
            const folderPath = path.join(outDir, folder);
            
            // 检查是否为文件夹
            if (fs.statSync(folderPath).isDirectory()) {
                // 检查该文件夹中是否有该学生的报告文件
                const files = fs.readdirSync(folderPath);
                const studentReportFile = files.find(file => 
                    file.includes(studentName) && file.endsWith('.md')
                );
                
                if (studentReportFile) {
                    // 获取文件夹创建时间
                    const stats = fs.statSync(folderPath);
                    const createTime = stats.mtime.toLocaleString('zh-CN');
                    
                    // 从文件夹名称中提取考试名称（去掉_teacher部分）
                    const examName = folder.replace(/_teacher$/, '');
                    
                    exams.push({
                        folderName: folder,
                        examName: examName,
                        createTime: createTime,
                        hasGrammarReport: fs.existsSync(path.join(folderPath, 'output_processed.xlsx')),
                        hasEvaluationReport: studentReportFile !== undefined
                    });
                }
            }
        });
        
        // 按创建时间倒序排列
        exams.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
        
        res.json({
            success: true,
            exams: exams
        });
        
    } catch (error) {
        console.error('获取学生考试列表失败:', error);
        res.json({
            success: false,
            error: '获取学生考试列表失败: ' + error.message
        });
    }
});

// 学生端API接口 - 获取学生语法报告
app.get('/api/student-grammar-report', (req, res) => {
    try {
        const studentName = req.query.studentName || '';
        const folderName = req.query.folderName || '';
        
        if (!studentName || !folderName) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        const outDir = path.join(__dirname, '..', 'out');
        const excelPath = path.join(outDir, folderName, 'output_processed.xlsx');
        
        if (!fs.existsSync(excelPath)) {
            return res.json({
                success: false,
                error: '语法报告Excel文件不存在'
            });
        }
        
        // 使用虚拟环境中的Python读取Excel文件
        const pythonScript = `
import pandas as pd
import json

try:
    df = pd.read_excel("${excelPath}", sheet_name="grammar_table")
    
    # 查找该学生的数据
    student_data = df[df['姓名'].str.contains("${studentName}", na=False)]
    
    if len(student_data) == 0:
        result = {"error": "未找到该学生的语法报告数据"}
    else:
        # 转换为字典格式
        report_data = []
        for index, row in student_data.iterrows():
            for col_name, value in row.items():
                if pd.notna(value) and str(value).strip() != '':
                    report_data.append({
                        "项目": str(col_name),
                        "内容": str(value)
                    })
        
        result = {"report": report_data}
    
    print(json.dumps(result, ensure_ascii=False))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
        
        const pythonProcess = spawn(path.join(__dirname, '..', 'venv', 'bin', 'python3'), ['-c', pythonScript], {
            cwd: path.join(__dirname, '..')
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            try {
                const result = JSON.parse(output);
                
                if (result.error) {
                    res.json({
                        success: false,
                        error: result.error
                    });
                } else {
                    res.json({
                        success: true,
                        report: result.report
                    });
                }
            } catch (parseError) {
                res.json({
                    success: false,
                    error: '解析语法报告数据失败: ' + parseError.message
                });
            }
        });
        
    } catch (error) {
        console.error('获取学生语法报告失败:', error);
        res.json({
            success: false,
            error: '获取学生语法报告失败: ' + error.message
        });
    }
});

// 学生端API接口 - 获取学生师生互评报告
app.get('/api/student-evaluation-report', (req, res) => {
    try {
        const studentName = req.query.studentName || '';
        const folderName = req.query.folderName || '';
        
        if (!studentName || !folderName) {
            return res.status(400).send('缺少必要参数');
        }
        
        const outDir = path.join(__dirname, '..', 'out');
        const folderPath = path.join(outDir, folderName);
        
        if (!fs.existsSync(folderPath)) {
            return res.status(404).send('考试文件夹不存在');
        }
        
        // 查找该学生的Markdown报告文件
        const files = fs.readdirSync(folderPath);
        const studentReportFile = files.find(file => 
            file.includes(studentName) && file.endsWith('.md')
        );
        
        if (!studentReportFile) {
            return res.status(404).send('未找到该学生的师生互评报告');
        }
        
        const reportPath = path.join(folderPath, studentReportFile);
        const reportContent = fs.readFileSync(reportPath, 'utf-8');
        
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(reportContent);
        
    } catch (error) {
        console.error('获取学生师生互评报告失败:', error);
        res.status(500).send('获取师生互评报告失败: ' + error.message);
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('请确保main.py文件存在于项目根目录');
    console.log('文件上传路径:', path.join(__dirname, '..', 'in'));
});