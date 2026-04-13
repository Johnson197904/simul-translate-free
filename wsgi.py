"""
WSGI entry point for Render deployment.
使用 gevent.pywsgi 运行服务，支持静态文件和 API。
"""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# 确保模块路径正确
BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
import sys
sys.path.insert(0, str(BASE_DIR))

# 延迟导入 server 模块的核心逻辑
from server import (
    LANGUAGES, PROVIDERS,
    TranslationError, perform_translation,
    LANGUAGE_DETECTION_AVAILABLE,
)
try:
    from language_detector import detect_text_language, detect_text_lang_simple
except ImportError:
    detect_text_language = None
    detect_text_lang_simple = None


def read_body(environ):
    """读取请求体"""
    size = int(environ.get('CONTENT_LENGTH', 0))
    if size == 0:
        return b''
    return environ['wsgi.input'].read(size)


def json_response(status_code, payload, cors=True):
    """构建 JSON 响应"""
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers = [('Content-Type', 'application/json; charset=utf-8')]
    if cors:
        headers += [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type'),
        ]
    headers.append(('Content-Length', str(len(body))))
    return status_code, headers, body


def serve_static(environ, start_response):
    """服务静态文件"""
    path = environ.get('PATH_INFO', '/')
    if path == '/':
        path = '/index.html'

    file_path = WEB_DIR / path.lstrip('/')
    if not file_path.is_file():
        file_path = WEB_DIR / 'index.html'

    if file_path.is_file():
        ext = file_path.suffix.lower()
        mime_types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
        }
        mime = mime_types.get(ext, 'application/octet-stream')
        with open(file_path, 'rb') as f:
            body = f.read()
        start_response('200 OK', [('Content-Type', mime), ('Content-Length', str(len(body)))])
        return [body]
    else:
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'Not Found']


def application(environ, start_response):
    """主 WSGI 应用"""
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')

    # CORS preflight
    if method == 'OPTIONS':
        start_response('200 OK', [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type'),
        ])
        return [b'']

    # 静态文件
    if method == 'GET' and (
        path.startswith('/web/') or
        path in ('/', '/index.html', '/style.css', '/script.js',
                 '/manifest.json', '/icon-192.png', '/favicon.ico') or
        '.' in path.split('/')[-1]
    ):
        return serve_static(environ, start_response)

    # API: health
    if path == '/api/health':
        status, headers, body = json_response(200, {'ok': True, 'message': 'server running'})
        start_response(f'{status} OK', headers)
        return [body]

    # API: languages
    if path == '/api/languages':
        status, headers, body = json_response(200, {'languages': LANGUAGES, 'providers': PROVIDERS})
        start_response(f'{status} OK', headers)
        return [body]

    # API: detect
    if path == '/api/detect' and method == 'POST':
        try:
            body_bytes = read_body(environ)
            body = json.loads(body_bytes.decode('utf-8'))
            text = str(body.get('text', ''))
            if not text:
                status, headers, body = json_response(400, {'ok': False, 'error': '缺少文本内容'})
                start_response(f'{status} Bad Request', headers)
                return [body]
            if LANGUAGE_DETECTION_AVAILABLE and detect_text_language:
                result = detect_text_language(text)
                status, headers, body = json_response(200, {
                    'ok': True,
                    'detected_language': result['detected_language'],
                    'confidence': result['confidence'],
                    'method': result['method'],
                    'text_sample': result.get('text_sample', text[:100])
                })
            elif detect_text_lang_simple:
                detected = detect_text_lang_simple(text)
                status, headers, body = json_response(200, {
                    'ok': True, 'detected_language': detected,
                    'confidence': 0.5, 'method': 'simple', 'text_sample': text[:100]
                })
            else:
                status, headers, body = json_response(500, {'ok': False, 'error': '语言检测模块不可用'})
                start_response(f'{status} Internal Server Error', headers)
                return [body]
            start_response(f'{status} OK', headers)
            return [body]
        except Exception as e:
            status, headers, body = json_response(500, {'ok': False, 'error': f'语言检测失败: {e}'})
            start_response(f'{status} Internal Server Error', headers)
            return [body]

    # API: translate
    if path == '/api/translate' and method == 'POST':
        try:
            body_bytes = read_body(environ)
            body = json.loads(body_bytes.decode('utf-8'))
            text = str(body.get('text', ''))
            source = str(body.get('source', 'auto'))
            target = str(body.get('target', 'en'))
            provider = str(body.get('provider', 'auto'))

            # 语言检测
            actual_source = source
            detection_info = {}
            if source == 'auto' and text:
                try:
                    if LANGUAGE_DETECTION_AVAILABLE and detect_text_language:
                        dr = detect_text_language(text)
                        actual_source = dr['detected_language']
                        detection_info = {
                            'detected_language': actual_source,
                            'confidence': dr['confidence'],
                            'method': dr['method'],
                            'original_source': 'auto'
                        }
                    elif detect_text_lang_simple:
                        actual_source = detect_text_lang_simple(text)
                        detection_info = {
                            'detected_language': actual_source,
                            'confidence': 0.5, 'method': 'simple', 'original_source': 'auto'
                        }
                except Exception:
                    actual_source = 'en'
                    detection_info = {
                        'detected_language': 'en', 'confidence': 0.3,
                        'method': 'fallback', 'original_source': 'auto'
                    }

            result = perform_translation(text, actual_source, target, provider)
            if detection_info:
                result['detection_info'] = detection_info
            payload = {'ok': True, **result}
            status, headers, body = json_response(200, payload)
            start_response(f'{status} OK', headers)
            return [body]
        except TranslationError as exc:
            status, headers, body = json_response(502, {'ok': False, 'error': str(exc)})
            start_response(f'{status} Bad Gateway', headers)
            return [body]
        except Exception as e:
            status, headers, body = json_response(500, {'ok': False, 'error': str(e)})
            start_response(f'{status} Internal Server Error', headers)
            return [body]

    # 未知路由 → 返回 index.html (SPA fallback)
    index_path = WEB_DIR / 'index.html'
    if index_path.is_file():
        with open(index_path, 'rb') as f:
            body = f.read()
        start_response('200 OK', [('Content-Type', 'text/html'), ('Content-Length', str(len(body)))])
        return [body]
    else:
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'Not Found']


# gunicorn 入口
app = application
