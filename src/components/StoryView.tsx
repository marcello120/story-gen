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
        <div className="space-y-4">
            {story.beats.map((beat, i) => (
                <BeatCard
                    key={`${beat.type}-${i}`}
                    beat={beat}
                    beatIndex={i}
                    story={story}
                    pools={pools}
                    onStoryUpdate={onStoryUpdate}
                    onReroll={() => onStoryUpdate(regenerateBeat(story, i, pools))}
                />
            ))}
        </div>
    );
}
