import {readFileSync, writeFileSync} from "fs";
import {parse} from "csv-parse/sync";
import {join, dirname} from "path";
import {fileURLToPath} from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, "..", "data", "tmi_clustered.csv");
const outPath = join(__dirname, "..", "public", "motifs.json");

const raw: Record<string, string>[] = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
});

const pools: Record<string, string[]> = {};

function addTo(key: string, name: string): void {
    if (!pools[key]) pools[key] = [];
    pools[key].push(name);
}

for (const row of raw) {
    const name = row.motif_name;
    const category = row.category;
    const subcategory = row.subcategory;
    if (!name) continue;

    addTo(category, name);

    if (category === "Being") {
        addTo(subcategory, name);
    }
}

writeFileSync(outPath, JSON.stringify(pools));

const totalMotifs = Object.values(pools).reduce((sum, arr) => sum + arr.length, 0);
const keys = Object.keys(pools);
console.log(`Wrote ${keys.length} pools (${totalMotifs} total entries) to ${outPath}`);
console.log(`File size: ${(readFileSync(outPath).length / 1024 / 1024).toFixed(2)} MB`);
for (const key of keys.sort()) {
    console.log(`  ${key}: ${pools[key].length} motifs`);
}
