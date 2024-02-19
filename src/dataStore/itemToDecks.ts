import { TFile } from "obsidian";
import { CardScheduleInfo, NoteCardScheduleParser } from "src/CardSchedule";
import { Note } from "src/Note";
import { ReviewDeck } from "src/ReviewDeck";
import { SrTFile } from "src/SRFile";
import { TopicPath } from "src/TopicPath";
import { DataStore } from "src/dataStore/data";
import { getKeysPreserveType } from "src/util/utils";
import { BlockUtils, DateUtils, debug, logExecutionTime } from "src/util/utils_recall";
import { CardInfo } from "./trackedFile";
import { Card } from "src/Card";
import { DataLocation } from "./dataLocation";
import { RPITEMTYPE } from "./repetitionItem";
import { Tags } from "src/tags";
import { SRSettings } from "src/settings";
import { INoteEaseList } from "src/NoteEaseList";
import { algorithmNames } from "src/algorithms/algorithms";

export class ItemToDecks {
    settings: SRSettings;

    static create(settings: SRSettings) {
        return new ItemToDecks(settings);
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
        const now = new Date().getTime();
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
                ItemToDecks.toRevDeck(reviewDecks[deckname], note);
            }

            // Add Recall reviewnote deck
            // const dkname = DEFAULT_DECKNAME;
            // if (!Object.prototype.hasOwnProperty.call(reviewDecks, dkname)) {
            //     reviewDecks[dkname] = new ReviewDeck(dkname);
            // }

            // store.data.trackedFiles
            //     .filter((trackedFile) => trackedFile?.noteID >= 0 && trackedFile.isTracked)
            //     .filter((trackedFile) => trackedFile.isDefault)
            //     .filter((trackedFile) => {
            //         // only add default deck.
            //         const note = app.vault.getAbstractFileByPath(trackedFile.path) as TFile;
            //         if (note instanceof TFile) {
            //             noteStats.updateStats(store.getItembyID(trackedFile.noteID));
            //             DataSyncer.syncRCDataToSRrevDeck(reviewDecks[deckName], note);
            //             return true;
            //         }
            // });
        });
        return;
    }

    /**
     * syncRCDataToSR ReviewDeck ,
     * and update deckName to trackedfile.tags;
     * @param rdeck
     * @returns
     */
    static toRevDeck(rdeck: ReviewDeck, note: TFile, now?: number) {
        // const plugin = plugin;
        // const rdeck = reviewDecks[deckName];
        const store = DataStore.getInstance();
        // const queue = store.data.queues;
        const ind = store.getFileIndex(note.path);
        const trackedFile = store.getTrackedFile(note.path);
        const fileid = store.getTrackedFile(note.path).noteID;
        const item = store.getItembyID(fileid);
        let now_number: number = now;
        const nowToday: number = DateUtils.EndofToday;

        if (item == null) {
            // store._updateItem(fileid, ind, RPITEMTYPE.NOTE, rdeck.deckName);
            // item = store.getItembyID(fileid);
            console.debug("syncRCDataToSRrevDeck update null item:", item, trackedFile);
            return;
        }
        if (!trackedFile.isDefault && !item.isTracked) {
            item.setTracked(ind);
        }
        const latterQue = store.data.queues.toDayLatterQueue;
        delete latterQue[fileid];
        if (now == null) {
            now_number = Date.now();
        } else {
            getKeysPreserveType(latterQue).forEach((idStr, _idx, _arr) => {
                const id: number = Number(idStr);
                const item = store.getItembyID(id);
                if (item.deckName === rdeck.deckName && item.nextReview - Date.now() < 0) {
                    rdeck.dueNotesCount++;
                    // console.debug(
                    //     `${rdeck.deckName}keysPreserve dueCnt: ${rdeck.dueNotesCount} \
                    // item:  toQ:`,
                    //     item,
                    //     latterQue,
                    // );
                    delete latterQue[id];
                }
            });
        }

        if (item.nextReview - now_number > 0 && item.nextReview <= nowToday) {
            // console.debug(
            //     `add ${rdeck.deckName} dueCnt: ${rdeck.dueNotesCount} \
            // item:  toQ:`,
            //     item,
            //     latterQue,
            // );
            latterQue[fileid] = rdeck.deckName;
        }

        if (item.hasDue) {
            rdeck.scheduledNotes.push({
                note,
                item,
                dueUnix: item.nextReview,
                interval: item.interval,
                ease: item.ease,
            });
            if (item.nextReview <= now_number) {
                rdeck.dueNotesCount++;
                // console.debug(`${rdeck.deckName} isDue dueCnt: ${rdeck.dueNotesCount}`, item);
            }
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
        if (topicPath.isEmptyPath || settings.dataLocation === DataLocation.SaveOnNoteFile) {
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

            let deckname = question.topicPath.hasPath
                ? question.topicPath.path[0]
                : topicPath.path[0];
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
