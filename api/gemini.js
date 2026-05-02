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
        
        Use this data to answer accurately. Answer in Arabic (the user's language).
        
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
