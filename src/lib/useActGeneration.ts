"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {Story} from "./types";
import {ACT_DEFINITIONS, actToMarkdown, fullOutlineMarkdown} from "./actMarkdown";

export interface ActState {
    text: string;
    status: "idle" | "generating" | "done" | "error";
    error?: string;
    responseId?: string;
}

const INITIAL_ACT: ActState = {text: "", status: "idle"};
const STORAGE_KEY_ACTS = "mythslop-acts";
const RESPONSE_ID_MARKER = "__RESPONSE_ID__:";

function loadSavedActs(): [ActState, ActState, ActState] | null {
    if (typeof window === "undefined") return null;
    try {
        const saved = localStorage.getItem(STORAGE_KEY_ACTS);
        if (!saved) return null;
        const parsed = JSON.parse(saved) as [ActState, ActState, ActState];
        // If page was refreshed mid-generation, treat partial text as done, empty as idle
        return parsed.map((act) => {
            if (act.status === "generating") {
                return act.text ? {text: act.text, status: "done" as const, responseId: act.responseId} : {...INITIAL_ACT};
            }
            return act;
        }) as [ActState, ActState, ActState];
    } catch {
        return null;
    }
}

function buildUserPrompt(
    story: Story,
    actIndex: number,
    previousActsText: string[],
    hasPreviousContext: boolean,
): string {
    const outline = fullOutlineMarkdown(story);
    const actOutline = actToMarkdown(story, actIndex);
    const actDef = ACT_DEFINITIONS[actIndex];

    let prompt = `Here is the full story outline:\n\n${outline}\n\n`;
    prompt += `---\n\n`;

    // Only include previous acts text if we don't have conversation context via previous_response_id
    // if (!hasPreviousContext && previousActsText.length > 0) {
    //     prompt += `Here is what has been written so far:\n\n`;
    //     for (let i = 0; i < previousActsText.length; i++) {
    //         prompt += `### ${ACT_DEFINITIONS[i].name}\n\n${previousActsText[i]}\n\n`;
    //     }
    //     prompt += `---\n\n`;
    // }

    prompt += `Now write ${actDef.name}. The beats to cover are:\n\n${actOutline}\n\n`;
    prompt += `Continue the narrative naturally from ${actIndex > 0 ? "where the story left off" : "the beginning"}.`;

    return prompt;
}

export function useActGeneration() {
    const [acts, setActs] = useState<[ActState, ActState, ActState]>([
        {...INITIAL_ACT},
        {...INITIAL_ACT},
        {...INITIAL_ACT},
    ]);
    const abortRef = useRef<AbortController | null>(null);

    // Load saved acts from localStorage on mount
    useEffect(() => {
        const saved = loadSavedActs();
        if (saved) setActs(saved);
    }, []);

    // Persist acts to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ACTS, JSON.stringify(acts));
    }, [acts]);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setActs([{...INITIAL_ACT}, {...INITIAL_ACT}, {...INITIAL_ACT}]);
    }, []);

    const generateAct = useCallback(
        async (story: Story, actIndex: number, currentActs: [ActState, ActState, ActState]) => {
            // Get the previous act's response ID for conversation continuity
            const previousResponseId = actIndex > 0 ? currentActs[actIndex - 1].responseId : undefined;

            // Collect previously completed act texts (only needed if no conversation context)
            const previousActsText: string[] = currentActs.map(
                (act, i) => (i < actIndex && act.status === "done" ? act.text : ""),
            ).filter((text) => true);

            // Update state separately (just marks as generating)
            setActs((prev) => {
                const next = [...prev] as [ActState, ActState, ActState];
                next[actIndex] = {text: "", status: "generating"};
                return next;
            });

            const userPrompt = buildUserPrompt(story, actIndex, previousActsText, !!previousResponseId);

            const abort = new AbortController();
            abortRef.current = abort;

            try {
                const res = await fetch("/api/generate", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        userPrompt,
                        previousResponseId: previousResponseId || undefined,
                    }),
                    signal: abort.signal,
                });

                if (!res.ok) {
                    const errText = await res.text();
                    setActs((prev) => {
                        const next = [...prev] as [ActState, ActState, ActState];
                        next[actIndex] = {text: "", status: "error", error: errText};
                        return next;
                    });
                    return;
                }

                const reader = res.body!.getReader();
                const decoder = new TextDecoder();
                let responseId = "";

                while (true) {
                    const a = await reader.read()
                    const {done, value} = a;
                    if (done) break;
                    const chunk = decoder.decode(value, {stream: true});

                    // Check if this chunk contains the response ID marker
                    const markerIdx = chunk.indexOf(RESPONSE_ID_MARKER);
                    if (markerIdx !== -1) {
                        const textBefore = chunk.slice(0, markerIdx).replace(/\n+$/, "");
                        responseId = chunk.slice(markerIdx + RESPONSE_ID_MARKER.length).trim();
                        if (textBefore) {
                            setActs((prev) => {
                                const next = [...prev] as [ActState, ActState, ActState];
                                next[actIndex] = {
                                    ...next[actIndex],
                                    text: next[actIndex].text + textBefore,
                                };
                                return next;
                            });
                        }
                    } else {
                        setActs((prev) => {
                            const next = [...prev] as [ActState, ActState, ActState];
                            next[actIndex] = {
                                ...next[actIndex],
                                text: next[actIndex].text + chunk,
                            };
                            return next;
                        });
                    }
                }

                setActs((prev) => {
                    const next = [...prev] as [ActState, ActState, ActState];
                    next[actIndex] = {...next[actIndex], status: "done", responseId};
                    return next;
                });
            } catch (err: unknown) {
                if ((err as Error).name === "AbortError") return;
                setActs((prev) => {
                    const next = [...prev] as [ActState, ActState, ActState];
                    next[actIndex] = {
                        text: "",
                        status: "error",
                        error: (err as Error).message,
                    };
                    return next;
                });
            }
        },
        [],
    );

    const nextAvailableAct = (() => {
        if (acts[0].status === "idle" || acts[0].status === "error") return 0;
        if (acts[0].status === "done" && (acts[1].status === "idle" || acts[1].status === "error")) return 1;
        if (acts[1].status === "done" && (acts[2].status === "idle" || acts[2].status === "error")) return 2;
        return null;
    })();

    const isGenerating = acts.some((a) => a.status === "generating");

    return {acts, nextAvailableAct, isGenerating, generateAct, reset};
}
