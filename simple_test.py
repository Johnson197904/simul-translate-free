import sys
import time
from http.client import HTTPConnection

def test_server():
    print("测试服务器连接...")
    print("地址: http://127.0.0.1:8765")
    print()
    
    try:
        # 尝试连接
        conn = HTTPConnection('127.0.0.1', 8765, timeout=5)
        conn.request('GET', '/')
        response = conn.getresponse()
        
        print(f"状态码: {response.status}")
        print(f"状态消息: {response.reason}")
        
        if response.status == 200:
            print("[OK] 服务器正常运行")
            print("[OK] 可以访问 http://127.0.0.1:8765")
            return True
        else:
            print(f"[WARN] 服务器返回非200状态: {response.status}")
            return False
            
    except ConnectionRefusedError:
        print("[ERROR] 连接被拒绝")
        print("可能的原因:")
        print("1. 服务器没有运行")
        print("2. 端口被其他程序占用")
        print("3. 防火墙阻止了连接")
        return False
    except Exception as e:
        print(f"[ERROR] 连接错误: {e}")
        return False

if __name__ == "__main__":
    # 等待几秒让服务器启动
    print("等待服务器启动...")
    time.sleep(5)
    
    if test_server():
        print("\n[SUCCESS] 服务器连接成功！")
        print("请在浏览器中访问: http://127.0.0.1:8765")
    else:
        print("\n[FAILED] 连接失败")
        print("建议:")
        print("1. 检查服务器是否正在运行")
        print("2. 尝试重新启动服务器")
        print("3. 尝试不同的端口（如8787）")