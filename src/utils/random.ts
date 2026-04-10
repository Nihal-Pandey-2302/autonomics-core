export class Random {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    chance(probability: number): boolean {
        return this.next() < probability;
    }

    intBetween(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick<T>(arr: T[]): T | undefined {
        if (arr.length === 0) return undefined;
        const index = Math.floor(this.next() * arr.length);
        return arr[index];
    }

    weightedPick<T>(items: T[], weightFn: (item: T) => number): T | undefined {
        if (items.length === 0) return undefined;
        let totalWeight = 0;
        for (const item of items) {
           const w = weightFn(item);
           if (w > 0) totalWeight += w;
        }
        if (totalWeight <= 0) return this.pick(items);
        
        let r = this.next() * totalWeight;
        for (const item of items) {
            const w = weightFn(item);
            if (w <= 0) continue;
            r -= w;
            if (r <= 0) return item;
        }
        return items[items.length - 1];
    }
}
