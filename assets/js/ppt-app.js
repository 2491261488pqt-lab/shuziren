/* ============================================================================
 * 数字人微课平台 · 前端公共层 (4.4 PPT 翻译与讲稿处理 / 4.5 音频生成)
 * ----------------------------------------------------------------------------
 * 【后端对接说明】
 * 所有后端调用集中在 window.API 中:
 *   - 每个方法先尝试请求真实后端 (API_BASE 下的 REST 接口)
 *   - 请求失败 / 接口未就绪时自动降级为本地 Mock, 页面功能可完整演示
 *   - 后端就绪后只需修改 API_BASE, 页面逻辑零改动
 *
 * 接口清单 (详见随附《接口对接说明.md》):
 *   POST {API_BASE}/ppt/parse            上传并解析 PPT
 *   GET  {API_BASE}/ppt/projects         获取平台内已生成的 PPT 项目列表
 *   POST {API_BASE}/ppt/projects/:id/load 加载已生成的 PPT 项目 (含幻灯片与 AI 建议)
 *   GET  {API_BASE}/ppt/:projectId/slides 获取幻灯片列表与文本块
 *   GET  {API_BASE}/ppt/:projectId/scripts 获取项目的分页讲稿列表 (音频生成页"待生成列表"数据源)
 *   POST {API_BASE}/translate            文本块翻译
 *   POST {API_BASE}/rewrite              AI 改写
 *   POST {API_BASE}/script/generate      基于幻灯片生成口播讲稿
 *   POST {API_BASE}/script/sync          讲稿同步至音频生成 / 微课合成流程
 *   GET  {API_BASE}/voices               获取平台音色列表
 *   POST {API_BASE}/tts/generate         提交语音合成任务
 *   GET  {API_BASE}/tts/:taskId          查询合成任务状态
 *   POST {API_BASE}/audio/upload         上传现成音频
 *   POST {API_BASE}/video/pipeline       将音频写入数字人视频流程
 * ========================================================================== */

(function () {
    'use strict';

    const API_BASE = '/api/v1';
    const REQUEST_TIMEOUT = 4000;

    /* 统一请求封装: 优先真实后端, 失败自动走 Mock */
    async function request(path, options, mockFn) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
            const resp = await fetch(API_BASE + path, {
                signal: controller.signal,
                headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
                ...options,
            });
            clearTimeout(timer);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            return { source: 'server', data };
        } catch (e) {
            /* 后端未就绪 → Mock 降级, 保证前端流程完整可演示 */
            await new Promise(r => setTimeout(r, 350)); // 模拟网络延迟
            return { source: 'mock', data: mockFn() };
        }
    }

    /* ================= Mock 数据 ================= */

    // 幻灯片数据: 原文 + 三语翻译 + 讲稿 (演示数据, 与案例一致的量子物理课程)
    const MOCK_PROJECT = {
        id: 'prj_quantum_001',
        fileName: '高等量子物理.pptx',
        fileSize: '12.4 MB',
        pageCount: 14,
        slides: [
            {
                id: 's01', index: 1, title: '薛定谔方程及其波函数应用',
                blocks: {
                    zh: ['量子力学是研究微观粒子的运动规律的物理学分支。',
                         '薛定谔方程是量子力学的核心方程，由奥地利物理学家埃尔温·薛定谔于1926年提出。',
                         '本节课我们将探讨波函数的概率解释及其物理意义。'],
                    ja: ['量子力学は、微視的な粒子の運動法則を研究する物理学の分野です。',
                         'シュレーディンガー方程式は量子力学の核心的な方程式であり、1926年にオーストリアの物理学者エルヴィン・シュレーディンガーによって提案されました。',
                         'この講義では、波動関数の確率解釈とその物理的意義について探究します。'],
                    en: ['Quantum mechanics is the branch of physics that studies the motion of microscopic particles.',
                         'The Schrödinger equation is the core equation of quantum mechanics, proposed by Austrian physicist Erwin Schrödinger in 1926.',
                         'In this lecture, we will explore the probabilistic interpretation of the wave function and its physical meaning.'],
                },
                scripts: {
                    zh: '「同学们好，欢迎来到量子物理课堂。今天我们要深入探讨二十世纪最伟大的发现之一——薛定谔方程。在这节课中，请大家重点关注：这套数学框架如何从根本上改变了我们对微观世界的理解……」',
                    ja: '「皆さん、こんにちは。今日の量子物理学の講義へようこそ。今日は、20世紀最大の発見の一つであるシュレーディンガー方程式について深く掘り下げていきます。講義の中で、この数学的枠組みが微視的な現実に対する私たちの理解をいかに根本的に変えたかに注目してほしいと思います...」',
                    en: '"Hello everyone, and welcome to today\'s quantum physics lecture. We will take a deep dive into one of the greatest discoveries of the 20th century — the Schrödinger equation. Please pay close attention to how this mathematical framework fundamentally changed our understanding of microscopic reality..."',
                },
            },
            {
                id: 's02', index: 2, title: '量子理论发展的历史背景',
                blocks: {
                    zh: ['1900年，普朗克提出能量量子化假说，揭开了量子时代的序幕。',
                         '1925-1927年间，海森堡、薛定谔与狄拉克建立了量子力学的数学体系。',
                         '哥本哈根诠释成为量子力学最广为接受的物理解释。'],
                    ja: ['1900年、プランクはエネルギー量子化仮説を提唱し、量子時代の幕開けとなった。',
                         '1925年から1927年にかけて、ハイゼンベルク、シュレーディンガー、ディラックが量子力学の数学的体系を確立した。',
                         'コペンハーゲン解釈は、量子力学の最も広く受け入れられた物理的解釈となった。'],
                    en: ['In 1900, Planck proposed the energy quantization hypothesis, ushering in the quantum era.',
                         'Between 1925 and 1927, Heisenberg, Schrödinger, and Dirac established the mathematical framework of quantum mechanics.',
                         'The Copenhagen interpretation became the most widely accepted physical interpretation of quantum mechanics.'],
                },
                scripts: {
                    zh: '「在正式进入方程之前，让我们先回顾一下历史。从普朗克的能量量子化假说，到海森堡与薛定谔建立的数学体系，量子力学在短短二十七年间彻底改写了物理学……」',
                    ja: '「方程式に入る前に、まず歴史を振り返りましょう。プランクのエネルギー量子化仮説から、ハイゼンベルクとシュレーディンガーによる数学的体系の確立まで、量子力学はわずか27年で物理学を書き換えました...」',
                    en: '"Before we dive into the equations, let us look back at history. From Planck\'s quantization hypothesis to the mathematical framework built by Heisenberg and Schrödinger, quantum mechanics rewrote physics in just 27 years..."',
                },
            },
            {
                id: 's03', index: 3, title: '原子结构的基本原理',
                blocks: {
                    zh: ['玻尔模型首次将量子化条件引入原子结构描述。',
                         '电子在不同能级之间跃迁时会吸收或释放特定频率的光子。',
                         '现代原子模型以电子云概率分布取代了确定的轨道概念。'],
                    ja: ['ボーア模型は、量子化条件を原子構造の記述に初めて導入した。',
                         '電子は異なるエネルギー準位間を遷移する際、特定の周波数の光子を吸収または放出する。',
                         '現代の原子模型では、確定的な軌道の概念が電子雲の確率分布に取って代わられた。'],
                    en: ['The Bohr model was the first to introduce quantization conditions into the description of atomic structure.',
                         'Electrons absorb or emit photons of specific frequencies when transitioning between energy levels.',
                         'The modern atomic model replaces definite orbits with probability distributions of the electron cloud.'],
                },
                scripts: {
                    zh: '「理解了历史脉络之后，我们来看原子结构。玻尔模型是一个重要的起点，而现代理论用电子云的概率分布，取代了经典轨道的确定图像……」',
                    ja: '「歴史の流れを理解したところで、原子構造を見ていきましょう。ボーア模型は重要な出発点であり、現代理論では古典的な軌道の代わりに電子雲の確率分布が用いられます...」',
                    en: '"With the historical context in mind, let us examine atomic structure. The Bohr model is an important starting point, while modern theory replaces classical orbits with the probability distribution of the electron cloud..."',
                },
            },
        ],
        aiSuggestions: [
            { type: 'AI 建议', color: 'outline', text: '在“薛定谔方程”后添加停顿以示强调。' },
            { type: '词汇优化', color: 'secondary', text: '使用“概率性”代替“随机”以提高准确度。' },
        ],
    };

    // 平台内已生成的 PPT 项目库 (供"从已生成的 PPT 中选择"使用)
    const MOCK_PROJECTS = [
        {
            id: MOCK_PROJECT.id, fileName: MOCK_PROJECT.fileName, fileSize: MOCK_PROJECT.fileSize,
            pageCount: MOCK_PROJECT.pageCount, updatedAt: '今天 14:32', course: '量子物理导论',
            aiSuggestions: MOCK_PROJECT.aiSuggestions,
            slides: MOCK_PROJECT.slides,
        },
        {
            id: 'prj_english_002', fileName: '大学英语演讲与写作.pptx', fileSize: '8.6 MB',
            pageCount: 12, updatedAt: '昨天 09:15', course: '大学英语（二）',
            aiSuggestions: [
                { type: 'AI 建议', color: 'outline', text: '开场提问后建议停顿 1 秒，给听众思考时间。' },
                { type: '词汇优化', color: 'secondary', text: '将“抓住注意力”改为“牢牢锁定注意力”以增强画面感。' },
            ],
            slides: [
                {
                    id: 'e01', index: 1, title: '英语演讲的开场技巧',
                    blocks: {
                        zh: ['一个好的开场决定了演讲留给听众的第一印象。',
                             '常见的开场方式包括提问、引用名言与讲述故事。',
                             '开场应在三十秒内点明演讲主题，抓住听众注意力。'],
                        ja: ['良いオープニングは、聴衆に与えるスピーチの第一印象を決定づけます。',
                             '一般的なオープニングには、質問、名言の引用、物語の語りがあります。',
                             'オープニングでは30秒以内にテーマを示し、聴衆の注意を引くべきです。'],
                        en: ['A strong opening determines the first impression your speech leaves on the audience.',
                             'Common opening techniques include asking a question, quoting a famous line, and telling a story.',
                             'The opening should state your topic within thirty seconds to capture attention.'],
                    },
                    scripts: {
                        zh: '「同学们，想象一下：你站在讲台上，台下有上百双眼睛看着你。前三十秒，决定了他们接下来是抬头听，还是低头看手机。今天我们就来学习，如何用提问、引用和故事，打造一个让人无法移开视线的开场……」',
                        ja: '「皆さん、想像してみてください。講壇に立ち、何百もの視線があなたに注がれています。最初の30秒が、聴衆が耳を傾けるかスマホを見るかを決めます。今日は、質問・引用・物語を使って、目が離せないオープニングを作る方法を学びます...」',
                        en: '"Imagine standing on the stage with hundreds of eyes on you. The first thirty seconds decide whether the audience looks up or looks down at their phones. Today, we will learn how to craft an irresistible opening using questions, quotes, and stories..."',
                    },
                },
                {
                    id: 'e02', index: 2, title: '段落结构与逻辑连接词',
                    blocks: {
                        zh: ['每个段落应围绕一个中心句展开，避免观点堆砌。',
                             '连接词如 however、therefore 能显著提升行文逻辑性。',
                             '段落的结尾句应自然引出下一段的内容。'],
                        ja: ['各段落は一つの中心文を軸に展開し、意見の羅列を避けるべきです。',
                             'however や therefore などの接続詞は、文章の論理性を大きく高めます。',
                             '段落の結末文は、次の段落の内容へ自然につなげるべきです。'],
                        en: ['Each paragraph should revolve around one topic sentence and avoid piling up ideas.',
                             'Connectives such as "however" and "therefore" greatly improve logical flow.',
                             'The closing sentence of a paragraph should naturally lead into the next.'],
                    },
                    scripts: {
                        zh: '「一篇好文章就像一列火车：每个段落是一节车厢，连接词就是车厢之间的挂钩。少了挂钩，车厢再多也跑不起来。这一节我们来看看如何用好 however 和 therefore……」',
                        ja: '「良い文章は列車のようなものです。各段落は車両であり、接続詞は車両をつなぐ連結器です。連結器がなければ、車両がいくらあっても走れません。今回は however と therefore の使い方を見ていきます...」',
                        en: '"A good essay is like a train: each paragraph is a carriage, and connectives are the couplings between them. Without couplings, the train goes nowhere. Let us look at how to use \'however\' and \'therefore\' effectively..."',
                    },
                },
                {
                    id: 'e03', index: 3, title: '学术写作中的常见错误',
                    blocks: {
                        zh: ['避免在学术写作中使用口语化表达与缩写。',
                             '主谓一致和时态统一是最常见的语法失分点。',
                             '引用他人观点必须规范标注出处，避免学术不端。'],
                        ja: ['学術写作では口語的な表現や略語の使用を避けましょう。',
                             '主語と述語の一致、時制の統一は、最もよくある減点ポイントです。',
                             '他人の意見を引用する際は、出典を適切に明記し、学術不正を避けなければなりません。'],
                        en: ['Avoid colloquial expressions and contractions in academic writing.',
                             'Subject-verb agreement and tense consistency are the most common grammar pitfalls.',
                             'Always cite sources properly when referencing others\' ideas to avoid academic misconduct.'],
                    },
                    scripts: {
                        zh: '「最后我们来排雷。口语化表达、主谓不一致、引用不规范——这三个错误几乎出现在每一份低分作文里。记住：学术写作的第一原则，是严谨……」',
                        ja: '「最後に、よくある間違いを確認しましょう。口語表現、主述の不一致、引用の不備——この三つは低得点の作文にほぼ必ず見られます。学術写作の第一原則は、厳密さです...」',
                        en: '"Finally, let us clear the mines. Colloquialisms, agreement errors, and improper citations appear in almost every low-scoring essay. Remember: the first principle of academic writing is rigor..."',
                    },
                },
            ],
        },
        {
            id: 'prj_marketing_003', fileName: '数字营销基础.pptx', fileSize: '6.2 MB',
            pageCount: 9, updatedAt: '3 天前', course: '市场营销学',
            aiSuggestions: [
                { type: 'AI 建议', color: 'outline', text: '在“转化漏斗”处建议放慢语速，配合图示讲解。' },
                { type: '词汇优化', color: 'secondary', text: '首次出现的 ROI 建议读作“投资回报率”以便理解。' },
            ],
            slides: [
                {
                    id: 'm01', index: 1, title: '数字营销的核心概念',
                    blocks: {
                        zh: ['数字营销以数据驱动为核心，实现精准触达。',
                             '用户画像是制定营销策略的基础工具。',
                             '转化漏斗模型帮助分析用户从认知到购买的路径。'],
                        ja: ['デジタルマーケティングはデータ駆動を中核とし、精密なリーチを実現します。',
                             'ユーザー像（ペルソナ）は、マーケティング戦略を立てるための基礎ツールです。',
                             'コンバージョンファネルモデルは、認知から購入までの経路を分析するのに役立ちます。'],
                        en: ['Digital marketing is data-driven at its core, enabling precise targeting.',
                             'User personas are the foundational tool for building marketing strategies.',
                             'The conversion funnel model helps analyze the customer journey from awareness to purchase.'],
                    },
                    scripts: {
                        zh: '「欢迎来到数字营销课堂。请记住一句话：没有数据的营销，就像在黑暗中射箭。今天我们先建立三个核心概念——数据驱动、用户画像和转化漏斗……」',
                        ja: '「デジタルマーケティングの講義へようこそ。覚えておいてほしいのは、データのないマーケティングは暗闇で矢を射るようなものだということです。今日はデータ駆動、ペルソナ、コンバージョンファネルという三つの核心概念を学びます...」',
                        en: '"Welcome to the digital marketing course. Remember this: marketing without data is like shooting arrows in the dark. Today we will build three core concepts — data-driven thinking, user personas, and the conversion funnel..."',
                    },
                },
                {
                    id: 'm02', index: 2, title: '社交媒体运营策略',
                    blocks: {
                        zh: ['内容日历能保证账号持续稳定地产出。',
                             '互动率是衡量社交媒体运营质量的关键指标。',
                             '不同平台的用户习惯差异要求差异化内容策略。'],
                        ja: ['コンテンツカレンダーは、アカウントの安定した運用を支えます。',
                             'エンゲージメント率は、SNS運用の質を測る重要な指標です。',
                             'プラットフォームごとのユーザー習慣の違いには、差別化されたコンテンツ戦略が必要です。'],
                        en: ['A content calendar ensures consistent output for your accounts.',
                             'Engagement rate is the key metric for social media performance.',
                             'Different platform habits require differentiated content strategies.'],
                    },
                    scripts: {
                        zh: '「同一条内容，发在微博和发在小红书，效果可能天差地别。这一节我们讨论如何根据平台特性制定运营策略，并用互动率来检验我们的内容质量……」',
                        ja: '「同じコンテンツでも、投稿するプラットフォームが違えば効果は大きく変わります。今回はプラットフォームの特性に応じた運用戦略と、エンゲージメント率による品質検証について議論します...」',
                        en: '"The same content can perform drastically differently across platforms. In this section, we discuss platform-specific strategies and how to use engagement rate to validate content quality..."',
                    },
                },
                {
                    id: 'm03', index: 3, title: '数据分析与效果评估',
                    blocks: {
                        zh: ['ROI 是评估营销活动效果的最终指标。',
                             'A/B 测试是优化广告素材的科学方法。',
                             '归因模型决定了转化功劳在不同渠道间的分配。'],
                        ja: ['ROI はマーケティング活動の効果を評価する最終指標です。',
                             'A/B テストは、広告クリエイティブを最適化する科学的な手法です。',
                             'アトリビューションモデルは、チャネル間でのコンバージョンの貢献配分を決定します。'],
                        en: ['ROI is the ultimate metric for evaluating marketing campaigns.',
                             'A/B testing is the scientific method for optimizing ad creatives.',
                             'Attribution models determine how conversion credit is distributed across channels.'],
                    },
                    scripts: {
                        zh: '「花了钱，就要算清账。ROI、A/B 测试、归因模型——这三件工具能帮你回答老板最关心的那个问题：这笔钱到底花得值不值……」',
                        ja: '「投資したからには、きちんと計算しましょう。ROI、A/B テスト、アトリビューションモデル——この三つのツールは、『この支出は本当に価値があったのか』という問いに答える助けになります...」',
                        en: '"When you spend money, you must do the math. ROI, A/B testing, and attribution models help you answer the question every boss asks: was this money well spent..."',
                    },
                },
            ],
        },
    ];

    // 平台音色库
    const MOCK_VOICES = [
        { id: 'v01', name: '学术专家', gender: 'male',   lang: 'zh-CN', langLabel: '中文',   style: '沉稳 · 权威',   sample: '大家好，我是学术专家音色，适合专业课程讲解。' },
        { id: 'v02', name: '亲切讲师', gender: 'female', lang: 'zh-CN', langLabel: '中文',   style: '温和 · 亲和',   sample: '同学们好，让我们一起开始今天的学习吧。' },
        { id: 'v03', name: '新闻主播', gender: 'male',   lang: 'zh-CN', langLabel: '中文',   style: '标准 · 清晰',   sample: '这里是新闻主播音色，发音标准，节奏明快。' },
        { id: 'v04', name: '青春活力', gender: 'female', lang: 'zh-CN', langLabel: '中文',   style: '活泼 · 明快',   sample: '嗨！让我们用轻松的方式学习新知识！' },
        { id: 'v05', name: '日语讲师', gender: 'female', lang: 'ja-JP', langLabel: '日本語', style: '丁寧 · 自然',   sample: '皆さん、こんにちは。今日の講義を始めましょう。' },
        { id: 'v06', name: 'English Narrator', gender: 'male', lang: 'en-US', langLabel: 'English', style: 'Professional', sample: 'Welcome to this course. Let us get started.' },
    ];

    let _seq = 100;
    const uid = p => p + '_' + Date.now().toString(36) + (_seq++);

    // 跨项目查找幻灯片 (Mock 辅助)
    function findSlide(slideId) {
        for (const p of MOCK_PROJECTS) {
            const hit = p.slides.find(s => s.id === slideId);
            if (hit) return hit;
        }
        return null;
    }

    /* ================= 接口层 ================= */

    window.API = {
        BASE: API_BASE,

        /** 上传并解析 PPT → { projectId, fileName, pageCount } */
        pptParse(file) {
            const fd = new FormData();
            fd.append('file', file);
            return request('/ppt/parse', { method: 'POST', body: fd }, () => ({
                projectId: MOCK_PROJECT.id,
                fileName: file ? file.name : MOCK_PROJECT.fileName,
                fileSize: file ? (file.size / 1048576).toFixed(1) + ' MB' : MOCK_PROJECT.fileSize,
                pageCount: MOCK_PROJECT.pageCount,
            }));
        },

        /** 获取幻灯片列表及文本块 → { slides: [...] } */
        getSlides(projectId) {
            return request(`/ppt/${projectId}/slides`, { method: 'GET' }, () => {
                const proj = MOCK_PROJECTS.find(p => p.id === projectId) || MOCK_PROJECTS[0];
                return { slides: proj.slides };
            });
        },

        /** 获取平台内已生成的 PPT 项目列表 → { projects: [...] } */
        getPptProjects() {
            return request('/ppt/projects', { method: 'GET' }, () => ({
                projects: MOCK_PROJECTS.map(p => ({
                    id: p.id, fileName: p.fileName, fileSize: p.fileSize,
                    pageCount: p.pageCount, updatedAt: p.updatedAt, course: p.course,
                })),
            }));
        },

        /** 加载平台内已生成的 PPT 项目 → 返回项目元信息 + 幻灯片 */
        loadPptProject(projectId) {
            return request(`/ppt/projects/${projectId}/load`, { method: 'POST' }, () => {
                const proj = MOCK_PROJECTS.find(p => p.id === projectId);
                if (!proj) throw new Error('project not found');
                return {
                    projectId: proj.id, fileName: proj.fileName, fileSize: proj.fileSize,
                    pageCount: proj.pageCount, slides: proj.slides,
                    aiSuggestions: proj.aiSuggestions || [],
                    slideScripts: proj.slides.map(s => ({
                        slideId: s.id, slideIndex: s.index, title: s.title, scripts: s.scripts,
                    })),
                };
            });
        },

        /** 文本块翻译 → { translations: [...] } */
        translate(slideId, targetLang) {
            return request('/translate', {
                method: 'POST', body: JSON.stringify({ slideId, targetLang }),
            }, () => {
                const slide = findSlide(slideId);
                return { translations: slide ? slide.blocks[targetLang] || slide.blocks.zh : [] };
            });
        },

        /** AI 改写 → { rewritten } */
        rewriteText(text, style = 'academic') {
            return request('/rewrite', {
                method: 'POST', body: JSON.stringify({ text, style }),
            }, () => ({ rewritten: text.replace(/研究する/g, '探求する').replace(/探讨/g, '深入探究').replace(/study/g, 'rigorously investigate') || text }));
        },

        /** 基于幻灯片生成口播讲稿 → { script, charCount, durationSec } */
        generateScript(slideId, opts = {}) {
            return request('/script/generate', {
                method: 'POST', body: JSON.stringify({ slideId, ...opts }),
            }, () => {
                const slide = findSlide(slideId);
                const lang = opts.lang || 'zh';
                const script = slide ? (slide.scripts[lang] || slide.scripts.zh) : '';
                return { script, charCount: script.length, durationSec: Math.round(script.length / 4.5) };
            });
        },

        /** 获取项目的分页讲稿列表 (音频生成页"待生成列表"数据源) → { scripts: [...] } */
        getSlideScripts(projectId) {
            return request(`/ppt/${projectId}/scripts`, { method: 'GET' }, () => {
                const proj = MOCK_PROJECTS.find(p => p.id === projectId) || MOCK_PROJECTS[0];
                return {
                    scripts: proj.slides.map(s => ({
                        slideId: s.id, slideIndex: s.index, title: s.title, scripts: s.scripts,
                    })),
                };
            });
        },

        /** 讲稿同步至音频生成 / 微课合成 → { taskId, status } */
        syncScript(payload) {
            return request('/script/sync', {
                method: 'POST', body: JSON.stringify(payload),
            }, () => ({ taskId: uid('sync'), status: 'synced' }));
        },

        /** 获取平台音色列表 → { voices: [...] } */
        getVoices() {
            return request('/voices', { method: 'GET' }, () => ({ voices: MOCK_VOICES }));
        },

        /** 提交语音合成任务 → { taskId, status, durationSec } */
        ttsGenerate(payload) {
            return request('/tts/generate', {
                method: 'POST', body: JSON.stringify(payload),
            }, () => ({
                taskId: uid('tts'),
                status: 'completed',
                durationSec: Math.max(4, Math.round((payload.text || '').length / 4.5 / (payload.rate || 1))),
            }));
        },

        /** 查询合成任务状态 → { taskId, status, progress } */
        ttsStatus(taskId) {
            return request(`/tts/${taskId}`, { method: 'GET' }, () => ({
                taskId, status: 'completed', progress: 100,
            }));
        },

        /** 上传现成音频 → { audioId, fileName, url } */
        uploadAudio(file) {
            const fd = new FormData();
            fd.append('file', file);
            return request('/audio/upload', { method: 'POST', body: fd }, () => ({
                audioId: uid('aud'),
                fileName: file.name,
                url: URL.createObjectURL(file), // Mock: 本地对象地址直接可播
            }));
        },

        /** 将音频写入数字人视频流程 → { pipelineId, status } */
        pushToVideo(payload) {
            return request('/video/pipeline', {
                method: 'POST', body: JSON.stringify(payload),
            }, () => ({ pipelineId: uid('pipe'), status: 'queued' }));
        },
    };

    /* ================= Toast ================= */

    const toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(toastRoot));

    const TOAST_ICON = { success: 'check_circle', error: 'error', info: 'info', loading: 'hourglass_top' };
    const TOAST_COLOR = { success: '#85fa51', error: '#ff8a80', info: '#a5c8ff', loading: '#a5c8ff' };

    window.toast = function (message, type = 'info', duration = 2800) {
        const el = document.createElement('div');
        el.className = `toast-item toast-${type}`;
        el.innerHTML = `<span class="material-symbols-outlined" style="color:${TOAST_COLOR[type]}">${TOAST_ICON[type]}</span><span>${message}</span>`;
        toastRoot.appendChild(el);
        if (type === 'loading') el.querySelector('.material-symbols-outlined').classList.add('pulse-processing');
        if (duration > 0) {
            setTimeout(() => {
                el.classList.add('toast-out');
                setTimeout(() => el.remove(), 240);
            }, duration);
        }
        return { close() { el.classList.add('toast-out'); setTimeout(() => el.remove(), 240); }, el };
    };

    /* ================= 通用弹窗 ================= */

    /**
     * showModal({ title, icon, body, actions:[{label, kind:'primary'|'ghost'|'danger', onClick, close}] , width })
     * 返回 close() 方法
     */
    window.showModal = function ({ title, icon = 'info', body = '', actions = [], width = 440 }) {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        const panel = document.createElement('div');
        panel.className = 'modal-panel bg-white rounded-xl shadow-2xl border border-outline-variant overflow-hidden';
        panel.style.width = width + 'px';
        panel.style.maxWidth = '92vw';
        panel.innerHTML = `
            <div class="px-lg py-md border-b border-outline-variant flex items-center gap-sm">
                <span class="material-symbols-outlined text-primary">${icon}</span>
                <h3 class="font-title-lg flex-1">${title}</h3>
                <button class="modal-x p-1 rounded-lg hover:bg-surface-container text-on-surface-variant">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
            <div class="p-lg modal-body"></div>
            <div class="px-lg pb-lg flex justify-end gap-sm modal-actions"></div>`;
        const bodyEl = panel.querySelector('.modal-body');
        if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
        const actionsEl = panel.querySelector('.modal-actions');

        const close = () => {
            mask.classList.add('mask-out');
            setTimeout(() => mask.remove(), 180);
        };
        panel.querySelector('.modal-x').addEventListener('click', close);
        mask.addEventListener('click', e => { if (e.target === mask) close(); });

        actions.forEach(a => {
            const btn = document.createElement('button');
            const base = 'px-md py-2 rounded-lg font-label-md flex items-center gap-xs';
            btn.className = a.kind === 'primary'
                ? `${base} bg-primary text-white hover:opacity-90 shadow-sm shadow-primary/20`
                : a.kind === 'danger'
                    ? `${base} bg-error text-white hover:opacity-90`
                    : `${base} bg-white border border-outline-variant hover:bg-surface-container`;
            btn.textContent = a.label;
            btn.addEventListener('click', () => {
                if (a.onClick) a.onClick(close, btn);
                if (a.close !== false && !a.onClick) close();
            });
            actionsEl.appendChild(btn);
        });

        mask.appendChild(panel);
        document.body.appendChild(mask);
        return { close, bodyEl, panel };
    };

    /** 确认弹窗 */
    window.confirmModal = function (title, message, onConfirm, confirmLabel = '确认') {
        return showModal({
            title, icon: 'help',
            body: `<p class="text-body-md text-on-surface-variant">${message}</p>`,
            actions: [
                { label: '取消', kind: 'ghost' },
                { label: confirmLabel, kind: 'primary', onClick: close => { onConfirm && onConfirm(); close(); } },
            ],
        });
    };

    /* ================= 抽屉 ================= */

    window.showDrawer = function ({ title, icon = 'history', bodyEl }) {
        const mask = document.createElement('div');
        mask.className = 'drawer-mask';
        const panel = document.createElement('div');
        panel.className = 'drawer-panel';
        panel.innerHTML = `
            <div class="h-14 px-lg border-b border-outline-variant flex items-center gap-sm shrink-0">
                <span class="material-symbols-outlined text-primary">${icon}</span>
                <h3 class="font-title-lg flex-1">${title}</h3>
                <button class="drawer-x p-1 rounded-lg hover:bg-surface-container text-on-surface-variant">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto custom-scrollbar p-lg drawer-body"></div>`;
        panel.querySelector('.drawer-body').appendChild(bodyEl);
        const close = () => {
            panel.classList.add('drawer-out');
            mask.classList.add('mask-out');
            setTimeout(() => { panel.remove(); mask.remove(); }, 220);
        };
        panel.querySelector('.drawer-x').addEventListener('click', close);
        mask.addEventListener('click', close);
        document.body.appendChild(mask);
        document.body.appendChild(panel);
        return { close, panel };
    };

    /* ================= 按钮按压缩放 (与案例一致的全局动效) ================= */

    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('mousedown', e => {
            const el = e.target.closest('button, a');
            if (el) el.style.transform = 'scale(0.98)';
        });
        ['mouseup', 'mouseleave'].forEach(evt =>
            document.addEventListener(evt, e => {
                const el = e.target.closest ? e.target.closest('button, a') : null;
                if (el) el.style.transform = 'scale(1)';
            }, true)
        );
        document.addEventListener('mouseup', () => {
            document.querySelectorAll('button, a').forEach(el => { el.style.transform = 'scale(1)'; });
        });
    });

    /* ================= 音频引擎 (试听 / 播放 / 下载) =================
     * - file 类型: 直接播放真实音频 (上传的本地文件 / 后端 URL)
     * - tts  类型: 后端未就绪时, Mock 降级为浏览器 speechSynthesis 朗读,
     *              保证"试听"流程可完整演示; 后端就绪后改为播放返回的音频 URL。
     * ================================================================== */

    const AudioEngine = {
        current: null,          // 当前播放项 { id, stop() }
        _progressTimer: null,
        onStateChange: null,    // (id, isPlaying) => void
        onProgress: null,       // (id, ratio) => void

        _fireState(id, playing) { this.onStateChange && this.onStateChange(id, playing); },
        _fireProgress(id, ratio) { this.onProgress && this.onProgress(id, ratio); },

        stop() {
            if (!this.current) return;
            const id = this.current.id;
            this.current.stop();
            this.current = null;
            clearInterval(this._progressTimer);
            this._fireState(id, false);
            this._fireProgress(id, 0);
        },

        /** 播放一个音频项
         * item: { id, kind:'file'|'tts', url?, text?, lang?, rate?, pitch?, durationSec? }
         */
        play(item) {
            if (this.current && this.current.id === item.id) { this.stop(); return false; }
            this.stop();

            let stopFn, durationSec = item.durationSec || 8;

            if (item.kind === 'file' && item.url) {
                const audio = new Audio(item.url);
                audio.playbackRate = item.rate || 1;
                audio.play().catch(() => {});
                stopFn = () => { audio.pause(); audio.src = ''; };
                audio.addEventListener('loadedmetadata', () => {
                    if (isFinite(audio.duration) && audio.duration > 0) durationSec = audio.duration;
                });
                this._progressTimer = setInterval(() => {
                    if (audio.duration) this._fireProgress(item.id, audio.currentTime / audio.duration);
                }, 120);
                audio.addEventListener('ended', () => this.stop());
            } else {
                // TTS Mock: 浏览器朗读
                const utter = new SpeechSynthesisUtterance((item.text || '').replace(/[「」"]/g, ''));
                utter.lang = item.lang || 'zh-CN';
                utter.rate = item.rate || 1;
                utter.pitch = item.pitch || 1;
                const voices = speechSynthesis.getVoices();
                const match = voices.find(v => v.lang && v.lang.replace('_', '-').startsWith(utter.lang.split('-')[0]));
                if (match) utter.voice = match;
                utter.onend = () => this.stop();
                utter.onerror = () => this.stop();
                speechSynthesis.cancel();
                speechSynthesis.speak(utter);
                stopFn = () => speechSynthesis.cancel();

                const t0 = Date.now();
                this._progressTimer = setInterval(() => {
                    const ratio = Math.min(1, (Date.now() - t0) / 1000 / durationSec);
                    this._fireProgress(item.id, ratio);
                    if (ratio >= 1) this.stop();
                }, 120);
            }

            this.current = { id: item.id, stop: stopFn };
            this._fireState(item.id, true);
            return true;
        },
    };
    window.AudioEngine = AudioEngine;

    /** 生成确定性波形 (按 seed) */
    window.renderWaveform = function (container, seedStr, barCount = 48) {
        container.innerHTML = '';
        let seed = 0;
        for (const c of String(seedStr)) seed = (seed * 31 + c.charCodeAt(0)) & 0xffff;
        for (let i = 0; i < barCount; i++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const h = 20 + (seed % 100) / 100 * 76; // 20% ~ 96%
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = h + '%';
            container.appendChild(bar);
        }
    };

    window.setWaveformProgress = function (container, ratio) {
        const bars = container.querySelectorAll('.bar');
        const cut = Math.floor(bars.length * ratio);
        bars.forEach((b, i) => {
            b.classList.toggle('played', i < cut);
            b.classList.toggle('playing-head', i === cut && ratio > 0 && ratio < 1);
        });
    };

    /** 生成占位 WAV 文件 (TTS Mock 下载用; 真实下载走后端 URL) */
    window.makePlaceholderWav = function (durationSec = 3) {
        const sr = 22050, n = Math.floor(sr * durationSec);
        const buf = new ArrayBuffer(44 + n * 2);
        const dv = new DataView(buf);
        const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); writeStr(8, 'WAVE');
        writeStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
        dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
        dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
        writeStr(36, 'data'); dv.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.min(1, t * 8, (durationSec - t) * 4);
            const v = Math.sin(2 * Math.PI * 440 * t) * 0.25 * env + Math.sin(2 * Math.PI * 660 * t) * 0.12 * env;
            dv.setInt16(44 + i * 2, v * 32767, true);
        }
        return new Blob([buf], { type: 'audio/wav' });
    };

    /** 触发浏览器下载 */
    window.downloadBlob = function (blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };

    /** 格式化秒 → m:ss */
    window.fmtTime = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

    /** 讲稿跨页面同步 (后端未就绪时的前端通道: localStorage) */
    window.SyncBridge = {
        KEY: 'dh_sync_payload',
        save(payload) { localStorage.setItem(this.KEY, JSON.stringify({ ...payload, ts: Date.now() })); },
        load() { try { return JSON.parse(localStorage.getItem(this.KEY)); } catch { return null; } },
        clear() { localStorage.removeItem(this.KEY); },
    };

    /* ================= Material Symbols 图标渲染器 =================
     * 策略 (三道保险, 保证任何网络/字体环境下布局都不崩):
     *   1. 本地 woff2 字体 (@font-face, font-display: block)
     *   2. JS 探测字体未生效 → 逐个拉取本地 SVG 单图标替换
     *   3. SVG 也失败 → 替换为通用圆点占位符 (绝不留回退文字撑爆布局)
     * ================================================================ */

    const ICON_BASE = 'assets/icons/';
    const _svgCache = {};

    async function fetchIconSvg(name) {
        if (_svgCache[name]) return _svgCache[name];
        try {
            const resp = await fetch(ICON_BASE + name + '.svg', { cache: 'force-cache' });
            if (!resp.ok) throw new Error(resp.status);
            const svg = await resp.text();
            _svgCache[name] = svg;
            return svg;
        } catch (e) {
            _svgCache[name] = null;
            return null;
        }
    }

    const FALLBACK_SVG = '<svg class="mi" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>';

    let _hydrating = false;

    async function hydrateIcons(root) {
        if (_hydrating) return;
        _hydrating = true;
        try {
            const els = (root || document).querySelectorAll('.material-symbols-outlined:not(.mi-svg):not([data-mi-skip])');
            const jobs = [...els].map(async el => {
                const name = (el.textContent || '').trim().replace(/\s+/g, '_');
                if (!name || !/^[a-z0-9_]+$/.test(name)) return;
                const svg = await fetchIconSvg(name);
                el.classList.add('mi-svg');
                el.textContent = '';
                el.innerHTML = svg || FALLBACK_SVG;
                if (!svg) el.classList.add('mi-fallback');
            });
            await Promise.all(jobs);
        } finally {
            _hydrating = false;
        }
    }

    let _fontChecked = null;
    function iconFontReady() {
        if (_fontChecked !== null) return _fontChecked;
        const probe = document.createElement('span');
        probe.className = 'material-symbols-outlined';
        probe.setAttribute('data-mi-skip', '1');
        probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:24px;';
        probe.textContent = 'school';
        document.body.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        _fontChecked = w <= 30;
        return _fontChecked;
    }

    async function ensureIcons() {
        try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]); } catch (e) {}
        _fontChecked = null; // 重新评估
        if (!iconFontReady()) await hydrateIcons(document);
    }

    document.addEventListener('DOMContentLoaded', ensureIcons);

    // 动态内容 (弹窗/抽屉/列表项) 在字体失效时兜底转换
    let _moTimer = null;
    new MutationObserver(muts => {
        if (_fontChecked !== false || _hydrating) return;
        const hasNewIcon = muts.some(m => [...m.addedNodes].some(n =>
            n.nodeType === 1 && (n.classList?.contains('material-symbols-outlined') || n.querySelector?.('.material-symbols-outlined:not(.mi-svg):not([data-mi-skip])'))));
        if (!hasNewIcon) return;
        clearTimeout(_moTimer);
        _moTimer = setTimeout(() => hydrateIcons(document), 100);
    }).observe(document.body, { childList: true, subtree: true });

    window.MiIcons = { hydrate: hydrateIcons, fontReady: iconFontReady };

})();
