import subprocess
import sys
import time

# 快速测试服务器是否能启动
print("启动测试服务器...")
proc = subprocess.Popen(
    [sys.executable, "server.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding='utf-8'
)

time.sleep(2)  # 等待服务器启动

# 查看进程是否还在运行
if proc.poll() is None:
    print("[OK] 服务器正常启动")
    print("正在终止服务器...")
    proc.terminate()
    proc.wait()
    print("测试完成")
else:
    stdout, stderr = proc.communicate()
    print("[ERROR] 服务器异常退出")
    print("STDOUT:", stdout)
    print("STDERR:", stderr)