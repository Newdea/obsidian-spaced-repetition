import { RepetitionItem } from "src/dataStore/repetitionItem";
import { DateUtils, debug } from "src/util/utils_recall";
import { SrsAlgorithm } from "../algorithms";
import { FsrsAlgorithm, FsrsData } from "../fsrs";

export function reschedule(items: RepetitionItem[]): RepetitionItem[] {
    let reCnt = 0;
    console.group(`reschedule`);
    if (items[0].isFsrs) {
        const result = reschedule_fsrs(items);
        reCnt = result.reCnt;
    } else {
        reCnt = reschedule_default(items).reCnt;
    }
    console.groupEnd();
    debug("reschedule", 0, { items, reCnt });
    return items;
}

function reschedule_default(items: RepetitionItem[]) {
    let reCnt = 0;

    items.map((item) => {
        let newitvl: number;

        let interval = item.interval * 9 * (1 / 0.9 - 1);
        newitvl = Math.min(Math.max(Math.round(interval), 1), 3650);
        if (newitvl !== item.interval) {
            reCnt++;
            item.updateDueByInterval(newitvl);
        }
    });

    // debug("reschedule", 0, { items, reCnt });
    return { items, reCnt };
}

function reschedule_fsrs(items: RepetitionItem[]) {
    let reCnt = 0;
    let fsrs = (SrsAlgorithm.getInstance() as FsrsAlgorithm).fsrs;

    items.map((item) => {
        let newitvl: number;
        if (!item.isTracked) return;
        const data = item.data as FsrsData;
        newitvl = fsrs.next_interval(data.stability);
        if (newitvl !== data.scheduled_days) {
            reCnt++;
            item.updateDueByInterval(newitvl);
        }
    });

    return { items, reCnt };
}
