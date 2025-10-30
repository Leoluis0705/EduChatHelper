document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const removeBtn = document.getElementById('removeBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    let selectedFile = null;
    
    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // 文件选择变化
    fileInput.addEventListener('change', function(e) {
        handleFileSelection(e.target.files[0]);
    });
    
    // 拖拽功能
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });
    
    // 移除文件
    removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        resetFileSelection();
    });
    
    // 确认上传
    confirmBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (selectedFile) {
            handleFileUpload(selectedFile);
        }
    });
    
    function handleFileSelection(file) {
        if (!file) return;
        
        // 检查文件类型
        if (file.type !== 'application/pdf') {
            alert('请选择PDF文件！');
            return;
        }
        
        // 保存选中的文件
        selectedFile = file;
        
        // 显示文件信息
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
        
        console.log('选择的文件:', file.name, file.size, file.type);
    }
    
    function resetFileSelection() {
        fileInput.value = '';
        fileInfo.style.display = 'none';
        selectedFile = null;
    }
    
    function handleFileUpload(file) {
        const originalText = uploadArea.querySelector('.upload-text');
        const originalHint = uploadArea.querySelector('.upload-hint');
        
        // 禁用确认按钮
        confirmBtn.disabled = true;
        confirmBtn.textContent = '上传中...';
        
        originalText.textContent = '上传中...';
        originalHint.textContent = '正在上传文件到服务器';
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('pdfFile', file);
        
        // 发送到服务器
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                originalText.textContent = '上传成功！';
                originalHint.textContent = data.message;
                confirmBtn.textContent = '上传完成';
                
                // 跳转到Excel上传页面
                setTimeout(() => {
                    window.location.href = 'upload-excel.html';
                }, 1000);
            } else {
                throw new Error(data.error || '上传失败');
            }
        })
        .catch(error => {
            console.error('上传错误:', error);
            originalText.textContent = '上传失败';
            originalHint.textContent = error.message || '请检查服务器连接';
            confirmBtn.textContent = '重新上传';
            confirmBtn.disabled = false;
            
            // 5秒后恢复原始状态
            setTimeout(() => {
                originalText.textContent = '请传入天学网学生报告';
                originalHint.textContent = '点击或拖拽PDF文件到此处';
            }, 5000);
        });
    }
});