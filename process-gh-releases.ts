#!/usr/bin/env -S deno run --allow-read --allow-run

const data = JSON.parse(Deno.readTextFileSync("quarto-cli-releases.json"));

const entries: any[] = [];

for (const node of data.data.repository.releases.nodes) {
    let totalDownloads = 0;
    for (const asset of node.releaseAssets.nodes) {
        totalDownloads += asset.downloadCount;
    }
    entries.push({
        tagName: node.tagName,
        updatedAt: node.updatedAt,
        downloads: totalDownloads,
    });
};

const entriesBytagName: Record<string, any> = {};
entries.forEach(entry => {
    entriesBytagName[entry.tagName] = entry;
});

const tagNumbers = (tagName: string) => {
    return tagName.slice(1).split(".").map(Number);
}

const versionDifference = (a: number[], b: number[]): number => {
    for (let i = 0; i < a.length; i++) {
        if (a[i] > b[i]) {
            return i + 1;
        }
        if (a[i] < b[i]) {
            return -(i + 1);
        }
    }
    return 0;
}

const isLaterThan = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
        if (a[i] > b[i]) {
            return true;
        }
        if (a[i] < b[i]) {
            return false;
        }
    }
    return false;
}

const findNextRelease = (tagName: string) => {
    const values = tagNumbers(tagName);
    let closestNext: any = null;
    for (const entry of entries) {
        const entryValues = tagNumbers(entry.tagName);
        if (isLaterThan(entryValues, values) && (!closestNext || isLaterThan(tagNumbers(closestNext.tagName), entryValues))) {
            closestNext = entry;
        }
    }
    return closestNext;
}

const msPerDay = 1000 * 60 * 60 * 24;

const downloadRecord: Record<string, Record<string, number>> = {};

for (const entry of entries) {
    const next = findNextRelease(entry.tagName);
    if (next && versionDifference(tagNumbers(next.tagName), tagNumbers(entry.tagName)) === 3) {
        const nextDate = new Date(next.updatedAt);
        const currentDate = new Date(entry.updatedAt);

        const nextDateDay = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
        const currentDateDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        const diff = nextDate.getTime() - currentDate.getTime();
        const downloadsPerDay = entry.downloads / diff * msPerDay;

        let indexDay = currentDateDay;
        while (indexDay.getTime() <= nextDateDay.getTime()) {
            const key = indexDay.toISOString().slice(0, 10);
            let dayObj = downloadRecord[key];
            if (!dayObj) {
                dayObj = {};
                downloadRecord[key] = dayObj;
            }
            // determine how much of the downloads to attribute to the day we're indexing over
            // four cases:
            // 1. index day is only one day long
            // 2. index day is the first day of a multi-day release
            // 3. index day is the last day of a multi-day release
            // 4. index day is in the middle of a multi-day release

            const nextIndexDay = new Date(indexDay.getTime() + msPerDay);
            // case 1
            if (currentDateDay.getTime() === nextDateDay.getTime()) {
                dayObj[entry.tagName] = entry.downloads;
            } else if (currentDateDay.getTime() === indexDay.getTime()) {
                // case 2
                dayObj[entry.tagName] = downloadsPerDay * (nextIndexDay.getTime() - currentDate.getTime()) / msPerDay;
            } else if (nextDateDay.getTime() === indexDay.getTime()) {
                // case 3
                dayObj[entry.tagName] = downloadsPerDay * (nextDate.getTime() - indexDay.getTime()) / msPerDay;
            } else {
                // case 4
                dayObj[entry.tagName] = downloadsPerDay;
            }
            indexDay = nextIndexDay;
        }
    }
}

let downloadRecordArray = Object.entries(downloadRecord).map(([date, downloads]) => {
    const entries = Object.entries(downloads);
    let v14 = entries.filter(([key, value]) => key.startsWith("v1.4")).reduce((acc, [key, value]) => acc + value, 0);
    let v15 = entries.filter(([key, value]) => key.startsWith("v1.5")).reduce((acc, [key, value]) => acc + value, 0);
    return {
        date,
        v14,
        v15,
        // ...downloads
    };
}).toSorted((a, b) => a.date.localeCompare(b.date));

console.log("date,version,downloads");
for (const entry of downloadRecordArray) {
    console.log(`${entry.date},v14,${entry.v14}`);
    console.log(`${entry.date},v15,${entry.v15}`);
}
