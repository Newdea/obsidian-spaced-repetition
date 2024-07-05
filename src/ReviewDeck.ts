import { TFile } from "obsidian";

import { t } from "src/lang/helpers";
import { RepetitionItem } from "./dataStore/repetitionItem";
import { globalDateProvider } from "./util/DateProvider";

export interface SchedNote {
    note: TFile;
    item?: RepetitionItem;
    dueUnix?: number;
    interval?: number;
    ease?: number;
}

export type Decks = { [deckKey: string]: ReviewDeck };

export class ReviewDeck {
    public deckName: string;
    public newNotes: SchedNote[] = [];
    public scheduledNotes: SchedNote[] = [];
    public activeFolders: Set<string>;
    private _dueNotesCount = 0;

    constructor(name: string) {
        this.deckName = name;
        this.activeFolders = new Set([this.deckName, t("TODAY")]);
    }

    public sortNotes(pageranks: Record<string, number>): void {
        // sort new notes by importance
        this.newNotes = this.newNotes.sort((a: SchedNote, b: SchedNote) => {
            const result = (pageranks[b.note.path] || 0) - (pageranks[a.note.path] || 0);
            if (result != 0) {
                return result;
            }
            return a.note.stat.ctime - b.note.stat.ctime;
        });

        // sort scheduled notes by date & within those days, sort them by importance
        this.scheduledNotes = this.scheduledNotes.sort((a: SchedNote, b: SchedNote) => {
            const adue = isDue(a) ? -1 : 1;
            const bdue = isDue(b) ? 1 : -1;
            let result = adue + bdue;
            if (result != 0) {
                return result;
            }
            result = a.dueUnix - b.dueUnix;
            if (result != 0) {
                return result;
            }
            return (pageranks[b.note.path] || 0) - (pageranks[a.note.path] || 0);
        });
    }

    get dueNotesCount(): number {
        return this.scheduledNotes.filter(isDue).length;
    }
}

function isDue(snote: SchedNote): boolean {
    if (Object.prototype.hasOwnProperty.call(snote, "item")) {
        return snote.item.isDue;
    } else {
        return snote.dueUnix <= globalDateProvider.endofToday.valueOf();
    }
}
