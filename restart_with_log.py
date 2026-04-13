import subprocess
import sys
import os
import time

print("同声传译服务器重启脚本")
print("=" * 50)

# 查找并终止现有的python进程（只终止我们的服务器）
try:
    import psutil
    current_pid = os.getpid()
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                cmdline = proc.info['cmdline']
                if cmdline and 'server.py' in ' '.join(cmdline):
                    if proc.info['pid'] != current_pid:
                        print(f"正在终止现有服务器进程 PID: {proc.info['pid']}")
                        proc.terminate()
                        proc.wait(timeout=5)
                        print(f"进程 {proc.info['pid']} 已终止")
        except:
            continue
except ImportError:
    print("psutil未安装，跳过进程检查")

# 等待端口释放
time.sleep(2)

# 启动新服务器
print("\n启动新服务器...")
python_path = r"C:\Users\PC\.workbuddy\binaries\python\versions\3.13.12\python.exe"
script_path = r"C:\Users\PC\WorkBuddy\Claw\simul_translate_free\server.py"

# 使用subprocess启动，并显示输出
process = subprocess.Popen(
    [python_path, script_path],
    cwd=r"C:\Users\PC\WorkBuddy\Claw\simul_translate_free",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1,
    universal_newlines=True
)

print(f"服务器启动命令: {python_path} {script_path}")
print(f"工作目录: {os.getcwd()}")

# 等待几秒然后检查
time.sleep(3)

# 检查进程状态
if process.poll() is None:
    print(f"\n[SUCCESS] 服务器已启动，PID: {process.pid}")
    print("访问地址: http://127.0.0.1:8765")
    print("测试地址: http://localhost:8765")
    
    # 测试连接
    try:
        import http.client
        conn = http.client.HTTPConnection("127.0.0.1", 8765, timeout=5)
        conn.request("GET", "/")
        response = conn.getresponse()
        print(f"HTTP测试: 状态码 {response.status} - {response.reason}")
    except Exception as e:
        print(f"HTTP测试失败: {e}")
        
    print("\n服务已启动。按Ctrl+C停止服务器。")
    
    # 保持脚本运行，显示服务器输出
    try:
        # 非阻塞读取输出
        import threading
        
        def read_output(pipe, label):
            for line in pipe:
                print(f"[SERVER {label}] {line.strip()}")
        
        stdout_thread = threading.Thread(target=read_output, args=(process.stdout, "OUT"))
        stderr_thread = threading.Thread(target=read_output, args=(process.stderr, "ERR"))
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.start()
        stderr_thread.start()
        
        process.wait()
    except KeyboardInterrupt:
        print("\n正在停止服务器...")
        process.terminate()
        
else:
    # 进程已经退出
    stdout, stderr = process.communicate()
    print(f"\n[ERROR] 服务器启动失败")
    print(f"退出码: {process.returncode}")
    if stdout:
        print(f"标准输出: {stdout}")
    if stderr:
        print(f"错误输出: {stderr}")