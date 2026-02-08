"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {PoolData, Story} from "@/lib/types";
import {loadPools} from "@/lib/pools";
import {generateStory} from "@/lib/engine";
import {storyToMarkdown} from "@/lib/markdown";
import {syncStory} from "@/lib/sync";
import StoryView from "@/components/StoryView";

export default function Home() {
    const [pools, setPools] = useState<PoolData | null>(null);
    const [story, setStory] = useState<Story | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPools().then((data) => {
            setPools(data);
            setLoading(false);
        });
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleStoryUpdate = useCallback((newStory: Story) => {
        setStory((prev) => prev ? syncStory(prev, newStory) : newStory);
    }, []);

    const generate = useCallback(() => {
        if (!pools) return;
        setStory(generateStory(pools));
    }, [pools]);

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
            } catch {
                alert("Invalid story JSON file.");
            }
        };
        reader.readAsText(file);
        // Reset so the same file can be re-imported
        e.target.value = "";
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <p className="text-gray-500 dark:text-gray-400">Loading motif data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Mythslop
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Generate a Hero&apos;s Journey from the Thompson Motif Index
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={generate}
                            className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer transition-colors shadow-sm"
                        >
                            {story ? "Generate New Story" : "Generate Story"}
                        </button>
                        {story && (
                            <>
                                <button
                                    type="button"
                                    onClick={exportJson}
                                    className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-sm"
                                >
                                    ⬇ JSON
                                </button>
                                <button
                                    type="button"
                                    onClick={exportMarkdown}
                                    className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-sm"
                                >
                                    ⬇ MD
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-sm"
                        >
                            ➕ JSON
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

                {story && pools && (
                    <StoryView story={story} pools={pools} onStoryUpdate={handleStoryUpdate}/>
                )}

                {!story && (
                    <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                        Click the button above to generate a story
                    </div>
                )}
            </div>
        </div>
    );
}
