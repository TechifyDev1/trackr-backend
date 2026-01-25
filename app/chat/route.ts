import { GoogleGenerativeAI, SchemaType, Tool } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { title } from "process";

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
- If a function is called, you may provide a very brief status update in text if helpful, but prioritize the function call.
- Always ensure your final response to the user is clear and never empty.

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

    const financialTools: Tool = {
        functionDeclarations: [
            {
                name: "getTransactions",
                description: "Fetches users transactions from the database",
                parameters: { type: SchemaType.OBJECT, properties: {} },
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
            },
            {
                name: "getCards",
                description: "Fetches all user's card",
                parameters: { type: SchemaType.OBJECT, properties: {} }
            },
            {
                name: "createTransaction",
                description: "Create a Transaction/Expense",
                parameters: {
                    type: SchemaType.OBJECT, properties: {
                        title: {
                            type: SchemaType.STRING,
                            description: "Title of the transaction/expense"
                        },
                        amount: {
                            type: SchemaType.INTEGER,
                            description: "Amount of the transaction/expense"
                        },
                        category: {
                            type: SchemaType.STRING,
                            format: "enum",
                            enum: ["housing", "utilities", "groceries", "transportation", "healthcare", "dining", "entertainment", "shopping", "miscellaneous"],
                            description: "The category the Expense/Transaction belongs to"
                        },
                        cardId: {
                            type: SchemaType.STRING,
                            description: "Id of the card used. (Get all the cards and ask user which one to choose so you can use the id here)"
                        },
                        cardDocId: {
                            type: SchemaType.STRING,
                            description: "DocId of the card used."
                        },
                        notes: {
                            type: SchemaType.STRING,
                            description: "Notes for the Expense/Transaction"
                        },
                        type: {
                            type: SchemaType.STRING,
                            format: "enum",
                            enum: ["expense", "deposit"],
                            description: "Type of the Transaction."
                        },
                    }
                }
            },
            {
                name: "updateExpense",
                description: "Update Expense/Transaction (Only the title, amount and notes are editable)",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: {
                            type: SchemaType.STRING,
                            description: "Updated title of the expense/transaction"
                        },
                        amount: {
                            type: SchemaType.NUMBER,
                            description: "Updated amount of the expense/transaction"
                        },
                        notes: {
                            type: SchemaType.STRING,
                            description: "Updated note for the expense/transaction"
                        },
                        expenseId: {
                            type: SchemaType.STRING,
                            description: "The id of the expense to update"
                        }
                    },
                    required: ["expenseId"]
                }
            },
            {
                name: "archiveCard",
                description: "Used to add cards to archive one at a time",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        cardDocId: {
                            type: SchemaType.STRING,
                            description:"Id of the card to be archived"
                        }
                    },
                    required: ["cardDocId"]
                }
            },
            {
                name: "activateCard",
                description: "Used to activate cards one at a time when it is archived",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        cardDocId: {
                            type: SchemaType.STRING,
                            description: "Id of the card to be activated"
                        }
                    },
                    required: ["cardDocId"]
                }
            },
            {
                name: "createCard",
                description: "Create a card",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        nickname: {
                            type: SchemaType.STRING,
                            description: "Nickname on the card"
                        },
                        cardType: {
                            type: SchemaType.STRING,
                            description: "Type of the card, it can only be one of these: Debit, Credit, Prepaid"
                        },
                        cardNetworkType: {
                            type: SchemaType.STRING,
                            description: "The network type of the card, it can only be one of these: Visa, MasterCard, Verve, UnionPage"
                        },
                        last4Digit: {
                            type: SchemaType.INTEGER,
                            description: "The last 4 digit of the card"
                        },
                        balance: {
                            type: SchemaType.NUMBER,
                            description: "The balance on the card"
                        },
                        bank: {
                            type: SchemaType.STRING,
                            description: "Bank of the card"
                        }
                    },
                    required: ["nickname", "cardType", "cardNetworkType", "last4Digit", "balance", "bank"]
                }
            }
        ]
    };

    const body = await request.json();
    const model = genAi.getGenerativeModel({model: "gemini-3-flash-preview", systemInstruction, tools: [financialTools]});
    try {
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

        if (!textResponse && (!calls || calls.length === 0)) {
            return NextResponse.json({
                type: "text",
                content: "I'm sorry, I couldn't process that. Could you please rephrase?"
        });
}



        return NextResponse.json({
            type: "text",
            content: textResponse
        })

    } catch (error) {
        console.error("Gemini error:", error);
        return NextResponse.json({error: "failed to generate content"}, {status: 500});
    }
}