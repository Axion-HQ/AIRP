import  { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import Groq from "groq-sdk";

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    additionalHeaders: {
        'Content-Type': 'application/json',
    }
});


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});


// TODO: Write a system prompt for AIRP 
const systemPrompt = ``;


export async function POST(req) {
    const data = await req.json();
    const index = pinecone.index("axionrag").namespace("arag");

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
    });

    const response = await index.query({
        topK: 3, 
        includeMetadata: true,
        vector: embedding.data[0].embedding
    })

    let responseString = "";
    response.matches.forEach((match) => {
        responseString += `  
        Professor: ${match.id},
        Department: ${match.metadata?.department}
        Rating: ${match.metadata?.rating}
        Review: ${match.metadata?.review}
        Timestamp: ${match.metadata?.timestamp}
        \n
        `
    });

    const lastMessage = data[data.length - 1].content;
    const lastMessageContent = lastMessage.content + responseString;
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

    const completion = await openai.completions.create({
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            ...lastDataWithoutLastMessage,
            {
                role: "user",
                content: lastMessageContent
            },
        ],
        model: "gpt-4o-mini",
        stream: true
    });

    const stream = ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            try {
                for await(const chunk of completion) {
                    const content = chunk.choices[0]?.delta.content;

                    if (content) {
                        const text = encoder.encode(content);
                        controller.enqueue(text);
                    }
                }
            } catch (error) {
                controller.error(error);

            } finally {
                controller.close();
            }
        }
    })

    return new NextResponse(stream);
}
