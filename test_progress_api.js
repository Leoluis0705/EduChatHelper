const http = require('http');

// 测试进度条API接口
function testProgressAPI() {
    return new Promise((resolve, reject) => {
        const examName = encodeURIComponent('第五次');
        const teacherUsername = encodeURIComponent('teacher');
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `/api/progress?examName=${examName}&teacherUsername=${teacherUsername}`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('进度条API响应:');
                    console.log('总学生数:', result.totalStudents);
                    console.log('当前进度:', result.currentProgress);
                    console.log('百分比:', result.percentage + '%');
                    console.log('tables文件存在:', result.tablesFileExists);
                    
                    if (result.error) {
                        console.log('错误信息:', result.error);
                    }
                    
                    resolve(result);
                } catch (error) {
                    console.error('解析响应失败:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('请求失败:', error);
            reject(error);
        });

        req.end();
    });
}

// 测试服务器状态
function testServerStatus() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/status',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('服务器状态:', result.status);
                    console.log('消息:', result.message);
                    resolve(result);
                } catch (error) {
                    console.error('解析状态响应失败:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('状态检查失败:', error);
            reject(error);
        });

        req.end();
    });
}

// 运行测试
async function runTests() {
    console.log('开始测试进度条接口...\n');
    
    try {
        // 先测试服务器状态
        await testServerStatus();
        console.log('');
        
        // 测试进度条API
        await testProgressAPI();
        
        console.log('\n测试完成！');
    } catch (error) {
        console.error('测试失败:', error);
    }
}

runTests();