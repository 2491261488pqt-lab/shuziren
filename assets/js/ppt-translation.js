/* ============================================================================
 * 4.4 PPT 翻译与讲稿处理 · 页面逻辑
 * 数据源: window.API (真实后端优先, Mock 自动降级)
 * ========================================================================== */
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    /* ---------------- 页面状态 ---------------- */
    const state = {
        project: null,          // { id, fileName, fileSize, pageCount }
        slides: [],             // 幻灯片数组
        currentSlide: null,     // 当前选中幻灯片
        targetLang: 'ja',
        dirty: false,           // 有未同步修改
    };

    const LANG_NAME = { zh: '简体中文', en: 'English', ja: '日本語' };
    const LANG_LABEL = { zh: 'AI 翻译与编辑', en: 'AI Translation & Edit', ja: 'AI 翻訳と編集' };
    const TTS_LANG = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' };

    /* ---------------- 初始化 ---------------- */
    async function init() {
        const { data } = await API.getSlides('prj_quantum_001');
        state.project = { id: 'prj_quantum_001', fileName: '高等量子物理.pptx', fileSize: '12.4 MB', pageCount: 14 };
        state.slides = data.slides;
        renderSlideList();
        selectSlide(state.slides[0].id);
        bindEvents();
        speechSynthesis.getVoices(); // 预热浏览器音色
        // 字体加载完成后重新校准文本域高度
        window.addEventListener('load', () =>
            document.querySelectorAll('#trans-blocks textarea').forEach(t => autoGrow(t)));

    }

    /* ---------------- 幻灯片列表 ---------------- */
    function slideThumbHtml(i, active) {
        // 用 CSS 模拟 PPT 缩略图 (避免外部图片依赖)
        const lines = active
            ? '<div style="height:3px;background:#005daa;width:70%;border-radius:2px"></div>'
            : '<div style="height:3px;background:#c0c7d6;width:70%;border-radius:2px"></div>';
        return `<div class="w-24 h-16 rounded overflow-hidden shadow-sm border ${active ? 'border-primary' : 'border-outline-variant'} bg-white p-2 flex flex-col gap-1 shrink-0">
            ${lines}
            <div style="height:2px;background:#e3e2e2;width:90%;border-radius:2px"></div>
            <div style="height:2px;background:#e3e2e2;width:85%;border-radius:2px"></div>
            <div style="height:2px;background:#e3e2e2;width:60%;border-radius:2px"></div>
            <div class="mt-auto text-[8px] font-bold ${active ? 'text-primary' : 'text-outline'}">${String(i).padStart(2, '0')}</div>
        </div>`;
    }

    function renderSlideList() {
        const list = $('slide-list');
        list.innerHTML = '';
        state.slides.forEach(s => {
            const active = state.currentSlide && state.currentSlide.id === s.id;
            const item = document.createElement('div');
            item.className = `flex gap-md cursor-pointer rounded-lg p-2 transition-all ${active ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : 'hover:bg-surface-container'}`;
            item.dataset.slideId = s.id;
            item.innerHTML = `
                ${slideThumbHtml(s.index, active)}
                <div class="flex-1 min-w-0">
                    <p class="text-label-md font-bold ${active ? 'text-primary' : ''}">幻灯片 ${String(s.index).padStart(2, '0')}</p>
                    <p class="text-[11px] text-on-surface-variant line-clamp-2 ${active ? 'italic' : ''}">标题：${s.title}</p>
                </div>`;
            item.addEventListener('click', () => selectSlide(s.id));
            list.appendChild(item);
        });
    }

    /* ---------------- 选中幻灯片 → 渲染编辑器 ---------------- */
    async function selectSlide(slideId) {
        state.currentSlide = state.slides.find(s => s.id === slideId);
        renderSlideList();

        const s = state.currentSlide;
        $('source-label').textContent = `原件内容 (幻灯片 ${String(s.index).padStart(2, '0')})`;
        $('source-title').textContent = s.title;
        $('source-blocks').innerHTML = s.blocks.zh.map((b, i) => `
            <p class="p-sm bg-white border border-outline-variant rounded-lg ${i === 0 ? 'border-l-4 border-primary' : ''}">${i + 1}. ${b}</p>
        `).join('');

        await loadTranslations();
        await loadScript();
        updateSyncStatus();
    }

    /* ---------------- 翻译 ---------------- */
    async function loadTranslations() {
        const s = state.currentSlide;
        $('edit-label').textContent = LANG_LABEL[state.targetLang];
        setSyncBadge('processing', '翻译中…');

        // 骨架屏
        $('trans-blocks').innerHTML = s.blocks.zh.map(() =>
            '<div class="animate-pulse bg-surface-container rounded-lg" style="height:60px"></div>').join('');
        $('trans-title').value = '翻译中…';

        const { data } = await API.translate(s.id, state.targetLang);
        $('trans-title').value = state.targetLang === 'zh' ? s.title : translateTitle(s.title);
        renderTransBlocks(data.translations);
        setSyncBadge('completed', '已同步');
    }

    function translateTitle(title) {
        // Mock 标题翻译; 真实场景由后端 translate 接口返回
        const map = {
            ja: { '薛定谔方程及其波函数应用': 'シュレーディンガー方程式とその波動関数の応用',
                  '量子理论发展的历史背景': '量子理論発展の歴史的背景',
                  '原子结构的基本原理': '原子構造の基本原理',
                  '英语演讲的开场技巧': '英語スピーチのオープニングテクニック',
                  '段落结构与逻辑连接词': '段落構造と論理接続詞',
                  '学术写作中的常见错误': '学術写作におけるよくある間違い',
                  '数字营销的核心概念': 'デジタルマーケティングの核心概念',
                  '社交媒体运营策略': 'ソーシャルメディア運用戦略',
                  '数据分析与效果评估': 'データ分析と効果評価' },
            en: { '薛定谔方程及其波函数应用': 'The Schrödinger Equation and Wave Function Applications',
                  '量子理论发展的历史背景': 'Historical Background of Quantum Theory',
                  '原子结构的基本原理': 'Fundamentals of Atomic Structure',
                  '英语演讲的开场技巧': 'Opening Techniques for English Speeches',
                  '段落结构与逻辑连接词': 'Paragraph Structure and Logical Connectives',
                  '学术写作中的常见错误': 'Common Mistakes in Academic Writing',
                  '数字营销的核心概念': 'Core Concepts of Digital Marketing',
                  '社交媒体运营策略': 'Social Media Operation Strategies',
                  '数据分析与效果评估': 'Data Analysis and Performance Evaluation' },
        };
        return (map[state.targetLang] || {})[title] || title;
    }

    function renderTransBlocks(texts) {
        const wrap = $('trans-blocks');
        wrap.innerHTML = '';
        texts.forEach((t, i) => {
            const div = document.createElement('div');
            div.className = 'relative group';
            div.innerHTML = `
                <textarea class="auto-grow w-full text-body-md border border-transparent focus:border-primary/40 focus:ring-0 p-sm min-h-[60px] bg-surface-container-low rounded-lg transition-all" placeholder="输入翻译内容...">${t}</textarea>
                <button class="retrans-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white shadow-sm rounded-md border border-outline-variant" title="重新翻译本段">
                    <span class="material-symbols-outlined text-[16px] text-primary">refresh</span>
                </button>`;
            const ta = div.querySelector('textarea');
            autoGrow(ta);
            ta.addEventListener('input', () => { autoGrow(ta); markDirty(); });
            div.querySelector('.retrans-btn').addEventListener('click', async () => {
                const icon = div.querySelector('.retrans-btn .material-symbols-outlined');
                icon.classList.add('pulse-processing');
                const { data } = await API.translate(state.currentSlide.id, state.targetLang);
                ta.value = data.translations[i] || t;
                autoGrow(ta);
                icon.classList.remove('pulse-processing');
                toast(`第 ${i + 1} 段已重新翻译`, 'success', 1600);
                markDirty();
            });
            wrap.appendChild(div);
        });
    }

    function autoGrow(ta, retry = 0) {
        ta.style.height = 'auto';
        const h = ta.scrollHeight;
        if (h > 0) {
            ta.style.height = h + 'px';
        } else if (retry < 10) {
            // 布局未就绪时延迟重试, 避免高度被量成 0
            ta.style.height = '';
            requestAnimationFrame(() => autoGrow(ta, retry + 1));
        }
    }

    /* ---------------- 讲稿 ---------------- */
    async function loadScript() {
        const { data } = await API.generateScript(state.currentSlide.id, { lang: state.targetLang, style: $('style-select').value });
        $('script-text').value = data.script;
        updateScriptStats();
    }

    function updateScriptStats() {
        const len = $('script-text').value.replace(/\s/g, '').length;
        $('char-count').textContent = `${len} 字`;
        $('duration-est').textContent = `约 ${fmtTime(len / 4.5)} 分钟`;
    }

    async function regenerateScript() {
        const btn = $('btn-regen-script');
        const ta = $('script-text');
        btn.disabled = true;
        btn.querySelector('span').classList.add('pulse-processing');
        ta.value = '';
        ta.classList.add('typing-caret');
        updateScriptStats();

        const { data } = await API.generateScript(state.currentSlide.id, { lang: state.targetLang, style: $('style-select').value });

        // 打字机效果
        const full = data.script;
        let i = 0;
        await new Promise(resolve => {
            const timer = setInterval(() => {
                i += 3 + Math.floor(Math.random() * 4);
                ta.value = full.slice(0, i);
                ta.scrollTop = ta.scrollHeight;
                updateScriptStats();
                if (i >= full.length) { clearInterval(timer); resolve(); }
            }, 28);
        });

        ta.classList.remove('typing-caret');
        btn.disabled = false;
        btn.querySelector('span').classList.remove('pulse-processing');
        toast('讲稿已重新生成', 'success');
        markDirty();
    }

    /* ---------------- 同步状态 ---------------- */
    function markDirty() {
        state.dirty = true;
        updateSyncStatus();
        setSyncBadge('processing', '编辑中');
    }
    function updateSyncStatus() {
        $('fab-status-text').textContent = state.dirty ? '待同步' : '已同步';
        $('fab-status-dot').className = `w-2 h-2 rounded-full ${state.dirty ? 'bg-tertiary-fixed-dim' : 'bg-secondary'} pulse-processing`;
    }
    function setSyncBadge(kind, text) {
        const badge = $('sync-status');
        const color = kind === 'completed' ? 'bg-secondary' : 'bg-primary pulse-processing';
        badge.innerHTML = `<span class="w-1.5 h-1.5 ${color} rounded-full"></span>${text}`;
    }

    /* ---------------- 模式切换 (对照 / 专注讲稿) ---------------- */
    function bindModeToggle() {
        const btnSplit = $('btn-split-mode'), btnFocus = $('btn-focus-mode');
        const paneSource = $('pane-source'), paneEdit = $('pane-edit');
        btnFocus.addEventListener('click', () => {
            btnSplit.classList.remove('tab-active'); btnSplit.classList.add('text-on-surface-variant');
            btnFocus.classList.add('tab-active'); btnFocus.classList.remove('text-on-surface-variant');
            paneSource.classList.add('hidden'); paneSource.classList.remove('w-1/2', 'border-r');
            paneEdit.classList.remove('w-1/2'); paneEdit.classList.add('w-full');
            document.querySelectorAll('#trans-blocks textarea').forEach(autoGrow);
        });
        btnSplit.addEventListener('click', () => {
            btnFocus.classList.remove('tab-active'); btnFocus.classList.add('text-on-surface-variant');
            btnSplit.classList.add('tab-active'); btnSplit.classList.remove('text-on-surface-variant');
            paneSource.classList.remove('hidden'); paneSource.classList.add('w-1/2', 'border-r');
            paneEdit.classList.remove('w-full'); paneEdit.classList.add('w-1/2');
        });
    }

    /* ---------------- PPT 上传与解析 ---------------- */
    function bindUpload() {
        const dz = $('dropzone');
        const input = $('ppt-file-input');
        // 点击 PPT 原件区 → 弹出来源选择弹窗 (本地上传 / 从已生成的 PPT 中选择)
        dz.addEventListener('click', () => openSourceModal());
        // 直接拖拽到卡片上仍然支持快捷上传
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', e => {
            e.preventDefault(); dz.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) handleParse(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => { if (input.files[0]) handleParse(input.files[0]); });
    }

    /* ---------------- PPT 来源选择弹窗 ---------------- */
    function openSourceModal() {
        const body = document.createElement('div');
        body.innerHTML = `
            <div class="flex bg-surface-container rounded-lg p-0.5 mb-md" id="src-tabs">
                <button data-tab="local" class="flex-1 px-md py-1.5 text-label-md font-bold tab-active rounded-md">从本地上传</button>
                <button data-tab="library" class="flex-1 px-md py-1.5 text-label-md font-bold text-on-surface-variant rounded-md">从已生成的 PPT 中选择</button>
            </div>
            <div id="src-pane-local">
                <div id="modal-dropzone" class="dropzone bg-surface-container-low border-2 border-dashed border-outline-variant rounded-xl p-xl text-center cursor-pointer hover:border-primary transition-colors">
                    <span class="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
                    <p class="text-body-md font-semibold mt-sm">点击选择或拖拽 PPT 文件到此处</p>
                    <p class="text-[11px] text-outline mt-1">支持 .ppt / .pptx，单文件不超过 100 MB</p>
                </div>
            </div>
            <div id="src-pane-library" class="hidden">
                <div id="lib-list" class="space-y-sm max-h-[320px] overflow-y-auto custom-scrollbar">
                    <div class="animate-pulse bg-surface-container rounded-lg" style="height:64px"></div>
                    <div class="animate-pulse bg-surface-container rounded-lg" style="height:64px"></div>
                </div>
            </div>`;

        const modal = showModal({ title: '选择 PPT 来源', icon: 'upload_file', body, actions: [], width: 520 });

        // 选项卡切换
        const tabs = body.querySelectorAll('#src-tabs button');
        tabs.forEach(btn => btn.addEventListener('click', () => {
            tabs.forEach(b => { b.classList.remove('tab-active'); b.classList.add('text-on-surface-variant'); });
            btn.classList.add('tab-active'); btn.classList.remove('text-on-surface-variant');
            body.querySelector('#src-pane-local').classList.toggle('hidden', btn.dataset.tab !== 'local');
            body.querySelector('#src-pane-library').classList.toggle('hidden', btn.dataset.tab !== 'library');
            if (btn.dataset.tab === 'library') renderLibraryList(modal);
        }));

        // 本地上传: 点击 / 拖拽
        const mdz = body.querySelector('#modal-dropzone');
        const input = $('ppt-file-input');
        mdz.addEventListener('click', () => input.click());
        mdz.addEventListener('dragover', e => { e.preventDefault(); mdz.classList.add('drag-over'); });
        mdz.addEventListener('dragleave', () => mdz.classList.remove('drag-over'));
        mdz.addEventListener('drop', e => {
            e.preventDefault(); mdz.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) { modal.close(); handleParse(e.dataTransfer.files[0]); }
        });
        // 文件选择后关闭弹窗 (change 事件由 bindUpload 中的监听器处理解析)
        input.addEventListener('change', () => modal.close(), { once: true });

        // 预加载项目库 (默认仍展示本地上传, 数据提前取回)
        renderLibraryList(modal);
    }

    async function renderLibraryList(modal) {
        const list = $('lib-list');
        const { data } = await API.getPptProjects();
        if (!document.body.contains(list)) return; // 弹窗已关闭
        list.innerHTML = '';
        data.projects.forEach(p => {
            const isCurrent = state.project && state.project.id === p.id;
            const item = document.createElement('div');
            item.className = `flex items-center gap-md p-md rounded-lg border cursor-pointer transition-all ${isCurrent ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container-low'}`;
            item.innerHTML = `
                <div class="w-11 h-11 rounded-lg ${isCurrent ? 'bg-primary' : 'bg-primary-fixed'} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined ${isCurrent ? 'text-white' : 'text-primary'}">description</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-label-md font-bold truncate">${p.fileName}</p>
                    <p class="text-[11px] text-on-surface-variant">${p.course} · ${p.fileSize} · ${p.pageCount} 页</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[10px] text-outline">${p.updatedAt}</p>
                    ${isCurrent ? '<p class="text-[10px] font-bold text-primary mt-0.5">当前项目</p>' : '<p class="text-[10px] font-bold text-outline mt-0.5 group-hover:text-primary">点击加载</p>'}
                </div>`;
            item.addEventListener('click', () => {
                if (isCurrent) { toast('该项目已是当前工作区内容', 'info'); return; }
                modal.close();
                loadLibraryProject(p.id);
            });
            list.appendChild(item);
        });
    }

    /* ---------------- 解析进度动画 (上传与库加载共用) ---------------- */
    function animateParsing(fileName, sizeText) {
        $('parse-badge').className = 'status-badge status-processing';
        $('parse-badge').innerHTML = '<span class="dot"></span>解析中';
        $('ppt-name').textContent = fileName;
        $('ppt-meta').textContent = sizeText + ' • 解析中…';
        const bar = $('parse-progress'), pct = $('parse-percent'), statusText = $('parse-status-text');
        statusText.textContent = '正在解析幻灯片结构…';
        bar.style.width = '0%';
        return new Promise(resolve => {
            let p = 0;
            const timer = setInterval(() => {
                p = Math.min(100, p + Math.random() * 12);
                bar.style.width = p + '%';
                pct.textContent = Math.round(p) + '%';
                if (p > 55) statusText.textContent = '提取文本块与版式…';
                if (p > 85) statusText.textContent = '构建对照索引…';
                if (p >= 100) { clearInterval(timer); resolve(); }
            }, 90);
        });
    }

    function finishParsing(fileName, sizeText, pageCount) {
        $('ppt-meta').textContent = `${sizeText} • ${pageCount} 页`;
        $('parse-status-text').textContent = '解析完成';
        $('parse-badge').className = 'status-badge status-completed';
        $('parse-badge').innerHTML = '<span class="dot"></span>已解析';
        $('slide-count').textContent = `${pageCount} 页`;
        toast(`「${fileName}」解析完成，共 ${pageCount} 页`, 'success');
    }

    /* ---------------- 本地上传解析 ---------------- */
    async function handleParse(file) {
        if (!/\.pptx?$/i.test(file.name)) { toast('仅支持 .ppt / .pptx 文件', 'error'); return; }
        const sizeText = (file.size / 1048576).toFixed(1) + ' MB';
        const apiPromise = API.pptParse(file);
        await animateParsing(file.name, sizeText);
        const { data } = await apiPromise;
        state.project = { id: data.projectId, fileName: data.fileName, fileSize: data.fileSize, pageCount: data.pageCount };
        finishParsing(data.fileName, data.fileSize, data.pageCount);
        markDirty();
    }

    /* ---------------- 从已生成的 PPT 中加载 ---------------- */
    async function loadLibraryProject(projectId) {
        const apiPromise = API.loadPptProject(projectId);
        // 先展示解析动画 (文件信息稍后由接口数据覆盖)
        const projMeta = { fileName: '加载中…', fileSize: '' };
        await animateParsing(projMeta.fileName, projMeta.fileSize);
        const { data } = await apiPromise;

        // 主界面内容随项目联动更新
        state.project = { id: data.projectId, fileName: data.fileName, fileSize: data.fileSize, pageCount: data.pageCount };
        state.slides = data.slides;
        renderAiSuggestions(data.aiSuggestions);
        $('ppt-name').textContent = data.fileName;
        renderSlideList();
        await selectSlide(state.slides[0].id);
        finishParsing(data.fileName, data.fileSize, data.pageCount);
        markDirty();
    }

    /* ---------------- AI 建议卡 (随项目联动) ---------------- */
    function renderAiSuggestions(suggestions) {
        if (!suggestions || !suggestions.length) return;
        const wrap = $('ai-suggestions');
        const previewBtn = $('btn-ai-preview');
        wrap.querySelectorAll('.ai-sug-card').forEach(el => el.remove());
        suggestions.forEach(sug => {
            const card = document.createElement('div');
            const isSecondary = sug.color === 'secondary';
            card.className = `ai-sug-card p-sm rounded-lg bg-surface-container-low border border-outline-variant ${isSecondary ? 'border-l-4 border-secondary' : ''}`;
            card.innerHTML = `
                <p class="text-[10px] font-bold ${isSecondary ? 'text-secondary' : 'text-outline'} mb-1 uppercase tracking-tighter">${sug.type}</p>
                <p class="text-[11px] text-on-surface leading-tight">${sug.text}</p>`;
            wrap.insertBefore(card, previewBtn);
        });
    }

    /* ---------------- AI 改写 ---------------- */
    async function rewriteAll() {
        const tas = [...document.querySelectorAll('#trans-blocks textarea')];
        if (!tas.length) { toast('暂无可改写的内容', 'info'); return; }
        const loading = toast('AI 正在改写译文…', 'loading', 0);
        for (const ta of tas) {
            const { data } = await API.rewriteText(ta.value, 'academic');
            ta.value = data.rewritten;
            autoGrow(ta);
            ta.classList.add('border-secondary');
            setTimeout(() => ta.classList.remove('border-secondary'), 900);
        }
        loading.close();
        toast('AI 改写完成', 'success');
        markDirty();
    }

    /* ---------------- 版本历史抽屉 ---------------- */
    function openHistory() {
        const versions = [
            { v: 'v1.4', time: '今天 14:32', user: '海南博士', desc: '更新幻灯片 01 讲稿措辞', current: true },
            { v: 'v1.3', time: '今天 11:05', user: '海南博士', desc: '目标语言切换为日语' },
            { v: 'v1.2', time: '昨天 17:48', user: '系统', desc: 'AI 自动翻译全部文本块' },
            { v: 'v1.1', time: '昨天 16:20', user: '海南博士', desc: '上传并解析 PPT 原件' },
        ];
        const body = document.createElement('div');
        body.className = 'space-y-md';
        body.innerHTML = versions.map(v => `
            <div class="p-md rounded-lg border ${v.current ? 'border-primary bg-primary/5' : 'border-outline-variant'} hover:bg-surface-container-low cursor-pointer transition-colors">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-label-md font-bold ${v.current ? 'text-primary' : ''}">${v.v}${v.current ? ' · 当前版本' : ''}</span>
                    <span class="text-[11px] text-outline">${v.time}</span>
                </div>
                <p class="text-body-sm text-on-surface-variant">${v.desc}</p>
                <p class="text-[11px] text-outline mt-1">操作人：${v.user}</p>
            </div>`).join('');
        showDrawer({ title: '版本历史', icon: 'history', bodyEl: body });
    }

    /* ---------------- 预览 / 同步 ---------------- */
    function openPreview() {
        const s = state.currentSlide;
        const script = $('script-text').value;
        showModal({
            title: '合成预览', icon: 'play_circle', width: 520,
            body: `
                <div class="space-y-md text-body-md">
                    <div class="flex justify-between py-2 border-b border-outline-variant"><span class="text-on-surface-variant">幻灯片</span><span class="font-semibold">${String(s.index).padStart(2, '0')} · ${s.title}</span></div>
                    <div class="flex justify-between py-2 border-b border-outline-variant"><span class="text-on-surface-variant">目标语言</span><span class="font-semibold text-primary">${LANG_NAME[state.targetLang]}</span></div>
                    <div class="flex justify-between py-2 border-b border-outline-variant"><span class="text-on-surface-variant">文本块</span><span class="font-semibold">${s.blocks.zh.length} 段</span></div>
                    <div class="flex justify-between py-2 border-b border-outline-variant"><span class="text-on-surface-variant">讲稿长度</span><span class="font-semibold">${script.replace(/\s/g, '').length} 字 · 约 ${fmtTime(script.length / 4.5)} 分钟</span></div>
                    <div class="flex justify-between py-2"><span class="text-on-surface-variant">配音风格</span><span class="font-semibold">${$('style-select').value}</span></div>
                </div>`,
            actions: [
                { label: '关闭', kind: 'ghost' },
                { label: '试听讲稿', kind: 'primary', close: false, onClick: (close, btn) => {
                    const playing = AudioEngine.play({
                        id: 'preview', kind: 'tts', text: script,
                        lang: TTS_LANG[state.targetLang], durationSec: script.length / 4.5,
                    });
                    btn.textContent = playing ? '停止试听' : '试听讲稿';
                    AudioEngine.onStateChange = (id, p) => { if (id === 'preview' && !p) btn.textContent = '试听讲稿'; };
                } },
            ],
        });
    }

    async function syncToPipeline() {
        const script = $('script-text').value.trim();
        if (!script) { toast('请先生成口播讲稿', 'error'); return; }

        const btn = $('btn-sync');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined pulse-processing">sync</span><span>同步中…</span>';

        const payload = {
            projectId: state.project.id,
            projectName: state.project.fileName,
            slideId: state.currentSlide.id,
            slideTitle: state.currentSlide.title,
            slideIndex: state.currentSlide.index,
            lang: state.targetLang,
            script,
            translations: [...document.querySelectorAll('#trans-blocks textarea')].map(t => t.value),
            style: $('style-select').value,
            // 全项目分页讲稿: 音频生成页"待生成列表"按此逐页生成配音
            slideScripts: state.slides.map(s => ({
                slideId: s.id, slideIndex: s.index, title: s.title,
                script: s.id === state.currentSlide.id
                    ? script
                    : ((s.scripts && (s.scripts[state.targetLang] || s.scripts.zh)) || ''),
            })),
        };

        const { data } = await API.syncScript(payload);
        // 前端通道: 供 4.5 音频生成页接收
        SyncBridge.save(payload);

        state.dirty = false;
        updateSyncStatus();
        btn.disabled = false;
        btn.innerHTML = '<span>同步至微课合成</span><span class="material-symbols-outlined">rocket_launch</span>';

        const t = toast(`讲稿已同步（任务 ${data.taskId}），正在跳转音频生成…`, 'success', 2000);
        setTimeout(() => { location.href = 'ppt-audio.html'; }, 1200);
    }

    /* ---------------- 事件绑定 ---------------- */
    function bindEvents() {
        bindModeToggle();
        bindUpload();

        $('lang-select').addEventListener('change', async e => {
            state.targetLang = e.target.value;
            await loadTranslations();
            await loadScript();
            markDirty();
        });
        $('btn-rewrite').addEventListener('click', rewriteAll);
        $('btn-spellcheck').addEventListener('click', () => toast('校对完成：未发现拼写或语法问题', 'success'));
        $('btn-regen-script').addEventListener('click', regenerateScript);
        $('style-select').addEventListener('change', regenerateScript);
        $('script-text').addEventListener('input', () => { updateScriptStats(); markDirty(); });
        $('trans-title').addEventListener('input', markDirty);

        $('btn-ai-preview').addEventListener('click', () => {
            const script = $('script-text').value.trim();
            if (!script) { toast('讲稿为空，请先生成', 'error'); return; }
            const btn = $('btn-ai-preview');
            const playing = AudioEngine.play({
                id: 'ai-preview', kind: 'tts', text: script,
                lang: TTS_LANG[state.targetLang], durationSec: script.length / 4.5,
            });
            btn.innerHTML = playing
                ? '<span class="material-symbols-outlined text-sm">stop_circle</span>停止预览'
                : '<span class="material-symbols-outlined text-sm">play_circle</span>AI 预览';
            AudioEngine.onStateChange = (id, p) => {
                if (id === 'ai-preview' && !p) btn.innerHTML = '<span class="material-symbols-outlined text-sm">play_circle</span>AI 预览';
            };
        });

        $('btn-history').addEventListener('click', openHistory);
        // 新建项目 → 打开 PPT 来源选择弹窗 (与点击原件卡片同一入口)
        $('btn-new-project').addEventListener('click', () => openSourceModal());

        $('btn-save-draft').addEventListener('click', () => {
            state.dirty = false;
            updateSyncStatus();
            toast('草稿已保存至版本 v1.4', 'success');
        });
        $('btn-preview').addEventListener('click', openPreview);
        $('btn-sync').addEventListener('click', syncToPipeline);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
