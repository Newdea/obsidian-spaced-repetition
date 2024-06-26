import { Notice, TFile } from "obsidian";
import { SrsAlgorithm } from "src/algorithms/algorithms";
import { DataStore } from "src/dataStore/data";
import { DataLocation } from "src/dataStore/dataLocation";
import { ItemTrans } from "src/dataStore/itemTrans";
import { t } from "src/lang/helpers";
import { NoteEaseList } from "src/NoteEaseList";
import { Decks, ReviewDeck, SchedNote } from "src/ReviewDeck";
import { ReviewResponse } from "src/scheduling";
import { SRSettings } from "src/settings";
import { Tags } from "src/tags";
import { globalDateProvider } from "src/util/DateProvider";
import { DateUtils, isIgnoredPath } from "src/util/utils_recall";

type Tsync = (notes: TFile[], reviewDecks?: Decks, easeByPath?: NoteEaseList) => Promise<void>;
export type TrespResult = { sNote: SchedNote; buryList?: string[] };
type TsaveResponse = (note: TFile, response: ReviewResponse, ease: number) => Promise<TrespResult>;

export abstract class IReviewNote {
    private static _instance: IReviewNote;
    static itemId: number;
    static minNextView: number;

    settings: SRSettings;
    // public reviewDecks: Decks = {};
    // public easeByPath: NoteEaseList;

    static create(
        // plugin: SRPlugin,
        settings: SRSettings,
        sync: Tsync,
        tagCheck: (note: TFile) => boolean,
        isNew: (note: TFile) => boolean,
        saveResponse: TsaveResponse,
    ) {
        switch (settings.dataLocation) {
            case DataLocation.SaveOnNoteFile:
                return new RNonNote(settings, sync, tagCheck, isNew, saveResponse);
                break;

            default:
                return new RNonTrackfiles(settings);
                break;
        }
    }

    static getInstance() {
        if (!IReviewNote._instance) {
            throw Error("there is not ReviewNote instance.");
        }
        return IReviewNote._instance;
    }

    constructor(settings: SRSettings) {
        this.settings = settings;
        IReviewNote._instance = this;
    }

    /**
     * 231215-not used yet.
     * after checking ignored folder, get note deckname from review tag and trackedfile.
     * @param settings SRSettings
     * @param note TFile
     * @returns string | null
     */
    static getDeckName(settings: SRSettings, note: TFile): string | null {
        const store = DataStore.getInstance();
        // const settings = plugin.data.settings;

        if (isIgnoredPath(settings.noteFoldersToIgnore, note.path)) {
            new Notice(t("NOTE_IN_IGNORED_FOLDER"));
            return;
        }

        let deckName = Tags.getNoteDeckName(note, settings);

        if (
            (settings.untrackWithReviewTag && deckName == null) ||
            (!settings.untrackWithReviewTag &&
                deckName == null &&
                !store.getTrackedFile(note.path)?.isTrackedNote)
        ) {
            new Notice(t("PLEASE_TAG_NOTE"));
            return;
        }
        if (deckName == null) {
            deckName = store.getTrackedFile(note.path)?.lastTag ?? null;
        }
        return deckName;
    }

    abstract tagCheck(note: TFile): boolean;
    abstract isNew(note: TFile): boolean;
    abstract sync(notes: TFile[], reviewDecks?: Decks, easeByPath?: NoteEaseList): Promise<void>;
    abstract responseProcess(
        note: TFile,
        response: ReviewResponse,
        ease: number,
    ): Promise<TrespResult>;

    static recallReviewResponse(itemId: number, response: string) {
        const store = DataStore.getInstance();
        const item = store.getItembyID(itemId);
        // console.debug("itemId: ", itemId);
        store.updateReviewedCounts(itemId);
        store.reviewId(itemId, response);
        store.save();
        this.minNextView = this.updateminNextView(this.minNextView, item.nextReview);
    }

    static getDeckNameForReviewDirectly(reviewDecks: {
        [deckKey: string]: ReviewDeck;
    }): string | null {
        const reviewDeckNames: string[] = Object.keys(reviewDecks);
        const rdnames: string[] = [];
        reviewDeckNames.some((dkey: string) => {
            const ndeck = reviewDecks[dkey];
            const ncount = ndeck.dueNotesCount;
            if (ncount > 0) {
                rdnames.push(dkey);
            }
        });
        reviewDeckNames.some((dkey: string) => {
            const ndeck = reviewDecks[dkey];
            const ncount = ndeck.newNotes.length;
            if (ncount > 0) {
                rdnames.push(dkey);
            }
        });
        if (rdnames.length > 0) {
            const ind = Math.floor(Math.random() * rdnames.length);
            return rdnames[ind];
        } else {
            return null;
        }
    }

    static getNextDueNoteIndex(NotesCount: number, openRandomNote: boolean = false) {
        let index = -1;

        if (NotesCount < 1) {
            return -1;
        }
        if (!openRandomNote) {
            return 0;
        } else {
            index = Math.floor(Math.random() * NotesCount);
        }
        return index;
    }

    static updateminNextView(mnv: number, nextReview: number): number {
        const now = Date.now();
        const nowToday: number = globalDateProvider.endofToday.valueOf();

        if (nextReview <= nowToday) {
            if (mnv == undefined || mnv < now || mnv > nextReview) {
                // console.debug("interval diff:should be - (", mnv - nextReview);
                mnv = nextReview;
            }
        }
        return mnv;
    }
}

class RNonNote extends IReviewNote {
    tagCheck: (note: TFile) => boolean;
    isNew: (note: TFile) => boolean;
    sync: (notes: TFile[], reviewDecks?: Decks, easeByPath?: NoteEaseList) => Promise<void>;
    responseProcess: (note: TFile, response: ReviewResponse, ease: number) => Promise<TrespResult>;

    constructor(
        settings: SRSettings,
        sync: Tsync,
        tagCheck: (note: TFile) => boolean,
        isNew: (note: TFile) => boolean,
        saveResponse: TsaveResponse,
    ) {
        super(settings);
        this.sync = sync;
        this.tagCheck = tagCheck;
        this.isNew = isNew;
        this.responseProcess = saveResponse;
    }
}

export class RNonTrackfiles extends IReviewNote {
    private store = DataStore.getInstance();
    // @logExecutionTime()
    async sync(notes: TFile[], reviewDecks: Decks, easeByPath: NoteEaseList): Promise<void> {
        // const settings = this.data.settings;
        this.store.data.queues.buildQueue();

        // check trackfile
        await this.store.reLoad();

        ItemTrans.create(this.settings).itemToReviewDecks(reviewDecks, notes, easeByPath);
    }

    tagCheck(note: TFile): boolean {
        const store = this.store;

        let deckName = Tags.getNoteDeckName(note, this.settings);
        if (
            (this.settings.untrackWithReviewTag && deckName == null) ||
            (!this.settings.untrackWithReviewTag &&
                deckName == null &&
                !store.getTrackedFile(note.path)?.isTrackedNote)
        ) {
            new Notice(t("PLEASE_TAG_NOTE"));
            return false;
        }
        if (deckName == null) {
            deckName = store.getTrackedFile(note.path).lastTag;
        }
        if (deckName == null) return false;
        return true;
    }
    isNew(note: TFile): boolean {
        return this.store.getNoteItem(note.path).isNew;
    }
    async responseProcess(note: TFile, response: ReviewResponse, ease?: number) {
        const store = this.store;

        const option = SrsAlgorithm.getInstance().srsOptions()[response];
        const now = Date.now();

        const itemId = store.getTrackedFile(note.path).noteID;
        const item = store.getItembyID(itemId);
        if (item.isNew && ease != null) {
            // new note
            item.updateAlgorithmData("ease", ease);
        }
        const buryList: string[] = [];
        if (this.settings.burySiblingCardsByNoteReview) {
            const trackFile = store.getTrackedFile(note.path);
            if (trackFile.hasCards) {
                for (const cardinfo of trackFile.cardItems) {
                    buryList.push(cardinfo.cardTextHash);
                }
            }
        }

        IReviewNote.recallReviewResponse(itemId, option);

        return {
            buryList,
            sNote: {
                note,
                item,
                dueUnix: item.nextReview,
                interval: item.interval,
                ease: item.ease,
            },
        };
    }
}

export function updatenDays(dueDates: Record<number, number>, dueUnix: number) {
    const nDays: number = Math.ceil(
        (dueUnix - globalDateProvider.endofToday.valueOf()) / DateUtils.DAYS_TO_MILLIS,
    );
    if (!Object.prototype.hasOwnProperty.call(dueDates, nDays)) {
        dueDates[nDays] = 0;
    }
    dueDates[nDays]++;
}
