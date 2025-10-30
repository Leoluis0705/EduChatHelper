# 英语作文自动批改系统 - 服务器部署指南

## 项目概述
本项目是一个英语作文自动批改系统，包含：
- 前端网页界面（HTML/CSS/JavaScript）
- Node.js后端服务器
- Python批改核心（main.py）

## 服务器部署步骤

### 1. 服务器环境准备

#### 服务器要求
- Ubuntu 20.04+ 或 CentOS 7+
- 至少2GB内存
- 至少20GB硬盘空间
- Python 3.8+
- Node.js 14+

#### 推荐服务器路径
```
/home/ubuntu/EduChatGrader_full_project/
```

### 2. 上传项目文件

将整个项目文件夹上传到服务器：
```bash
scp -r EduChatGrader_full_project/ ubuntu@your-server-ip:/home/ubuntu/
```

### 3. 服务器环境配置

#### 执行自动配置脚本
```bash
cd /home/ubuntu/EduChatGrader_full_project/deploy
chmod +x setup_server.sh
./setup_server.sh
```

#### 手动配置步骤（如果自动脚本失败）

1. **安装系统依赖**
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx nodejs npm
```

2. **创建Python虚拟环境**
```bash
cd /home/ubuntu/EduChatGrader_full_project
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **安装Node.js依赖**
```bash
cd web
npm install
```

4. **创建必要目录**
```bash
mkdir -p in out outputs logs
chmod 755 in out outputs logs
```

### 4. Nginx配置

1. **复制Nginx配置文件**
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/agent.hongyanink.com
sudo ln -s /etc/nginx/sites-available/agent.hongyanink.com /etc/nginx/sites-enabled/
```

2. **测试并重启Nginx**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 5. 系统服务配置

1. **创建系统服务文件**
```bash
sudo cp deploy/app.service /etc/systemd/system/educhat-grader.service
```

2. **启用并启动服务**
```bash
sudo systemctl daemon-reload
sudo systemctl enable educhat-grader
sudo systemctl start educhat-grader
```

### 6. 域名和SSL配置

1. **域名解析**
将 `agent.hongyanink.com` 解析到服务器IP地址

2. **SSL证书（可选）**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d agent.hongyanink.com
```

### 7. 服务管理命令

#### 查看服务状态
```bash
sudo systemctl status educhat-grader
```

#### 重启服务
```bash
sudo systemctl restart educhat-grader
```

#### 查看日志
```bash
sudo journalctl -u educhat-grader -f
```

### 8. 文件上传流程

1. **用户访问**：`https://agent.hongyanink.com`
2. **上传PDF**：通过网页界面上传文件
3. **自动处理**：
   - 文件保存到 `/home/ubuntu/EduChatGrader_full_project/in/1.pdf`
   - 自动执行 `main.py` 进行批改
   - 生成报告到 `out/` 和 `outputs/` 目录

### 9. 目录结构说明

```
EduChatGrader_full_project/
├── web/                 # 前端文件
│   ├── index.html       # 主页面
│   ├── processing.html # 处理页面
│   ├── result.html      # 结果页面
│   ├── server.js        # Node.js服务器
│   └── package.json     # Node.js依赖
├── in/                  # 上传文件目录
├── out/                 # 输出报告目录
├── outputs/             # 处理结果目录
├── deploy/              # 部署配置文件
├── main.py              # 主批改程序
└── requirements.txt     # Python依赖
```

### 10. 故障排除

#### 常见问题

1. **端口占用**
```bash
sudo netstat -tulpn | grep :3000
```

2. **文件权限问题**
```bash
sudo chown -R ubuntu:ubuntu /home/ubuntu/EduChatGrader_full_project
```

3. **Python依赖问题**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

4. **Node.js依赖问题**
```bash
cd web
npm install
```

#### 日志查看
- Node.js服务日志：`sudo journalctl -u educhat-grader -f`
- Nginx日志：`sudo tail -f /var/log/nginx/error.log`
- 应用日志：`tail -f /home/ubuntu/EduChatGrader_full_project/logs/app.log`

### 11. 备份和恢复

#### 定期备份
```bash
# 备份项目文件
tar -czf educhat-backup-$(date +%Y%m%d).tar.gz EduChatGrader_full_project/
```

#### 数据恢复
```bash
tar -xzf educhat-backup-YYYYMMDD.tar.gz -C /home/ubuntu/
```

## 技术支持

如有问题，请检查：
1. 服务器网络连接
2. 服务运行状态
3. 文件权限设置
4. 日志错误信息

部署完成后，即可通过 `https://agent.hongyanink.com` 访问系统。