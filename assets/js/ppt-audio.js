/* ============================================================================
 * 4.5 音频生成 · 页面逻辑
 * 数据源: window.API (真实后端优先, Mock 自动降级)
 * 试听: 浏览器 speechSynthesis (Mock) / 后端音频 URL (生产)
 * ========================================================================== */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    const state = {
        voices: [],
        selectedVoice: null,
        voiceFilter: 'all',
        results: [],   // 生成结果 [{ id, name, kind, voice, durationSec, status, url?, text?, pushed }]
        pending: [],   // 待生成列表: 上一步 PPT 每页讲稿 [{ slideId, slideIndex, title, script, status, resultId }]
        stagedSlideId: null, // 「去生成」载入讲稿文本编辑区的待生成页
        syncPayload: null,
        generatingAll: false,
    };

    const LANG_LABEL = { zh: '简体中文', en: 'English', ja: '日本語' };
    const LANG_TTS = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' };

    /* ================= 初始化 ================= */
    async function init() {
        const { data } = await API.getVoices();
        state.voices = data.voices;
        renderVoices();
        selectVoice(state.voices[0].id);

        await receiveSyncPayload();
        seedResults();

        bindEvents();
        bindAudioEngine();
        updateStats();
        speechSynthesis.getVoices();
    }

    /* ================= 接收 4.4 同步的讲稿 (含全项目分页讲稿) ================= */
    async function receiveSyncPayload() {
        const payload = SyncBridge.load();

        if (payload && payload.script) {
            state.syncPayload = payload;
            $('tts-text').value = payload.script;
            $('sync-banner').classList.remove('hidden');
            $('sync-banner-desc').textContent =
                `《${payload.projectName || payload.slideTitle || '未命名项目'}》· 共 ${payload.slideScripts ? payload.slideScripts.length : 1} 页讲稿 · 语言：${LANG_LABEL[payload.lang] || payload.lang}`;
            $('script-source-badge').classList.remove('hidden');
            $('script-source-badge').classList.add('inline-block');
            // 按讲稿语言自动匹配音色
            const match = state.voices.find(v => v.lang === LANG_TTS[payload.lang]);
            if (match) selectVoice(match.id);

            if (payload.slideScripts && payload.slideScripts.length) {
                buildPendingList(payload.slideScripts, payload.lang);
            } else {
                // 旧格式兼容: 单页讲稿
                buildPendingList([{ slideId: payload.slideId, slideIndex: payload.slideIndex, title: payload.slideTitle, script: payload.script }], payload.lang);
            }
        } else {
            // 无同步数据: 仍加载默认项目的分页讲稿, 便于直接体验待生成流程
            const { data } = await API.getSlideScripts('prj_quantum_001');
            buildPendingList(data.scripts.map(s => ({
                slideId: s.slideId, slideIndex: s.slideIndex, title: s.title,
                script: s.scripts.zh,
            })), 'zh');
        }
        updateStats();
    }

    /* ================= 待生成列表 ================= */
    function buildPendingList(scripts, lang) {
        state.pending = scripts.filter(s => (s.script || '').trim()).map(s => ({
            slideId: s.slideId, slideIndex: s.slideIndex, title: s.title,
            script: s.script, lang: lang || 'zh', status: 'pending', resultId: null,
        }));
        renderPendingList();
    }

    function pendingStatusChip(item) {
        const map = {
            pending: ['bg-surface-container-highest text-on-surface-variant', '待生成'],
            processing: ['bg-primary-fixed text-on-primary-fixed-variant', '合成中…'],
            done: ['bg-secondary-fixed text-on-secondary-fixed-variant', '已生成'],
            failed: ['bg-error-container text-on-error-container', '失败'],
        };
        const [cls, label] = map[item.status];
        const pulse = item.status === 'processing' ? ' pulse-processing' : '';
        return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}${pulse}">${label}</span>`;
    }

    function renderPendingList() {
        const list = $('pending-list');
        list.innerHTML = '';
        if (!state.pending.length) {
            list.innerHTML = '<p class="text-body-sm text-outline text-center py-md">暂无待生成的讲稿，可从「PPT 处理」页同步</p>';
            return;
        }
        state.pending.forEach(item => {
            const el = document.createElement('div');
            el.className = 'pending-item p-sm rounded-lg border border-outline-variant hover:border-primary/40 bg-white transition-colors'
                + (state.stagedSlideId === item.slideId ? ' pending-item-staged' : '');
            el.dataset.slideId = item.slideId;
            el.innerHTML = `
                <div class="flex items-center gap-sm">
                    <div class="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center shrink-0">
                        <span class="text-[11px] font-bold text-primary">${String(item.slideIndex).padStart(2, '0')}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-sm">
                            <p class="text-label-md font-bold truncate">${item.title}</p>
                            <span class="status-chip-slot shrink-0">${pendingStatusChip(item)}</span>
                        </div>
                        <p class="text-[11px] text-on-surface-variant truncate mt-0.5">${item.script.replace(/[「」"]/g, '').slice(0, 42)}…</p>
                    </div>
                </div>
                <div class="flex items-center justify-end gap-xs mt-1.5">
                    <span class="text-[10px] text-outline mr-auto">${item.script.replace(/\s/g, '').length} 字 · 约 ${fmtTime(item.script.length / 4.5)}</span>
                    <button class="preview-btn p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" title="试听讲稿">
                        <span class="material-symbols-outlined text-[16px]">volume_up</span>
                    </button>
                    <button class="gen-btn px-sm py-1 bg-primary text-white text-[10px] font-bold rounded-full hover:opacity-90 flex items-center gap-1" title="载入讲稿到「讲稿文本」区微调后生成">
                        <span class="material-symbols-outlined text-[12px]">edit</span>去生成
                    </button>
                </div>`;
            el.querySelector('.preview-btn').addEventListener('click', () => {
                const playing = AudioEngine.play({
                    id: 'pending_' + item.slideId, kind: 'tts',
                    text: item.script, lang: LANG_TTS[item.lang] || 'zh-CN',
                    durationSec: item.script.length / 4.5,
                });
                el.querySelector('.preview-btn .material-symbols-outlined').textContent = playing ? 'stop_circle' : 'volume_up';
            });
            el.querySelector('.gen-btn').addEventListener('click', () => stageForEdit(item.slideId));
            list.appendChild(el);
        });
        updateFabStatus();
    }

    function updatePendingChip(slideId) {
        const item = state.pending.find(p => p.slideId === slideId);
        const el = document.querySelector(`.pending-item[data-slide-id="${slideId}"]`);
        if (item && el) el.querySelector('.status-chip-slot').innerHTML = pendingStatusChip(item);
    }

    /* 去生成: 将该页口播讲稿载入「讲稿文本」编辑区, 供微调后再点击「生成语音」合成 */
    function stageForEdit(slideId) {
        const item = state.pending.find(p => p.slideId === slideId);
        if (!item) return;
        const pageNo = String(item.slideIndex).padStart(2, '0');

        state.stagedSlideId = slideId;
        $('tts-text').value = item.script;
        updateStats();

        // 来源徽标: 标明当前编辑区文本来自哪一页
        const badge = $('script-source-badge');
        badge.textContent = `待生成 · 第 ${pageNo} 页《${item.title}》`;
        badge.classList.remove('hidden');
        badge.classList.add('inline-block');

        // 列表项高亮当前载入页
        document.querySelectorAll('.pending-item').forEach(el =>
            el.classList.toggle('pending-item-staged', el.dataset.slideId === slideId));

        // 滚动到讲稿编辑区并聚焦, 便于直接微调
        const card = $('tts-text').closest('section') || $('tts-text');
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('tts-text').focus({ preventScroll: true });

        setFabStatus('pending', `微调第 ${pageNo} 页讲稿`);
        toast(`第 ${pageNo} 页讲稿已载入「讲稿文本」，微调后点击「生成语音」`, 'info', 2800);
    }

    /* 生成单页讲稿的配音 */
    async function generatePending(slideId, silent = false) {
        const item = state.pending.find(p => p.slideId === slideId);
        if (!item || item.status === 'processing' || item.status === 'done') return item && item.status === 'done';

        item.status = 'processing';
        updatePendingChip(slideId);
        if (!silent) setFabStatus('processing', `合成第 ${String(item.slideIndex).padStart(2, '0')} 页…`);

        const { data } = await API.ttsGenerate({
            voiceId: state.selectedVoice.id,
            text: item.script,
            rate: parseFloat($('param-rate').value),
            pitch: parseFloat($('param-pitch').value),
            emotion: $('param-emotion').value,
            slideId: item.slideId,
        });

        const result = {
            id: data.taskId,
            name: `幻灯片${String(item.slideIndex).padStart(2, '0')}_${item.title}`,
            kind: 'tts',
            voiceName: state.selectedVoice.name,
            durationSec: data.durationSec,
            status: 'completed',
            time: '刚刚',
            text: item.script, lang: LANG_TTS[item.lang] || state.selectedVoice.lang,
            rate: parseFloat($('param-rate').value),
            pitch: parseFloat($('param-pitch').value),
            pushed: false,
        };
        state.results.push(result);
        addResultItem(result);
        refreshResultCount();

        item.status = 'done';
        item.resultId = result.id;
        updatePendingChip(slideId);
        if (!silent) {
            setFabStatus('completed', '已生成');
            toast(`第 ${String(item.slideIndex).padStart(2, '0')} 页配音已生成（${fmtTime(result.durationSec)}）`, 'success');
        }
        return true;
    }

    /* 批量生成全部待生成页 */
    async function generateAllPending() {
        const todos = state.pending.filter(p => p.status === 'pending' || p.status === 'failed');
        if (!todos.length) { toast('没有待生成的讲稿', 'info'); return; }
        if (state.generatingAll) return;

        state.generatingAll = true;
        const btn = $('btn-generate-all');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm pulse-processing">sync</span>生成中…';

        let done = 0;
        for (const item of todos) {
            setFabStatus('processing', `批量合成 ${done + 1}/${todos.length}`);
            btn.innerHTML = `<span class="material-symbols-outlined text-sm pulse-processing">sync</span>${done + 1}/${todos.length}`;
            await generatePending(item.slideId, true);
            done++;
        }
        updateFabStatus();

        state.generatingAll = false;
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">bolt</span>全部生成';
        setFabStatus('completed', `已生成 ${done} 页`);
        toast(`批量生成完成，共 ${done} 页配音已写入生成结果`, 'success', 3200);
    }

    /* ================= 音色库 ================= */
    function renderVoices() {
        const list = $('voice-list');
        list.innerHTML = '';
        const filtered = state.voices.filter(v => {
            if (state.voiceFilter === 'all') return true;
            if (state.voiceFilter === 'intl') return v.lang !== 'zh-CN';
            return v.gender === state.voiceFilter;
        });
        if (!filtered.length) {
            list.innerHTML = '<p class="text-body-sm text-outline text-center py-lg">该分类下暂无音色</p>';
            return;
        }
        filtered.forEach(v => {
            const selected = state.selectedVoice && state.selectedVoice.id === v.id;
            const card = document.createElement('div');
            card.className = `voice-card flex items-center gap-md p-md rounded-lg border ${selected ? 'selected border-primary' : 'border-outline-variant hover:border-primary/50'} bg-white transition-all`;
            card.dataset.voiceId = v.id;
            card.innerHTML = `
                <div class="w-10 h-10 rounded-full ${v.gender === 'male' ? 'bg-primary-fixed' : 'bg-tertiary-fixed'} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined ${v.gender === 'male' ? 'text-primary' : 'text-tertiary'}">${v.gender === 'male' ? 'man' : 'woman'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-label-md font-bold">${v.name}</p>
                    <p class="text-[11px] text-on-surface-variant">${v.style} · ${v.langLabel}</p>
                </div>
                <button class="sample-btn p-2 rounded-lg hover:bg-surface-container text-primary" title="试听音色">
                    <span class="material-symbols-outlined text-[20px]">play_circle</span>
                </button>`;
            card.addEventListener('click', () => selectVoice(v.id));
            card.querySelector('.sample-btn').addEventListener('click', e => {
                e.stopPropagation();
                auditionVoice(v, card.querySelector('.sample-btn'));
            });
            list.appendChild(card);
        });
    }

    function selectVoice(id) {
        state.selectedVoice = state.voices.find(v => v.id === id);
        document.querySelectorAll('.voice-card').forEach(c => {
            const on = c.dataset.voiceId === id;
            c.classList.toggle('selected', on);
            c.classList.toggle('border-primary', on);
            c.classList.toggle('border-outline-variant', !on);
        });
        $('fab-voice').textContent = state.selectedVoice.name;
    }

    function auditionVoice(v, btn) {
        const playing = AudioEngine.play({
            id: 'voice_' + v.id, kind: 'tts', text: v.sample, lang: v.lang, durationSec: v.sample.length / 4.5,
        });
        btn.querySelector('.material-symbols-outlined').textContent = playing ? 'stop_circle' : 'play_circle';
    }

    /* ================= 讲稿统计 ================= */
    function updateStats() {
        const text = $('tts-text').value;
        const len = text.replace(/\s/g, '').length;
        const rate = parseFloat($('param-rate').value) || 1;
        $('tts-char-count').textContent = `${len} 字`;
        $('tts-duration-est').textContent = `约 ${fmtTime(len / 4.5 / rate)} 分钟`;
    }

    /* ================= 生成结果列表 ================= */
    function seedResults() {
        // 预置两条历史生成记录 (Mock)
        [
            { id: 'seed1', name: '幻灯片02_旁白_v2', kind: 'tts', voiceName: '学术专家', durationSec: 96, status: 'completed', time: '昨天 17:20', pushed: true,
              text: '在正式进入方程之前，让我们先回顾一下历史。' },
            { id: 'seed2', name: '开场白_试听版', kind: 'tts', voiceName: '亲切讲师', durationSec: 24, status: 'completed', time: '昨天 16:02', pushed: false,
              text: '同学们好，欢迎来到今天的微课。' },
        ].forEach(it => { state.results.push(it); addResultItem(it, false); });
        refreshResultCount();
    }

    function refreshResultCount() {
        $('result-count').textContent = `${state.results.length} 条音频`;
    }

    function statusBadge(status, pushed) {
        if (pushed) return '<span class="status-badge status-completed"><span class="dot"></span>已写入视频流程</span>';
        const map = {
            queuing: ['status-queuing', '排队中'],
            processing: ['status-processing', '合成中'],
            completed: ['status-completed', '已完成'],
            failed: ['status-failed', '失败'],
        };
        const [cls, label] = map[status] || map.completed;
        return `<span class="status-badge ${cls}"><span class="dot"></span>${label}</span>`;
    }

    function addResultItem(item, animate = true) {
        const list = $('result-list');
        const el = document.createElement('div');
        el.className = `p-md rounded-lg border border-outline-variant bg-white hover:border-primary/40 transition-colors ${animate ? 'item-enter' : ''}`;
        el.dataset.itemId = item.id;
        el.innerHTML = `
            <div class="flex items-center gap-md">
                <button class="play-btn w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0 hover:opacity-80" title="试听">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-label-md font-bold truncate">${item.name}</p>
                        <div class="badge-slot">${statusBadge(item.status, item.pushed)}</div>
                    </div>
                    <div class="waveform" data-wave="${item.id}"></div>
                    <div class="flex items-center justify-between mt-1">
                        <p class="meta-line text-[11px] text-on-surface-variant">${item.voiceName || '自定义'} · ${fmtTime(item.durationSec)} · ${item.time || '刚刚'}</p>
                        <div class="flex items-center gap-xs">
                            <button class="dl-btn p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant" title="下载">
                                <span class="material-symbols-outlined text-[18px]">download</span>
                            </button>
                            <button class="push-btn p-1.5 rounded-lg hover:bg-surface-container text-secondary" title="写入数字人视频流程">
                                <span class="material-symbols-outlined text-[18px]">movie</span>
                            </button>
                            <button class="del-btn p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error" title="删除">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        list.prepend(el);
        renderWaveform(el.querySelector('.waveform'), item.id);

        el.querySelector('.play-btn').addEventListener('click', () => playResult(item.id));
        el.querySelector('.dl-btn').addEventListener('click', () => downloadResult(item.id));
        el.querySelector('.push-btn').addEventListener('click', () => pushResult(item.id));
        el.querySelector('.del-btn').addEventListener('click', () => removeResult(item.id));
        return el;
    }

    function findItem(id) { return state.results.find(r => r.id === id); }
    function findItemEl(id) { return document.querySelector(`[data-item-id="${id}"]`); }

    /* ================= 试听 / 下载 / 写入 / 删除 ================= */
    function playResult(id) {
        const item = findItem(id);
        if (!item) return;
        AudioEngine.play({
            id: 'result_' + id, kind: item.kind, url: item.url,
            text: item.text, lang: item.lang || (state.selectedVoice && state.selectedVoice.lang) || 'zh-CN',
            rate: item.rate || 1, pitch: item.pitch || 1, durationSec: item.durationSec,
        });
    }

    function downloadResult(id) {
        const item = findItem(id);
        if (!item) return;
        if (item.kind === 'file' && item.url) {
            // 上传的真实文件: 直接下载
            const a = document.createElement('a');
            a.href = item.url; a.download = item.name;
            a.click();
            toast(`已下载「${item.name}」`, 'success');
        } else {
            // Mock TTS: 生成占位 WAV; 生产环境由后端返回真实音频 URL
            const t = toast('正在准备下载文件…', 'loading', 0);
            setTimeout(() => {
                downloadBlob(makePlaceholderWav(Math.min(item.durationSec, 8)), item.name + '.wav');
                t.close();
                toast(`已下载「${item.name}.wav」（演示占位音频，生产环境为合成结果）`, 'info', 3600);
            }, 600);
        }
    }

    function pushResult(id) {
        const item = findItem(id);
        if (!item || item.pushed) { if (item && item.pushed) toast('该音频已在视频流程中', 'info'); return; }
        confirmModal('写入数字人视频流程',
            `将音频「${item.name}」作为配音素材写入数字人视频合成流程？`, async () => {
                const t = toast('正在写入视频流程…', 'loading', 0);
                const { data } = await API.pushToVideo({
                    audioId: item.id, audioName: item.name,
                    slideId: state.syncPayload ? state.syncPayload.slideId : undefined,
                });
                t.close();
                item.pushed = true;
                findItemEl(id).querySelector('.badge-slot').innerHTML = statusBadge(item.status, true);
                toast(`已写入视频流程（流水线 ${data.pipelineId}）`, 'success');
            }, '写入');
    }

    function removeResult(id) {
        const item = findItem(id);
        confirmModal('删除音频', `确定删除「${item.name}」吗？该操作不可撤销。`, () => {
            const el = findItemEl(id);
            if (AudioEngine.current && AudioEngine.current.id === 'result_' + id) AudioEngine.stop();
            el.style.transition = 'all .25s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateX(30px)';
            setTimeout(() => {
                el.remove();
                state.results = state.results.filter(r => r.id !== id);
                refreshResultCount();
            }, 260);
            toast('音频已删除', 'success');
        }, '删除');
    }

    /* ================= AudioEngine 回调 → UI ================= */
    function bindAudioEngine() {
        AudioEngine.onStateChange = (engineId, playing) => {
            // 结果列表播放按钮
            if (engineId.startsWith('result_')) {
                const itemId = engineId.replace('result_', '');
                const el = findItemEl(itemId);
                if (el) {
                    const btn = el.querySelector('.play-btn');
                    btn.classList.toggle('is-playing', playing);
                    btn.querySelector('.material-symbols-outlined').textContent = playing ? 'stop' : 'play_arrow';
                    if (!playing) setWaveformProgress(el.querySelector('.waveform'), 0);
                }
            }
            // 音色试听按钮
            if (engineId.startsWith('voice_')) {
                const vid = engineId.replace('voice_', '');
                const card = document.querySelector(`.voice-card[data-voice-id="${vid}"]`);
                if (card && !playing) card.querySelector('.sample-btn .material-symbols-outlined').textContent = 'play_circle';
            }
            // 讲稿试听按钮
            if (engineId === 'script-audition' && !playing) {
                $('btn-audition').innerHTML = '<span class="material-symbols-outlined text-sm">volume_up</span>试听';
            }
        };
        AudioEngine.onProgress = (engineId, ratio) => {
            if (engineId.startsWith('result_')) {
                const el = findItemEl(engineId.replace('result_', ''));
                if (el) setWaveformProgress(el.querySelector('.waveform'), ratio);
            }
        };
    }

    /* ================= 生成语音 (主流程) ================= */
    const GEN_STEPS = ['文本预处理', '声学模型合成', '声码器渲染', '写入生成结果'];

    async function generate() {
        const text = $('tts-text').value.trim();
        if (!state.selectedVoice) { toast('请先选择音色', 'error'); return; }
        if (!text) { toast('请输入讲稿文本', 'error'); return; }

        // 当前文本若是经「去生成」从待生成列表载入的, 生成成功后同步该页状态
        const staged = state.stagedSlideId ? state.pending.find(p => p.slideId === state.stagedSlideId) : null;

        setFabStatus('processing', '合成中');

        // 进度弹窗: 步骤条 + 进度条
        const body = document.createElement('div');
        body.innerHTML = `
            <div class="space-y-md mb-lg">
                ${GEN_STEPS.map((s, i) => `
                    <div class="gen-step" data-step="${i}">
                        <div class="step-icon"><span class="material-symbols-outlined" style="font-size:14px">check</span></div>
                        <span>${s}</span>
                    </div>`).join('')}
            </div>
            <div class="progress-track h-2"><div class="progress-fill" id="gen-progress" style="width:0%"></div></div>
            <p class="text-[11px] text-outline mt-2 text-right" id="gen-pct">0%</p>`;
        const modal = showModal({ title: '语音合成中', icon: 'graphic_eq', body, actions: [], width: 400 });

        const apiPromise = API.ttsGenerate({
            voiceId: state.selectedVoice.id,
            text,
            rate: parseFloat($('param-rate').value),
            pitch: parseFloat($('param-pitch').value),
            emotion: $('param-emotion').value,
            slideId: staged ? staged.slideId : (state.syncPayload ? state.syncPayload.slideId : undefined),
        });

        // 步骤动画
        const stepEls = body.querySelectorAll('.gen-step');
        const bar = body.querySelector('#gen-progress');
        const pct = body.querySelector('#gen-pct');
        for (let i = 0; i < GEN_STEPS.length; i++) {
            stepEls[i].classList.add('active');
            const target = ((i + 1) / GEN_STEPS.length) * 100;
            await animateBar(bar, pct, target, 620);
            stepEls[i].classList.remove('active');
            stepEls[i].classList.add('done');
        }

        const { data } = await apiPromise;
        modal.close();

        const item = {
            id: data.taskId,
            name: staged
                ? `幻灯片${String(staged.slideIndex).padStart(2, '0')}_${staged.title}`
                : `${state.syncPayload ? state.syncPayload.slideTitle : '自由讲稿'}_${state.selectedVoice.name}`,
            kind: 'tts',
            voiceName: state.selectedVoice.name,
            durationSec: data.durationSec,
            status: 'completed',
            time: '刚刚',
            text, lang: state.selectedVoice.lang,
            rate: parseFloat($('param-rate').value),
            pitch: parseFloat($('param-pitch').value),
            pushed: false,
        };
        state.results.push(item);
        addResultItem(item);
        refreshResultCount();

        // 同步待生成列表: 该页标记「已生成」并解除编辑区高亮
        if (staged) {
            staged.status = 'done';
            staged.resultId = item.id;
            updatePendingChip(staged.slideId);
            state.stagedSlideId = null;
            document.querySelectorAll('.pending-item').forEach(el => el.classList.remove('pending-item-staged'));
            updateFabStatus();
        }

        setFabStatus('completed', '已生成');
        toast(`语音合成完成（${fmtTime(item.durationSec)}），可试听或写入视频流程`, 'success', 3200);
    }

    function animateBar(bar, pct, target, ms) {
        return new Promise(resolve => {
            const start = parseFloat(bar.style.width) || 0;
            const t0 = performance.now();
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                bar.style.width = target + '%';
                pct.textContent = Math.round(target) + '%';
                resolve();
            };
            // rAF 在后台标签页/被节流环境下会停滞, 用 setTimeout 兜底保证流程必达终点
            setTimeout(finish, ms + 150);
            (function frame(t) {
                if (finished) return;
                const k = Math.min(1, (t - t0) / ms);
                const v = start + (target - start) * k;
                bar.style.width = v + '%';
                pct.textContent = Math.round(v) + '%';
                if (k < 1) requestAnimationFrame(frame); else finish();
            })(t0);
        });
    }

    function setFabStatus(kind, text) {
        $('fab-status-text').textContent = text;
        const color = kind === 'completed' ? 'bg-secondary' : kind === 'processing' ? 'bg-primary' : 'bg-tertiary-fixed-dim';
        $('fab-status-dot').className = `w-2 h-2 rounded-full ${color} pulse-processing`;
    }

    /* 悬浮栏状态: 有待生成页时显示待办数 */
    function updateFabStatus() {
        const left = state.pending.filter(p => p.status === 'pending' || p.status === 'failed').length;
        if (state.generatingAll) return; // 批量进行中不打断进度文案
        if (left > 0) setFabStatus('pending', `待生成 ${left} 页`);
        else if (state.pending.length) setFabStatus('completed', '全部已生成');
        else setFabStatus('pending', '待生成');
    }

    /* ================= 生成历史抽屉 ================= */
    function openHistory() {
        const body = document.createElement('div');
        body.className = 'space-y-md';
        const history = state.results.length
            ? state.results
            : [];
        if (!history.length) {
            body.innerHTML = '<p class="text-body-sm text-outline text-center py-lg">暂无生成记录</p>';
        } else {
            body.innerHTML = history.slice().reverse().map(it => `
                <div class="p-md rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-label-md font-bold truncate">${it.name}</span>
                        ${statusBadge(it.status, it.pushed)}
                    </div>
                    <p class="text-[11px] text-on-surface-variant">${it.voiceName || '自定义'} · ${fmtTime(it.durationSec)} · ${it.time || '刚刚'}</p>
                </div>`).join('');
        }
        showDrawer({ title: '生成历史', icon: 'history', bodyEl: body });
    }

    /* ================= 事件绑定 ================= */
    function bindEvents() {
        // 音色分类页签
        $('voice-tabs').querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                $('voice-tabs').querySelectorAll('button').forEach(b => {
                    b.classList.remove('tab-active'); b.classList.add('text-on-surface-variant');
                });
                btn.classList.add('tab-active'); btn.classList.remove('text-on-surface-variant');
                state.voiceFilter = btn.dataset.filter;
                renderVoices();
            });
        });

        // 讲稿输入
        $('tts-text').addEventListener('input', updateStats);

        // 参数
        $('param-rate').addEventListener('input', e => {
            $('rate-val').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
            updateStats();
        });
        $('param-pitch').addEventListener('input', e => {
            $('pitch-val').textContent = parseFloat(e.target.value).toFixed(1);
        });

        // 插入停顿 (光标处)
        $('btn-insert-pause').addEventListener('click', () => {
            const ta = $('tts-text');
            const token = '[停顿0.5s]';
            const pos = ta.selectionStart ?? ta.value.length;
            ta.value = ta.value.slice(0, pos) + token + ta.value.slice(pos);
            ta.focus();
            ta.selectionStart = ta.selectionEnd = pos + token.length;
            updateStats();
            toast('已在光标处插入停顿标记', 'info', 1500);
        });

        // 清空
        $('btn-clear-script').addEventListener('click', () => {
            if (!$('tts-text').value) return;
            confirmModal('清空讲稿', '确定清空当前讲稿文本吗？', () => {
                $('tts-text').value = '';
                updateStats();
                state.stagedSlideId = null;
                document.querySelectorAll('.pending-item').forEach(el => el.classList.remove('pending-item-staged'));
                toast('讲稿已清空', 'success');
            }, '清空');
        });

        // 试听 (悬浮栏)
        $('btn-audition').addEventListener('click', () => {
            const text = $('tts-text').value.trim();
            if (!text) { toast('请输入讲稿文本', 'error'); return; }
            if (!state.selectedVoice) { toast('请先选择音色', 'error'); return; }
            const rate = parseFloat($('param-rate').value);
            const playing = AudioEngine.play({
                id: 'script-audition', kind: 'tts',
                text: text.replace(/\[停顿0\.5s\]/g, '，'),
                lang: state.selectedVoice.lang, rate,
                pitch: parseFloat($('param-pitch').value),
                durationSec: text.length / 4.5 / rate,
            });
            $('btn-audition').innerHTML = playing
                ? '<span class="material-symbols-outlined text-sm">stop_circle</span>停止'
                : '<span class="material-symbols-outlined text-sm">volume_up</span>试听';
        });

        $('btn-generate').addEventListener('click', generate);
        $('btn-generate-all').addEventListener('click', generateAllPending);
        $('btn-back-ppt').addEventListener('click', () => { location.href = 'ppt-translation.html'; });
        $('btn-save-draft').addEventListener('click', () => toast('草稿已保存', 'success'));
        $('btn-history').addEventListener('click', openHistory);
        $('sync-banner-close').addEventListener('click', () => {
            $('sync-banner').remove();
            SyncBridge.clear();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
