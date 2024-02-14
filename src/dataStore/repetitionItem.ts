import { AnkiData } from "src/algorithms/anki";
import { balance } from "src/algorithms/balance/balance";
import { FsrsData } from "src/algorithms/fsrs";
import { DateUtils } from "src/util/utils_recall";

export enum RPITEMTYPE {
    NOTE = "note",
    CARD = "card",
}

/**
 * ReviewResult.
 */
export interface ReviewResult {
    /**
     * @type {boolean}
     */
    correct: boolean;
    /**
     * @type {number}
     */
    nextReview: number;
}

/**
 * RepetitionItem.
 */
export class RepetitionItem {
    /**
     * @type {number}
     */
    nextReview: number;
    /**
     * @type {number}
     */
    ID: number;
    /**
     * @type {number}
     */
    fileIndex: number;
    /**
     * @type {RPITEMTYPE}
     */
    itemType: RPITEMTYPE;
    /**
     * @type {string}
     */
    deckName: string;
    /**
     * @type {number}
     */
    timesReviewed: number;
    /**
     * @type {number}
     */
    timesCorrect: number;
    /**
     * @type {number}
     */
    errorStreak: number; // Needed to calculate leeches later on.
    /**
     * @type {any}
     */

    data: unknown; // Additional data, determined by the selected algorithm.

    static create(item: RepetitionItem) {
        const newItem = new RepetitionItem();
        Object.assign(newItem, item);
        if (newItem.isFsrs) {
            let data = item.data as FsrsData;
            data.due = new Date(data.due);
            data.last_review = new Date(data.last_review);
        }
        return newItem;
    }

    constructor(
        id: number = -1,
        fileIndex: number = -1,
        itemType: RPITEMTYPE = RPITEMTYPE.NOTE,
        deckName: string = "default",
        data: unknown = {},
    ) {
        this.nextReview = 0;
        this.ID = id;
        this.fileIndex = fileIndex;
        this.itemType = itemType;
        this.deckName = deckName;
        this.timesReviewed = 0;
        this.timesCorrect = 0;
        this.errorStreak = 0;
        this.data = data;
    }

    /**
     * @param {ReviewResult} result
     * @return {*}
     */
    reviewUpdate(result: ReviewResult) {
        let newitvl = balance(result.nextReview / DateUtils.DAYS_TO_MILLIS, this.itemType);
        this.nextReview = DateUtils.fromNow(newitvl * DateUtils.DAYS_TO_MILLIS).getTime();
        this.timesReviewed += 1;
        if (result.correct) {
            this.timesCorrect += 1;
            this.errorStreak = 0;
        } else {
            this.errorStreak += 1;
        }
    }

    /**
     *
     * @returns ["due-interval-ease00", dueString, interval, ease] | null for new
     */
    getSched(): RegExpMatchArray | null {
        if (this.nextReview === 0 || this.nextReview === null || this.timesReviewed === 0) {
            return null; // new card doesn't need schedinfo
        }

        let ease: number;
        let interval: number;

        if (this.isFsrs) {
            const data = this.data as FsrsData;
            interval = data.scheduled_days;
            // ease just used for StatsChart, not review scheduling.
            ease = data.state;
        } else {
            const data: AnkiData = this.data as AnkiData;
            ease = data.ease;
            interval = data.lastInterval;
            // const interval = this.data.iteration;
        }

        const sched = [this.ID, this.nextReview, interval, ease] as unknown as RegExpMatchArray;
        return sched;
    }

    get isFsrs(): boolean {
        return Object.prototype.hasOwnProperty.call(this.data, "state");
    }

    getSchedDurAsStr() {
        const sched = this.getSched();
        if (sched == null) return null;

        const due = window.moment(this.nextReview);
        sched[1] = due.format("YYYY-MM-DD");
        sched[2] = parseFloat(sched[2]).toFixed(0);
        return sched;
    }

    updateSched(sched: RegExpMatchArray | number[] | string[], correct?: boolean) {
        const data: AnkiData = this.data as AnkiData;

        this.nextReview =
            typeof sched[1] == "number"
                ? Number(sched[1])
                : window
                      .moment(sched[1], ["YYYY-MM-DD", "DD-MM-YYYY", "ddd MMM DD YYYY"])
                      .valueOf();
        data.lastInterval = Number(sched[2]);
        data.ease = Number(sched[3]);

        if (correct != null) {
            this.timesReviewed += 1;
            if (correct) {
                this.timesCorrect += 1;
                this.errorStreak = 0;
            } else {
                this.errorStreak += 1;
            }
        }
    }

    get interval(): number {
        const sched = this.getSched();
        return sched ? Number(sched[2]) : 0;
    }

    updateDueByInterval(newitvl: number, newdue?: number) {
        // 240212-interval will be used to calc current retention, shoudn't update.
        const now = Date.now();
        const enableBalance = newdue == undefined;
        let oitvl = this.interval,
            odue = this.hasDue ? this.nextReview : now;

        if (this.isFsrs) {
            const data = this.data as FsrsData;

            newdue = newdue
                ? newdue
                : // : odue - (data.scheduled_days - newitvl) * DateUtils.DAYS_TO_MILLIS;
                  data.last_review.getTime() + newitvl * DateUtils.DAYS_TO_MILLIS;
            // data.scheduled_days = newitvl;
            data.due = new Date(newdue);
        } else {
            newdue = newdue ? newdue : odue - (this.interval - newitvl) * DateUtils.DAYS_TO_MILLIS;
            // (this.data as AnkiData).lastInterval = newitvl;
        }

        if (enableBalance) {
            let days = Math.max(0, newdue - now) / DateUtils.DAYS_TO_MILLIS;
            days = balance(days, this.itemType);
            console.debug("days:", days);
            let nextInterval = days * DateUtils.DAYS_TO_MILLIS;
            newdue = nextInterval + now;
        }

        console.debug({
            oitvl,
            newitvl,
            odue: new Date(this.nextReview).toISOString(),
            ndue: new Date(newdue).toISOString(),
        });
        this.isFsrs ? ((this.data as FsrsData).due = new Date(newdue)) : null;
        this.nextReview = newdue;
    }

    get ease(): number {
        const sched = this.getSched();
        return sched ? Number(sched[3]) : 0;
    }

    /**
     * check if file id is just new add.
     * @returns boolean
     */
    get isNew(): boolean {
        try {
            if (this.nextReview > 0) {
                return false;
            } else if (this.nextReview === 0 || this.timesReviewed === 0) {
                // This is a new item.
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * check if item should be reviewed rightnow.
     */
    get isDue() {
        const now_number = Date.now();
        if (this.hasDue) {
            if (this.nextReview < now_number) {
                return true;
            }
            if (this.nextReview < DateUtils.EndofToday) {
                if (this.isFsrs) {
                    const data: FsrsData = this.data as FsrsData;
                    if (data.scheduled_days >= 1) {
                        return true;
                    }
                } else {
                    const data: AnkiData = this.data as AnkiData;
                    if (data.lastInterval >= 1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    get hasDue() {
        try {
            if (this.nextReview > 0 || this.timesReviewed > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    get isTracked() {
        return this.fileIndex >= 0;
    }

    get isCard() {
        return this.itemType === RPITEMTYPE.CARD;
    }

    setTracked(fileIndex: number) {
        this.fileIndex = fileIndex;
    }

    setUntracked() {
        this.fileIndex = -1;
    }

    /**
     * updateDeckName, if different, uupdate. Else do none thing.
     * @param deckName
     * @param isCard
     */
    updateDeckName(deckName: string, isCard: boolean) {
        if (this.deckName !== deckName) {
            this.deckName = deckName;
        }
        if (!Object.prototype.hasOwnProperty.call(this, "itemType")) {
            this.itemType = isCard ? RPITEMTYPE.CARD : RPITEMTYPE.NOTE;
        }
    }

    /**
     * updateItem AlgorithmData.
     * @param id
     * @param key
     * @param value
     */
    updateAlgorithmData(key: string, value: unknown) {
        try {
            if (value == null) {
                throw new Error("updateAlgorithmData get null value: " + value);
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.data[key] = value;
        } catch (error) {
            console.log(error);
        }
    }
}
