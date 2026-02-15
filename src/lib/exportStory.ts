"use client";

import type {Story} from "./types";
import type {ActState} from "./useActGeneration";
import {beatToMarkdown} from "./markdown";
import {ACT_DEFINITIONS} from "./actMarkdown";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Always use light theme colors for export
const C = {
    bg: "#e8d5b0",
    bgCard: "#f0e4cc",
    fg: "#1a0e04",
    fgMuted: "#4a3525",
    fgFaint: "#7a6040",
    gold: "#7a5c0a",
    goldBright: "#a07810",
    goldFaint: "#eedcaa",
    blue: "#0e1f38",
    border: "#a08040",
    borderCard: "#b09248",
    borderLight: "#c0a458",
};

function esc(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Convert a markdown line (from beatToMarkdown) into styled HTML */
function mdLine(line: string): string {
    return esc(line).replace(
        /\*\*(.+?)\*\*/g,
        `<strong style="color:${C.gold};font-weight:700">$1</strong>`,
    );
}

function resolvedFonts() {
    const s = getComputedStyle(document.documentElement);
    return {
        cinzel: s.getPropertyValue("--font-cinzel").trim() || "'Cinzel',serif",
        cinzelDeco: s.getPropertyValue("--font-cinzel-deco").trim() || "'Cinzel Decorative',serif",
        fell: s.getPropertyValue("--font-fell").trim() || "'IM Fell English',Georgia,serif",
    };
}

function flourish(): string {
    return `<div style="text-align:center;color:${C.border};font-size:1rem;letter-spacing:0.3em;opacity:0.5;user-select:none">&mdash; &#10040; &mdash;</div>`;
}

function beatToHtml(beat: Story["beats"][number], index: number, fonts: ReturnType<typeof resolvedFonts>): string {
    const md = beatToMarkdown(beat);
    const lines = md.split("\n");

    let h = `<div style="background:${C.bgCard};border:1px solid ${C.borderCard};border-radius:8px;padding:16px 20px;margin-bottom:12px;position:relative;box-shadow:0 2px 6px rgba(80,50,20,0.15)">`;

    // Gold top edge
    h += `<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${C.gold},${C.goldBright},${C.gold},transparent);border-radius:8px 8px 0 0;opacity:0.5"></div>`;

    for (const line of lines) {
        if (line.startsWith("## ")) {
            const title = esc(line.slice(3));
            h += `<div style="display:flex;align-items:center;margin-bottom:8px">`;
            h += `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border-radius:50%;border:1.5px solid ${C.border};background:${C.goldFaint};color:${C.blue};font-family:${fonts.cinzel};font-size:0.65rem;font-weight:700;flex-shrink:0;margin-right:8px">${ROMAN[index]}</span>`;
            h += `<span style="font-family:${fonts.cinzelDeco};font-size:1.3rem;font-weight:700;color:${C.blue};font-variant:small-caps;letter-spacing:0.07em">${title}</span>`;
            h += `</div>`;
        } else if (line.startsWith("        - ")) {
            h += `<div style="margin-left:3rem;margin-bottom:2px;font-size:0.95rem">${mdLine(line.slice(10))}</div>`;
        } else if (line.startsWith("    - ")) {
            h += `<div style="margin-left:2rem;margin-bottom:2px;font-size:0.95rem">${mdLine(line.slice(6))}</div>`;
        } else if (line.startsWith("- ")) {
            h += `<div style="margin-bottom:3px;font-size:0.95rem">${mdLine(line.slice(2))}</div>`;
        }
    }

    h += `</div>`;
    return h;
}

function buildExportHtml(story: Story, acts: [ActState, ActState, ActState]): string {
    const fonts = resolvedFonts();
    const hasChronicle = acts.some((a) => a.text);

    let h = `<div style="background:${C.bg};color:${C.fg};font-family:${fonts.fell};padding:40px 50px;width:800px;line-height:1.6">`;

    // Title
    h += `<div style="text-align:center;margin-bottom:24px">`;
    h += `<div style="font-family:${fonts.cinzelDeco};font-size:2.5rem;font-weight:700;color:${C.blue};margin:0 0 8px">Mythslop</div>`;
    h += flourish();
    h += `</div>`;

    // Outline
    h += `<div style="font-family:${fonts.cinzel};font-size:1.4rem;color:${C.blue};font-weight:700;margin-bottom:16px;text-align:center;font-variant:small-caps;letter-spacing:0.08em">Story Outline</div>`;

    for (let i = 0; i < story.beats.length; i++) {
        h += beatToHtml(story.beats[i], i, fonts);
    }

    // Chronicle
    if (hasChronicle) {
        h += `<div style="margin:30px 0">${flourish()}</div>`;
        h += `<div style="font-family:${fonts.cinzelDeco};font-size:1.6rem;color:${C.blue};font-weight:700;margin-bottom:24px;text-align:center">The Chronicle</div>`;

        for (let i = 0; i < 3; i++) {
            const act = acts[i];
            if (!act.text) continue;

            const def = ACT_DEFINITIONS[i];
            h += `<div style="font-family:${fonts.cinzel};font-size:1.1rem;font-weight:700;color:${C.gold};letter-spacing:0.05em;font-variant:small-caps;margin-bottom:12px">${def.label}: ${esc(def.name.split(": ")[1])}</div>`;
            h += `<div style="white-space:pre-wrap;line-height:1.8;font-size:1rem;margin-bottom:24px">${esc(act.text)}</div>`;

            if (i < 2 && acts[i + 1]?.text) {
                h += `<div style="margin:16px 0">${flourish()}</div>`;
            }
        }
    }

    // Footer
    h += `<div style="margin-top:30px">${flourish()}</div>`;
    h += `<div style="text-align:center;margin-top:8px">`;
    h += `<span style="font-family:${fonts.cinzel};font-style:italic;color:${C.fgFaint};font-size:0.75rem;letter-spacing:0.1em;opacity:0.5">Here Be Dragons</span>`;
    h += `</div>`;

    h += `</div>`;
    return h;
}

async function renderToCanvas(story: Story, acts: [ActState, ActState, ActState]): Promise<HTMLCanvasElement> {
    const {default: html2canvas} = await import("html2canvas-pro");

    const html = buildExportHtml(story, acts);
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-9999px";
    wrapper.style.top = "0";
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    try {
        return await html2canvas(wrapper.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: C.bg,
        });
    } finally {
        document.body.removeChild(wrapper);
    }
}

export async function exportAsImage(story: Story, acts: [ActState, ActState, ActState]) {
    const canvas = await renderToCanvas(story, acts);
    const link = document.createElement("a");
    link.download = "mythslop-story.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

export async function exportAsPdf(story: Story, acts: [ActState, ActState, ActState]) {
    const canvas = await renderToCanvas(story, acts);
    const {jsPDF} = await import("jspdf");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let position = 0;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    pdf.save("mythslop-story.pdf");
}
