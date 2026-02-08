"use client";

import {useState, useEffect, useCallback} from "react";
import type {PoolData, Story} from "@/lib/types";
import {loadPools} from "@/lib/pools";
import {generateStory} from "@/lib/engine";
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

    const generate = useCallback(() => {
        if (!pools) return;
        setStory(generateStory(pools));
    }, [pools]);

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
                        DnD Story Generator
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Generate a Hero&apos;s Journey from the Thompson Motif Index
                    </p>
                    <button
                        type="button"
                        onClick={generate}
                        className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer transition-colors shadow-sm"
                    >
                        {story ? "Generate New Story" : "Generate Story"}
                    </button>
                </header>

                {story && pools && (
                    <StoryView story={story} pools={pools} onStoryUpdate={setStory} />
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
