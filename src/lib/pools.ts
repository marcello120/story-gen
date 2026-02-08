import type {PoolData} from "./types";

let cached: PoolData | null = null;

export async function loadPools(): Promise<PoolData> {
    if (cached) return cached;
    const res = await fetch("/motifs.json");
    cached = await res.json();
    return cached!;
}
