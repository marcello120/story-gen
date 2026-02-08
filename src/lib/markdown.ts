import type {Beat, Entity, Modifier, MotifValue, Place, Story} from "./types";

function bold(m: MotifValue): string {
    return `**${m.text}**`;
}

function mods(modifiers: Modifier[], indent: string): string {
    return modifiers.map((m) => `${indent}- ${m.label}: ${bold(m.value)}`).join("\n");
}

function entity(label: string, e: Entity, suffix?: string): string {
    const lines: string[] = [];
    const suffixStr = suffix ? ` — ${suffix}` : "";
    lines.push(`- ${label}: ${bold(e.name)}${suffixStr}`);
    if (e.mods.length > 0) lines.push(mods(e.mods, "    "));
    return lines.join("\n");
}

function place(label: string, p: Place, suffix?: string): string {
    const lines: string[] = [];
    const suffixStr = suffix ? ` — ${suffix}` : "";
    lines.push(`- ${label}: ${bold(p.name)} (${p.origin.text})${suffixStr}`);
    if (p.mods.length > 0) lines.push(mods(p.mods, "    "));
    return lines.join("\n");
}

function motifLine(label: string, m: MotifValue): string {
    return `- ${label}: ${bold(m)}`;
}

function beatToMarkdown(beat: Beat): string {
    const lines: string[] = [];
    lines.push(`## ${beat.title}`);
    lines.push("");

    switch (beat.type) {
        case "ordinary-world":
            lines.push(entity("Hero", beat.hero));
            lines.push(entity("Initial Companion", beat.companion, "Helper"));
            lines.push(entity("Villain", beat.villain));
            lines.push(place("Original World", beat.originalWorld, "Original World"));
            break;

        case "call-to-adventure":
            if (beat.inciting) lines.push(motifLine("Inciting", beat.inciting));
            if (beat.herald) lines.push(motifLine("Herald", beat.herald));
            for (const m of beat.hasToDoWith) lines.push(motifLine("Has something to do with", m));
            if (beat.lie) lines.push(motifLine("Lie told about", beat.lie));
            if (beat.becauseOf) lines.push(`- Because of: ${beat.becauseOf}`);
            break;

        case "refusal":
            lines.push(motifLine("Happens at Place", beat.place));
            for (const m of beat.hasToDoWith) lines.push(motifLine("Has something to do with", m));
            if (beat.becauseOf) lines.push(`- Because of: ${beat.becauseOf}`);
            break;

        case "mentor":
            lines.push(entity("Mentor", beat.mentor));
            lines.push(motifLine("Place", beat.place));
            if (beat.supernaturalBeing) lines.push(motifLine("Supernatural Being", beat.supernaturalBeing));
            for (const t of beat.talismans) lines.push(motifLine("Talisman gained", t));
            if (beat.learnsAbout) lines.push(`- Learns about: ${beat.learnsAbout}`);
            if (beat.trial) lines.push(motifLine("Trial", beat.trial));
            break;

        case "threshold":
            if (beat.hasToDoWith) lines.push(motifLine("Has something to do with", beat.hasToDoWith));
            lines.push(place("Other World", beat.otherWorld, "Other World"));
            break;

        case "tests":
            lines.push(`- Tests: ${beat.tests.map((t) => bold(t)).join(", ")}`);
            lines.push("- Allies:");
            for (const ally of beat.allies) {
                lines.push(`    - ${bold(ally.name)}`);
                if (ally.mods.length > 0) lines.push(mods(ally.mods, "        "));
            }
            lines.push("- Enemies:");
            for (const enemy of beat.enemies) {
                lines.push(`    - ${bold(enemy.name)}`);
                if (enemy.mods.length > 0) lines.push(mods(enemy.mods, "        "));
            }
            break;

        case "cave":
            lines.push(motifLine("Place", beat.place));
            for (const r of beat.toRescue) lines.push(motifLine("To Rescue", r));
            if (beat.toGetTalisman) lines.push(motifLine("To Get Object", beat.toGetTalisman));
            if (beat.cursedBane) lines.push(motifLine("Cursed (Bane)", beat.cursedBane));
            if (beat.toUndergo) lines.push(motifLine("To Undergo", beat.toUndergo));
            break;

        case "ordeal":
            lines.push(motifLine("Confronts Villain(s) at Place", beat.place));
            if (beat.placeMods.length > 0) lines.push(mods(beat.placeMods, "    "));
            for (const m of beat.hasToDoWith) lines.push(motifLine("Has something to do with", m));
            for (const h of beat.hingesOn) lines.push(`- Hinges on: ${h}`);
            break;

        case "reward":
            lines.push(motifLine("Reward", beat.reward));
            lines.push(motifLine("Hero becomes", beat.heroBecomes));
            lines.push(motifLine("Has something to do with", beat.hasToDoWith));
            if (beat.lossOf) lines.push(`- Loss of: ${beat.lossOf}`);
            break;

        case "road-back":
            lines.push(motifLine("Goes through Place", beat.place));
            if (beat.placeMods.length > 0) lines.push(mods(beat.placeMods, "    "));
            lines.push(motifLine("Accompanied by", beat.accompaniedBy));
            break;

        case "resurrection":
            lines.push(motifLine("Has to contend with", beat.contendWith));
            lines.push(motifLine("To achieve", beat.toAchieve));
            break;
    }

    return lines.join("\n");
}

export function storyToMarkdown(story: Story): string {
    const sections = ["# Generated Story", ""];
    for (const beat of story.beats) {
        sections.push(beatToMarkdown(beat));
        sections.push("");
    }
    return sections.join("\n");
}
