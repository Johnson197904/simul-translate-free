#!/usr/bin/env python3
"""
语言检测模块 - 自动检测文本的语言
提供多个免费的在线语言检测服务
"""

import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Dict, Any, Optional, List, Tuple


class LanguageDetectionError(Exception):
    """语言检测错误"""
    pass


def detect_text_lang_simple(text: str) -> str:
    """
    简单基于字符的语言检测
    返回语言代码（如 'zh', 'en', 'ja' 等）
    """
    # 清理文本并采样前200字符
    sample = text.strip()[:200]
    if not sample:
        return "unknown"
    
    # 中文字符检测
    if re.search(r'[\u4e00-\u9fff]', sample):
        return "zh-CN"
    
    # 日文字符
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]', sample):  # 平假名、片假名、汉字
        return "ja"
    
    # 韩文字符
    if re.search(r'[\uac00-\ud7a3]', sample):
        return "ko"
    
    # 西里尔字符（俄语、乌克兰语等）
    if re.search(r'[\u0400-\u04ff]', sample):
        # 尝试区分俄语和乌克兰语
        ru_pattern = r'[ыЫэЭ]'
        uk_pattern = r'[їЇєЄіІ]'
        if re.search(uk_pattern, sample):
            return "uk"
        return "ru"
    
    # 阿拉伯字符
    if re.search(r'[\u0600-\u06ff]', sample):
        return "ar"
    
    # 希伯来字符
    if re.search(r'[\u0590-\u05ff]', sample):
        return "he"
    
    # 泰文字符
    if re.search(r'[\u0e00-\u0e7f]', sample):
        return "th"
    
    # 希腊字符
    if re.search(r'[\u0370-\u03ff]', sample):
        return "el"
    
    # 默认判断为英语（适用于拉丁字母系语言）
    return "en"


def detect_text_lang_whatlang(text: str) -> Optional[str]:
    """
    使用 whatlang（免费语言检测API）
    支持超过200种语言
    """
    try:
        params = urlencode({
            "text": text[:1000],  # 限制长度
            "key": "demo",  # 使用演示密钥（免费）
        })
        url = f"http://whatlang.herokuapp.com/detect?{params}"
        
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 WorkBuddy Free Simul Translate",
                "Accept": "application/json",
            }
        )
        
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            
        # whatlang返回格式：{"language": "en", "confidence": 0.95}
        if result.get("language"):
            lang_code = result["language"]
            # 转换为标准语言代码
            lang_map = {
                "zh": "zh-CN",
                "zh-cn": "zh-CN",
                "zh-tw": "zh-TW",
                "ja": "ja",
                "ko": "ko",
                "en": "en",
                "es": "es",
                "fr": "fr",
                "de": "de",
                "ru": "ru",
                "ar": "ar",
                "pt": "pt",
                "it": "it",
                "nl": "nl",
                "pl": "pl",
                "sv": "sv",
                "da": "da",
                "fi": "fi",
                "no": "no",
            }
            return lang_map.get(lang_code.lower(), lang_code)
            
    except Exception as e:
        # 静默失败，回退到简单检测
        print(f"[DEBUG] whatlang检测失败: {e}")
    
    return None


def detect_text_lang_langid(text: str) -> Optional[str]:
    """
    使用 langid.py 的在线API（免费）
    支持超过90种语言
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 WorkBuddy Free Simul Translate",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        
        data = urlencode({"text": text[:500]}).encode('utf-8')
        url = "http://langid.cool/api/predict"
        
        request = Request(url, data=data, headers=headers, method="POST")
        
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            
        # langid返回格式：{"label": "en", "probability": 0.999}
        if result.get("label"):
            lang_code = result["label"]
            # 转换为标准语言代码
            lang_map = {
                "zh": "zh-CN",
                "en": "en",
                "ja": "ja",
                "ko": "ko",
                "fr": "fr",
                "de": "de",
                "es": "es",
                "ru": "ru",
                "ar": "ar",
                "pt": "pt",
                "it": "it",
            }
            return lang_map.get(lang_code.lower(), lang_code)
            
    except Exception as e:
        print(f"[DEBUG] langid检测失败: {e}")
    
    return None


def detect_text_lang_fallback(text: str) -> str:
    """
    回退检测：使用简单检测
    在在线API都不可用时使用
    """
    return detect_text_lang_simple(text)


def detect_text_language(text: str) -> Dict[str, Any]:
    """
    主语言检测函数
    依次尝试多个免费API，返回最可能的结果
    """
    if not text or len(text.strip()) < 2:
        return {
            "detected_language": "unknown",
            "confidence": 0.0,
            "method": "none",
            "message": "文本太短无法检测"
        }
    
    # 尝试顺序：whatlang -> langid -> 简单检测
    methods = [
        ("whatlang", detect_text_lang_whatlang),
        ("langid", detect_text_lang_langid),
    ]
    
    detected_lang = None
    method_used = "simple"
    
    for method_name, detector_func in methods:
        try:
            detected = detector_func(text)
            if detected:
                detected_lang = detected
                method_used = method_name
                break
        except Exception as e:
            print(f"[DEBUG] {method_name}检测异常: {e}")
            continue
    
    # 如果没有在线检测结果，使用简单检测
    if not detected_lang:
        detected_lang = detect_text_lang_fallback(text)
    
    # 计算置信度（简化版本）
    confidence = 0.8 if method_used != "simple" else 0.6
    
    return {
        "detected_language": detected_lang,
        "confidence": confidence,
        "method": method_used,
        "text_sample": text[:100] + ("..." if len(text) > 100 else ""),
        "timestamp": None,  # 可以添加时间戳
    }


def detect_multilingual(text: str) -> List[Dict[str, Any]]:
    """
    检测文本中的多种语言（混合语言检测）
    返回检测到的语言及其比例
    """
    if not text or len(text) < 10:
        return []
    
    text = text.strip()
    languages = []
    
    # 简单实现：按字符范围检测
    char_ranges = {
        "zh-CN": r'[\u4e00-\u9fff]',
        "ja": r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]',
        "ko": r'[\uac00-\ud7a3]',
        "ru": r'[\u0400-\u04ff]',
        "ar": r'[\u0600-\u06ff]',
        "en": r'[a-zA-Z]',  # 拉丁字母
    }
    
    total_chars = len(text)
    for lang_code, pattern in char_ranges.items():
        matches = re.findall(pattern, text)
        if matches:
            percentage = len(matches) / total_chars
            if percentage > 0.1:  # 超过10%则认为存在该语言
                languages.append({
                    "language": lang_code,
                    "percentage": round(percentage, 3),
                    "char_count": len(matches),
                })
    
    # 如果有主要语言，根据百分比设置置信度
    if languages:
        languages.sort(key=lambda x: x["percentage"], reverse=True)
        main_lang = languages[0]
        main_lang["is_primary"] = True
    
    return languages


# 主函数，用于独立测试
if __name__ == "__main__":
    test_texts = [
        "你好，世界！这是一个测试。",
        "Hello world! This is a test.",
        "こんにちは、世界！テストです。",
        "안녕하세요 세계! 테스트입니다.",
        "Привет, мир! Это тест.",
        "مرحبا بالعالم! هذا اختبار.",
        "Hola, mundo! Esto es una prueba.",
    ]
    
    print("语言检测模块测试:")
    print("=" * 60)
    
    for i, text in enumerate(test_texts):
        print(f"\n测试 {i+1}:")
        print(f"文本: {text}")
        result = detect_text_language(text)
        print(f"检测结果: {result['detected_language']} (置信度: {result['confidence']:.2f}, 方法: {result['method']})")
        
        # 多语言检测测试
        if len(text) > 20:
            multi_result = detect_multilingual(text)
            if multi_result:
                print(f"多语言检测: {multi_result}")