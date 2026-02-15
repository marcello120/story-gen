"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {PoolData, Story} from "@/lib/types";
import {loadPools} from "@/lib/pools";
import {generateStory} from "@/lib/engine";
import {storyToMarkdown} from "@/lib/markdown";
import {syncStory} from "@/lib/sync";
import {useActGeneration} from "@/lib/useActGeneration";
import StoryView from "@/components/StoryView";
import StorySidebar from "@/components/StorySidebar";
import ChronicleContent from "@/components/ChronicleContent";
import {exportAsImage, exportAsPdf} from "@/lib/exportStory";
import {Download, FileBraces, FilePen, FileUp, FileText, FileImage, RefreshCcw, Map, BookOpenText} from "lucide-react";

const STORAGE_KEY_STORY = "mythslop-story";

export default function Home() {
    const [pools, setPools] = useState<PoolData | null>(null);
    const [story, setStory] = useState<Story | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState<"outline" | "chronicle">("outline");
    const [downloadOpen, setDownloadOpen] = useState(false);
    const {acts, nextAvailableAct, isGenerating, generateAct, reset: resetActs} = useActGeneration();

    useEffect(() => {
        loadPools().then((data) => {
            setPools(data);
            setLoading(false);
        });
        // Restore story from localStorage
        try {
            const saved = localStorage.getItem(STORAGE_KEY_STORY);
            if (saved) setStory(JSON.parse(saved));
        } catch {
            // ignore corrupt data
        }
    }, []);

    // Persist story to localStorage whenever it changes
    useEffect(() => {
        if (story) {
            localStorage.setItem(STORAGE_KEY_STORY, JSON.stringify(story));
        } else {
            localStorage.removeItem(STORAGE_KEY_STORY);
        }
    }, [story]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const downloadRef = useRef<HTMLDivElement>(null);

    // Close download dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
                setDownloadOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleStoryUpdate = useCallback((newStory: Story) => {
        setStory((prev) => prev ? syncStory(prev, newStory) : newStory);
    }, []);

    const generate = useCallback(() => {
        if (!pools) return;
        setStory(generateStory(pools));
        resetActs();
        setSidebarOpen(false);
    }, [pools, resetActs]);

    const downloadFile = useCallback((content: string, filename: string, type: string) => {
        const blob = new Blob([content], {type});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const exportJson = useCallback(() => {
        if (!story) return;
        downloadFile(JSON.stringify(story, null, 2), "story.json", "application/json");
    }, [story, downloadFile]);

    const exportMarkdown = useCallback(() => {
        if (!story) return;
        downloadFile(storyToMarkdown(story), "story.md", "text/markdown");
    }, [story, downloadFile]);

    const exportPdf = useCallback(() => {
        if (!story) return;
        exportAsPdf(story, acts);
    }, [story, acts]);

    const exportImage = useCallback(() => {
        if (!story) return;
        exportAsImage(story, acts);
    }, [story, acts]);

    const importStory = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string) as Story;
                setStory(data);
                resetActs();
            } catch {
                alert("Invalid story JSON file.");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    }, [resetActs]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="label-text text-lg">Loading motif data...</p>
            </div>
        );
    }

    return (
        <div className={`min-h-screen background-style page-layout ${sidebarOpen ? "page-layout--sidebar-open" : ""}`}>
            <div className="max-w-3xl mx-auto px-6 py-10 map-container">
                {/* Corner flourishes */}
                <span className="map-corner map-corner-tl" aria-hidden="true">&#10087;</span>
                <span className="map-corner map-corner-tr" aria-hidden="true">&#10087;</span>
                <span className="map-corner map-corner-bl" aria-hidden="true">&#10087;</span>
                <span className="map-corner map-corner-br" aria-hidden="true">&#10087;</span>

                <header className="text-center mb-8">
                    {/* Compass rose */}
                    <div className="compass-rose" aria-hidden="true">
                        <img src="/logo.png" alt=""/>
                    </div>

                    {/* Cartouche title */}
                    <div className="cartouche">
                        <h1 className="cartouche-title font-bold mb-0">
                            Mythslop
                        </h1>
                    </div>

                    {/* Decorative divider */}
                    <div className="divider-flourish mb-3 mt-2" aria-hidden="true">
                        &#8212;&#10040;&#8212;
                    </div>

                    <div className="flex items-center justify-center m-3 gap-3">
                        <button
                            type="button"
                            onClick={generate}
                            className="px-6 py-2.5 rounded-lg btn-gold font-medium cursor-pointer"
                        >
                            {story ? <RefreshCcw /> : "Generate"}
                        </button>
                        {story && (
                            <div className="relative" ref={downloadRef}>
                                <button
                                    type="button"
                                    onClick={() => setDownloadOpen(!downloadOpen)}
                                    className="px-4 py-2.5 rounded-lg btn-outline cursor-pointer text-sm"
                                >
                                    <Download />
                                </button>
                                {downloadOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-[var(--background-card)] border border-[var(--border)] rounded-lg shadow-lg z-10 min-w-[140px]">
                                        <button
                                            type="button"
                                            onClick={() => { exportJson(); setDownloadOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--gold-faint)] flex items-center gap-2 rounded-t-lg cursor-pointer"
                                        >
                                            <FileBraces className="w-4 h-4" /> JSON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { exportMarkdown(); setDownloadOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--gold-faint)] flex items-center gap-2 cursor-pointer"
                                        >
                                            <FilePen className="w-4 h-4" /> Markdown
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { exportPdf(); setDownloadOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--gold-faint)] flex items-center gap-2 cursor-pointer"
                                        >
                                            <FileText className="w-4 h-4" /> PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { exportImage(); setDownloadOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--gold-faint)] flex items-center gap-2 rounded-b-lg cursor-pointer"
                                        >
                                            <FileImage className="w-4 h-4" /> Image
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 rounded-lg btn-outline cursor-pointer text-sm"
                        >
                            <FileUp />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={importStory}
                            className="hidden"
                        />
                    </div>
                </header>


                {/* Mobile tab switcher — hidden on desktop */}
                {story && (
                    <div className="mobile-tabs">
                        <button
                            type="button"
                            onClick={() => setMobileTab("outline")}
                            className={`mobile-tab ${mobileTab === "outline" ? "mobile-tab--active" : ""}`}
                        >
                            <Map className="w-4 h-4"/>
                            Outline
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab("chronicle")}
                            className={`mobile-tab ${mobileTab === "chronicle" ? "mobile-tab--active" : ""}`}
                        >
                            <BookOpenText className="w-4 h-4"/>
                            Chronicle
                        </button>
                    </div>
                )}

                {/* Outline view — always visible on desktop, tab-controlled on mobile */}
                <div className={`mobile-tab-content ${mobileTab !== "outline" ? "mobile-tab-content--hidden" : ""}`}>
                    {story && pools && (
                        <StoryView story={story} pools={pools} onStoryUpdate={handleStoryUpdate}/>
                    )}

                    {!story && (
                        <div className="text-center py-20 label-text">
                            Click the button above to generate a story
                        </div>
                    )}
                </div>

                {/* Chronicle view — only visible on mobile when tab is active */}
                {story && (
                    <div className={`mobile-chronicle ${mobileTab !== "chronicle" ? "mobile-chronicle--hidden" : ""}`}>
                        <ChronicleContent
                            story={story}
                            acts={acts}
                            nextAvailableAct={nextAvailableAct}
                            isGenerating={isGenerating}
                            onGenerate={generateAct}
                        />
                    </div>
                )}

                {/* Map footer */}
                <footer className="text-center mt-10">
                    <div className="divider-flourish mb-3" aria-hidden="true">
                        &#8212;&#10040;&#8212;
                    </div>
                    <p className="map-footer">
                        Here Be Dragons
                    </p>
                </footer>
            </div>

            <StorySidebar
                open={sidebarOpen}
                onOpen={() => setSidebarOpen(true)}
                onClose={() => setSidebarOpen(false)}
                story={story}
                acts={acts}
                nextAvailableAct={nextAvailableAct}
                isGenerating={isGenerating}
                onGenerate={generateAct}
            />
        </div>
    );
}
