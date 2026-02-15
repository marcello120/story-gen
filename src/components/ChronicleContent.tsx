"use client";

import type {Story} from "@/lib/types";
import type {ActState} from "@/lib/useActGeneration";
import {ACT_DEFINITIONS} from "@/lib/actMarkdown";
import {Loader2, AlertTriangle} from "lucide-react";

interface ChronicleContentProps {
    story: Story | null;
    acts: [ActState, ActState, ActState];
    nextAvailableAct: number | null;
    isGenerating: boolean;
    onGenerate: (story: Story, actIndex: number, acts: [ActState, ActState, ActState]) => void;
}

export default function ChronicleContent({
    story,
    acts,
    nextAvailableAct,
    isGenerating,
    onGenerate,
}: ChronicleContentProps) {
    if (!story) {
        return (
            <p className="sidebar-locked" style={{textAlign: "center", paddingTop: "2rem"}}>
                Generate a story to begin the Chronicle...
            </p>
        );
    }

    return (
        <>
            {acts.map((act, i) => (
                <div key={i} className="sidebar-act">
                    <h3 className="sidebar-act-title">
                        {ACT_DEFINITIONS[i].label}: {ACT_DEFINITIONS[i].name.split(": ")[1]}
                    </h3>

                    {act.text && (
                        <div className="sidebar-prose">
                            {act.text}
                            {act.status === "generating" && (
                                <span className="sidebar-cursor"/>
                            )}
                        </div>
                    )}

                    {act.status === "error" && (
                        <div className="sidebar-error">
                            <AlertTriangle className="inline w-4 h-4 flex-shrink-0"/>
                            <span>{act.error || "Generation failed"}</span>
                        </div>
                    )}

                    {nextAvailableAct === i && (
                        <button
                            type="button"
                            onClick={() => onGenerate(story, i, acts)}
                            disabled={isGenerating}
                            className="px-4 py-2 rounded-lg btn-gold cursor-pointer
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       sidebar-generate-btn"
                        >
                            {act.status === "error"
                                ? `Retry ${ACT_DEFINITIONS[i].label}`
                                : i === 0
                                    ? "Begin the Chronicle"
                                    : `Continue: ${ACT_DEFINITIONS[i].label}`}
                        </button>
                    )}

                    {act.status === "idle" && nextAvailableAct !== i && (
                        <p className="sidebar-locked">
                            Complete {ACT_DEFINITIONS[i - 1]?.label ?? "the previous act"} first...
                        </p>
                    )}

                    {act.status === "generating" && !act.text && (
                        <div className="sidebar-loading">
                            <Loader2 className="inline w-4 h-4 animate-spin"/>
                            <span>Inscribing {ACT_DEFINITIONS[i].label}...</span>
                        </div>
                    )}

                    {i < 2 && (act.status === "done" || act.text) && (
                        <div className="divider-flourish my-3" aria-hidden="true">
                            &#8212;&#10040;&#8212;
                        </div>
                    )}
                </div>
            ))}
        </>
    );
}
