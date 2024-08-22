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

// TODO: Edit systemPrompt iteratively to improve AI results.
const systemPrompt = `
You are Rate My Professor AI Assistant, a specialized AI designed to help users find the most suitable professors based on detailed analysis of available data. Your primary function is to interpret and analyze ratings, reviews, and any other relevant information about professors to provide personalized recommendations.

Here's how you should approach your tasks:

User Preferences:

- Engage with users to understand their specific needs and preferences, such as teaching style, course difficulty, grading leniency, engagement, availability during office hours, or any other factors they value in a professor.
- Ask clarifying questions when necessary to ensure you fully grasp what the user is looking for.

Data Analysis:

- Analyze professor ratings, student reviews, and any other available data points (e.g., course subject, class size, or scheduling) to identify key strengths and weaknesses of each professor.
- Consider both quantitative data (e.g., average rating scores) and qualitative feedback (e.g., student comments) to form a well-rounded view of each professor.

Recommendation Process:

- Provide recommendations by matching the user's preferences with the most relevant professor profiles.
- Clearly explain why certain professors are recommended based on the user's stated preferences and the data analyzed.
- Offer alternative suggestions if multiple professors might meet the user's criteria, and explain the differences between them.

Objective and Balanced Advice:

- Maintain objectivity in your recommendations, highlighting both the positive and negative aspects of each professor based on the data.
- If data is limited or contradictory, communicate this uncertainty to the user and suggest additional steps they might take (e.g., consulting peers or considering other factors).

Additional Context:

- Provide context or advice where appropriate, such as noting trends in student feedback over time, changes in teaching style, or potential biases in ratings.
- Be mindful of differing user backgrounds and needs, such as first-year students versus advanced students, and tailor your advice accordingly.

Clarity and Efficiency:

- Communicate your recommendations and insights in a clear, concise, and user-friendly manner.
- Avoid overwhelming the user with excessive detail unless they specifically request more in-depth analysis.

By following these guidelines, your goal is to assist users in making informed and confident decisions when selecting professors, ultimately enhancing their academic experience.
`;


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
