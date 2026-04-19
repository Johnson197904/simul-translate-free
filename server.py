from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

# 导入语言检测模块
try:
    from language_detector import detect_text_language
    LANGUAGE_DETECTION_AVAILABLE = True
except ImportError:
    LANGUAGE_DETECTION_AVAILABLE = False
    print("[WARNING] 语言检测模块不可用，使用基础检测功能")

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
DEFAULT_PORT = int(os.environ.get("PORT", "8765"))
# Render 环境下 PORT 固定为 10000

LANGUAGES = [
    {"code": "auto", "name": "自动检测"},
    {"code": "zh-CN", "name": "中文（简体）"},
    {"code": "zh-TW", "name": "中文（繁体）"},
    {"code": "en", "name": "英语"},
    {"code": "ja", "name": "日语"},
    {"code": "ko", "name": "韩语"},
    {"code": "fr", "name": "法语"},
    {"code": "de", "name": "德语"},
    {"code": "es", "name": "西班牙语"},
    {"code": "pt", "name": "葡萄牙语"},
    {"code": "it", "name": "意大利语"},
    {"code": "ru", "name": "俄语"},
    {"code": "ar", "name": "阿拉伯语"},
    {"code": "th", "name": "泰语"},
    {"code": "vi", "name": "越南语"},
    {"code": "id", "name": "印尼语"},
    {"code": "ms", "name": "马来语"},
    {"code": "hi", "name": "印地语"},
    {"code": "bn", "name": "孟加拉语"},
    {"code": "ur", "name": "乌尔都语"},
    {"code": "fa", "name": "波斯语"},
    {"code": "tr", "name": "土耳其语"},
    {"code": "pl", "name": "波兰语"},
    {"code": "nl", "name": "荷兰语"},
    {"code": "sv", "name": "瑞典语"},
    {"code": "da", "name": "丹麦语"},
    {"code": "fi", "name": "芬兰语"},
    {"code": "no", "name": "挪威语"},
    {"code": "cs", "name": "捷克语"},
    {"code": "sk", "name": "斯洛伐克语"},
    {"code": "sl", "name": "斯洛文尼亚语"},
    {"code": "hr", "name": "克罗地亚语"},
    {"code": "sr", "name": "塞尔维亚语"},
    {"code": "bs", "name": "波斯尼亚语"},
    {"code": "mk", "name": "马其顿语"},
    {"code": "bg", "name": "保加利亚语"},
    {"code": "ro", "name": "罗马尼亚语"},
    {"code": "hu", "name": "匈牙利语"},
    {"code": "el", "name": "希腊语"},
    {"code": "uk", "name": "乌克兰语"},
    {"code": "be", "name": "白俄罗斯语"},
    {"code": "lt", "name": "立陶宛语"},
    {"code": "lv", "name": "拉脱维亚语"},
    {"code": "et", "name": "爱沙尼亚语"},
    {"code": "sq", "name": "阿尔巴尼亚语"},
    {"code": "is", "name": "冰岛语"},
    {"code": "ga", "name": "爱尔兰语"},
    {"code": "cy", "name": "威尔士语"},
    {"code": "mt", "name": "马耳他语"},
    {"code": "ca", "name": "加泰罗尼亚语"},
    {"code": "eu", "name": "巴斯克语"},
    {"code": "gl", "name": "加利西亚语"},
    {"code": "he", "name": "希伯来语"},
    {"code": "ps", "name": "普什图语"},
    {"code": "sw", "name": "斯瓦希里语"},
    {"code": "am", "name": "阿姆哈拉语"},
    {"code": "so", "name": "索马里语"},
    {"code": "ha", "name": "豪萨语"},
    {"code": "yo", "name": "约鲁巴语"},
    {"code": "ig", "name": "伊博语"},
    {"code": "zu", "name": "祖鲁语"},
    {"code": "xh", "name": "科萨语"},
    {"code": "af", "name": "南非荷兰语"},
    {"code": "km", "name": "高棉语"},
    {"code": "lo", "name": "老挝语"},
    {"code": "my", "name": "缅甸语"},
    {"code": "si", "name": "僧伽罗语"},
    {"code": "ne", "name": "尼泊尔语"},
    {"code": "ta", "name": "泰米尔语"},
    {"code": "te", "name": "泰卢固语"},
    {"code": "ml", "name": "马拉雅拉姆语"},
    {"code": "mr", "name": "马拉地语"},
    {"code": "gu", "name": "古吉拉特语"},
    {"code": "pa", "name": "旁遮普语"},
    {"code": "kn", "name": "卡纳达语"},
    {"code": "or", "name": "奥里亚语"},
    {"code": "as", "name": "阿萨姆语"},
    {"code": "sd", "name": "信德语"},
    {"code": "hy", "name": "亚美尼亚语"},
    {"code": "ka", "name": "格鲁吉亚语"},
    {"code": "az", "name": "阿塞拜疆语"},
    {"code": "kk", "name": "哈萨克语"},
    {"code": "uz", "name": "乌兹别克语"},
    {"code": "ky", "name": "吉尔吉斯语"},
    {"code": "tg", "name": "塔吉克语"},
    {"code": "mn", "name": "蒙古语"},
    {"code": "ceb", "name": "宿务语"},
    {"code": "jv", "name": "爪哇语"},
    {"code": "su", "name": "巽他语"},
    {"code": "haw", "name": "夏威夷语"},
    {"code": "mi", "name": "毛利语"},
    {"code": "sm", "name": "萨摩亚语"},
    {"code": "ht", "name": "海地克里奥尔语"},
    {"code": "la", "name": "拉丁语"},
    {"code": "yi", "name": "意第绪语"},
    {"code": "lb", "name": "卢森堡语"},
    {"code": "eo", "name": "世界语"},
    {"code": "ku", "name": "库尔德语"},
]

def json_response(handler: "AppHandler", payload: dict[str, Any], status: int = 200, cors: bool = True) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    if cors:
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class TranslationError(RuntimeError):
    pass


def _fetch_json(url: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {"User-Agent": "Mozilla/5.0 WorkBuddy Free Simul Translate"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=18) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise TranslationError(f"HTTP {exc.code}: {detail[:300]}") from exc
    except URLError as exc:
        raise TranslationError(f"网络错误：{exc.reason}") from exc


PROVIDERS = {
    "auto": {
        "label": "智能择优（推荐）",
        "description": "国内优先百度翻译，境外优先 Google，失败自动切换 MyMemory / LibreTranslate",
    },
    "baidu": {
        "label": "百度翻译",
        "description": "国内速度最快，支持 200+ 语种，需要配置 BAIDU_APPID / BAIDU_SECRET",
    },
    "google_free": {
        "label": "Google 免费网页接口",
        "description": "语言覆盖最广，境外可用，偶尔会受限",
    },
    "mymemory": {
        "label": "MyMemory 免费接口",
        "description": "完全免费但有频率和长度限制，适合轻量备用",
    },
    "libre": {
        "label": "LibreTranslate 公共实例",
        "description": "可切换为自建实例，免费但语言覆盖较少",
    },
}

# ─── 百度语言代码映射（百度用自己一套代码）─────────────────────────────────
# 百度翻译API文档：https://fanyi-api.baidu.com/doc/21
_BAIDU_LANG_MAP: dict[str, str] = {
    "zh-CN": "zh",     # 简体中文
    "zh-TW": "cht",    # 繁体中文
    "en": "en",
    "ja": "jp",
    "ko": "kor",
    "fr": "fra",
    "de": "de",
    "es": "spa",
    "pt": "pt",
    "it": "it",
    "ru": "ru",
    "ar": "ara",
    "th": "th",
    "vi": "vie",
    "id": "id",
    "ms": "may",
    "hi": "hi",
    "bn": "ben",
    "ur": "ur",
    "fa": "per",
    "tr": "tr",
    "pl": "pl",
    "nl": "nl",
    "sv": "swe",
    "da": "dan",
    "fi": "fin",
    "no": "nor",
    "cs": "cs",
    "sk": "sk",
    "bg": "bul",
    "ro": "rom",
    "hu": "hu",
    "el": "el",
    "uk": "ukr",
    "lt": "lit",
    "lv": "lav",
    "et": "est",
    "he": "heb",
    "sq": "alb",
    "sr": "srp",
    "hr": "hrv",
    "mk": "mac",
    "sl": "slo",
    "bs": "bos",
    "be": "bel",
    "hy": "arm",
    "ka": "geo",
    "az": "aze",
    "kk": "kaz",
    "uz": "uzb",
    "mn": "mon",
    "sw": "swa",
    "af": "afr",
    "is": "ice",
    "ga": "gle",
    "cy": "wel",
    "mt": "mlt",
    "km": "hkm",
    "lo": "lao",
    "my": "bur",
    "ne": "nep",
    "si": "sin",
    "ta": "tam",
    "te": "tel",
    "ml": "mal",
    "kn": "kan",
    "mr": "mar",
    "gu": "guj",
    "pa": "pan",
    "am": "amh",
    "so": "som",
    "ha": "hau",
    "yo": "yor",
    "ig": "ibo",
    "zu": "zul",
    "xh": "xho",
    "ht": "ht",
    "la": "lat",
    "eo": "epo",
    "ku": "kur",
    "lb": "ltz",
    "jv": "jav",
    "ceb": "ceb",
    "haw": "haw",
    "mi": "mao",
    "sm": "sm",
    "yi": "yid",
    "ca": "cat",
    "eu": "baq",
    "gl": "glg",
    "ps": "pus",
    "sd": "snd",
    "tg": "tgk",
    "ky": "kir",
    "auto": "auto",
}


def _to_baidu_lang(code: str) -> str:
    """将标准语言代码转换为百度翻译API使用的代码"""
    return _BAIDU_LANG_MAP.get(code, code)


# ─── 检测是否在国内（通过访问百度首页是否通畅）─────────────────────────────
_IN_CHINA_CACHE: dict[str, Any] = {"result": None, "ts": 0}
_IN_CHINA_TTL = 120  # 秒，2分钟重新检测一次


def _detect_in_china() -> bool:
    """通过访问百度API域名检测是否在中国大陆网络环境"""
    now = time.time()
    if _IN_CHINA_CACHE["result"] is not None and now - _IN_CHINA_CACHE["ts"] < _IN_CHINA_TTL:
        return bool(_IN_CHINA_CACHE["result"])
    try:
        req = Request(
            "https://fanyi.baidu.com",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urlopen(req, timeout=4) as r:
            ok = r.status < 400
    except Exception:
        ok = False
    _IN_CHINA_CACHE["result"] = ok
    _IN_CHINA_CACHE["ts"] = now
    return ok


# ─── 翻译函数 ────────────────────────────────────────────────────────────────

def translate_baidu(text: str, source: str, target: str) -> dict[str, Any]:
    """百度翻译通用文本翻译API（标准版，免费额度每月200万字）"""
    appid = os.environ.get("BAIDU_APPID", "")
    secret = os.environ.get("BAIDU_SECRET", "")
    if not appid or not secret:
        raise TranslationError("未配置百度翻译 BAIDU_APPID / BAIDU_SECRET")
    src = _to_baidu_lang(source)
    tgt = _to_baidu_lang(target)
    if not src or not tgt:
        raise TranslationError(f"百度翻译不支持该语言对: {source} → {target}")
    salt = str(int(time.time() * 1000))
    sign_str = appid + text + salt + secret
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
    params = urlencode({
        "q": text,
        "from": src,
        "to": tgt,
        "appid": appid,
        "salt": salt,
        "sign": sign,
    })
    url = f"https://fanyi-api.baidu.com/api/trans/vip/translate?{params}"
    data = _fetch_json(url)
    if "error_code" in data:
        raise TranslationError(f"百度翻译错误 {data['error_code']}: {data.get('error_msg', '')}")
    results = data.get("trans_result", [])
    if not results:
        raise TranslationError("百度翻译返回空结果")
    translated = "\n".join(r["dst"] for r in results)
    detected = _BAIDU_LANG_MAP.get(data.get("from", src), data.get("from", src))
    # 百度返回的是百度内部代码，反查回标准代码
    detected_std = next((k for k, v in _BAIDU_LANG_MAP.items() if v == detected), detected)
    return {
        "provider": "baidu",
        "translated_text": translated,
        "detected_source": detected_std,
    }


def translate_google_free(text: str, source: str, target: str) -> dict[str, Any]:
    params = urlencode({
        "client": "gtx",
        "sl": source or "auto",
        "tl": target,
        "dt": "t",
        "q": text,
    })
    url = f"https://translate.googleapis.com/translate_a/single?{params}"
    data = _fetch_json(url)
    translated = "".join(part[0] for part in data[0] if part and part[0])
    detected = data[2] if len(data) > 2 and data[2] else source
    if not translated:
        raise TranslationError("Google 免费接口返回空结果")
    return {
        "provider": "google_free",
        "translated_text": translated,
        "detected_source": detected,
    }


def translate_mymemory(text: str, source: str, target: str) -> dict[str, Any]:
    if source == "auto":
        raise TranslationError("MyMemory 不支持自动检测，请明确源语言")
    params = urlencode({
        "q": text,
        "langpair": f"{source}|{target}",
    })
    url = f"https://api.mymemory.translated.net/get?{params}"
    data = _fetch_json(url)
    translated = data.get("responseData", {}).get("translatedText", "")
    if not translated:
        raise TranslationError("MyMemory 返回空结果")
    return {
        "provider": "mymemory",
        "translated_text": translated,
        "detected_source": source,
        "match": data.get("responseData", {}).get("match"),
    }


def translate_libre(text: str, source: str, target: str) -> dict[str, Any]:
    if source == "auto":
        raise TranslationError("LibreTranslate 公共实例默认不建议自动检测，请明确源语言")
    url = "https://translate.argosopentech.com/translate"
    data = _fetch_json(
        url,
        method="POST",
        payload={
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
        },
    )
    translated = data.get("translatedText", "")
    if not translated:
        raise TranslationError("LibreTranslate 返回空结果")
    return {
        "provider": "libre",
        "translated_text": translated,
        "detected_source": source,
    }


def _auto_detect_source(text: str) -> str:
    """用Unicode字符范围在本地检测语言，完全不需要网络"""
    import re
    sample = text.strip()[:200]
    if not sample:
        return "en"
    if re.search(r'[\u4e00-\u9fff]', sample):
        return "zh-CN"
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', sample):
        return "ja"
    if re.search(r'[\uac00-\ud7a3]', sample):
        return "ko"
    if re.search(r'[\u0400-\u04ff]', sample):
        return "ru"
    if re.search(r'[\u0600-\u06ff]', sample):
        return "ar"
    if re.search(r'[\u0e00-\u0e7f]', sample):
        return "th"
    if re.search(r'[\u3041-\u3096]', sample):
        return "ja"
    if re.search(r'[\u0900-\u097f]', sample):
        return "hi"
    return "en"


def perform_translation(text: str, source: str, target: str, provider: str) -> dict[str, Any]:
    if not text.strip():
        raise TranslationError("没有可翻译的内容")
    if source == target:
        return {
            "provider": provider,
            "translated_text": text,
            "detected_source": source,
            "warning": "源语言和目标语言相同，已原样返回",
        }

    # 如果是auto模式，先本地检测语言
    actual_source = source
    if source == "auto":
        actual_source = _auto_detect_source(text)
        if actual_source == target:
            return {
                "provider": "local_detect",
                "translated_text": text,
                "detected_source": actual_source,
                "warning": "检测到的源语言和目标语言相同，已原样返回",
            }

    # ── 智能择优链 ──────────────────────────────────────────────────────────
    # auto 模式：检测网络环境，国内优先百度，境外优先 Google
    # 其他模式：按用户指定，失败时降级
    has_baidu = bool(os.environ.get("BAIDU_APPID") and os.environ.get("BAIDU_SECRET"))

    if provider == "auto":
        in_china = _detect_in_china()
        if in_china and has_baidu:
            # 国内：百度 → Google → MyMemory → LibreTranslate
            chain = [translate_baidu, translate_google_free, translate_mymemory, translate_libre]
        elif in_china and not has_baidu:
            # 国内但没配置百度密钥：Google → MyMemory → LibreTranslate
            chain = [translate_google_free, translate_mymemory, translate_libre]
        else:
            # 境外：Google → MyMemory → 百度（如果有密钥） → LibreTranslate
            if has_baidu:
                chain = [translate_google_free, translate_mymemory, translate_baidu, translate_libre]
            else:
                chain = [translate_google_free, translate_mymemory, translate_libre]
    elif provider == "baidu":
        chain = [translate_baidu, translate_mymemory, translate_google_free]
    elif provider == "google_free":
        chain = [translate_google_free, translate_mymemory, translate_libre]
    elif provider == "mymemory":
        chain = [translate_mymemory]
    elif provider == "libre":
        chain = [translate_libre]
    else:
        chain = [translate_google_free, translate_mymemory, translate_libre]

    errors: list[str] = []
    print(f"[翻译引擎链] chain={[f.__name__ for f in chain]}")
    for fn in chain:
        try:
            result = fn(text, actual_source, target)
            print(f"[翻译成功] provider={result.get('provider')} target={target} -> {result.get('translated_text','')[:50]!r}")
            result["detected_source"] = actual_source
            return result
        except TranslationError as exc:
            errors.append(f"{fn.__name__}: {exc}")
            print(f"[翻译失败] {fn.__name__}: {exc}")
    raise TranslationError("；".join(errors))


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        sys.stdout.write("[server] " + format % args + "\n")

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            json_response(self, {"ok": True, "message": "server running"})
            return
        if parsed.path == "/api/languages":
            json_response(self, {"languages": LANGUAGES, "providers": PROVIDERS})
            return
        if parsed.path == "/api/echo":
            qs = parse_qs(parsed.query)
            json_response(self, {"query": qs})
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        
        # 处理语言检测请求
        if parsed.path == "/api/detect":
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            try:
                body = json.loads(raw_body.decode("utf-8"))
            except json.JSONDecodeError:
                json_response(self, {"ok": False, "error": "请求体不是合法 JSON"}, status=HTTPStatus.BAD_REQUEST)
                return
            
            text = str(body.get("text", ""))
            if not text:
                json_response(self, {"ok": False, "error": "缺少文本内容"}, status=HTTPStatus.BAD_REQUEST)
                return
            
            # 调用语言检测
            try:
                if LANGUAGE_DETECTION_AVAILABLE:
                    detection_result = detect_text_language(text)
                    json_response(self, {
                        "ok": True,
                        "detected_language": detection_result["detected_language"],
                        "confidence": detection_result["confidence"],
                        "method": detection_result["method"],
                        "text_sample": detection_result["text_sample"]
                    })
                else:
                    # 基础语言检测
                    from language_detector import detect_text_lang_simple
                    detected_lang = detect_text_lang_simple(text)
                    json_response(self, {
                        "ok": True,
                        "detected_language": detected_lang,
                        "confidence": 0.5,
                        "method": "simple",
                        "text_sample": text[:100]
                    })
            except Exception as e:
                json_response(self, {"ok": False, "error": f"语言检测失败: {e}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        
        # 处理翻译请求
        elif parsed.path == "/api/translate":
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            try:
                body = json.loads(raw_body.decode("utf-8"))
            except json.JSONDecodeError:
                json_response(self, {"ok": False, "error": "请求体不是合法 JSON"}, status=HTTPStatus.BAD_REQUEST)
                return

            text = str(body.get("text", ""))
            source = str(body.get("source", "auto"))  # 默认自动检测
            target = str(body.get("target", "en"))
            provider = str(body.get("provider", "auto"))
            print(f"[翻译请求] source={source} target={target} provider={provider} text={text[:50]!r}")

            # 如果源语言设置为"auto"，先检测语言
            actual_source = source
            detection_info = {}
            
            if source == "auto" and text:
                try:
                    if LANGUAGE_DETECTION_AVAILABLE:
                        detection_result = detect_text_language(text)
                        actual_source = detection_result["detected_language"]
                        detection_info = {
                            "detected_language": actual_source,
                            "confidence": detection_result["confidence"],
                            "method": detection_result["method"],
                            "original_source": "auto"
                        }
                    else:
                        # 基础检测
                        from language_detector import detect_text_lang_simple
                        actual_source = detect_text_lang_simple(text)
                        detection_info = {
                            "detected_language": actual_source,
                            "confidence": 0.5,
                            "method": "simple",
                            "original_source": "auto"
                        }
                except Exception as e:
                    print(f"[WARNING] 语言检测失败，使用默认源语言: {e}")
                    # 检测失败时默认使用英语
                    actual_source = "en"
                    detection_info = {
                        "detected_language": "en",
                        "confidence": 0.3,
                        "method": "fallback",
                        "original_source": "auto",
                        "warning": f"语言检测失败，已使用默认语言: {e}"
                    }

            try:
                result = perform_translation(text, actual_source, target, provider)
                # 添加语言检测信息到结果
                if detection_info:
                    result["detection_info"] = detection_info
                json_response(self, {"ok": True, **result})
            except TranslationError as exc:
                json_response(self, {"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
        else:
            json_response(self, {"ok": False, "error": "未知接口"}, status=HTTPStatus.NOT_FOUND)


def make_app() -> type[AppHandler]:
    """返回 WSGI 兼容的 AppHandler 类"""
    return AppHandler


# WSGI app for gunicorn
app = AppHandler

# 本地开发模式
def main() -> None:
    from http.server import ThreadingHTTPServer
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"端口无效：{sys.argv[1]}，改用默认端口 {DEFAULT_PORT}")
            port = DEFAULT_PORT

    server = ThreadingHTTPServer(("0.0.0.0", port), AppHandler)
    print(f"免费同声传译服务已启动：http://127.0.0.1:{port}")
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
