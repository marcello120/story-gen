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
import {FileBraces, FilePen, FileUp, RefreshCcw, Map, BookOpenText} from "lucide-react";

const STORAGE_KEY_STORY = "mythslop-story";

export default function Home() {
    const [pools, setPools] = useState<PoolData | null>(null);
    const [story, setStory] = useState<Story | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileTab, setMobileTab] = useState<"outline" | "chronicle">("outline");
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
                            <>
                                <button
                                    type="button"
                                    onClick={exportJson}
                                    className="px-4 py-2.5 rounded-lg btn-outline cursor-pointer text-sm"
                                >
                                    <FileBraces />
                                </button>
                                <button
                                    type="button"
                                    onClick={exportMarkdown}
                                    className="px-4 py-2.5 rounded-lg btn-outline cursor-pointer text-sm"
                                >
                                    <FilePen />
                                </button>
                            </>
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

                {/*<button onClick={()=>{*/}
                {/*    const utterance = new SpeechSynthesisUtterance("On a drifting speck of land that answered to no king, the Man With Inscription On Forehead awoke each dawn beneath an arc of colours. The island had no anchor; it wandered upon the gray sea like a secret thought. They called it the Wandering Isle, for its shores changed kin with the tides, and its paths led sometimes to distant shoals and sometimes to the belly of mists. The rainbows that crowned the isle were not the work of sun and storm alone but of a thousand small wings: butterflies, each the pale sprite of a lover’s soul, flung into iridescent flight. When two hearts were joined and then rent by fate, their spirits took wing and painted heaven in bands of blue and gold. Thus the isle remembered love, and the memory was bright against the sky.");*/}
                {/*    window.speechSynthesis.speak(utterance);*/}
                {/*}} >*/}
                {/*    TALK*/}
                {/*</button>*/}

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
