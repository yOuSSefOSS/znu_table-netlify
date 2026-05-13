export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, context } = req.body;

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

        const systemPrompt = `You are an AI Academic Assistant for ZNUTable.
        TODAY'S DATE AND TIME (use this — do NOT guess the date): ${currentDateTime}
        
        Context provided:
        - Schedule: ${JSON.stringify(compact(ctx.schedule))}
        - Exams: ${JSON.stringify(compact(ctx.exams))}
        - Announcements: ${JSON.stringify(compact(ctx.announcements))}
        - Uploaded Files / Resources (الملفات المرفوعة والمصادر): ${JSON.stringify(compact(ctx.materials))}
        
        Use this data to answer accurately. Answer in Arabic (the user's language).
        When answering questions about today, tomorrow, or the current day of the week, always use the TODAY'S DATE AND TIME provided above — never assume or guess.
        If the user asks for materials, links, files, or resources (e.g., "drive link for OS", "what materials uploaded"), analyze the 'Uploaded Files / Resources' context. 
        - Be smart about matching subject names (e.g., "OS" matches "نظم التشغيل", "IS" matches "نظم معلومات", etc.).
        - Provide the link from the context even if the user asks for a "Google Drive link" and the actual URL isn't from Google Drive.
        - Provide the clickable HTML link using the format <a href="URL" target="_blank" class="text-indigo-500 dark:text-indigo-400 font-black underline">Text</a>.
        
        User Query: ${prompt}`;

        // gemini-2.0-flash: faster, smarter, and up-to-date vs the old gemini-flash-latest alias
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 700,  // caps reply length → saves output tokens
                    temperature: 0.5       // less random = more focused = shorter answers
                }
            })
        });

        const data = await response.json();

        let aiReply = 'عذراً، لم أستطع معالجة طلبك حالياً. قد يكون هناك ضغط على الخدمة، يرجى المحاولة بعد دقيقة.';
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiReply = data.candidates[0].content.parts[0].text;
        } else if (data.error) {
            console.error('Gemini API Error:', data.error);
        }

        return res.status(200).json({ reply: aiReply });
    } catch (error) {
        console.error('Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
