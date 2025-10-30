#!/bin/bash
# EduChatGrader 服务启动脚本

echo "正在启动 EduChatGrader 服务..."

# 检查Python虚拟环境
if [ ! -d "venv" ]; then
    echo "错误：Python虚拟环境不存在，请先运行安装脚本"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 启动Python后端服务
echo "启动Python后端API服务..."
nohup python start_server.py > logs/python_server.log 2>&1 &

# 等待Python服务启动
sleep 3

# 检查Python服务是否启动
if pgrep -f "python start_server.py" > /dev/null; then
    echo "✅ Python后端服务启动成功"
else
    echo "❌ Python后端服务启动失败"
    exit 1
fi

# 启动Node.js前端服务（如果需要）
if [ -d "web" ]; then
    echo "启动Node.js前端服务..."
    cd web
    nohup npm start > ../logs/node_server.log 2>&1 &
    cd ..
    
    sleep 2
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "✅ Node.js前端服务启动成功"
    else
        echo "⚠️ Node.js前端服务启动失败或不需要"
    fi
fi

echo "🎉 EduChatGrader 服务启动完成"
echo "Python API服务运行在: http://127.0.0.1:5000"
echo "前端服务运行在: http://127.0.0.1:3000"
echo "查看日志: tail -f logs/python_server.log"