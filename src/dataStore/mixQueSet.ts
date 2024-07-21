export type tIMixQueSet = Record<string, number | boolean>; // isDue,DueDefaultCnt, NewDefaultCnt
export interface IMixQueSet {
    isDue: boolean;
    isCard: boolean;
    DueDefaultCnt: number;
    NewDefaultCnt: number;
}

export class MixQueSet implements IMixQueSet {
    isDue: boolean;
    DueDefaultCnt: number;
    NewDefaultCnt: number;

    isCard: boolean;
    CardDefaultCnt: number;
    NoteDefaultCnt: number;

    private static _instance: MixQueSet;
    private _dnCnt: number = 0;

    constructor() {
        MixQueSet._instance = this;
    }

    static create(due: number = 3, newdc: number = 2, card: number = 3, note: number = 1) {
        const mqs = new MixQueSet();
        mqs.isDue = true;
        mqs.isCard = false;
        mqs.DueDefaultCnt = due;
        mqs.NewDefaultCnt = newdc;
        mqs.CardDefaultCnt = card;
        mqs.NoteDefaultCnt = note;
        return mqs;
    }

    static getInstance() {
        return this._instance;
    }

    calcNext(dueCnthad: number, newCnthad: number) {
        if (this.DueDefaultCnt === 0) return (this.isDue = newCnthad > 0 ? false : true);
        if (this.NewDefaultCnt === 0) return (this.isDue = dueCnthad > 0 ? true : false);
        this._dnCnt++;
        if (this.isDue) {
            if (this._dnCnt >= this.DueDefaultCnt && newCnthad > 0) {
                this.isDue = false;
                this._dnCnt = 0;
            }
        } else {
            if (this._dnCnt >= this.NewDefaultCnt && dueCnthad > 0) {
                this.isDue = true;
                this._dnCnt = 0;
            }
        }

        // todo: update card note cnt
    }
}
