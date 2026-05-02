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
        const systemPrompt = `You are an AI Academic Assistant for ZNUTable.
        Context provided:
        - Schedule: ${JSON.stringify(ctx.schedule || [])}
        - Exams: ${JSON.stringify(ctx.exams || [])}
        - Announcements: ${JSON.stringify(ctx.announcements || [])}
        - Uploaded Files / Resources (الملفات المرفوعة والمصادر): ${JSON.stringify(ctx.materials || [])}
        
        Use this data to answer accurately. Answer in Arabic (the user's language).
        If the user asks for materials, links, files, or resources (e.g., "drive link for OS", "what materials uploaded"), analyze the 'Uploaded Files / Resources' context. 
        - Be smart about matching subject names (e.g., "OS" matches "نظم التشغيل", "IS" matches "نظم معلومات", etc.).
        - Provide the link from the context even if the user asks for a "Google Drive link" and the actual URL isn't from Google Drive.
        - Provide the clickable HTML link using the format <a href="URL" target="_blank" class="text-indigo-500 dark:text-indigo-400 font-black underline">Text</a>.
        
        User Query: ${prompt}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();

        let aiReply = 'عذراً، لم أستطع معالجة طلبك حالياً.';
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiReply = data.candidates[0].content.parts[0].text;
        }

        return res.status(200).json({ reply: aiReply });
    } catch (error) {
        console.error('Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
