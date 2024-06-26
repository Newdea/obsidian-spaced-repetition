import { TFile } from "obsidian";
import { CardScheduleInfo, NoteCardScheduleParser } from "src/CardSchedule";
import { Note } from "src/Note";
import { ReviewDeck, SchedNote } from "src/ReviewDeck";
import { SrTFile } from "src/SRFile";
import { TopicPath } from "src/TopicPath";
import { DataStore } from "src/dataStore/data";
import { BlockUtils, debug, logExecutionTime } from "src/util/utils_recall";
import { CardInfo } from "./trackedFile";
import { Card } from "src/Card";
import { DataLocation } from "./dataLocation";
import { RPITEMTYPE, RepetitionItem } from "./repetitionItem";
import { Tags } from "src/tags";
import { SRSettings } from "src/settings";
import { INoteEaseList } from "src/NoteEaseList";
import { algorithmNames } from "src/algorithms/algorithms";

export class ItemTrans {
    settings: SRSettings;

    static create(settings: SRSettings) {
        return new ItemTrans(settings);
    }
    constructor(settings: SRSettings) {
        this.settings = settings;
    }

    /**
     * sync RCsrsDataTo SRreviewDecks
     *
     * @param rdeck
     * @returns
     */
    itemToReviewDecks(
        reviewDecks: { [deckKey: string]: ReviewDeck },
        notes: TFile[],
        easeByPath: INoteEaseList,
    ) {
        const store = DataStore.getInstance();
        const settings = this.settings;
        // store.data.queues.buildQueue();
        notes.forEach(async (note) => {
            let deckname = Tags.getNoteDeckName(note, this.settings);
            if (deckname == null) {
                const tkfile = store.getTrackedFile(note.path);
                let tag = tkfile?.lastTag;
                if (settings.tagsToReview.includes(tag) && settings.untrackWithReviewTag) {
                    store.untrackFile(tkfile.path, false);
                    tag = tkfile.lastTag;
                }
                if (tag != undefined && (settings.tagsToReview.includes(tag) || tkfile.isDefault)) {
                    deckname = tag;
                }
            }
            if (deckname != null) {
                if (!Object.prototype.hasOwnProperty.call(reviewDecks, deckname)) {
                    reviewDecks[deckname] = new ReviewDeck(deckname);
                }
                // update single note deck data, only tagged reviewnote
                if (!store.getTrackedFile(note.path)?.isTrackedNote) {
                    store.trackFile(note.path, deckname, false);
                }
                if (
                    settings.algorithm === algorithmNames.Anki ||
                    settings.algorithm === algorithmNames.Default ||
                    settings.algorithm === algorithmNames.SM2
                ) {
                    const sched = store.getNoteItem(note.path).getSched();
                    if (sched != null) {
                        const ease: number = parseFloat(sched[3]);
                        if (!isNaN(ease)) {
                            easeByPath.setEaseForPath(note.path, ease);
                        }
                    }
                }
                ItemTrans._toRevDeck(reviewDecks[deckname], note);
            }
        });
        return;
    }

    /**
     * syncRCDataToSR ReviewDeck ,
     * and update deckName to trackedfile.tags;
     * @param rdeck
     * @returns
     */
    private static _toRevDeck(rdeck: ReviewDeck, note: TFile, now?: number) {
        // const plugin = plugin;
        const store = DataStore.getInstance();
        const ind = store.getFileIndex(note.path);
        const trackedFile = store.getTrackedFile(note.path);
        const item = store.getNoteItem(note.path);

        if (item == null) {
            // store._updateItem(fileid, ind, RPITEMTYPE.NOTE, rdeck.deckName);
            // item = store.getItembyID(fileid);
            console.debug("syncRCDataToSRrevDeck update null item:", item, trackedFile);
            return;
        }
        if (!trackedFile.isDefault && !item.isTracked) {
            item.setTracked(ind);
        }

        if (item.hasDue) {
            rdeck.scheduledNotes.push(itemToShedNote(item, note));
        } else {
            rdeck.newNotes.push({ note, item });
        }
        // update store.trackFile and item
        trackedFile.updateTags(rdeck.deckName);
        item.updateDeckName(rdeck.deckName, store.isCardItem(item.ID));

        return;
    }

    static updateCardsSchedbyItems(note: Note, topicPath: TopicPath) {
        const store = DataStore.getInstance();
        const settings = store.settings;
        const noteFile: SrTFile = note.file as SrTFile;
        if (
            note.questionList.length === 0 ||
            settings.dataLocation === DataLocation.SaveOnNoteFile
        ) {
            return;
        }
        if (store.getFileIndex(note.filePath) < 0) {
            if (
                settings.trackedNoteToDecks &&
                Tags.getNoteDeckName(noteFile.file, settings) !== null
            ) {
                store.trackFile(note.filePath, RPITEMTYPE.NOTE, false);
            } else {
                store.trackFile(note.filePath, RPITEMTYPE.CARD, false);
            }
        }
        // DataSyncer.updateCardsSched_algo(note, topicPath);
        const trackedFile = store.getTrackedFile(noteFile.path);

        for (const question of note.questionList) {
            const cardText: string = question.questionText.actualQuestion;
            const lineNo: number = question.lineNo;
            const cardTextHash = BlockUtils.getTxtHash(cardText);
            const count: number = question.cards.length;
            const scheduling: RegExpMatchArray[] = [];
            let carditem = trackedFile.getSyncCardInfo(lineNo, cardTextHash);
            if (carditem != null) {
                carditem.itemIds
                    .map((id: number) => store.getItembyID(id).getSched())
                    .filter((sched) => {
                        // ignore new add card  sched != null &&
                        if (scheduling.length <= count) {
                            scheduling.push(sched);
                            return true;
                        }
                    });
            } else {
                carditem = trackedFile.trackCard(lineNo, cardTextHash);
            }

            const dtppath = question.topicPathList.list[0] ?? undefined;
            let deckname = dtppath?.hasPath ? dtppath.path[0] : topicPath.path[0];
            deckname = Tags.isDefaultDackName(deckname) ? deckname : "#" + deckname;
            store.updateCardItems(trackedFile, carditem, count, deckname, false);
            updateCardObjs(question.cards, carditem, scheduling);

            // update question
            question.hasChanged = false;
        }
    }
}

function updateCardObjs(cards: Card[], cardinfo: CardInfo, scheduling: RegExpMatchArray[]) {
    const schedInfoList: CardScheduleInfo[] =
        NoteCardScheduleParser.createInfoList_algo(scheduling);
    const carditemIds = cardinfo.itemIds;
    for (let i = 0; i < cards.length; i++) {
        const cardObj = cards[i];
        const hasScheduleInfo: boolean = i < schedInfoList.length;
        const schedule: CardScheduleInfo = schedInfoList[i];
        cardObj.scheduleInfo =
            hasScheduleInfo && !schedule.isDummyScheduleForNewCard() ? schedule : null;
        cardObj.Id = carditemIds[i];
    }
}

export function itemToShedNote(item: RepetitionItem, note: TFile): SchedNote {
    return {
        note,
        item,
        dueUnix: item.nextReview,
        interval: item.interval,
        ease: item.ease,
    };
}
