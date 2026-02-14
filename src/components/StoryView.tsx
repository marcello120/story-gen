"use client";

import type {PoolData, Story} from "@/lib/types";
import {regenerateBeat} from "@/lib/engine";
import BeatCard from "./BeatCard";

interface StoryViewProps {
    story: Story;
    pools: PoolData;
    onStoryUpdate: (story: Story) => void;
}

export default function StoryView({story, pools, onStoryUpdate}: StoryViewProps) {
    return (
        <div>
            {story.beats.map((beat, i) => (
                <div key={`${beat.type}-${i}`}>
                    {/* Dotted trail connector between beats */}
                    {i > 0 && (
                        <div className="trail-connector" aria-hidden="true">
                            <div className="trail-line"></div>
                        </div>
                    )}
                    <BeatCard
                        beat={beat}
                        beatIndex={i}
                        story={story}
                        pools={pools}
                        onStoryUpdate={onStoryUpdate}
                        onReroll={() => onStoryUpdate(regenerateBeat(story, i, pools))}
                    />
                </div>
            ))}
        </div>
    );
}
