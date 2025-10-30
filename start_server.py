#!/usr/bin/env python3
"""
EduChatGrader Web Server
启动Python后端API服务
"""

import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import pandas as pd
import yaml
from settings import paths, sheets, modelconf
from educhat_client import EduChatClient
from aggregator import aggregate_all
from report_builder import write_excel, write_markdown
from prompts import CONTENT_TABLE_SYSTEM, CONTENT_TABLE_USER_TMPL, STRUCTURE_TABLE_SYSTEM, STRUCTURE_TABLE_USER_TMPL
from pydantic import BaseModel
import asyncio
import json
from pydantic import ValidationError

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

class Row(BaseModel):
    维度: str
    满分: int
    得分: int
    扣分原因: str
    建议: str

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'xlsx', 'xls', 'pdf'}

@app.route('/')
def index():
    return jsonify({
        "status": "running",
        "service": "EduChatGrader API",
        "version": "1.0.0"
    })

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/upload', methods=['POST'])
def upload_file():
    """处理文件上传（兼容前端Node.js服务）"""
    try:
        if 'pdfFile' not in request.files:
            return jsonify({"error": "没有接收到文件"}), 400
        
        file = request.files['pdfFile']
        if file.filename == '':
            return jsonify({"error": "没有选择文件"}), 400
        
        if file and allowed_file(file.filename):
            # 确保in目录存在
            in_dir = os.path.join(os.path.dirname(__file__), 'in')
            os.makedirs(in_dir, exist_ok=True)
            
            # 保存文件为1.pdf
            filename = '1.pdf'
            filepath = os.path.join(in_dir, filename)
            file.save(filepath)
            
            return jsonify({
                "success": True,
                "message": "文件已成功保存到in文件夹并重命名为1.pdf",
                "originalName": file.filename,
                "savedPath": filepath
            })
        
        return jsonify({"error": "只允许上传PDF文件"}), 400
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/process', methods=['POST'])
def process_files():
    """处理上传的文件并生成评分报告"""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # 返回基本信息，不调用AI处理（需要配置API密钥）
            return jsonify({
                "status": "success",
                "filename": filename,
                "message": "文件上传成功，请配置API密钥后启用AI评分功能"
            })
        
        return jsonify({"error": "Invalid file type"}), 400
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def process_file(filepath):
    """处理文件的核心逻辑"""
    # 这里实现文件处理逻辑
    return {"message": "File processed successfully", "path": filepath}

if __name__ == '__main__':
    # 确保上传目录存在
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # 启动Flask服务器
    host = os.getenv('SERVER_HOST', '0.0.0.0')
    port = int(os.getenv('SERVER_PORT', 5000))
    
    print(f"Starting EduChatGrader server on {host}:{port}")
    app.run(host=host, port=port, debug=False)