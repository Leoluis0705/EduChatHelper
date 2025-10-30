#!/bin/bash
# EduChatGrader 开机自启动脚本

echo "正在启动 EduChatGrader 服务..."

# 检查Python后端服务是否已运行
if ! pgrep -f "python start_server.py" > /dev/null; then
    echo "启动Python后端API服务..."
    cd /www/wwwroot/agent.hongyanink.com/EduChatGrader_full_project
    source venv/bin/activate
    nohup python start_server.py > logs/python_server.log 2>&1 &
    echo "✅ Python后端服务已启动"
else
    echo "✅ Python后端服务已在运行"
fi

# 等待Python服务启动
sleep 5

# 检查Node.js前端服务是否已运行
if ! pgrep -f "node server.js" > /dev/null; then
    echo "启动Node.js前端服务..."
    cd /www/wwwroot/agent.hongyanink.com/EduChatGrader_full_project/web
    nohup node server.js > ../logs/node_server.log 2>&1 &
    echo "✅ Node.js前端服务已启动"
else
    echo "✅ Node.js前端服务已在运行"
fi

# 检查服务状态
sleep 3
echo "服务状态检查:"
pgrep -f "python start_server.py" && echo "Python后端服务: ✅ 运行中" || echo "Python后端服务: ❌ 未运行"
pgrep -f "node server.js" && echo "Node.js前端服务: ✅ 运行中" || echo "Node.js前端服务: ❌ 未运行"

echo "EduChatGrader 服务启动完成"