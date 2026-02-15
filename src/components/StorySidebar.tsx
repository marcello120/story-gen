"use client";

import {useEffect, useRef} from "react";
import type {Story} from "@/lib/types";
import type {ActState} from "@/lib/useActGeneration";
import {BookOpenText, X} from "lucide-react";
import ChronicleContent from "./ChronicleContent";

interface StorySidebarProps {
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
    story: Story | null;
    acts: [ActState, ActState, ActState];
    nextAvailableAct: number | null;
    isGenerating: boolean;
    onGenerate: (story: Story, actIndex: number, acts: [ActState, ActState, ActState]) => void;
}

export default function StorySidebar({
    open,
    onOpen,
    onClose,
    story,
    acts,
    nextAvailableAct,
    isGenerating,
    onGenerate,
}: StorySidebarProps) {
    const contentRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom during generation
    useEffect(() => {
        if (isGenerating && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    });

    if (!open) {
        return (
            <aside className="sidebar-collapsed" onClick={onOpen} title="Open Chronicle">
                <BookOpenText className="w-8 h-8 sidebar-collapsed-icon animate-bounce"/>
                <span className="sidebar-collapsed-label animate-text-glow">Chronicle</span>
            </aside>
        );
    }

    return (
        <aside className="sidebar-panel">
            <div className="sidebar-header">
                <BookOpenText className="inline w-5 h-5 shrink-0"/>
                <h2 className="sidebar-title">Chronicle</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto p-1 rounded btn-outline cursor-pointer"
                    title="Close sidebar"
                >
                    <X className="w-4 h-4"/>
                </button>
            </div>

            <div className="sidebar-content" ref={contentRef}>
                <ChronicleContent
                    story={story}
                    acts={acts}
                    nextAvailableAct={nextAvailableAct}
                    isGenerating={isGenerating}
                    onGenerate={onGenerate}
                />
            </div>
        </aside>
    );
}
