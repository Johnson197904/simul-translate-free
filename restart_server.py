#!/usr/bin/env python3
"""
重启同声传译服务器脚本
"""

import subprocess
import time
import sys
import os
from pathlib import Path

def check_port(port=8765):
    """检查端口是否被占用"""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        return result == 0  # 0表示端口被占用
    except:
        return False

def kill_process_on_port(port=8765):
    """杀死占用端口的进程"""
    try:
        import psutil
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                for conn in proc.connections():
                    if conn.laddr.port == port:
                        print(f"终止占用端口{port}的进程: PID={proc.pid}, 名称={proc.name()}")
                        proc.kill()
                        time.sleep(1)
                        return True
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
    except ImportError:
        print("未安装psutil，跳过进程检查")
    return False

def start_server():
    """启动服务器"""
    # 获取当前目录
    current_dir = Path(__file__).parent
    server_path = current_dir / "server.py"
    
    if not server_path.exists():
        print(f"错误: 找不到服务器文件 {server_path}")
        return False
    
    # 杀死可能占用端口的进程
    if check_port(8765):
        kill_process_on_port(8765)
    
    print("正在启动同声传译服务器...")
    
    try:
        # 启动服务器进程
        python_exe = r"C:\Users\PC\.workbuddy\binaries\python\versions\3.13.12\python.exe"
        
        cmd = [python_exe, str(server_path)]
        
        # 在新控制台窗口启动
        if os.name == 'nt':  # Windows
            # 使用CREATE_NEW_CONSOLE选项
            proc_info = subprocess.STARTUPINFO()
            proc_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            proc_info.wShowWindow = subprocess.SW_SHOWMINIMIZED
            
            process = subprocess.Popen(
                cmd,
                cwd=str(current_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                startupinfo=proc_info,
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            # 非Windows系统
            process = subprocess.Popen(
                cmd,
                cwd=str(current_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
        
        print(f"服务器进程已启动，PID={process.pid}")
        
        # 等待几秒，检查服务器是否启动成功
        time.sleep(3)
        
        # 检查端口是否开始监听
        if check_port():
            print(f"✅ 服务器启动成功！访问地址: http://127.0.0.1:8765")
            print("按Ctrl+C停止服务器")
            
            # 保持程序运行
            try:
                while True:
                    time.sleep(1)
                    if process.poll() is not None:
                        print("服务器进程已退出")
                        break
            except KeyboardInterrupt:
                print("\n正在停止服务器...")
                process.terminate()
                process.wait()
                print("服务器已停止")
                return True
        else:
            print("❌ 服务器可能启动失败，端口未监听")
            stderr_output = process.stderr.read()
            if stderr_output:
                print("错误输出:", stderr_output)
            process.terminate()
            return False
            
    except Exception as e:
        print(f"启动服务器失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("同声传译服务器重启工具")
    print("=" * 50)
    
    success = start_server()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)