import type {Story} from "./types";
import {beatToMarkdown} from "./markdown";

export const ACT_DEFINITIONS = [
    {name: "Act 1: The Setup", beats: [0, 1, 2, 3], label: "Act I"},
    {name: "Act 2: The Confrontation", beats: [4, 5, 6, 7], label: "Act II"},
    {name: "Act 3: The Resolution", beats: [8, 9, 10, 11], label: "Act III"},
] as const;

export function actToMarkdown(story: Story, actIndex: number): string {
    const {beats} = ACT_DEFINITIONS[actIndex];
    const sections: string[] = [];
    for (const i of beats) {
        if (story.beats[i]) {
            sections.push(beatToMarkdown(story.beats[i]));
            sections.push("");
        }
    }
    return sections.join("\n");
}

export function fullOutlineMarkdown(story: Story): string {
    return story.beats.map((beat) => beatToMarkdown(beat)).join("\n\n");
}
