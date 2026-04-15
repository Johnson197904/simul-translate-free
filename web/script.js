// 同声传译工具 - JavaScript主逻辑
document.addEventListener('DOMContentLoaded', function() {
    // 元素引用
    const elements = {
        sourceLang: document.getElementById('sourceLang'),
        targetLang: document.getElementById('targetLang'),
        startSourceBtn: document.getElementById('startSource'),
        stopSourceBtn: document.getElementById('stopSource'),
        startTargetBtn: document.getElementById('startTarget'),
        stopTargetBtn: document.getElementById('stopTarget'),
        speakTargetBtn: document.getElementById('speakTarget'),
        swapLangsBtn: document.getElementById('swapLangs'),
        manualInput: document.getElementById('manualInput'),
        translateManualBtn: document.getElementById('translateManual'),
        sourceTextDisplay: document.getElementById('sourceTextDisplay'),
        targetTextDisplay: document.getElementById('targetTextDisplay'),
        statusBox: document.getElementById('statusBox'),
        statusText: document.getElementById('statusText'),
        clearHistoryBtn: document.getElementById('clearHistory'),
        exportHistoryBtn: document.getElementById('exportHistory'),
        toggleSettingsBtn: document.getElementById('toggleSettings'),
        viewHelpBtn: document.getElementById('viewHelp'),
        settingsModal: document.getElementById('settingsModal'),
        helpModal: document.getElementById('helpModal'),
        closeModals: document.querySelectorAll('.close-modal'),
        saveSettingsBtn: document.getElementById('saveSettings'),
        cancelSettingsBtn: document.getElementById('cancelSettings'),
        voiceSpeed: document.getElementById('voiceSpeed'),
        voicePitch: document.getElementById('voicePitch'),
        speedValue: document.getElementById('speedValue'),
        pitchValue: document.getElementById('pitchValue'),
        autoDetect: document.getElementById('autoDetect'),
        autoSpeak: document.getElementById('autoSpeak')
    };

    // 应用状态
    const state = {
        isRecording: false,
        currentSourceText: '',
        currentTargetText: '',
        translationHistory: [],
        settings: {
            voiceSpeed: 1.0,
            voicePitch: 1.0,
            autoDetect: true,
            autoSpeak: true,
            autoDetectTarget: true,
            autoSwitchTarget: false
        },
        mediaRecorder: null,
        audioChunks: [],
        recognition: null,           // Web Speech API
        lastFinalText: '',           // 上次确认文字（防重复）
        silenceTimer: null,          // 静音检测定时器
        pendingTranscript: ''         // 待确认的临时文字
    };

    // 语言代码映射（Web Speech API → 百度/Google）
    const SPEECH_LANG_MAP = {
        'auto': 'zh-CN',
        'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh': 'zh-CN',
        'en': 'en', 'ja': 'ja', 'ko': 'ko',
        'fr': 'fr', 'de': 'de', 'es': 'es',
        'ru': 'ru', 'ar': 'ar'
    };

    // 初始化
    function init() {
        loadSettings();
        attachEventListeners();
        updateUI();
        updateLanguageDisplay();
        updateRecordingUI();
    }

    // 加载设置
    function loadSettings() {
        const saved = localStorage.getItem('simulTranslateSettings');
        if (saved) {
            try {
                state.settings = { ...state.settings, ...JSON.parse(saved) };
                elements.voiceSpeed.value = state.settings.voiceSpeed;
                elements.voicePitch.value = state.settings.voicePitch;
                elements.autoDetect.checked = state.settings.autoDetect;
                elements.autoSpeak.checked = state.settings.autoSpeak;
                elements.speedValue.textContent = state.settings.voiceSpeed;
                elements.pitchValue.textContent = state.settings.voicePitch;
            } catch (e) {
                console.warn('加载设置失败:', e);
            }
        }
    }

    // 保存设置
    function saveSettings() {
        localStorage.setItem('simulTranslateSettings', JSON.stringify(state.settings));
    }

    // 获取Web Speech API的language参数
    function getSpeechLang() {
        const src = elements.sourceLang.value;
        if (src === 'auto') return 'zh-CN';
        return SPEECH_LANG_MAP[src] || 'zh-CN';
    }

    // 附加事件监听器
    function attachEventListeners() {
        elements.sourceLang.addEventListener('change', () => { updateLanguageDisplay(); restartRecognitionIfRunning(); });
        elements.targetLang.addEventListener('change', updateLanguageDisplay);
        elements.startSourceBtn.addEventListener('click', startRecording);
        elements.stopSourceBtn.addEventListener('click', stopRecording);
        elements.speakTargetBtn.addEventListener('click', speakTranslation);
        elements.startTargetBtn.addEventListener('click', startContinuousSpeech);
        elements.stopTargetBtn.addEventListener('click', stopContinuousSpeech);
        elements.swapLangsBtn.addEventListener('click', swapLanguages);
        elements.translateManualBtn.addEventListener('click', translateManualText);
        elements.manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) translateManualText();
        });
        elements.clearHistoryBtn.addEventListener('click', clearHistory);
        elements.exportHistoryBtn.addEventListener('click', exportHistory);
        elements.toggleSettingsBtn.addEventListener('click', () => showModal(elements.settingsModal));
        elements.viewHelpBtn.addEventListener('click', () => showModal(elements.helpModal));
        elements.closeModals.forEach(closeBtn => closeBtn.addEventListener('click', hideAllModals));
        elements.saveSettingsBtn.addEventListener('click', saveSettingsFromUI);
        elements.cancelSettingsBtn.addEventListener('click', hideAllModals);
        document.querySelector('.close-help')?.addEventListener('click', hideAllModals);
        elements.voiceSpeed.addEventListener('input', (e) => { elements.speedValue.textContent = e.target.value; });
        elements.voicePitch.addEventListener('input', (e) => { elements.pitchValue.textContent = e.target.value; });
        window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) hideAllModals(); });
    }

    // 如果正在录音，切换语言后重启识别
    function restartRecognitionIfRunning() {
        if (state.isRecording && state.recognition) {
            const interim = state.pendingTranscript;
            state.recognition.stop();
            setTimeout(() => { if (state.isRecording) startSpeechRecognition(); }, 200);
        }
    }

    // 更新UI状态
    function updateUI() {
        elements.stopSourceBtn.classList.toggle('disabled', !state.isRecording);
        elements.startSourceBtn.classList.toggle('disabled', state.isRecording);
        elements.startTargetBtn.classList.toggle('disabled', !state.currentTargetText);
        updateTextDisplay();
        updateHistoryDisplay();
    }

    // 更新录音相关UI
    function updateRecordingUI() {
        if (state.isRecording) {
            elements.startSourceBtn.innerHTML = '<span class="recording-indicator"></span><i class="fas fa-microphone"></i> 识别中...';
            elements.stopSourceBtn.classList.remove('disabled');
        } else {
            elements.startSourceBtn.innerHTML = '<i class="fas fa-play"></i> 开始识别源语言';
            elements.startSourceBtn.classList.remove('recording-active');
            elements.stopSourceBtn.classList.add('disabled');
        }
    }

    // 更新语言显示
    function updateLanguageDisplay() {
        const sourceLang = elements.sourceLang.options[elements.sourceLang.selectedIndex].text;
        const targetLang = elements.targetLang.options[elements.targetLang.selectedIndex].text;
        document.getElementById('sourceLangName').textContent = sourceLang;
        document.getElementById('targetLangName').textContent = targetLang;
    }

    // 更新文本显示
    function updateTextDisplay() {
        if (state.currentSourceText) {
            elements.sourceTextDisplay.innerHTML = `<div class="text-content">${escapeHtml(state.currentSourceText)}</div>`;
        } else {
            elements.sourceTextDisplay.innerHTML = '<div class="placeholder">等待识别或输入...</div>';
        }
        if (state.currentTargetText) {
            elements.targetTextDisplay.innerHTML = `<div class="text-content">${escapeHtml(state.currentTargetText)}</div>`;
        } else {
            elements.targetTextDisplay.innerHTML = '<div class="placeholder">翻译将显示在这里...</div>';
        }
        document.getElementById('sourceTextLength').textContent = `${state.currentSourceText.length} 字符`;
        document.getElementById('targetTextLength').textContent = `${state.currentTargetText.length} 字符`;
    }

    // 开始实时识别
    async function startRecording() {
        if (state.recognition) {
            try { state.recognition.stop(); } catch(e) {}
        }
        state.lastFinalText = '';
        state.pendingTranscript = '';
        state.currentSourceText = '';
        state.currentTargetText = '';

        // 检查浏览器支持
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            updateStatus('您的浏览器不支持语音识别，请使用Chrome或Edge浏览器', true);
            alert('错误：您的浏览器不支持语音识别。\n\n请使用以下浏览器：\n• Chrome（推荐）\n• Edge\n\nFirefox和Safari不支持Web Speech API');
            return;
        }

        try {
            updateStatus('正在请求麦克风权限...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // 获得权限后立即停止
            updateStatus('麦克风权限已获取，正在启动识别...', false);
            startSpeechRecognition();
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                updateStatus('麦克风权限被拒绝，请允许麦克风权限后重试', true);
                alert('⚠️ 麦克风权限被拒绝\n\n解决方法：\n1. 点击浏览器地址栏左侧的摄像头/麦克风图标\n2. 允许麦克风访问\n3. 刷新页面后重试');
            } else {
                updateStatus('麦克风访问出错: ' + error.message, true);
            }
        }
    }

    function startSpeechRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        state.recognition = recognition;

        recognition.lang = getSpeechLang();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // 静音超时处理（1.5秒无新文字则触发翻译）
        const resetSilenceTimer = () => {
            clearTimeout(state.silenceTimer);
            state.silenceTimer = setTimeout(() => {
                if (state.pendingTranscript && state.pendingTranscript.trim().length > 2) {
                    commitTranslation(state.pendingTranscript.trim());
                }
            }, 1500);
        };

        recognition.onstart = () => {
            state.isRecording = true;
            elements.startSourceBtn.classList.add('recording-active');
            updateStatus('正在监听... 说话吧');
            updateRecordingUI();
            updateUI();
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += t;
                } else {
                    interim += t;
                }
            }
            state.pendingTranscript = final + interim;

            // 实时显示临时识别结果
            const displayText = state.currentSourceText +
                (state.currentSourceText && state.pendingTranscript ? ' ' : '') +
                state.pendingTranscript;
            elements.sourceTextDisplay.innerHTML = `<div class="text-content interim">${escapeHtml(displayText)}</div>`;
            document.getElementById('sourceTextLength').textContent = `${displayText.length} 字符`;

            if (final) {
                // 有确认文字，加入主文本
                if (state.pendingTranscript) {
                    const newText = (state.currentSourceText + ' ' + final).trim();
                    state.currentSourceText = newText;
                    state.pendingTranscript = '';
                    state.lastFinalText = final.trim();
                    elements.sourceTextDisplay.innerHTML = `<div class="text-content">${escapeHtml(newText)}</div>`;
                    // 实时翻译已识别文字
                    translateText(newText, elements.sourceLang.value, elements.targetLang.value);
                }
                resetSilenceTimer();
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                // 无语音输入，重启识别
                resetSilenceTimer();
                return;
            }
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                updateStatus('麦克风权限被拒绝，请允许麦克风权限后重试', true);
                state.isRecording = false;
                updateRecordingUI();
                return;
            }
            console.error('识别错误:', event.error);
            updateStatus('识别出错: ' + event.error + '，自动重试...');
            setTimeout(() => {
                if (state.isRecording) startSpeechRecognition();
            }, 500);
        };

        recognition.onend = () => {
            if (state.isRecording) {
                // 非手动停止，重启识别
                setTimeout(() => startSpeechRecognition(), 100);
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error('启动识别失败:', e);
            setTimeout(() => startSpeechRecognition(), 500);
        }
    }

    // 停止录音
    function stopRecording() {
        state.isRecording = false;
        elements.startSourceBtn.classList.remove('recording-active');
        clearTimeout(state.silenceTimer);

        // 提交最后待处理文字
        if (state.pendingTranscript && state.pendingTranscript.trim().length > 2) {
            const newText = (state.currentSourceText + ' ' + state.pendingTranscript.trim()).trim();
            state.currentSourceText = newText;
            state.pendingTranscript = '';
            translateText(newText, elements.sourceLang.value, elements.targetLang.value);
        }

        if (state.recognition) {
            try { state.recognition.stop(); } catch(e) {}
            state.recognition = null;
        }
        updateRecordingUI();
        updateUI();
        updateStatus('已停止识别');
    }

    // 提交翻译（防重复）
    function commitTranslation(text) {
        if (text === state.lastFinalText) return;
        state.lastFinalText = text;
        state.currentSourceText = text;
        state.pendingTranscript = '';
        translateText(text, elements.sourceLang.value, elements.targetLang.value);
    }

    // 翻译文本
    async function translateText(text, fromLang, toLang) {
        if (!text || !text.trim()) return;
        try {
            updateStatus('正在翻译...');
            const requestData = { text, source: fromLang, target: toLang, provider: 'auto' };
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            if (!response.ok) throw new Error(`翻译失败: ${response.status}`);
            const data = await response.json();
            if (data.ok) {
                state.currentTargetText = data.translated_text || data.translatedText;
                updateTextDisplay();
                let statusMsg = '翻译完成';
                if (data.detection_info) {
                    const dl = data.detection_info.detected_language;
                    const conf = data.detection_info.confidence;
                    statusMsg = `翻译完成 - 检测为${getLanguageName(dl)} (${(conf*100).toFixed(0)}%)`;
                }
                updateStatus(statusMsg);
                if (state.settings.autoSpeak) speakTranslation();
                addToHistory(text, state.currentTargetText, fromLang, toLang);
            } else {
                throw new Error(data.error || '翻译失败');
            }
        } catch (error) {
            console.error('翻译失败:', error);
            // 后端失败时降级为Google Translate前端直连
            try {
                const params = new URLSearchParams({ client: 'gtx', sl: fromLang === 'auto' ? 'auto' : fromLang, tl: toLang, dt: 't', q: text });
                const resp = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
                const j = await resp.json();
                const translated = j[0].map(p => p[0]).join('');
                state.currentTargetText = translated;
                updateTextDisplay();
                updateStatus('翻译完成（降级模式）');
                if (state.settings.autoSpeak) speakTranslation();
                addToHistory(text, state.currentTargetText, fromLang, toLang);
            } catch (e2) {
                updateStatus('翻译失败: ' + error.message, true);
            }
        }
    }

    // 自动检测目标语言
    async function autoDetectTargetLanguage(sourceText) {
        const pairs = { 'zh-CN': 'en', 'en': 'zh-CN', 'ja': 'zh-CN', 'ko': 'zh-CN' };
        const suggested = pairs[elements.sourceLang.value] || 'en';
        if (suggested !== elements.targetLang.value) {
            elements.targetLang.value = suggested;
            updateLanguageDisplay();
        }
    }

    // 语音合成
    function speakTranslation() {
        if (!state.currentTargetText) return;
        try {
            const utt = new SpeechSynthesisUtterance(state.currentTargetText);
            utt.rate = state.settings.voiceSpeed;
            utt.pitch = state.settings.voicePitch;
            utt.lang = elements.targetLang.value;
            utt.onstart = () => { updateStatus('正在播放语音...'); };
            utt.onend = () => { updateStatus('翻译完成'); };
            utt.onerror = () => { updateStatus('语音播放失败', true); };
            speechSynthesis.cancel();
            speechSynthesis.speak(utt);
        } catch (e) {
            updateStatus('语音合成失败', true);
        }
    }

    function startContinuousSpeech() { speakTranslation(); }
    function stopContinuousSpeech() { speechSynthesis.cancel(); }

    // 交换语言
    function swapLanguages() {
        const sv = elements.sourceLang.value;
        elements.sourceLang.value = elements.targetLang.value;
        elements.targetLang.value = sv;
        if (state.currentSourceText && state.currentTargetText) {
            const tmp = state.currentSourceText;
            state.currentSourceText = state.currentTargetText;
            state.currentTargetText = tmp;
            translateText(state.currentSourceText, elements.sourceLang.value, elements.targetLang.value);
        }
        updateLanguageDisplay();
        updateStatus('已交换语言');
    }

    // 手动翻译
    function translateManualText() {
        const text = elements.manualInput.value.trim();
        if (!text) { elements.manualInput.focus(); return; }
        state.currentSourceText = text;
        state.currentTargetText = '';
        elements.manualInput.value = '';
        updateTextDisplay();
        translateText(text, elements.sourceLang.value, elements.targetLang.value);
    }

    // 历史记录
    function addToHistory(src, tgt, fromLang, toLang) {
        state.translationHistory.unshift({ id: Date.now(), timestamp: new Date().toLocaleString(), sourceText: src, targetText: tgt, fromLang, toLang });
        if (state.translationHistory.length > 50) state.translationHistory = state.translationHistory.slice(0, 50);
        saveHistory();
        updateHistoryDisplay();
    }

    function updateHistoryDisplay() {
        const list = document.getElementById('historyList');
        if (state.translationHistory.length === 0) {
            list.innerHTML = `<div class="history-empty"><i class="fas fa-clock"></i><p>暂无翻译记录</p></div>`;
            return;
        }
        list.innerHTML = state.translationHistory.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-header">
                    <span class="history-time">${item.timestamp}</span>
                    <span class="history-langs">${getLanguageName(item.fromLang)} → ${getLanguageName(item.toLang)}</span>
                </div>
                <div class="history-source">${escapeHtml(item.sourceText.substring(0,100))}${item.sourceText.length>100?'...':''}</div>
                <div class="history-target">${escapeHtml(item.targetText.substring(0,100))}${item.targetText.length>100?'...':''}</div>
                <div class="history-actions"><button class="btn-history-use" onclick="useHistoryItem(${item.id})"><i class="fas fa-redo"></i> 重用</button></div>
            </div>
        `).join('');
    }

    window.useHistoryItem = function(id) {
        const item = state.translationHistory.find(h => h.id === id);
        if (item) {
            elements.sourceLang.value = item.fromLang;
            elements.targetLang.value = item.toLang;
            state.currentSourceText = item.sourceText;
            state.currentTargetText = item.targetText;
            updateLanguageDisplay();
            updateUI();
        }
    };

    function clearHistory() {
        if (!state.translationHistory.length) return;
        if (confirm('确定要清空所有历史记录吗？')) {
            state.translationHistory = [];
            localStorage.removeItem('simulTranslateHistory');
            updateHistoryDisplay();
            updateStatus('已清空历史记录');
        }
    }

    function exportHistory() {
        if (!state.translationHistory.length) { updateStatus('没有历史记录可导出', true); return; }
        const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), history: state.translationHistory }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `翻译历史_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        updateStatus('历史记录已导出');
    }

    function saveHistory() {
        try { localStorage.setItem('simulTranslateHistory', JSON.stringify(state.translationHistory)); } catch(e) {}
    }

    function loadHistory() {
        try { const s = localStorage.getItem('simulTranslateHistory'); if (s) state.translationHistory = JSON.parse(s) || []; } catch(e) { state.translationHistory = []; }
    }

    function showModal(m) { hideAllModals(); m.style.display = 'flex'; }
    function hideAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

    function saveSettingsFromUI() {
        state.settings.voiceSpeed = parseFloat(elements.voiceSpeed.value);
        state.settings.voicePitch = parseFloat(elements.voicePitch.value);
        state.settings.autoDetect = elements.autoDetect.checked;
        state.settings.autoSpeak = elements.autoSpeak.checked;
        saveSettings();
        hideAllModals();
        updateStatus('设置已保存');
    }

    function updateStatus(message, isError = false) {
        elements.statusText.textContent = message;
        if (isError) {
            elements.statusBox.style.background = '#fff5f5';
            elements.statusBox.style.color = '#c53030';
            elements.statusBox.style.borderColor = '#fc8181';
            elements.statusBox.querySelector('i').className = 'fas fa-exclamation-circle';
        } else {
            elements.statusBox.style.background = '#f0fff4';
            elements.statusBox.style.color = '#38a169';
            elements.statusBox.style.borderColor = '#9ae6b4';
            elements.statusBox.querySelector('i').className = 'fas fa-check-circle';
        }
    }

    function escapeHtml(text) {
        const d = document.createElement('div'); d.textContent = text; return d.innerHTML;
    }

    function getLanguageName(code) {
        const names = { 'auto': '自动检测', 'zh-CN': '中文', 'zh-TW': '中文(繁体)', 'en': '英语', 'ja': '日语', 'ko': '韩语', 'fr': '法语', 'de': '德语', 'es': '西班牙语', 'ru': '俄语', 'ar': '阿拉伯语' };
        return names[code] || code;
    }

    loadHistory();
    init();
});
