# 宝塔面板 Node.js 项目配置指南

## 1. 创建网站（基础配置）

在宝塔面板中创建网站：
- **域名**: agent.hongyanink.com
- **根目录**: `/www/wwwroot/agent.hongyanink.com/EduChatGrader_full_project/web`
- **PHP版本**: 纯静态

## 2. 配置 Node.js 项目

### 方法一：使用宝塔Node.js管理器（推荐）

1. **安装Node.js版本管理器**
   - 进入宝塔面板 → 软件商店
   - 搜索 "Node版本管理器" 并安装
   - 安装 Node.js 18.x 版本

2. **添加Node.js项目**
   - 进入宝塔面板 → 网站
   - 点击 "添加站点"
   - 选择 "Node项目"
   - 配置如下：
     ```
     项目名称: EduChatGrader
     项目路径: /www/wwwroot/agent.hongyanink.com/EduChatGrader_full_project/web
     启动选项: server.js
     Node版本: 18.x
     端口: 3000
     运行用户: root
     ```

3. **项目设置**
   - 勾选 "开机自动启动"
   - 勾选 "监听3000端口"
   - 运行命令: `node server.js`

### 方法二：手动配置反向代理

如果使用传统网站配置：

1. **创建网站**
   - 域名: agent.hongyanink.com
   - 根目录: `/www/wwwroot/agent.hongyanink.com/EduChatGrader_full_project/web`

2. **配置反向代理**
   - 进入网站设置 → 反向代理
   - 添加反向代理：
     ```
     代理名称: node_app
     目标URL: http://127.0.0.1:3000
     发送域名: $host
     ```

3. **配置API代理**
   - 添加第二个反向代理：
     ```
     代理名称: api_proxy  
     目标URL: http://127.0.0.1:5000
     发送域名: $host
     代理目录: /api
     ```

## 3. 防火墙配置

在宝塔面板防火墙中开放端口：
- **3000** (Node.js前端)
- **5000** (Python后端)

## 4. 启动服务

### 如果使用systemd服务（已配置）
项目已配置systemd开机自启动，无需额外操作。

### 如果需要宝塔管理
在宝塔Node.js项目管理器中：
- 点击 "启动"
- 点击 "重启"
- 检查运行状态

## 5. 访问测试

配置完成后访问：
- 主界面: http://agent.hongyanink.com
- 或直接: http://agent.hongyanink.com:3000

## 6. 注意事项

1. **端口冲突**: 确保3000和5000端口未被其他程序占用
2. **权限问题**: 确保宝塔面板有权限访问项目目录
3. **依赖安装**: 项目依赖已安装，无需重新安装
4. **开机启动**: systemd服务已配置开机自启动

## 当前服务状态
- Node.js前端: 运行在3000端口 ✅
- Python后端: 运行在5000端口 ✅
- 开机自启动: 已配置 ✅

**推荐使用方法一（宝塔Node.js管理器）**，这样可以通过宝塔面板方便地管理Node.js服务。