import {NextRequest} from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5-nano";
    if (!apiKey) {
        return new Response("OPENAI_API_KEY not configured", {status: 500});
    }
    const instructions = `You are a master storyteller writing in the style of classic mythology and fairy tales. You write vivid, evocative prose with a medieval tone. You are given a story outline based on the Hero's Journey (12 beats across 3 acts). Your task is to write the prose for one act at a time.
Rules:
- Write only the requested act, not the entire story.
- Follow the outline closely — the characters, places, objects, and events described are your source material.
- Weave the motifs naturally into flowing narrative prose.
- Use chapter/section breaks for each beat within the act.
- Maintain a consistent tone: mythic, evocative, with a sense of wonder.
- Adapt motifs to fit the narrative as needed, but keep their core essence.
- The motif is the archetype not the name of the character, place, or object.
- Each act should be approximately 800-1200 words.
- Do not include meta-commentary or notes — only the story prose.`;

    const {userPrompt, previousResponseId} = await req.json();

    const body: Record<string, unknown> = {
        model,
        stream: true,
        instructions,
        input: userPrompt,
        temperature: 1.0,
        max_output_tokens: 4000,
        store: true,
    };

    if (previousResponseId) {
        body.previous_response_id = previousResponseId;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!openaiRes.ok) {
        const errorText = await openaiRes.text();
        return new Response(errorText, {status: openaiRes.status});
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
        async start(controller) {
            const reader = openaiRes.body!.getReader();
            let buffer = "";
            let currentEvent = "";

            try {
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, {stream: true});
                    const lines = buffer.split("\n");
                    buffer = lines.pop()!;

                    for (const line of lines) {
                        const trimmed = line.trim();

                        if (trimmed.startsWith("event: ")) {
                            currentEvent = trimmed.slice(7);
                            continue;
                        }

                        if (!trimmed.startsWith("data: ")) continue;
                        const data = trimmed.slice(6);

                        if (currentEvent === "response.created") {
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed?.response?.id) {
                                    controller.enqueue(
                                        encoder.encode(`__RESPONSE_ID__:${parsed.response.id}\n`),
                                    );
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        } else if (currentEvent === "response.output_text.delta") {
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.delta) {
                                    controller.enqueue(encoder.encode(parsed.delta));
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
        },
    });
}
