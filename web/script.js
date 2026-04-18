// 同声传译 - 新版 JS
document.addEventListener('DOMContentLoaded', () => {

    // ============ 状态 ============
    const S = {
        isRecording: false,
        recognition: null,
        currentSource: '',
        currentTarget: '',
        history: [],
        lastFinal: '',
        pendingTranscript: '',
        silenceTimer: null,
        settings: {
            voiceSpeed: 1.0,
            voicePitch: 1.0,
            autoSpeak: true,
            autoDetect: true,
        }
    };

    // ============ DOM ============
    const $ = id => document.getElementById(id);
    const micBtn = $('micBtn');
    const micIcon = $('micIcon');
    const recordHint = $('recordHint');
    const recordHintError = $('recordHintError');
    const ringWave = $('ringWave');
    const sourceDisplay = $('sourceTextDisplay');
    const targetDisplay = $('targetTextDisplay');
    const sourceCount = $('sourceCount');
    const targetCount = $('targetCount');
    const sourceLangTag = $('sourceLangTag');
    const targetLangTag = $('targetLangTag');
    const statusLine = $('statusLine');
    const detectBadge = $('detectBadge');
    const manualInput = $('manualInput');
    const translateManualBtn = $('translateManualBtn');
    const translateNowBtn = $('translateNowBtn');
    const speakBtn = $('speakBtn');
    const copyBtn = $('copyBtn');
    const clearBtn = $('clearBtn');
    const historyBtn = $('historyBtn');
    const historyPanel = $('historyPanel');
    const historyList = $('historyList');
    const settingsPanel = $('settingsPanel');
    const settingsBtn = $('btnSettings');
    const overlay = $('overlay');
    const toast = $('toast');

    // 语言名称
    const LANG_NAMES = {
        'auto': '自动', 'zh-CN': '中文', 'en': '英文', 'ja': '日文',
        'ko': '韩文', 'fr': '法文', 'de': '德文', 'es': '西班牙', 'pt': '葡萄牙',
        'it': '意大利', 'nl': '荷兰', 'pl': '波兰', 'tr': '土耳其',
        'hi': '印地', 'th': '泰文', 'id': '印尼', 'cs': '捷克',
        'sv': '瑞典', 'hu': '匈牙利', 'el': '希腊', 'uk': '乌克兰',
        'ro': '罗马尼亚', 'ru': '俄文', 'ar': '阿拉伯', 'vi': '越南'
    };

    // ============ 语言选择 ============
    let sourceLang = 'auto';
    let targetLang = 'en';

    // 双向对话模式
    let biMode = false;
    let biLangs = ['zh-CN', 'ko']; // 双向语言对

    // 双向模式切换
    function setBiMode(enabled) {
        biMode = enabled;
        $('biModeSwitch').checked = enabled;
        var toggle = $('bidirectionalToggle');
        toggle.classList.toggle('bi-active', enabled);
        $('langBar').classList.toggle('bi-mode', enabled);
        if (enabled) {
            // 确认两个语言
            var langA = sourceLang === 'auto' ? 'zh-CN' : sourceLang;
            var langB = targetLang;
            if (langA === langB) {
                showToast('请先选择两个不同的语言', 'error');
                setBiMode(false);
                return;
            }
            biLangs = [langA, langB];
            sourceLangTag.textContent = LANG_NAMES[langA] + ' / ' + LANG_NAMES[langB];
            targetLangTag.textContent = '→ 对方语言';
            showToast('双向模式已开启：' + LANG_NAMES[langA] + ' ↔ ' + LANG_NAMES[langB]);
        } else {
            syncLangDisplay();
            showToast('双向模式已关闭');
        }
    }

    $('biModeSwitch').addEventListener('change', function() {
        setBiMode(this.checked);
    });

    function bindPills(containerId, onChange) {
        const container = $(containerId);
        if (!container) return;
        container.addEventListener('click', e => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const hiddenSelect = container.nextElementSibling;
            if (hiddenSelect) {
                hiddenSelect.value = pill.dataset.value;
                hiddenSelect.dispatchEvent(new Event('change'));
            }
            onChange(pill.dataset.value);
        });
    }

    function syncPillToHidden(containerId, value) {
        const container = $(containerId);
        if (!container) return;
        container.querySelectorAll('.pill').forEach(p => {
            p.classList.toggle('active', p.dataset.value === value);
        });
    }

    bindPills('sourcePills', v => {
        sourceLang = v;
        syncLangDisplay();
    });
    bindPills('targetPills', v => {
        targetLang = v;
        syncLangDisplay();
    });

    $('sourceLang').addEventListener('change', e => {
        sourceLang = e.target.value;
        syncPillToHidden('sourcePills', sourceLang);
        syncLangDisplay();
    });
    $('targetLang').addEventListener('change', e => {
        targetLang = e.target.value;
        syncPillToHidden('targetPills', targetLang);
        syncLangDisplay();
    });

    function syncLangDisplay() {
        sourceLangTag.textContent = LANG_NAMES[sourceLang] || sourceLang;
        targetLangTag.textContent = LANG_NAMES[targetLang] || targetLang;
    }

    // 交换语言
    $('swapLangs').addEventListener('click', () => {
        if (sourceLang === 'auto') { showToast('请先选择源语言', 'error'); return; }
        const tmp = sourceLang;
        sourceLang = targetLang;
        targetLang = tmp;
        syncPillToHidden('sourcePills', sourceLang);
        syncPillToHidden('targetPills', targetLang);
        $('sourceLang').value = sourceLang;
        $('targetLang').value = targetLang;
        syncLangDisplay();
        const ts = S.currentSource;
        S.currentSource = S.currentTarget;
        S.currentTarget = ts;
        renderSource();
        renderTarget();
        showToast('已交换');
    });

    // ============ Toast ============
    let toastTimer;
    function showToast(msg, type) {
        type = type || '';
        toast.textContent = msg;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2000);
    }

    // ============ 面板 ============
    function openPanel(panel) {
        historyPanel.classList.remove('active');
        settingsPanel.classList.remove('active');
        panel.classList.add('active');
        overlay.classList.add('active');
    }
    function closeAll() {
        historyPanel.classList.remove('active');
        settingsPanel.classList.remove('active');
        overlay.classList.remove('active');
    }

    overlay.addEventListener('click', closeAll);
    historyBtn.addEventListener('click', () => openPanel(historyPanel));
    $('closeHistoryBtn').addEventListener('click', closeAll);
    settingsBtn.addEventListener('click', () => openPanel(settingsPanel));
    $('closeSettingsBtn').addEventListener('click', closeAll);

    // ============ 设置 ============
    $('autoSpeak').addEventListener('change', e => {
        S.settings.autoSpeak = e.target.checked;
        saveSettings();
    });
    $('autoDetect').addEventListener('change', e => {
        S.settings.autoDetect = e.target.checked;
        saveSettings();
    });
    $('voiceSpeed').addEventListener('input', e => {
        S.settings.voiceSpeed = parseFloat(e.target.value);
        $('speedVal').textContent = e.target.value;
        saveSettings();
    });
    $('voicePitch').addEventListener('input', e => {
        S.settings.voicePitch = parseFloat(e.target.value);
        $('pitchVal').textContent = e.target.value;
        saveSettings();
    });

    function loadSettings() {
        const raw = localStorage.getItem('st_settings');
        if (raw) {
            try {
                S.settings = Object.assign(S.settings, JSON.parse(raw));
                $('autoSpeak').checked = S.settings.autoSpeak;
                $('autoDetect').checked = S.settings.autoDetect;
                $('voiceSpeed').value = S.settings.voiceSpeed;
                $('voicePitch').value = S.settings.voicePitch;
                $('speedVal').textContent = S.settings.voiceSpeed;
                $('pitchVal').textContent = S.settings.voicePitch;
            } catch (e) {}
        }
    }
    function saveSettings() {
        localStorage.setItem('st_settings', JSON.stringify(S.settings));
    }

    // ============ 渲染 ============
    function renderSource() {
        if (S.currentSource) {
            sourceDisplay.innerHTML = '<div class="text-content">' + escHtml(S.currentSource) + '</div>';
        } else {
            sourceDisplay.innerHTML = '<p class="text-placeholder">等待识别...</p>';
        }
        sourceCount.textContent = S.currentSource.length + ' 字';
    }

    function renderTarget() {
        if (S.currentTarget) {
            targetDisplay.innerHTML = '<div class="text-content">' + escHtml(S.currentTarget) + '</div>';
        } else {
            targetDisplay.innerHTML = '<p class="text-placeholder">翻译结果</p>';
        }
        targetCount.textContent = S.currentTarget.length + ' 字';
    }

    function renderHistory() {
        if (!S.history.length) {
            historyList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无记录</p></div>';
            return;
        }
        var html = S.history.map(function(item) {
            return '<div class="history-item" data-id="' + item.id + '">' +
                '<div class="history-item-header">' +
                '<span class="history-lang-badge">' + (LANG_NAMES[item.s] || item.s) + ' → ' + (LANG_NAMES[item.t] || item.t) + '</span>' +
                '<span class="history-time">' + item.time + '</span></div>' +
                '<div class="history-source">' + escHtml(item.src.substring(0,80)) + (item.src.length>80?'...':'') + '</div>' +
                '<div class="history-target">' + escHtml(item.tgt.substring(0,80)) + (item.tgt.length>80?'...':'') + '</div>' +
                '</div>';
        }).join('');
        historyList.innerHTML = html;
    }

    // ============ 历史操作 ============
    $('clearHistoryBtn').addEventListener('click', function() {
        if (!S.history.length) return;
        S.history = [];
        localStorage.removeItem('st_history');
        renderHistory();
        showToast('已清空');
    });

    $('exportHistoryBtn').addEventListener('click', function() {
        if (!S.history.length) { showToast('没有记录', 'error'); return; }
        var blob = new Blob([JSON.stringify({ date: new Date().toISOString(), items: S.history }, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '翻译历史_' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('已导出', 'success');
    });

    historyList.addEventListener('click', function(e) {
        var item = e.target.closest('.history-item');
        if (!item) return;
        var id = parseInt(item.dataset.id);
        var h = S.history.find(function(x) { return x.id === id; });
        if (!h) return;
        sourceLang = h.s; targetLang = h.t;
        $('sourceLang').value = sourceLang;
        $('targetLang').value = targetLang;
        syncPillToHidden('sourcePills', sourceLang);
        syncPillToHidden('targetPills', targetLang);
        S.currentSource = h.src;
        S.currentTarget = h.tgt;
        syncLangDisplay();
        renderSource();
        renderTarget();
        closeAll();
        showToast('已载入');
    });

    // ============ 清空 ============
    clearBtn.addEventListener('click', function() {
        S.currentSource = '';
        S.currentTarget = '';
        S.lastFinal = '';
        S.pendingTranscript = '';
        clearTimeout(S.silenceTimer);
        renderSource();
        renderTarget();
        showToast('已清空');
    });

    // ============ 复制 ============
    copyBtn.addEventListener('click', function() {
        if (!S.currentTarget) { showToast('没有内容', 'error'); return; }
        navigator.clipboard.writeText(S.currentTarget).then(function() {
            showToast('已复制', 'success');
        }).catch(function() {
            showToast('复制失败', 'error');
        });
    });

    // ============ 朗读 ============
    speakBtn.addEventListener('click', function() {
        if (!S.currentTarget) { showToast('没有内容', 'error'); return; }
        speak(S.currentTarget, targetLang);
    });

    function speak(text, lang) {
        if (!window.speechSynthesis) { showToast('浏览器不支持语音', 'error'); return; }
        ttsStop(); // 手动触发：停止当前播放，清空队列，从头开始
        var utt = new SpeechSynthesisUtterance(text);
        utt.lang = (lang === 'auto') ? 'zh-CN' : lang;
        utt.rate = S.settings.voiceSpeed;
        utt.pitch = S.settings.voicePitch;
        utt.onstart = function() { showToast('播放中...'); };
        utt.onend = function() { showToast('播放完毕'); };
        utt.onerror = function() { showToast('播放失败', 'error'); };
        speechSynthesis.speak(utt);
    }

    // ============ 翻译 API ============
    async function doTranslate(text, fromLang, toLang) {
        statusLine.textContent = '翻译中...';
        var resp = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, source: fromLang, target: toLang, provider: 'auto' })
        });
        if (!resp.ok) throw new Error(resp.status);
        var data = await resp.json();
        if (!data.ok) throw new Error(data.error || '翻译失败');
        return data;
    }

    // 全量翻译（手动翻译按钮、历史记录恢复用）
    async function translate(text, fromLang, toLang) {
        if (!text || !text.trim()) return;
        if (fromLang === toLang) {
            _targetWindow = [text];
            renderTargetWindow();
            statusLine.textContent = '完成';
            return;
        }
        try {
            var result = await doTranslate(text, fromLang, toLang);
            var translated = result.translated_text || result.translatedText;
            _targetWindow = [translated];
            renderTargetWindow();
            if (result.detection_info) {
                var dl = result.detection_info.detected_language;
                var conf = Math.round(result.detection_info.confidence * 100);
                statusLine.textContent = '检测为' + (LANG_NAMES[dl]||dl) + ' · ' + conf + '%';
            } else {
                statusLine.textContent = '翻译完成';
            }
            if (S.settings.autoSpeak) speak(S.currentTarget, toLang);
            addHistory(text, S.currentTarget, fromLang, toLang);
        } catch (err) {
            try {
                var params = new URLSearchParams({
                    client: 'gtx',
                    sl: (fromLang === 'auto') ? 'auto' : fromLang,
                    tl: toLang,
                    dt: 't',
                    q: text
                });
                var r = await fetch('https://translate.googleapis.com/translate_a/single?' + params);
                var j = await r.json();
                var t = j[0].map(function(p) { return p[0]; }).join('');
                _targetWindow = [t];
                renderTargetWindow();
                statusLine.textContent = '翻译完成';
                if (S.settings.autoSpeak) speak(S.currentTarget, toLang);
                addHistory(text, t, fromLang, toLang);
            } catch (e2) {
                statusLine.textContent = '翻译失败';
                showToast('翻译失败', 'error');
            }
        }
    }

    function addHistory(src, tgt, s, t) {
        S.history.unshift({
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            src: src, tgt: tgt, s: s, t: t
        });
        if (S.history.length > 50) S.history = S.history.slice(0, 50);
        localStorage.setItem('st_history', JSON.stringify(S.history));
        renderHistory();
    }

    // 手动翻译
    translateManualBtn.addEventListener('click', function() {
        var text = manualInput.value.trim();
        if (!text) { manualInput.focus(); return; }
        S.currentSource = text;
        manualInput.value = '';
        renderSource();
        translate(text, sourceLang, targetLang);
    });

    manualInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            translateManualBtn.click();
        }
    });

    // 翻译按钮
    translateNowBtn.addEventListener('click', function() {
        if (!S.currentSource) { showToast('没有内容', 'error'); return; }
        translate(S.currentSource, sourceLang, targetLang);
    });

    // ============ 语言检测（服务端，更准）===========
    var _detectXhr = null;
    var _pendingBiTranslate = null; // 双向模式：待翻译的新段落

    function detectLanguage(text, onDetected) {
        if (!text || text.trim().length < 3) { onDetected && onDetected(null); return; }
        if (_detectXhr) _detectXhr.abort();
        _detectXhr = new XMLHttpRequest();
        _detectXhr.open('POST', '/api/detect', true);
        _detectXhr.setRequestHeader('Content-Type', 'application/json');
        _detectXhr.onload = function() {
            if (this.status === 200) {
                try {
                    var r = JSON.parse(this.responseText);
                    if (r.detected_language) {
                        var dl = r.detected_language;
                        var conf = r.confidence || 0;
                        var name = LANG_NAMES[dl] || dl;
                        detectBadge.textContent = '检测: ' + name + ' ' + Math.round(conf * 100) + '%';
                        detectBadge.style.display = 'inline-block';
                        detectBadge.className = 'detect-badge ' + (conf >= 0.8 ? 'high-conf' : conf >= 0.5 ? '' : 'low-conf');
                        detectBadge.title = '点击手动确认语言';
                        detectBadge.onclick = function() {
                            sourceLang = dl;
                            $('sourceLang').value = dl;
                            syncPillToHidden('sourcePills', dl);
                            syncLangDisplay();
                            detectBadge.textContent = '已确认: ' + name;
                            detectBadge.className = 'detect-badge high-conf';
                        };
                        onDetected && onDetected(dl, conf);
                    } else {
                        onDetected && onDetected(null);
                    }
                } catch(e) { onDetected && onDetected(null); }
            } else {
                onDetected && onDetected(null);
            }
        };
        _detectXhr.onerror = function() { onDetected && onDetected(null); };
        _detectXhr.send(JSON.stringify({ text: text.trim() }));
    }

    // 双向翻译：检测到语言后，自动翻译成另一种
    function biTranslateIncremental(newText) {
        detectLanguage(newText, function(dl, conf) {
            if (!dl || !biMode) {
                // 检测失败或非双向模式：用配置的源语言
                if (!biMode) translateIncremental(newText, sourceLang, targetLang);
                return;
            }
            // 判断该语言属于哪一边
            var langA = biLangs[0], langB = biLangs[1];
            var fromLang, toLang;
            if (dl === langA || dl === langB) {
                fromLang = dl;
                toLang = (dl === langA) ? langB : langA;
            } else {
                // 检测到的语言不在两侧，按普通模式处理
                translateIncremental(newText, sourceLang, targetLang);
                return;
            }
            // 更新显示标签
            sourceLangTag.textContent = LANG_NAMES[fromLang] || fromLang;
            targetLangTag.textContent = LANG_NAMES[toLang] || toLang;
            // 只翻译新增段落，追加到译文
            translateIncremental(newText, fromLang, toLang);
        });
    }

    // ============ TTS 队列（只读新增段落，不打断当前播放）===========
    var _ttsQueue = [];
    var _ttsBusy = false;
    function ttsSpeak(text, lang) {
        if (!text || !text.trim()) return;
        if (!window.speechSynthesis) return;
        _ttsQueue.push({ text: text, lang: lang });
        if (!_ttsBusy) drainTTS();
    }
    function drainTTS() {
        if (!_ttsQueue.length) { _ttsBusy = false; return; }
        _ttsBusy = true;
        var item = _ttsQueue.shift();
        var utt = new SpeechSynthesisUtterance(item.text);
        utt.lang = (item.lang === 'auto') ? 'zh-CN' : item.lang;
        utt.rate = S.settings.voiceSpeed;
        utt.pitch = S.settings.voicePitch;
        utt.onend = function() { drainTTS(); };
        utt.onerror = function() { drainTTS(); };
        speechSynthesis.speak(utt);
    }
    function ttsStop() {
        speechSynthesis.cancel();
        _ttsQueue = [];
        _ttsBusy = false;
    }

    // ============ 增量翻译（只翻新增段落，滑动窗口显示）===========
    // 译文滑动窗口：只保留最近 N 段，超出自动清除，配合说话节奏
    var _incDebounce = null;
    var _targetWindow = [];     // 最近 N 条译文
    var _pendingPlaceholder = null; // 占位符（等待翻译返回）
    const _TARGET_WINDOW_SIZE = 3; // 最多保留几条

    async function translateIncremental(newText, fromLang, toLang) {
        if (!newText || !newText.trim()) return;

        // 先清掉超过窗口的旧译文
        if (_targetWindow.length >= _TARGET_WINDOW_SIZE) {
            _targetWindow.shift();
        }

        if (fromLang === toLang) {
            _targetWindow.push(newText);
            renderTargetWindow();
            if (S.settings.autoSpeak) ttsSpeak(newText, toLang);
            return;
        }

        // 追加占位符（显示原文，表示正在翻译）
        _targetWindow.push(newText);
        renderTargetWindow();

        clearTimeout(_incDebounce);
        _incDebounce = setTimeout(async function() {
            try {
                var result = await doTranslate(newText, fromLang, toLang);
                var translated = result.translated_text || result.translatedText;
                // 找到占位符并替换
                var idx = _targetWindow.lastIndexOf(newText);
                if (idx !== -1) _targetWindow[idx] = translated;
                renderTargetWindow();
                if (result.detection_info) {
                    var dl = result.detection_info.detected_language;
                    var conf = Math.round(result.detection_info.confidence * 100);
                    statusLine.textContent = '检测为' + (LANG_NAMES[dl]||dl) + ' · ' + conf + '%';
                } else {
                    statusLine.textContent = '翻译完成';
                }
                if (S.settings.autoSpeak) ttsSpeak(translated, toLang);
            } catch (err) {
                try {
                    var params = new URLSearchParams({
                        client: 'gtx',
                        sl: (fromLang === 'auto') ? 'auto' : fromLang,
                        tl: toLang,
                        dt: 't',
                        q: newText
                    });
                    var r = await fetch('https://translate.googleapis.com/translate_a/single?' + params);
                    var j = await r.json();
                    var t = j[0].map(function(p) { return p[0]; }).join('');
                    var idx = _targetWindow.lastIndexOf(newText);
                    if (idx !== -1) _targetWindow[idx] = t;
                    renderTargetWindow();
                    if (S.settings.autoSpeak) ttsSpeak(t, toLang);
                } catch (e2) {
                    // 翻译失败：从窗口移除占位符
                    var failIdx = _targetWindow.lastIndexOf(newText);
                    if (failIdx !== -1) _targetWindow.splice(failIdx, 1);
                    renderTargetWindow();
                    statusLine.textContent = '翻译失败';
                    showToast('翻译失败', 'error');
                }
            }
        }, 150);
    }

    // 渲染译文窗口（滑动窗口模式）
    function renderTargetWindow() {
        targetDisplay.innerHTML = '<div class="text-content">' +
            escHtml(_targetWindow.join('\n')) + '</div>';
        targetCount.textContent = _targetWindow.join('').length + ' 字';
        S.currentTarget = _targetWindow.join('\n');
    }

    // 重置译文（开麦时 + 手动清空）
    function resetTargetWindow() {
        _targetWindow = [];
        _pendingPlaceholder = null;
        S.currentTarget = '';
        renderTarget();
    }

    // ============ 语音识别 ============
    function getSpeechLang() {
        var map = {
            'auto': 'zh-CN', 'zh-CN': 'zh-CN', 'en': 'en-US',
            'ja': 'ja-JP', 'ko': 'ko-KR', 'fr': 'fr-FR',
            'de': 'de-DE', 'es': 'es-ES', 'pt': 'pt-PT',
            'it': 'it-IT', 'nl': 'nl-NL', 'pl': 'pl-PL',
            'tr': 'tr-TR', 'hi': 'hi-IN', 'th': 'th-TH',
            'id': 'id-ID', 'cs': 'cs-CZ', 'sv': 'sv-SE',
            'hu': 'hu-HU', 'el': 'el-GR', 'uk': 'uk-UA',
            'ro': 'ro-RO', 'ru': 'ru-RU', 'ar': 'ar-SA',
            'vi': 'vi-VN'
        };
        return map[sourceLang] || 'zh-CN';
    }

    micBtn.addEventListener('click', function() {
        if (S.isRecording) { stopRecord(); }
        else { startRecord(); }
    });

    async function startRecord() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            showToast('浏览器不支持语音识别，请用Chrome', 'error');
            return;
        }
        S.lastFinal = '';
        S.pendingTranscript = '';
        S.currentSource = '';
        detectBadge.style.display = 'none';
        detectBadge.onclick = null;
        resetTargetWindow(); // 清空译文窗口，配合说话节奏
        renderSource();

        try {
            statusLine.textContent = '请求麦克风权限...';
            var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(function(t) { t.stop(); });
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showToast('请允许麦克风权限', 'error');
            } else {
                showToast('麦克风错误', 'error');
            }
            return;
        }

        S.isRecording = true;
        micBtn.classList.add('recording');
        ringWave.classList.add('active');
        micIcon.className = 'fas fa-stop';
        recordHint.textContent = '说话中...';
        recordHintError.style.display = 'none';
        statusLine.textContent = '说话中...';
        startRecognition();
    }

    function startRecognition() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        var rec = new SR();
        S.recognition = rec;
        rec.lang = getSpeechLang();
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        var resetSilence = function() {
            clearTimeout(S.silenceTimer);
            S.silenceTimer = setTimeout(function() {
                // 静音超过1.5秒：说明已经停住
                // 此时如果 pendingTranscript 里还有内容（最后的临时片段），追加写入
                var pending = S.pendingTranscript ? S.pendingTranscript.trim() : '';
                if (pending.length > 1) {
                    // 把最后这段追加到文本框并翻译
                    S.currentSource = pending;
                    S.lastFinal = pending;
                    S.pendingTranscript = '';
                    sourceDisplay.innerHTML = '<div class="text-content">' + escHtml(pending) + '</div>';
                    sourceCount.textContent = pending.length + ' 字';
                    resetTargetWindow();
                    if (biMode) {
                        biTranslateIncremental(pending);
                    } else {
                        translateIncremental(pending, sourceLang, targetLang);
                    }
                }
                // 如果 pendingTranscript 已空，说明 finalText 时已处理完，无需额外动作
            }, 1500);
        };

        rec.onstart = function() { statusLine.textContent = '聆听中...'; };

        rec.onresult = function(evt) {
            var interim = '', finalText = '';
            for (var i = evt.resultIndex; i < evt.results.length; i++) {
                var t = evt.results[i][0].transcript;
                if (evt.results[i].isFinal) finalText += t;
                else interim += t;
            }

            // 说话中：只显示省略号，不写文本框
            if (interim || finalText) {
                sourceDisplay.innerHTML = '<div style="color:#818CF8;font-style:italic">说话中...</div>';
                sourceCount.textContent = '...';
            }

            if (finalText) {
                // 停顿了（识别出完整句子）：内容写入文本框 + 触发翻译
                var text = finalText.trim();
                S.currentSource = text;
                S.pendingTranscript = '';
                S.lastFinal = text;
                sourceDisplay.innerHTML = '<div class="text-content">' + escHtml(text) + '</div>';
                sourceCount.textContent = text.length + ' 字';
                // 同时清空译文窗口，从新一段开始
                resetTargetWindow();
                // 触发翻译
                if (biMode) {
                    biTranslateIncremental(text);
                } else {
                    detectLanguage(text);
                    translateIncremental(text, sourceLang, targetLang);
                }
                resetSilence();
            }
        };

        rec.onerror = function(evt) {
            if (evt.error === 'no-speech') { resetSilence(); return; }
            if (evt.error === 'not-allowed') {
                showToast('麦克风被拒绝', 'error');
                stopRecord();
                return;
            }
            statusLine.textContent = '出错: ' + evt.error;
            if (S.isRecording) setTimeout(startRecognition, 500);
        };

        rec.onend = function() {
            if (S.isRecording) setTimeout(startRecognition, 100);
        };

        try { rec.start(); } catch (e) { setTimeout(startRecognition, 300); }
    }

    function commit(text) {
        if (text === S.lastFinal) return;
        S.lastFinal = text;
        S.currentSource = text;
        S.pendingTranscript = '';
        renderSource();
        if (biMode) {
            var langA = biLangs[0], langB = biLangs[1];
            detectLanguage(text, function(dl) {
                if (dl && (dl === langA || dl === langB)) {
                    var fromLang = dl, toLang = (dl === langA) ? langB : langA;
                    sourceLangTag.textContent = LANG_NAMES[fromLang] || fromLang;
                    targetLangTag.textContent = LANG_NAMES[toLang] || toLang;
                    translateIncremental(text, fromLang, toLang);
                } else {
                    translateIncremental(text, sourceLang, targetLang);
                }
            });
        } else {
            translateIncremental(text, sourceLang, targetLang);
        }
    }

    function stopRecord() {
        S.isRecording = false;
        clearTimeout(S.silenceTimer);
        micBtn.classList.remove('recording');
        ringWave.classList.remove('active');
        micIcon.className = 'fas fa-microphone';
        recordHint.textContent = '点击麦克风开始说话';
        statusLine.textContent = '已停止';
        // 停麦时：如果还有未 final 的内容，补写入并翻译
        var pending = S.pendingTranscript ? S.pendingTranscript.trim() : '';
        if (pending.length > 1) {
            S.currentSource = pending;
            S.lastFinal = pending;
            sourceDisplay.innerHTML = '<div class="text-content">' + escHtml(pending) + '</div>';
            sourceCount.textContent = pending.length + ' 字';
            resetTargetWindow();
            if (biMode) {
                biTranslateIncremental(pending);
            } else {
                translateIncremental(pending, sourceLang, targetLang);
            }
        }
        if (S.recognition) {
            try { S.recognition.stop(); } catch(e) {}
            S.recognition = null;
        }
    }

    // ============ 初始化 ============
    function loadHistory() {
        try {
            var raw = localStorage.getItem('st_history');
            if (raw) S.history = JSON.parse(raw) || [];
        } catch (e) { S.history = []; }
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function init() {
        loadSettings();
        syncLangDisplay();
        renderSource();
        renderTarget();
        loadHistory();
        renderHistory();

        var savedSrc = localStorage.getItem('st_src_lang');
        var savedTgt = localStorage.getItem('st_tgt_lang');
        if (savedSrc) {
            sourceLang = savedSrc;
            $('sourceLang').value = sourceLang;
            syncPillToHidden('sourcePills', sourceLang);
        }
        if (savedTgt) {
            targetLang = savedTgt;
            $('targetLang').value = targetLang;
            syncPillToHidden('targetPills', targetLang);
        }
        syncLangDisplay();

        statusLine.textContent = '准备就绪';
    }

    $('sourceLang').addEventListener('change', function() {
        localStorage.setItem('st_src_lang', $('sourceLang').value);
    });
    $('targetLang').addEventListener('change', function() {
        localStorage.setItem('st_tgt_lang', $('targetLang').value);
    });

    init();
});
