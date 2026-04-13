import urllib.request
import urllib.error
import json

def test_server():
    try:
        # 测试健康检查接口
        req = urllib.request.Request('http://127.0.0.1:8765/api/health')
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode('utf-8'))
        print("✅ 服务器健康检查通过:", data)
        
        # 测试首页
        req2 = urllib.request.Request('http://127.0.0.1:8765/')
        response2 = urllib.request.urlopen(req2, timeout=5)
        print(f"✅ 首页访问成功，状态码: {response2.status}")
        
        return True
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP错误: {e.code} - {e.reason}")
        return False
    except urllib.error.URLError as e:
        print(f"❌ URL错误: {e.reason}")
        return False
    except Exception as e:
        print(f"❌ 其他错误: {e}")
        return False

def test_translate():
    try:
        # 测试翻译接口
        data = json.dumps({
            "text": "你好，世界",
            "source": "zh-CN",
            "target": "en"
        }).encode('utf-8')
        
        req = urllib.request.Request(
            'http://127.0.0.1:8765/api/translate',
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode('utf-8'))
        print("✅ 翻译测试成功:", result.get('translated_text', 'N/A'))
        return True
    except Exception as e:
        print(f"❌ 翻译测试失败: {e}")
        return False

if __name__ == "__main__":
    print("=== 测试同声传译服务器连接 ===")
    print("服务器地址: http://127.0.0.1:8765")
    print()
    
    if test_server():
        print("\n✅ 服务器基本功能正常")
        
        if test_translate():
            print("✅ 翻译功能正常")
        else:
            print("⚠️ 翻译功能有问题，但服务器在运行")
    else:
        print("\n❌ 服务器可能没有正确启动")