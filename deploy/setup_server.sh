#!/bin/bash

# 服务器部署脚本
# 在服务器上执行此脚本进行环境配置

echo "开始配置服务器环境..."

# 1. 创建项目目录
mkdir -p /home/ubuntu/EduChatGrader_full_project
cd /home/ubuntu/EduChatGrader_full_project

# 2. 安装Python和必要依赖
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx

# 3. 创建Python虚拟环境
python3 -m venv venv
source venv/bin/activate

# 4. 安装Python依赖
pip install --upgrade pip
pip install -r requirements.txt

# 5. 创建必要的目录结构
mkdir -p in out outputs logs

# 6. 设置文件权限
chmod 755 in out outputs logs
chown -R ubuntu:ubuntu /home/ubuntu/EduChatGrader_full_project

echo "服务器环境配置完成！"