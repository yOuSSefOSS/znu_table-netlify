exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body);
        const prompt = body.prompt;

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ error: "API key is not configured" }) };
        }

        const context = body.context || {};
        
        let systemPrompt = `You are an AI Academic Assistant for ZNUTable. 
        Context provided:
        - Schedule: ${JSON.stringify(context.schedule || [])}
        - Exams: ${JSON.stringify(context.exams || [])}
        - Announcements: ${JSON.stringify(context.announcements || [])}
        
        Use this data to answer accurately. If asked about something not in the data, use your general knowledge but prioritize these tables.
        Answer in Arabic (the user's language).
        
        User Query: ${prompt}`;

        const modelId = "gemini-flash-latest";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        
        let aiReply = "عذراً، لم أستطع معالجة طلبك حالياً.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            aiReply = data.candidates[0].content.parts[0].text;
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply: aiReply })
        };
    } catch (error) {
        console.error("Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
