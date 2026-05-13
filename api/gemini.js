export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, context, history = [] } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const ctx = context || {};

        // Strip null / undefined / empty-string fields from each object before
        // serializing — avoids sending useless tokens to the API.
        const compact = (arr) => (arr || []).map(obj =>
            Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''))
        );

        // Inject the real current date/time so the AI always knows what day it is
        const now = new Date();
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const currentDateTime = `${dayNames[now.getDay()]} ${now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} - الساعة ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

        const systemPrompt = `أنت زميل أكبر (Senior Student) ذكي، لطيف، ومتعاون لطلاب كلية الزرقاء الجامعية في تخصص نظم معلومات الطيران.
اسمك هو "الجدول الذكي".
تحدث مع الطلاب بطريقة ودودة، أكاديمية، ومحفزة. استخدم الرموز التعبيرية (Emojis) بشكل مناسب لتلطيف الجو.
يفضل استخدام النقاط (Bullet points) والإجابات المختصرة والواضحة.
تجنب الردود الطويلة والمملة. 
مهم جداً: إذا طلب الطالب رابطاً أو ملفاً، استخدم صيغة الماركداون (Markdown) للروابط بهذا الشكل: [اسم المادة](الرابط)، ولا تستخدم وسوم HTML إطلاقاً.

التاريخ والوقت الحالي للخادم (TODAY'S DATE AND TIME): ${currentDateTime}
استخدم هذا التاريخ والوقت دائماً عند الإجابة على الأسئلة المتعلقة بـ "اليوم"، "غداً"، أو الأيام النسبية. لا تخمن أبداً.

البيانات الحالية للجدول والإعلانات والمواد:
- Schedule: ${JSON.stringify(compact(ctx.schedule))}
- Exams: ${JSON.stringify(compact(ctx.exams))}
- Announcements: ${JSON.stringify(compact(ctx.announcements))}
- Uploaded Files / Resources (الملفات المرفوعة والمصادر): ${JSON.stringify(compact(ctx.materials))}

استخدم البيانات أعلاه للإجابة. عند البحث عن مواد استخدم ذكاءك في مطابقة أسماء المواد (مثلاً OS تعني نظم تشغيل). قم بتقديم الرابط الموجود في البيانات.`;

        // Format history to Gemini contents structure
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // gemini-2.0-flash-lite: free-tier compatible, fast, Gemini 2.0 generation
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    ...formattedHistory,
                    { role: "user", parts: [{ text: prompt }] }
                ],
                generationConfig: {
                    maxOutputTokens: 700,  // caps reply length → saves output tokens
                    temperature: 0.5       // less random = more focused = shorter answers
                }
            })
        });

        const data = await response.json();

        // If the Gemini API returned an error, log details and fail fast
        if (data.error) {
            console.error(`Gemini API Error [HTTP ${response.status}]:`, JSON.stringify(data.error));
            return res.status(502).json({
                reply: 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.',
                debug: data.error.message  // visible in response during development
            });
        }

        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text
            || 'عذراً، لم أتلقَّ ردًا من الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.';

        return res.status(200).json({ reply: aiReply });
    } catch (error) {
        console.error('Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
