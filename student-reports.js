let examsData = [];
let currentExam = null;
let currentStudent = null;

function logout() {
    // 清除本地存储的登录信息
    localStorage.removeItem('currentUser');
    // 跳转到首页登录页面
    window.location.href = 'index.html';
}

// 页面加载时获取考试数据
document.addEventListener('DOMContentLoaded', function() {
    loadExamsData();
    
    // 绑定标签页切换事件
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
});

// 加载考试数据
function loadExamsData() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const studentName = currentUser.username || '';
    
    if (!studentName) {
        document.getElementById('examGrid').innerHTML = '<div class="error">未登录或用户信息错误</div>';
        return;
    }
    
    currentStudent = studentName;
    
    // 调用API获取学生参与的考试列表
    fetch(`/api/student-exams?studentName=${encodeURIComponent(studentName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('API响应数据:', data);
            if (data.success && data.exams) {
                examsData = data.exams;
                displayExamGrid(examsData);
            } else {
                showError('无法加载考试数据: ' + (data.error || '未知错误'));
            }
        })
        .catch(error => {
            console.error('加载考试数据失败:', error);
            showError('网络错误: ' + error.message);
        });
}

// 显示考试网格
function displayExamGrid(exams) {
    const grid = document.getElementById('examGrid');
    
    if (exams.length === 0) {
        grid.innerHTML = '<div class="no-exams">暂无考试报告</div>';
        return;
    }
    
    grid.innerHTML = '';
    
    exams.forEach((exam, index) => {
        const examBox = document.createElement('div');
        examBox.className = 'exam-box';
        examBox.innerHTML = `
            <h3>${exam.examName}</h3>
            <p>考试时间: ${exam.createTime}</p>
        `;
        examBox.onclick = () => selectExam(exam);
        
        grid.appendChild(examBox);
    });
}

// 选择考试
function selectExam(exam) {
    currentExam = exam;
    
    // 隐藏欢迎消息，显示报告内容
    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('reportContent').style.display = 'block';
    
    // 显示学生基本信息
    displayStudentInfo(currentStudent, exam);
    
    // 默认显示语法报告
    switchTab('grammar');
}

// 显示学生基本信息
function displayStudentInfo(studentName, exam) {
    const infoGrid = document.getElementById('infoGrid');
    infoGrid.innerHTML = '';
    
    const basicInfo = [
        { label: '姓名', value: studentName },
        { label: '考试名称', value: exam.examName },
        { label: '考试时间', value: exam.createTime }
    ];
    
    basicInfo.forEach(info => {
        const infoItem = document.createElement('div');
        infoItem.className = 'info-item';
        infoItem.innerHTML = `
            <span class="info-label">${info.label}</span>
            <span class="info-value">${info.value}</span>
        `;
        infoGrid.appendChild(infoItem);
    });
}

// 切换标签页
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName + 'Tab');
    });
    
    // 加载对应标签页的内容
    if (currentExam && currentStudent) {
        if (tabName === 'grammar') {
            loadGrammarReport(currentStudent, currentExam);
        } else if (tabName === 'evaluation') {
            loadEvaluationReport(currentStudent, currentExam);
        }
    }
}

// 加载语法报告
function loadGrammarReport(studentName, exam) {
    const grammarContent = document.getElementById('grammarContent');
    grammarContent.innerHTML = '<div class="loading"><div class="spinner"></div>正在加载语法报告...</div>';
    
    fetch(`/api/student-grammar-report?studentName=${encodeURIComponent(studentName)}&folderName=${encodeURIComponent(exam.folderName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.report) {
                displayGrammarReport(data.report);
            } else {
                grammarContent.innerHTML = '<div class="no-data">暂无语法报告数据</div>';
            }
        })
        .catch(error => {
            grammarContent.innerHTML = '<div class="no-data">加载语法报告失败</div>';
        });
}

// 显示语法报告
function displayGrammarReport(reportData) {
    const grammarContent = document.getElementById('grammarContent');
    
    if (!reportData || reportData.length === 0) {
        grammarContent.innerHTML = '<div class="no-data">暂无语法报告数据</div>';
        return;
    }
    
    // 提取各个模块的数据
    let data = {};
    reportData.forEach((item) => {
        const key = item['项目'] || '';
        const value = item['内容'] || '';
        if (key && value) {
            data[key] = value;
        }
    });
    
    let html = '<div class="grammar-report" style="text-align: left;">';
    
    // 第一部分：基本信息
    html += '<div class="basic-info-section">';
    html += '<h4>基本信息</h4>';
    html += '<div class="info-boxes">';
    
    // 基本信息方框
    const basicInfoFields = [
        { key: '序号', label: '序号' },
        { key: '学校', label: '学校' },
        { key: '班级', label: '班级' },
        { key: '姓名', label: '姓名' },
        { key: '学号', label: '学号' },
        { key: '作答时间', label: '作答时间' }
    ];
    
    basicInfoFields.forEach(field => {
        html += '<div class="info-box">';
        html += `<div class="box-header">${field.label}</div>`;
        html += `<div class="box-content">${data[field.key] || 'N/A'}</div>`;
        html += '</div>';
    });
    
    html += '</div>';
    html += '</div>';
    
    // 第二部分：得分信息
    if (data['得分']) {
        html += '<div class="score-section" style="text-align: center;">';
        html += '<h4>得分</h4>';
        html += `<div class="score-value">${data['得分'] || 'N/A'}</div>`;
        if (data['等级']) {
            html += `<div style="font-size: 1.2rem; color: #666; margin-top: 10px;">等级：${data['等级']}</div>`;
        }
        html += '</div>';
    }
    
    // 第三部分：我的原文
    if (data['我的原文']) {
        html += '<div class="original-text-section">';
        html += '<h4>我的原文</h4>';
        html += `<div class="original-text">${data['我的原文']}</div>`;
        html += '</div>';
    }
    
    // 第四部分：语法错误
    if (data['语法错误']) {
        html += '<div class="grammar-errors-section">';
        html += '<h4>语法错误</h4>';
        let grammarErrors = data['语法错误'];
        grammarErrors = grammarErrors.replace(/^（[^）]*）/, '');
        html += `<div class="grammar-errors">${grammarErrors}</div>`;
        html += '</div>';
    }
    
    // 第五部分：单句点评
    if (data['单句点评']) {
        html += '<div class="sentence-review-section">';
        html += '<h4>单句点评</h4>';
        html += formatSentenceReview(data['单句点评']);
        html += '</div>';
    }
    
    // 第六部分：更多表达
    if (data['更多表达']) {
        html += '<div class="expression-section">';
        html += '<h4>更多表达</h4>';
        html += formatExpressionList(data['更多表达']);
        html += '</div>';
    }
    
    html += '</div>';
    grammarContent.innerHTML = html;
}

// 格式化单句点评
function formatSentenceReview(content) {
    const lines = content.split('\n');
    let html = '<div class="sentence-review">';
    
    lines.forEach(line => {
        line = line.trim();
        if (line) {
            if (line.match(/^\d+\./)) {
                const number = line.split('.')[0];
                const text = line.substring(line.indexOf('.') + 1).trim();
                html += `<div class="sentence-item"><span class="sentence-number">${number}</span> ${text}</div>`;
            } else if (line) {
                html += `<div class="sentence-item">${line}</div>`;
            }
        }
    });
    
    html += '</div>';
    return html;
}

// 格式化更多表达
function formatExpressionList(content) {
    const lines = content.split('\n');
    let html = '<div class="expression-list">';
    let currentOriginal = '';
    let currentExpression = '';
    
    lines.forEach(line => {
        line = line.trim();
        if (line) {
            if (line.includes('我的原文:')) {
                if (currentOriginal && currentExpression) {
                    html += `<div class="expression-pair"><div class="original">${currentOriginal}</div><div class="expression">${currentExpression}</div></div>`;
                }
                currentOriginal = line.replace('我的原文:', '').trim();
                currentExpression = '';
            } else if (line.includes('更多表达:')) {
                currentExpression = line.replace('更多表达:', '').trim();
            }
        }
    });
    
    if (currentOriginal && currentExpression) {
        html += `<div class="expression-pair"><div class="original">${currentOriginal}</div><div class="expression">${currentExpression}</div></div>`;
    }
    
    html += '</div>';
    return html;
}

// 加载师生互评报告
function loadEvaluationReport(studentName, exam) {
    const evaluationContent = document.getElementById('evaluationContent');
    evaluationContent.innerHTML = '<div class="loading"><div class="spinner"></div>正在加载师生互评报告...</div>';
    
    fetch(`/api/student-evaluation-report?studentName=${encodeURIComponent(studentName)}&folderName=${encodeURIComponent(exam.folderName)}`)
        .then(response => {
            if (!response.ok) throw new Error('报告不存在');
            return response.text();
        })
        .then(markdown => {
            const reportData = parseMarkdownReport(markdown);
            displayEvaluationReport(reportData);
        })
        .catch(error => {
            console.error('加载师生互评报告失败:', error);
            evaluationContent.innerHTML = '<div class="no-data">加载师生互评报告失败: ' + error.message + '</div>';
        });
}

// 解析Markdown报告内容
function parseMarkdownReport(markdown) {
    const data = {};
    const lines = markdown.split('\n');
    let currentSection = '';
    let currentContent = [];
    
    lines.forEach(line => {
        line = line.trim();
        
        // 检测模块标题
        if (line.includes('分项得分')) {
            currentSection = '分项得分';
            currentContent = [];
        } else if (line.includes('格式检查')) {
            currentSection = '格式检查';
            currentContent = [];
        } else if (line.includes('综合评价')) {
            currentSection = '综合评价';
            currentContent = [];
        } else if (line.includes('亮点（优先肯定）')) {
            currentSection = '亮点（优先肯定）';
            currentContent = [];
        } else if (line.includes('易错点（具体可改方向）')) {
            currentSection = '易错点（具体可改方向）';
            currentContent = [];
        } else if (line.includes('学生画像（学习建议）')) {
            currentSection = '学生画像（学习建议）';
            currentContent = [];
        } else if (line.includes('建议方向')) {
            currentSection = '建议方向';
            currentContent = [];
        }
        // 提取具体项目数据
        else if (line.includes('内容：')) {
            data['内容得分'] = extractScoreValue(line, '内容：');
        } else if (line.includes('结构：')) {
            data['结构得分'] = extractScoreValue(line, '结构：');
        } else if (line.includes('内容格式') || line.includes('**内容格式**')) {
            data['内容格式'] = extractFormatContent(lines, currentSection, '内容格式');
        } else if (line.includes('结构格式') || line.includes('**结构格式**')) {
            data['结构格式'] = extractFormatContent(lines, currentSection, '结构格式');
        } else if (line.includes('**总分**：')) {
            data['总分'] = extractTotalValue(line, '**总分**：');
        } else if (line.includes('**等级**：')) {
            data['等级'] = extractGradeValue(line, '**等级**：');
        } else if (line.includes('**简评**：')) {
            data['简评'] = extractCommentValue(line, '**简评**：');
        } else if (line.includes('词汇水平：')) {
            data['词汇水平'] = extractLevelValue(line, '词汇水平：');
        } else if (line.includes('写作风格：')) {
            data['写作风格'] = extractStyleValue(line, '写作风格：');
        }
        // 收集模块内容
        else if (currentSection && line && !line.startsWith('#') && !line.startsWith('##') && !line.startsWith('###')) {
            if (line) {
                currentContent.push(line);
            }
        }
        
        // 保存模块内容
        if (currentSection && currentContent.length > 0) {
            data[currentSection] = currentContent.join('\n');
        }
    });
    
    return data;
}

// 从文本行中提取分数值
function extractScoreValue(line, key) {
    const regex = new RegExp(`${key}\\s*(\\d+)`);
    const match = line.match(regex);
    return match ? match[1] : 'N/A';
}

// 提取格式检查内容
function extractFormatContent(lines, currentSection, key) {
    let content = '';
    let inFormatSection = false;
    let foundKey = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes(key)) {
            foundKey = true;
            inFormatSection = true;
            continue;
        }
        
        if (inFormatSection) {
            if (line.startsWith('##') || line.startsWith('#') || (line.includes('格式扣分合计'))) {
                break;
            }
            
            if (line && line.startsWith('-') && line.includes('缺失')) {
                const cleanLine = line.replace(/^-/, '').replace(/\*\*/g, '').trim();
                if (cleanLine) {
                    content += cleanLine + '\n';
                }
            }
        }
    }
    
    if (!foundKey) {
        return 'N/A';
    }
    
    return content.trim() || '无缺失项';
}

// 提取总分
function extractTotalValue(line, key) {
    const escapedKey = key.replace(/\*/g, '\\*');
    const regex = new RegExp(`${escapedKey}\\s*：?\\s*(\\d+)`);
    const match = line.match(regex);
    return match ? match[1] : 'N/A';
}

// 提取等级
function extractGradeValue(line, key) {
    const escapedKey = key.replace(/\*/g, '\\*');
    const regex = new RegExp(`${escapedKey}\\s*：?\\s*([A-F][+-]?)`);
    const match = line.match(regex);
    return match ? match[1] : 'N/A';
}

// 提取简评
function extractCommentValue(line, key) {
    const escapedKey = key.replace(/\*/g, '\\*');
    const regex = new RegExp(`${escapedKey}\\s*：?\\s*(.+)`);
    const match = line.match(regex);
    if (match) {
        return match[1].replace(/\*\*/g, '').trim();
    }
    return 'N/A';
}

// 提取词汇水平
function extractLevelValue(line, key) {
    const regex = new RegExp(`${key}\\s*：?\\s*([A-Z]\\d?)`);
    const match = line.match(regex);
    return match ? match[1] : 'N/A';
}

// 提取写作风格
function extractStyleValue(line, key) {
    const regex = new RegExp(`${key}\\s*：?\\s*(.+)`);
    const match = line.match(regex);
    return match ? match[1].trim() : 'N/A';
}

// 显示师生互评报告
function displayEvaluationReport(reportData) {
    const evaluationContent = document.getElementById('evaluationContent');
    
    if (!reportData || Object.keys(reportData).length === 0) {
        evaluationContent.innerHTML = '<div class="no-data">暂无师生互评报告数据</div>';
        return;
    }
    
    let html = '<div class="evaluation-report" style="text-align: left;">';
    
    // 第一部分：分项得分
    if (reportData['内容得分'] || reportData['结构得分']) {
        html += '<div class="score-section">';
        html += '<h4>分项得分</h4>';
        html += '<div class="score-boxes">';
        
        if (reportData['内容得分']) {
            html += '<div class="info-box">';
            html += '<div class="box-header">内容得分</div>';
            html += `<div class="box-content">${reportData['内容得分']}</div>`;
            html += '</div>';
        }
        
        if (reportData['结构得分']) {
            html += '<div class="info-box">';
            html += '<div class="box-header">结构得分</div>';
            html += `<div class="box-content">${reportData['结构得分']}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
    }
    
    // 第二部分：格式检查
    if (reportData['内容格式'] || reportData['结构格式']) {
        html += '<div class="format-section">';
        html += '<h4>格式检查</h4>';
        html += '<div class="format-boxes">';
        
        if (reportData['内容格式']) {
            html += '<div class="info-box left-align">';
            html += '<div class="box-header">内容格式</div>';
            html += `<div class="box-content">${reportData['内容格式']}</div>`;
            html += '</div>';
        }
        
        if (reportData['结构格式']) {
            html += '<div class="info-box left-align">';
            html += '<div class="box-header">结构格式</div>';
            html += `<div class="box-content">${reportData['结构格式']}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
    }
    
    // 第三部分：综合评价
    if (reportData['总分'] || reportData['等级'] || reportData['简评']) {
        html += '<div class="comprehensive-section">';
        html += '<h4>综合评价</h4>';
        html += '<div class="comprehensive-boxes">';
        
        if (reportData['总分']) {
            html += '<div class="info-box">';
            html += '<div class="box-header">总分</div>';
            html += `<div class="box-content">${reportData['总分']}</div>`;
            html += '</div>';
        }
        
        if (reportData['等级']) {
            html += '<div class="info-box">';
            html += '<div class="box-header">等级</div>';
            html += `<div class="box-content">${reportData['等级']}</div>`;
            html += '</div>';
        }
        
        if (reportData['简评']) {
            html += '<div class="info-box left-align">';
            html += '<div class="box-header">简评</div>';
            html += `<div class="box-content">${reportData['简评']}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
    }
    
    // 第四部分：亮点
    if (reportData['亮点（优先肯定）']) {
        html += '<div class="highlight-section">';
        html += '<h4>亮点</h4>';
        html += `<div class="plain-text">${reportData['亮点（优先肯定）']}</div>`;
        html += '</div>';
    }
    
    // 第五部分：易错点
    if (reportData['易错点（具体可改方向）']) {
        html += '<div class="error-section">';
        html += '<h4>易错点（具体可改方向）</h4>';
        html += `<div class="plain-text">${reportData['易错点（具体可改方向）']}</div>`;
        html += '</div>';
    }
    
    // 第六部分：学生画像
    if (reportData['词汇水平'] || reportData['写作风格'] || reportData['学生画像（学习建议）']) {
        html += '<div class="profile-section">';
        html += '<h4>学生画像</h4>';
        html += '<div class="profile-boxes">';
        
        if (reportData['词汇水平']) {
            html += '<div class="info-box">';
            html += '<div class="box-header">词汇水平</div>';
            html += `<div class="box-content">${reportData['词汇水平']}</div>`;
            html += '</div>';
        }
        
        if (reportData['写作风格']) {
            html += '<div class="info-box left-align">';
            html += '<div class="box-header">写作风格</div>';
            html += `<div class="box-content">${reportData['写作风格']}</div>`;
            html += '</div>';
        }
        
        if (reportData['学生画像（学习建议）']) {
            html += '<div class="info-box left-align">';
            html += '<div class="box-header">学习建议</div>';
            html += `<div class="box-content">${reportData['学生画像（学习建议）']}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        html += '</div>';
    }
    
    // 第七部分：建议方向
    if (reportData['建议方向']) {
        html += '<div class="suggestion-section">';
        html += '<h4>建议方向</h4>';
        html += `<div class="plain-text">${reportData['建议方向']}</div>`;
        html += '</div>';
    }
    
    html += '</div>';
    evaluationContent.innerHTML = html;
}

// 显示错误信息
function showError(message) {
    const grid = document.getElementById('examGrid');
    grid.innerHTML = `<div class="error">${message}</div>`;
}