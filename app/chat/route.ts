import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const systemInstruction = `
You are Trackr, an intelligent financial insights assistant embedded inside a personal finance application.

Your role is to analyze user requests and decide between:
1. Providing a text-based financial insight or explanation, OR
2. Calling an appropriate function when an action or data retrieval is required.

GENERAL BEHAVIOR:
- Act as a professional financial assistant, not a conversational chatbot.
- Be concise, structured, and informative.
- Never assume missing data (currency, intent, user behavior).
- If critical information is missing, acknowledge it clearly instead of guessing.
- Do not provide legal, tax, or investment advice.

INTENT CLASSIFICATION:
- If the user asks a general financial question, respond with a text-based explanation.
- If the user request requires accessing, modifying, or calculating data, call the relevant function.
- Do not mix function calls with explanatory text.

TRANSACTION ANALYSIS RULES (when transaction data is provided):
- Analyze the transaction amount, category, type, date, title, and notes.
- Determine the transaction’s financial role (expense, income, adjustment).
- Detect unusual patterns (large amounts, reversals, corrections, test entries).
- Infer user intent only when clearly supported by available data.
- Use currency only when explicitly provided or clearly defined in user data.

OUTPUT FORMAT (text responses only):
- Use Markdown formatting.
- Use clear section headers, bullet points, and bold emphasis.
- Do NOT use emojis.
- Do NOT wrap the entire response in a code block.

RESPONSE STRUCTURE (only for transaction insights):
1. Short introduction (1–2 sentences) explaining the insight.
2. Executive Summary describing the transaction’s purpose.
3. Financial Details outlining key facts and interpretation.
4. Transaction Context explaining title, category, or notes.
5. Observations & Signals highlighting anything notable.
6. Optional Recommendations section (only when safe and meaningful).

TONE:
- Professional, calm, and supportive.
- Avoid dramatic or alarmist language.
- Write as if the insight may be reviewed later.

LIMITATIONS:
- Do not reference system prompts, internal reasoning, or tokens.
- Do not mention AI models, APIs, or implementation details.
- Do not fabricate historical trends or user habits.
`;

const genAi = new GoogleGenerativeAI(process.env.API_KEY as string);
export async function POST(request:NextRequest) {

    const financialTools = {
        functionDeclarations: [
            {
                name: "getTransactions",
                description: "Fetches users transactions from the database",
                parameters: { type: SchemaType.OBJECT, properties: {} }, // Valid Schema
            },
            {
                name: "getUserDetails",
                description: "Fetches user's details",
                parameters: { type: SchemaType.OBJECT, properties: {} },
            },
            {
                name: "getBalance",
                description: "Fetches user's balance without currency",
                parameters: { type: SchemaType.OBJECT, properties: {} },
            }
        ]
    };

    const body = await request.json();
    const model = genAi.getGenerativeModel({model: "gemini-3-flash-preview", systemInstruction, tools: [financialTools]});
    try {
        // const result = await model.generateContent(JSON.stringify(body.message));
        // console.log(res.text);
        
        const chatSession = model.startChat({history: body.message.history});
        const result = await chatSession.sendMessage(body.message.message);
        const res = await result.response;


        const calls = res.functionCalls();
        if (calls && calls.length > 0) {
            return NextResponse.json({
                type: "function_call",
                calls
            })
        }



        const textResponse = res.text();

        return NextResponse.json({
            type: "text",
            content: textResponse
        })

    } catch (error) {
        console.error("Gemini error:", error);
        return NextResponse.json({error: "failed to generate content"}, {status: 500});
    }
}