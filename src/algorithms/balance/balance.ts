import { Notice } from "obsidian";
import { RPITEMTYPE } from "src/dataStore/repetitionItem";

let dueDatesDict: { [type: string]: Record<number, number> };

export function setDueDates(
    notedueDates: Record<number, number>,
    carddueDates: Record<number, number>,
) {
    dueDatesDict = {};
    dueDatesDict[RPITEMTYPE.NOTE] = notedueDates;
    dueDatesDict[RPITEMTYPE.CARD] = carddueDates;
}

function getDueDates(itemType: string) {
    return dueDatesDict && itemType in dueDatesDict ? dueDatesDict[itemType] : undefined;
}

/**
 * balance review counts in a day, return new interval day.
 * @param interval days till next review
 * @param type: RPITEMTYPE,
 * @param maximumInterval default = 36525
 * @returns
 */
export function balance(
    interval: number,
    type: RPITEMTYPE,
    maximumInterval: number = 36525,
    lowestCount: number = 10,
    tolerance: number = 5,
): number {
    // replaces random fuzz with load balancing over the fuzz interval
    const beforeIntvl = interval;
    let isChange = false;
    let dueDates = dueDatesDict[type];
    if (dueDates !== undefined) {
        interval = Math.round(interval);
        // const due = window.moment().add(interval,"days");
        // const nowToday = window.moment().endOf("day").valueOf();
        // interval= Math.ceil((due.valueOf() - nowToday) / DateUtils.DAYS_TO_MILLIS);
        if (!Object.prototype.hasOwnProperty.call(dueDates, interval)) {
            dueDates[interval] = 0;
        } else if (dueDates[interval] >= lowestCount) {
            // disable fuzzing for small intervals
            if (interval >= 1) {
                let fuzz = getFuzz(interval);

                const originalInterval = interval;
                outer: for (let i = 1; i <= fuzz; i++) {
                    for (const ivl of [originalInterval - i, originalInterval + i]) {
                        if (!Object.prototype.hasOwnProperty.call(dueDates, ivl)) {
                            dueDates[ivl] = 0;
                            interval = ivl;
                            isChange = true;
                            break outer;
                        }
                        if (dueDates[ivl] < dueDates[interval] - tolerance) {
                            interval = ivl;
                            isChange = true;
                        }
                    }
                }
            }
        }

        dueDates[interval]++;
    }
    interval = Math.min(interval, maximumInterval);
    if (isChange) {
        const msg = `balance: interval from ${beforeIntvl} balance to ${interval} days.`;
        console.debug(msg);
        // new Notice(msg);
    } else {
        interval = beforeIntvl;
    }
    return interval;
}

function getFuzz(interval: number) {
    let fuzz = 0;
    if (interval < 7) fuzz = 1;
    else if (interval < 30) fuzz = Math.max(2, Math.floor(interval * 0.15));
    else fuzz = Math.max(4, Math.floor(interval * 0.05));
    return fuzz;
}
