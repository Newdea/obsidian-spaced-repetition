import SRPlugin from "./main";
import { DateUtils } from "./utils_recall";
import { DataLocation, SRSettings } from "./settings";

import { TFile, TFolder, Notice, getAllTags } from "obsidian";

import { ReviewDeck } from "src/review-deck";
import { CardType, ReviewResponse } from "./scheduling";
import { parse } from "./parser";
import { cyrb53 } from "./utils";
import deepcopy from "deepcopy";

const ROOT_DATA_PATH = "./tracked_files.json";
const PLUGIN_DATA_PATH = "./.obsidian/plugins/obsidian-spaced-repetition-recall/tracked_files.json";

/**
 * SrsData.
 */
interface SrsData {
    /**
     * @type {number[]}
     */
    queue: number[];
    /**
     * @type {number[]}
     */
    repeatQueue: number[];
    /**
     * @type {number[]}
     */
    cardQueue: number[];
    /**
     * @type {number[]}
     */
    cardRepeatQueue: number[];
    toDayAllQueue: Record<number, string>;
    toDayLatterQueue: Record<number, string>;
    /**
     * @type {RepetitionItem[]}
     */
    items: RepetitionItem[];
    /**
     * @type {TrackedFile[]}
     */
    trackedFiles: TrackedFile[];
    /**
     * @type {number}
     */
    lastQueue: number;
    /**
     * @type {0}
     */
    newAdded: 0;
}

export enum RPITEMTYPE {
    NOTE = "note",
    CARD = "card",
}

/**
 * RepetitionItem.
 */
export interface RepetitionItem {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any; // Additional data, determined by the selected algorithm.
}

/**
 * TrackedFile.
 */
interface TrackedFile {
    /**
     * @type {string}
     */
    path: string;
    /**
     * @type {Record<string, number>}
     */
    items: Record<string, number>;
    /**
     * @type {CardInfo[]}
     */
    cardItems?: CardInfo[];
    /**
     * @type {string[]}
     */
    tags?: string[];
}

/**
 * CardInfo
 */
interface CardInfo {
    /**
     * @type {number}
     */
    lineNo: number;
    /**
     * @type {string}
     */
    cardTextHash: string;
    /**
     * @type {number[]}
     */
    itemIds: number[];
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

const DEFAULT_SRS_DATA: SrsData = {
    queue: [],
    repeatQueue: [],
    cardQueue: [],
    cardRepeatQueue: [],
    toDayAllQueue: {},
    toDayLatterQueue: {},
    items: [],
    trackedFiles: [],
    lastQueue: 0,
    newAdded: 0,
};

const NEW_ITEM: RepetitionItem = {
    nextReview: 0,
    ID: -1,
    fileIndex: -1,
    itemType: RPITEMTYPE.NOTE,
    deckName: "default",
    timesReviewed: 0,
    timesCorrect: 0,
    errorStreak: 0,
    data: {},
};

const DEFAULT_NEW_CARDINFO: CardInfo = {
    lineNo: 0,
    cardTextHash: "",
    itemIds: [],
};

/**
 * DataStore.
 */
export class DataStore {
    /**
     * @type {SrsData}
     */
    data: SrsData;
    /**
     * @type {SRPlugin}
     */
    plugin: SRPlugin;
    /**
     * @type {string}
     */
    dataPath: string;

    /**
     * @type {string}
     */
    private defaultDeckname = "default";

    /**
     * constructor.
     *
     * @param {SRPlugin} plugin
     */
    constructor(plugin: SRPlugin) {
        this.plugin = plugin;
        this.dataPath = this.getStorePath();
    }

    /**
     * getStorePath.
     *
     * @returns {string}
     */
    getStorePath(): string {
        const dataLocation = this.plugin.data.settings.dataLocation;
        if (dataLocation == DataLocation.PluginFolder) {
            return PLUGIN_DATA_PATH;
        } else if (dataLocation == DataLocation.RootFolder) {
            return ROOT_DATA_PATH;
        } else if (dataLocation == DataLocation.SpecifiedFolder) {
            return this.plugin.data.settings.customFolder;
        } else if (dataLocation == DataLocation.SaveOnNoteFile) {
            return PLUGIN_DATA_PATH;
        }
    }

    getDefaultDackName() {
        return this.defaultDeckname;
    }

    /**
     * moveStoreLocation.
     *
     * @returns {boolean}
     */
    moveStoreLocation(): boolean {
        const adapter = this.plugin.app.vault.adapter;

        const newPath = this.getStorePath();
        if (newPath === this.dataPath) {
            return false;
        }

        try {
            this.save();
            adapter.remove(this.dataPath).then(
                () => {
                    this.dataPath = newPath;
                    new Notice("Successfully moved data file!");
                    return true;
                },
                (e) => {
                    this.dataPath = newPath;
                    new Notice("Unable to delete old data file, please delete it manually.");
                    console.log(e);
                    return true;
                }
            );
        } catch (e) {
            new Notice("Unable to move data file!");
            console.log(e);
            return false;
        }
    }

    /**
     * load.
     */
    async load(path = this.dataPath) {
        const adapter = this.plugin.app.vault.adapter;
        if (this.plugin.data.settings.dataLocation != DataLocation.SaveOnNoteFile) {
            if (await adapter.exists(path)) {
                const data = await adapter.read(path);
                if (data == null) {
                    console.log("Unable to read SRS data!");
                    this.data = Object.assign({}, DEFAULT_SRS_DATA);
                } else {
                    console.log("Reading tracked files...");
                    this.data = Object.assign(
                        Object.assign({}, DEFAULT_SRS_DATA),
                        JSON.parse(data)
                    );
                }
            } else {
                console.log("Tracked files not found! Creating new file...");
                this.data = Object.assign({}, DEFAULT_SRS_DATA);
                await this.save();
            }
        }
    }

    /**
     * save.
     */
    async save(path = this.dataPath) {
        await this.plugin.app.vault.adapter.write(path, JSON.stringify(this.data)).catch((e) => {
            new Notice("Unable to save data file!");
            console.log(e);
        });
    }

    /**
     * Returns total number of items tracked by the SRS.
     */
    /**
     * items.
     *
     * @returns {number}
     */
    items(): number {
        return this.data.items.length;
    }

    /**
     * Returns the size of the current queue.
     */
    /**
     * queueSize.
     *
     * @returns {number}
     */
    queueSize(): number {
        return this.data.queue.length;
    }

    /**
     * repeatQueueSize.
     *
     * @returns {number}
     */
    repeatQueueSize(): number {
        return this.data.repeatQueue.length;
    }

    /**
     * getFileIndex.
     *
     * @param {string} path
     * @returns {number}
     */
    getFileIndex(path: string): number {
        return this.data.trackedFiles.findIndex((val, _ind, _obj) => {
            return val != null && val.path == path;
        });
    }

    getFileId(path: string): number {
        if (this.getFileIndex(path) == -1) {
            return -1;
        }
        const fileInd = this.getFileIndex(path);
        const fileId = this.data.trackedFiles[fileInd].items["file"];
        return fileId;
    }

    getTrackedFile(path: string): TrackedFile {
        const ind = this.getFileIndex(path);
        if (ind < 0) {
            return null;
        }
        return this.data.trackedFiles[ind];
    }

    /**
     * getAndSyncCardInfoIndex
     * @param note: TFile
     * @param lineNo
     * @param cardTextHash
     * @returns {CardInfo} cardinfo | null: didn't have cardInfo
     */
    getAndSyncCardInfo(note: TFile, lineNo: number, cardTextHash?: string): CardInfo {
        let cardind = -2;
        const trackedFile = this.getTrackedFile(note.path);
        if (trackedFile != null && Object.prototype.hasOwnProperty.call(trackedFile, "cardItems")) {
            cardind = trackedFile.cardItems.findIndex((cinfo: CardInfo, _ind, _obj) => {
                let res = false;
                if (cardTextHash != null && cinfo.cardTextHash === cardTextHash) {
                    cinfo.lineNo = lineNo;
                    res = true;
                } else if (cinfo.lineNo === lineNo) {
                    cinfo.cardTextHash = cardTextHash;
                    res = true;
                }
                return res;
            });
        }
        return cardind >= 0 ? trackedFile.cardItems[cardind] : null;
    }

    /**
     * Returns whether or not the given file path is tracked by the SRS.
     * @param {string} path
     * @returns {boolean}
     */
    isTracked(path: string): boolean {
        const ind = this.getFileIndex(path);
        const fid = this.getFileId(path);

        return ind >= 0 && fid >= 0;
    }

    /**
     * Returns whether or not the given file path is tracked by the SRS.
     * work for cards query.
     * @param {string} path
     * @returns {boolean}
     */
    isTrackedCardfile(path: string): boolean {
        const ind = this.getFileIndex(path);
        let cardLen = 0;
        if (ind >= 0) {
            const file = this.getTrackedFileByIndex(ind);
            if (Object.keys(file).includes("cardItems")) {
                cardLen = this.getTrackedFileByIndex(ind).cardItems.length;
            }
        }

        return cardLen > 0;
    }

    /**
     * isQueued.
     *
     * @param {number} item
     * @returns {boolean}
     */
    isQueued(item: number): boolean {
        return this.data.queue.includes(item);
    }

    /**
     * isQueued.
     *
     * @param {number} item
     * @returns {boolean}
     */
    isCardQueued(item: number): boolean {
        return this.data.cardQueue.includes(item);
    }

    /**
     * isInRepeatQueue.
     *
     * @param {number} item
     * @returns {boolean}
     */
    isInRepeatQueue(item: number): boolean {
        return this.data.repeatQueue.includes(item) || this.data.cardRepeatQueue.includes(item);
    }

    /**
     * check if file id is just new add.
     * @param id Item id, can get by:
     * findex = this.store.getFileIndex(note.path);
     * id = this.data.trackedFiles[findex].items["file"]
     * @returns id | -1
     */
    isNewAdd(id: number) {
        if (id < 0) {
            console.log("[wrong file ID]: file %d not tracked. ", id);
            return -1;
        }
        if (this.data.items[id] == null) {
            console.log("[wrong file ID]: file %d had been  untracked. ", id);
            return -2;
        }
        if (this.data.items[id]["nextReview"] == 0 || this.data.items[id]["timesReviewed"] == 0) {
            // This is a new item.
            return id;
        }
        return -1;
    }

    isCardItem(id: number) {
        const item = this.getItembyID(id);
        const file = this.data.trackedFiles[item.fileIndex];
        return file.items.file !== id;
    }

    /**
     * Returns when the given item is reviewed next (in hours).
     */
    /**
     * nextReview.
     *
     * @param {number} itemId
     * @returns {number}
     */
    nextReview(itemId: number): number {
        const item = this.data.items[itemId];
        if (item == null) {
            return -1;
        }

        const now: Date = new Date();
        return (item.nextReview - now.getTime()) / (1000 * 60 * 60);
    }

    getItembyID(id: number): RepetitionItem {
        return this.data.items[id];
    }

    getTrackedFileByIndex(idx: number): TrackedFile {
        return this.data.trackedFiles[idx];
    }

    /**
     * getItemsOfFile.
     *
     * @param {string} path
     * @returns {RepetitionItem[]}
     */
    getItemsOfFile(path: string): RepetitionItem[] {
        const result: RepetitionItem[] = [];
        const file = this.data.trackedFiles[this.getFileIndex(path)];
        Object.values(file.items).forEach((item) => {
            result.push(this.data.items[item]);
        });
        return result;
    }

    getFileForItem(item: RepetitionItem): TrackedFile {
        if (item != null) {
            return this.data.trackedFiles[item.fileIndex];
        }
        return null;
    }

    /**
     * getNext. RepetitionItem
     *
     * @returns {RepetitionItem | null}
     */
    getNext(): RepetitionItem | null {
        const id = this.getNextId();
        if (id != null) {
            return this.data.items[id];
        }

        return null;
    }

    /**
     * getNextId.
     *
     * @returns {number | null}
     */
    getNextId(): number | null {
        if (this.queueSize() > 0) {
            return this.data.queue[0];
        } else if (this.data.repeatQueue.length > 0) {
            return this.data.repeatQueue[0];
        } else {
            return null;
        }
    }

    /**
     * getFilePath.
     *
     * @param {RepetitionItem} item
     * @returns {string | null}
     */
    getFilePath(item: RepetitionItem): string | null {
        const trackedFile = this.data.trackedFiles[item.fileIndex];
        if (trackedFile != null) {
            return trackedFile.path;
        }
        return null;
    }

    /**
     * reviewId.
     * update data according to response opt
     * @param {number} itemId
     * @param {string} option
     */
    reviewId(itemId: number, option: string) {
        const item = this.data.items[itemId];
        if (item == null) {
            return -1;
        }

        if (this.isInRepeatQueue(itemId)) {
            const result = this.plugin.algorithm.onSelection(item, option, true);

            this.data.repeatQueue.remove(itemId);
            if (!result.correct) {
                this.data.repeatQueue.push(itemId); // Re-add until correct.
            }
        } else {
            const result = this.plugin.algorithm.onSelection(item, option, false);

            item.nextReview = DateUtils.fromNow(result.nextReview).getTime();
            item.timesReviewed += 1;
            this.data.queue.remove(itemId);
            if (result.correct) {
                item.timesCorrect += 1;
                item.errorStreak = 0;
            } else {
                item.errorStreak += 1;

                if (this.plugin.data.settings.repeatItems) {
                    this.data.repeatQueue.push(itemId);
                }
            }
        }
    }

    /**
     * calcReviewInterval.
     * just calc data according to response opt for showing on button, not update,
     * @param {number} itemId
     */
    calcReviewInterval(itemId: number): number[] {
        const item = this.data.items[itemId];
        if (item == null) {
            return null;
        }
        const intervals: number[] = [];
        for (const opt of this.plugin.algorithm.srsOptions()) {
            // const tempitem = MiscUtils.assignObjFully({}, item);
            const tempitem = deepcopy(item);
            let result: ReviewResult = null;
            if (this.isInRepeatQueue(itemId)) {
                result = this.plugin.algorithm.onSelection(tempitem, opt, true);
            } else {
                result = this.plugin.algorithm.onSelection(tempitem, opt, false);
            }
            const intvl = Math.round((result.nextReview / DateUtils.DAYS_TO_MILLIS) * 100) / 100;
            intervals.push(intvl);
        }

        return intervals;
    }

    /**
     * untrackFilesInFolderPath.
     *
     * @param {string} path
     * @param {boolean} recursive
     */
    untrackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = this.plugin.app.vault.getAbstractFileByPath(path) as TFolder;

        if (folder != null) {
            this.untrackFilesInFolder(folder, recursive);
        }
    }

    /**
     * untrackFilesInFolder.
     *
     * @param {TFolder} folder
     * @param {boolean} recursive
     */
    untrackFilesInFolder(folder: TFolder, recursive?: boolean) {
        if (recursive == null) recursive = true;

        let totalRemoved = 0;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                if (recursive) {
                    this.untrackFilesInFolder(child, recursive);
                }
            } else if (child instanceof TFile) {
                if (this.isTracked(child.path)) {
                    const removed = this.untrackFile(child.path, false);
                    totalRemoved += removed;
                }
            }
        });
    }

    /**
     * trackFilesInFolderPath.
     *
     * @param {string} path
     * @param {boolean} recursive
     */
    trackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = this.plugin.app.vault.getAbstractFileByPath(path) as TFolder;

        if (folder != null) {
            this.trackFilesInFolder(folder, recursive);
        }
    }

    /**
     * trackFilesInFolder.
     *
     * @param {TFolder} folder
     * @param {boolean} recursive
     */
    trackFilesInFolder(folder: TFolder, recursive?: boolean) {
        if (recursive == null) recursive = true;

        let totalAdded = 0;
        let totalRemoved = 0;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                if (recursive) {
                    this.trackFilesInFolder(child, recursive);
                }
            } else if (child instanceof TFile && child.extension === "md") {
                if (!this.isTracked(child.path)) {
                    const { added, removed } = this.trackFile(child.path, RPITEMTYPE.NOTE, false);
                    totalAdded += added;
                    totalRemoved += removed;
                }
            }
        });

        new Notice("Added " + totalAdded + " new items, removed " + totalRemoved + " items.");
    }

    /**
     * trackFile.
     *
     * @param {string} path
     * @param {string} tag? "default" , "card"
     * @param {boolean} notice
     * @returns {{ added: number; removed: number } | null}
     */
    trackFile(
        path: string,
        type?: RPITEMTYPE | string,
        notice?: boolean
    ): { added: number; removed: number } | null {
        const trackedFile: TrackedFile = {
            path: path,
            items: {},
            tags: [],
        };
        const itemtype = RPITEMTYPE.NOTE;
        let dname = this.getDefaultDackName();
        if (type != null) {
            trackedFile.tags = [type];
            if (type === RPITEMTYPE.CARD) {
                // itemtype = RPITEMTYPE.CARD;
                trackedFile.cardItems = [];
            } else if (type !== RPITEMTYPE.NOTE) {
                dname = type as string;
            }
        }
        this.data.trackedFiles.push(trackedFile);
        const data = this.updateItems(path, itemtype, dname, notice);
        console.log("Tracked: " + path);
        // this.plugin.updateStatusBar();
        return data;
    }

    /**
     * trackFileCard
     * 添加笔记中特定行的卡片（组）
     * @param note
     * @param lineNo
     * @param cardTextHash
     * @returns {CardInfo} cardInfo of new add.
     */
    trackFileCard(note: TFile, lineNo: number, cardTextHash: string): CardInfo {
        if (!this.isTrackedCardfile(note.path)) {
            console.log("Attempt to add card in untracked file: " + note.path);
            this.trackFile(note.path, RPITEMTYPE.CARD, false);
        }
        const trackedFile = this.getTrackedFile(note.path);

        // const newcardItem: CardInfo = { lineNo: lineNo, cardTextHash: cardTextHash, itemIds: [] };
        const newcardItem: CardInfo = deepcopy(DEFAULT_NEW_CARDINFO);
        newcardItem.lineNo = lineNo;
        newcardItem.cardTextHash = cardTextHash;

        if (!Object.prototype.hasOwnProperty.call(trackedFile, "cardItems")) {
            // didn't have cardItems
            trackedFile.cardItems = [];
        }

        const _cind = trackedFile.cardItems.push(newcardItem) - 1;
        // const data = this.updateCardItems(note, trackedFile.cardItems[cind], count, deckName,notice);
        trackedFile.cardItems.sort((a, b) => {
            return a.lineNo - b.lineNo;
        });
        this.save();

        console.log("Tracked: " + note.path + ", lineNo:" + lineNo + 1); // +1 just for better read.

        return newcardItem;
    }

    /**
     * untrackFile.
     *
     * @param {string} path
     * @param {boolean} notice
     * @returns {number}
     */
    untrackFile(path: string, notice?: boolean): number {
        if (notice == null) notice = true;

        const index = this.getFileIndex(path);

        if (index == -1) {
            return;
        }

        const trackedFile = this.data.trackedFiles[index];
        const file = this.plugin.app.vault.getAbstractFileByPath(path) as TFile;

        if (
            file != null &&
            "tags" in trackedFile &&
            trackedFile.tags.length > 0 &&
            trackedFile.tags.last() !== this.getDefaultDackName()
        ) {
            // it's taged file, can't untrack by this.
            console.log(path + " is taged file, can't untrack by this.");
            new Notice(
                "it is taged file, can't untrack by this. You can delete the #review tag in note file."
            );
            return;
        }

        const numItems = Object.keys(trackedFile.items).length;

        for (const key in trackedFile.items) {
            const ind = trackedFile.items[key];
            if (this.isQueued(ind)) {
                this.data.queue.remove(ind);
                delete this.data.toDayAllQueue[ind];
            }
            if (this.isInRepeatQueue(ind)) {
                this.data.repeatQueue.remove(ind);
            }
            this.data.items[ind] = null;
        }

        if (notice) {
            new Notice("Untracked " + numItems + " items!");
        }

        //  when file not exist, or doesn't have carditems, del it.
        let nulrstr: string;
        if (!file || !Object.prototype.hasOwnProperty.call(trackedFile, "cardItems")) {
            this.data.trackedFiles[index] = null;
            nulrstr = file == null ? ", because it not exist." : "";
        } else {
            this.data.trackedFiles[index].items.file = -1;
        }
        this.save();
        // this.plugin.updateStatusBar();
        console.log("Untracked: " + path + nulrstr);
    }

    /**
     * updateItems.
     *
     * @param {string} path
     * @param {string} type? RPITEMTYPE
     * @param {string} dname? "default" , deckName
     * @param {boolean} notice
     * @returns {{ added: number; removed: number } | null}
     */
    updateItems(
        path: string,
        type?: RPITEMTYPE,
        dname?: string,
        notice?: boolean
    ): { added: number; removed: number } | null {
        if (notice == null) notice = true;
        if (type == null) type = RPITEMTYPE.NOTE;
        if (dname == null) dname = this.getDefaultDackName();

        const ind = this.getFileIndex(path);
        if (ind == -1) {
            console.log("Attempt to update untracked file: " + path);
            return;
        }
        const trackedFile = this.data.trackedFiles[ind];

        const file = this.plugin.app.vault.getAbstractFileByPath(path) as TFile;
        if (!file) {
            console.log("Could not find file: " + path);
            return;
        }

        let added = 0;
        let removed = 0;

        const newItems: Record<string, number> = {};
        if ("file" in trackedFile.items) {
            newItems["file"] = trackedFile.items["file"];
        } else {
            const newItem: RepetitionItem = Object.assign({}, NEW_ITEM);
            newItem.data = Object.assign(this.plugin.algorithm.defaultData());
            // newItem.data = Object.assign(this.algorithmdefaultData());
            newItem.fileIndex = ind;
            newItem.itemType = type;
            newItem.deckName = Object.values(RPITEMTYPE).includes(type)
                ? this.getDefaultDackName()
                : type;
            newItem.ID = this.data.items.push(newItem) - 1;
            newItems["file"] = newItem.ID;
            added += 1;
        }

        for (const key in trackedFile.items) {
            if (!(key in newItems)) {
                const itemInd = trackedFile.items[key];
                if (this.isQueued(itemInd)) {
                    this.data.queue.remove(itemInd);
                }
                if (this.isInRepeatQueue(itemInd)) {
                    this.data.repeatQueue.remove(itemInd);
                }
                this.data.items[itemInd] = null;
                removed += 1;
            }
        }
        trackedFile.items = newItems;
        this.save();

        // if (notice) {
        //     new Notice("Added " + added + " new items, removed " + removed + " items.");
        // }
        return { added, removed };
    }

    updateCardItems(
        note: TFile,
        cardinfo: CardInfo,
        count: number,
        deckName: string = this.getDefaultDackName(),
        notice?: boolean
    ): { added: number; removed: number } | null {
        if (notice == null) notice = false;
        let len = cardinfo.itemIds.length;
        if (len === count) {
            return;
        }

        if (!this.isTrackedCardfile(note.path)) {
            console.log("Attempt to update cards in untracked file: " + note.path);
            return;
        }
        const ind = this.getFileIndex(note.path);
        const trackedFile = this.getTrackedFile(note.path);
        let added = 0;
        let removed = 0;

        const newitemIds: number[] = cardinfo.itemIds.slice();

        //delete extra items data
        if (count < len) {
            newitemIds.slice(count).forEach((id) => {
                this.data.items[id] = null;
                removed++;
            });
            console.debug("delete %d ids:", removed, newitemIds.slice(count));
            newitemIds.splice(count, len - count);
            len = newitemIds.length;
        }

        if (count - len > 0) {
            // add new card data
            for (let i = 0; i < count - len; i++) {
                const newItem: RepetitionItem = Object.assign({}, NEW_ITEM);
                newItem.data = Object.assign(this.plugin.algorithm.defaultData());
                newItem.fileIndex = ind;
                newItem.itemType = RPITEMTYPE.CARD;
                newItem.deckName = deckName;
                const cardId = this.data.items.push(newItem) - 1;
                newItem.ID = cardId;
                newitemIds.push(cardId);
                added += 1;
            }
            console.debug("add %d ids:", added, newitemIds);
        }

        // delete unused iid items.
        for (const iid of cardinfo.itemIds) {
            if (!newitemIds.includes(iid)) {
                if (this.isCardQueued(iid)) {
                    this.data.cardQueue.remove(iid);
                }
                if (this.isInRepeatQueue(iid)) {
                    this.data.cardRepeatQueue.remove(iid);
                }
                this.data.items[iid] = null;
                console.debug("removed", iid);
                removed += 1;
            } else {
                const item = this.data.items[iid];
                if (item.deckName !== deckName) {
                    item.deckName = deckName;
                }
            }
        }
        cardinfo.itemIds = newitemIds;
        this.save();

        console.log(
            trackedFile.path +
                " update - lineNo:" +
                cardinfo.lineNo +
                "\n Added: " +
                added +
                " new card items, removed " +
                removed +
                " card items."
        );
        if (notice) {
            new Notice(
                trackedFile.path +
                    " update - lineNo:" +
                    cardinfo.lineNo +
                    "\n Added: " +
                    added +
                    " new card items, removed " +
                    removed +
                    " card items."
            );
        }
        return { added, removed };
    }

    /**
     * updateItemById
     * @param id
     * @param fileIndex
     * @returns
     */
    updateItemById(id: number, fileIndex?: number): void {
        if (id < 0) return;
        const item = this.data.items[id];
        if (item == null && fileIndex != null) {
            const newItem: RepetitionItem = Object.assign({}, NEW_ITEM);
            newItem.data = Object.assign(this.plugin.algorithm.defaultData());
            newItem.fileIndex = fileIndex;
            newItem.itemType =
                this.data.trackedFiles[fileIndex].items.file === id
                    ? RPITEMTYPE.NOTE
                    : RPITEMTYPE.CARD;

            this.data.items[id] = newItem;
            this.save();
            console.debug("update item[%d]:", id, item);
            return;
        }
        if (item == null) {
            console.debug("update item[${id}] lack fileIndex");
        }
    }

    /**
     * renameTrackedFile.
     *
     * @param {string} old
     * @param {string} newPath
     */
    renameTrackedFile(old: string, newPath: string) {
        const index = this.getFileIndex(old);
        // Sanity check
        if (index == -1) {
            console.log("Renamed file is not tracked!");
            return;
        }

        const fileData = this.data.trackedFiles[index];
        fileData.path = newPath;
        this.data.trackedFiles[index] = fileData;

        console.log("Updated tracking: " + old + " -> " + newPath);
    }

    /**
     * buildQueue. indexlist of items
     */
    async buildQueue() {
        // console.log("Building queue...");
        const data = this.data;
        const maxNew = this.plugin.data.settings.maxNewPerDay;
        const now: Date = new Date();

        if (now.getDate() != new Date(this.data.lastQueue).getDate()) {
            this.data.newAdded = 0;
        }
        data.cardQueue = [];

        let oldAdd = 0;
        let newAdd = 0;
        let oldAdd_card = 0;
        let newAdd_card = 0;

        let untrackedFiles = 0;
        let removedItems = 0;

        await Promise.all(
            this.data.items.map(async (item, id) => {
                if (item != null) {
                    const file = this.getFileForItem(item);
                    return this.verify(file).then((exists) => {
                        if (!exists) {
                            if (file != null) {
                                console.debug("untrackfile by buildqueue:", file);
                                new Notice("untrackfile by buildqueue:" + file);
                                removedItems += this.untrackFile(file.path, false);
                                item = null;
                                untrackedFiles += 1;
                            }
                        } else if (file.items.file !== id) {
                            if (item.timesReviewed == 0) {
                                // This is a new item.
                                if (maxNew == -1 || data.newAdded < maxNew) {
                                    // item.nextReview = now.getTime();
                                    data.newAdded += 1;
                                    data.cardQueue.push(id);
                                    newAdd_card += 1;
                                }
                            } else if (item.nextReview <= now.getTime()) {
                                if (this.isInRepeatQueue(id)) {
                                    data.cardRepeatQueue.remove(id);
                                }
                                if (!this.isCardQueued(id)) {
                                    data.cardQueue.push(id);
                                    oldAdd_card += 1;
                                }
                            }
                        } else {
                            if (item.timesReviewed == 0) {
                                // This is a new item.
                                if (maxNew == -1 || data.newAdded < maxNew) {
                                    // item.nextReview = now.getTime();   // it doesn't matter.
                                    data.newAdded += 1;
                                    data.queue.push(id);
                                    newAdd += 1;
                                }
                            } else if (item.nextReview <= now.getTime()) {
                                if (this.isInRepeatQueue(id)) {
                                    data.repeatQueue.remove(id);
                                }
                                if (!this.isQueued(id)) {
                                    data.queue.push(id);
                                    oldAdd += 1;
                                }
                            }
                        }
                    });
                }
            })
        );

        this.data.lastQueue = now.getTime();
        // if (this.plugin.data.settings.shuffleQueue && oldAdd + newAdd > 0) {
        //     MiscUtils.shuffle(data.queue);
        // }

        console.log(
            "Added " + (oldAdd + newAdd) + " notes to review queue, with " + newAdd + " new!"
        );
        console.log(
            "Added " +
                (oldAdd_card + newAdd_card) +
                " cards to review queue, with " +
                newAdd_card +
                " new!"
        );

        if (untrackedFiles > 0) {
            new Notice(
                "Recall: Untracked " +
                    untrackedFiles +
                    " files with a total of " +
                    removedItems +
                    " items while building queue!"
            );
        }
    }

    loadRepeatQueue(rvdecks: { [deckKey: string]: ReviewDeck }) {
        if (this.repeatQueueSize() > 0) {
            // const repeatDeckCounts: Record<string, number> = {};
            this.data.repeatQueue.forEach((id) => {
                const dname: string = this.getItembyID(id).deckName;
                this.data.toDayAllQueue[id] = dname;
                // if (!Object.keys(repeatDeckCounts).includes(dname)) {
                //     repeatDeckCounts[dname] = 0;
                // }
                rvdecks[dname].dueNotesCount++;
            });
            // return repeatDeckCounts;
        }
    }

    /**
     * Verify that the file of this item still exists.
     *
     * @param {TrackedFile} file
     */
    async verify(file: TrackedFile): Promise<boolean> {
        const adapter = this.plugin.app.vault.adapter;
        if (file != null) {
            return adapter.exists(file.path).catch((_reason) => {
                console.error("Unable to verify file: ", file.path);
                return false;
            });
        }
        return false;
    }

    /**
     * resetData.
     */
    resetData() {
        this.data = Object.assign({}, DEFAULT_SRS_DATA);
    }

    /**
     * pruneData: delete unused storedata, fsrs's optimizer/writeRevlog() will be affected if using this func.
     * NulltFiles/NullItems
     * @returns
     */
    async pruneData() {
        const items = this.data.items;
        const tracked_files = this.data.trackedFiles;
        let removedNulltFiles = 0;
        let removedNullItems = 0;
        const nullFileList: number[] = [];
        const nullFileList_del: number[] = [];
        const nullItemList: number[] = [];
        const nullItemList_del: number[] = [];

        if (this.plugin.data.settings.algorithm === "Fsrs") {
            new Notice("因涉及到revlog.csv, 暂不可精简清除无效数据");
            return;
            //todo: 后续通过正则替换的方式，同步修改revlog.csv中的数据
        }
        tracked_files.map((tf, ind) => {
            if (tf == null) {
                nullFileList.push(ind);
                nullFileList_del.push(ind - nullFileList_del.length);
                removedNulltFiles++;
            }
        });
        for (let i = 0; i < nullFileList_del.length; i++) {
            tracked_files.splice(nullFileList_del[i], 1);
        }
        const nflMin = Math.min(...nullFileList);
        items.map((item, id) => {
            if (item != null && item.fileIndex >= nflMin) {
                const ifind = item.fileIndex;
                for (let nli = nullFileList.length - 1; nli >= 0; nli--) {
                    if (ifind > nullFileList[nli]) {
                        item.fileIndex -= nli + 1;
                        break;
                    } else if (ifind === nullFileList[nli]) {
                        item = null;
                        break;
                    }
                }
            }
            if (item == null) {
                nullItemList.push(id);
                nullItemList_del.push(id - nullItemList_del.length);
                removedNullItems++;
            }
        });

        for (let i = 0; i < nullItemList_del.length; i++) {
            items.splice(nullItemList_del[i], 1);
        }

        const nlMin = Math.min(...nullItemList);
        for (const trackedFile of tracked_files) {
            if (trackedFile == null) continue;
            const oldId = trackedFile.items.file;
            let newId = -1;
            if (oldId >= nlMin) {
                for (let nli = nullItemList.length - 1; nli >= 0; nli--) {
                    if (oldId >= nullItemList[nli]) {
                        newId = oldId > nullItemList[nli] ? oldId - (nli + 1) : -1;
                        trackedFile.items.file = newId;
                        this.getItembyID(newId).ID = newId;
                        // console.debug("change file: id%d to id%d", oldId, newId, trackedFile);
                        break;
                    }
                }
            }

            // loop itemIds, if has some id point to null, change it.
            if (!Object.prototype.hasOwnProperty.call(trackedFile, "cardItems")) {
                continue;
            }
            for (const carditem of trackedFile.cardItems) {
                if (Math.max(...carditem.itemIds) >= nlMin) {
                    for (let idi = 0; idi < carditem.itemIds.length; idi++) {
                        const oldId = carditem.itemIds[idi];
                        let newId = -1;
                        if (oldId >= nlMin) {
                            nlfor: for (let nli = nullItemList.length - 1; nli >= 0; nli--) {
                                if (oldId >= nullItemList[nli]) {
                                    newId = oldId > nullItemList[nli] ? oldId - (nli + 1) : newId;
                                    carditem.itemIds.splice(idi, 1, newId);
                                    this.getItembyID(newId).ID = newId;
                                    break nlfor;
                                }
                            }
                        }
                    }
                    console.debug("changed card:%s by %s", carditem.itemIds, nullFileList);
                }
            }
        }

        // console.debug("after delete nullitems:", items);

        this.save();

        console.log(
            "removed " +
                removedNulltFiles +
                " nullTrackedfile(s), removed " +
                removedNullItems +
                " nullitem(s)."
        );
        return;
    }

    /**
     * sync RCsrsDataTo SRreviewDecks
     *
     * @param rdeck
     * @returns
     */
    syncRCsrsDataToSRreviewDecks(rdeck: ReviewDeck) {
        // graph.reset();
        this.buildQueue();
        const now = new Date().getTime();
        for (let i = 0; i < this.data.queue.length; i++) {
            const item = this.data.items[this.data.queue[i]];
            if (item == null) {
                console.log("syncRCsrsDataToSRreviewDecks: null item");
                continue;
            }
            const path = this.getFilePath(item);
            const trackedFile = this.getFileForItem(item);
            const file = this.plugin.app.vault.getAbstractFileByPath(path) as TFile;
            if (!file) {
                console.log("Could not find file: ", path);
                continue;
            }

            let shouldIgnore = false;
            if (!Object.prototype.hasOwnProperty.call(trackedFile, "tags")) {
                trackedFile["tags"] = [this.getDefaultDackName()];
                this.save();
            }
            for (const tag of trackedFile.tags) {
                if (
                    this.plugin.data.settings.tagsToReview.some(
                        (tagToReview) => tag === tagToReview || tag.startsWith(tagToReview + "/")
                    )
                ) {
                    shouldIgnore = true;
                    break;
                }
            }
            if (
                trackedFile.tags.length > 0 &&
                trackedFile.tags.last() !== this.getDefaultDackName()
            ) {
                // had other tags that user currently doesn't want to review.
                shouldIgnore = true;
            }
            if (shouldIgnore) {
                continue;
            } // already add to other tagDeck.

            if (this.isNewAdd(this.data.queue[i]) >= 0) {
                rdeck.newNotes.push(file);
                this.plugin.newNotesCount++;
                console.debug("syncRCsrsDataToSRreviewDecks: newadd");
                continue;
            } else {
                rdeck.scheduledNotes.push({ note: file, dueUnix: item.nextReview });
                if (item.nextReview <= now.valueOf()) {
                    rdeck.dueNotesCount++;
                    this.plugin.dueNotesCount++;
                }
            }

            const [, due, _interval, ease] = this.getReviewNoteHeaderData(path);
            if (Object.prototype.hasOwnProperty.call(this.plugin.easeByPath, path)) {
                this.plugin.easeByPath[path] = (this.plugin.easeByPath[path] + ease) / 2;
            } else {
                this.plugin.easeByPath[path] = ease;
            }
            const nDays: number = Math.ceil((due - now.valueOf()) / (24 * 3600 * 1000));
            if (!Object.prototype.hasOwnProperty.call(this.plugin.dueDatesNotes, nDays)) {
                this.plugin.dueDatesNotes[nDays] = 0;
            }
            this.plugin.dueDatesNotes[nDays]++;
        }
        return rdeck;
    }

    /**
     * syncRCDataToSR ReviewDeck ,
     * and update deckName to trackedfile.tags;
     * @param rdeck
     * @returns
     */
    syncRCDataToSRrevDeck(rdeck: ReviewDeck, note: TFile, now?: number) {
        const fileid = this.getFileId(note.path);
        const item = this.data.items[fileid];
        const trackedFile = this.getTrackedFile(note.path);
        const ind = this.getFileIndex(note.path);
        let now_number: number = now;
        const nowToday: number =
            Math.ceil(Date.now() / DateUtils.DAYS_TO_MILLIS) * DateUtils.DAYS_TO_MILLIS;

        if (item == null) {
            this.updateItemById(fileid, ind);
            console.debug("syncRCDataToSRrevDeck update item:", item);
        }
        if (now == null) {
            //it's inside plugin.sync();
            now_number = nowToday;
            const currNow = Date.now();
            if (
                nowToday - item.nextReview > 0 &&
                (this.data.toDayLatterQueue[fileid] == undefined || currNow - item.nextReview > 0)
            ) {
                this.data.toDayAllQueue[fileid] = rdeck.deckName;
                delete this.data.toDayLatterQueue[fileid];
            } else if (nowToday - item.nextReview < 0) {
                // just in case some unknow errors.
                delete this.data.toDayAllQueue[fileid];
            }
        } else {
            delete this.data.toDayAllQueue[fileid];
            if (item.nextReview <= nowToday) {
                this.data.toDayLatterQueue[fileid] = rdeck.deckName;
            } else if (item.nextReview > nowToday) {
                delete this.data.toDayLatterQueue[fileid];
            }
            Object.keys(this.data.toDayLatterQueue).forEach((fileid) => {
                const id = Number.parseInt(fileid);
                if (now - this.data.items[id].nextReview > 0) {
                    if (!Object.prototype.hasOwnProperty.call(this.data.toDayAllQueue, id)) {
                        const dname = (this.data.toDayAllQueue[id] = this.data.items[id].deckName);
                        this.plugin.reviewDecks[dname].dueNotesCount++;
                    }
                    delete this.data.toDayLatterQueue[id];
                }
            });
        }

        if (this.isNewAdd(fileid) >= 0) {
            rdeck.newNotes.push(note);
            this.plugin.newNotesCount++;
            // console.debug("syncRCDataToSRrevDeck : addNew", fileid);
        } else {
            rdeck.scheduledNotes.push({ note: note, dueUnix: item.nextReview });
            if (item.nextReview <= nowToday) {
                rdeck.dueNotesCount++;
                this.plugin.dueNotesCount++;
            }

            // update pulgin data
            const [, due, _interval, ease] = this.getReviewNoteHeaderData(note.path);
            if (now != null) {
                // this.plugin.easeByPath just update in plugin.sync(), shouldn't update in pulgin.singNoteSyncQueue()
                if (Object.prototype.hasOwnProperty.call(this.plugin.easeByPath, note.path)) {
                    this.plugin.easeByPath[note.path] =
                        (this.plugin.easeByPath[note.path] + ease) / 2;
                } else {
                    this.plugin.easeByPath[note.path] = ease;
                }
            }
            const nDays: number = Math.ceil((due - now_number) / (24 * 3600 * 1000));
            if (!Object.prototype.hasOwnProperty.call(this.plugin.dueDatesNotes, nDays)) {
                this.plugin.dueDatesNotes[nDays] = 0;
            }
            this.plugin.dueDatesNotes[nDays]++;
        }
        // update this.trackFile
        if (!Object.prototype.hasOwnProperty.call(trackedFile, "tags")) {
            trackedFile["tags"] = [rdeck.deckName];
            this.save();
        } else {
            if (!trackedFile.tags.includes(rdeck.deckName)) {
                trackedFile.tags.push(rdeck.deckName);
                this.save();
            }
        }

        // update item
        if (item.deckName !== rdeck.deckName) {
            item.deckName = rdeck.deckName;
            this.save();
        }
        if (!Object.prototype.hasOwnProperty.call(item, "itemType")) {
            item.itemType = this.isCardItem(fileid) ? RPITEMTYPE.CARD : RPITEMTYPE.NOTE;
            this.save();
        }

        return;
    }

    /**
     * syncheadertoDataItems
     * @param note Tfile
     * @param sched ["due-interval-ease00", dueString, interval, ease]
     * @param response
     */
    syncheadertoDataItems(note: TFile, sched: number[], response?: ReviewResponse) {
        const fileId = this.getFileId(note.path);
        let correct = null;
        if (response != null) {
            if (!(response == ReviewResponse.Easy || response == ReviewResponse.Good)) {
                correct = false;
            } else {
                correct = true;
            }
        }
        if (sched[1] == null) {
            console.debug("%s response sched wrong: null ", note.path, fileId);
            new Notice(note.path + "%s %s response sched wrong: null " + fileId.toString());
        }
        this.setSchedbyId(fileId, sched, correct);
    }

    /**
     *  get ReviewNote dataItems to HeaderData
     *  getSchedbyId
     * @param path
     * @returns number[] | [0, due, interval, ease];
     */
    getReviewNoteHeaderData(path: string): number[] {
        const item: RepetitionItem = this.getItemsOfFile(path)[0];
        if (item == null) {
            console.log("getReviewNoteHeaderData --> note: %s doesn't have item: ", path, item);
            return;
        }
        const ease = item.data.ease * 100;
        const interval = item.data.lastInterval;
        // const interval = item.data.iteration;
        const due = item.nextReview;
        return [0, due, interval, ease];
    }

    /**
     * @description: getSchedbyId , give returns to scheduling
     * @param {number} id
     * @return {[]}  ["due-interval-ease00", due, interval, ease] | null for new
     */
    getSchedbyId(id: number): RegExpMatchArray {
        const item: RepetitionItem = this.data.items[id];
        if (item == null || item.nextReview === 0 || item.timesReviewed === 0) return null; // new card doesn't need schedinfo
        const ease = item.data.ease * 100;
        const interval = item.data.lastInterval;
        // const interval = item.data.iteration;
        const due = window.moment(item.nextReview);
        const dueString: string = due.format("YYYY-MM-DD");
        return ["due-interval-ease00", dueString, interval, ease] as RegExpMatchArray;
    }

    setSchedbyId(id: number, sched: RegExpMatchArray | number[] | string[], correct?: boolean) {
        const item: RepetitionItem = this.data.items[id];
        if (item == null) {
            console.warn("setSchedbyId failed: item === null");
            // this.updateItemById(id);     //not work well yet.
            return;
        }
        item.nextReview =
            typeof sched[1] == "number"
                ? sched[1]
                : window
                      .moment(sched[1], ["YYYY-MM-DD", "DD-MM-YYYY", "ddd MMM DD YYYY"])
                      .valueOf();
        item.data.lastInterval = sched[2] as number;
        item.data.ease = (sched[3] as number) / 100;

        if (correct != null) {
            item.timesReviewed += 1;
            if (correct) {
                item.timesCorrect += 1;
                item.errorStreak = 0;
            } else {
                item.errorStreak += 1;
            }
        }
    }

    /**
     * syncNoteCardsIndex
     * only check and sync index, not add/remove cardinfo/ids/items.
     * @param note
     * @returns
     */
    async syncNoteCardsIndex(note: TFile): Promise<number> {
        if (!this.isTaged(note, "card") && !this.isTrackedCardfile(note.path)) {
            return;
        }

        const trackedFile = this.getTrackedFile(note.path);
        const fileText: string = await this.plugin.app.vault.read(note);
        const settings: SRSettings = this.plugin.data.settings;
        let negIndFlag = false;
        const lines: number[] = [];
        const cardHashList: Record<number, string> = {};

        const parsedCards: [CardType, string, number][] = parse(
            fileText,
            settings.singleLineCardSeparator,
            settings.singleLineReversedCardSeparator,
            settings.multilineCardSeparator,
            settings.multilineReversedCardSeparator,
            settings.convertHighlightsToClozes,
            settings.convertBoldTextToClozes,
            settings.convertCurlyBracketsToClozes
        );

        for (const parsedCard of parsedCards) {
            const lineNo: number = parsedCard[2];
            let cardText: string = parsedCard[1];

            if (cardText.includes(settings.editLaterTag)) {
                continue;
            }

            if (!settings.convertFoldersToDecks) {
                const tagInCardRegEx = /^#[^\s#]+/gi;
                const cardDeckPath = cardText
                    .match(tagInCardRegEx)
                    ?.slice(-1)[0]
                    .replace("#", "")
                    .split("/");
                if (cardDeckPath) {
                    cardText = cardText.replaceAll(tagInCardRegEx, "");
                }
            }

            const cardTextHash: string = cyrb53(cardText);

            const cardinfo = this.getAndSyncCardInfo(note, lineNo, cardTextHash);
            lines.push(lineNo);
            cardHashList[lineNo] = cardTextHash;
            if (cardinfo == null) {
                negIndFlag = true;
                continue;
            }
        }
        // console.debug("cardHashList: ", cardHashList);

        // sync by total parsedCards.length
        const carditems = trackedFile.cardItems;
        if (lines.length === carditems.length && negIndFlag) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i] !== carditems[i].lineNo) {
                    carditems[i].lineNo = lines[i];
                    this.getAndSyncCardInfo(note, lines[i], cardHashList[lines[i]]);
                }
            }
        }

        return;
    }

    /**
     * check if note taged for sr.
     * @param note
     * @param tagtype  "note", "card", "all"
     * @returns boolean
     */
    isTaged(note: TFile, tagtype?: string) {
        if (tagtype == null) {
            tagtype = "note";
        }
        // on tracked notfile changed.
        const fileCachedData = app.metadataCache.getFileCache(note) || {};
        let shouldIgnore = true;

        const tags = getAllTags(fileCachedData) || [];
        if (
            this.plugin.data.settings.noteFoldersToIgnore.some((folder) =>
                note.path.startsWith(folder)
            )
        ) {
            return false;
        }

        if (tagtype === "note") {
            if (this.getNoteDeckName(tags) !== null) {
                shouldIgnore = false;
            }
        } else if (tagtype === "card") {
            for (const tag of tags) {
                if (this.isTagedDeckName(tag)) {
                    shouldIgnore = false;
                    break;
                }
            }
        } else if (tagtype === "all") {
            if (this.getNoteDeckName(tags) !== null) {
                shouldIgnore = false;
            }
            for (const tag of tags) {
                if (this.isTagedDeckName(tag)) {
                    shouldIgnore = false;
                    break;
                }
            }
        }

        return !shouldIgnore;
    }

    isTagedNoteDeckName(deckName: string) {
        let isTaged = false;
        if (
            this.plugin.data.settings.tagsToReview.some(
                (tagToReview) => deckName === tagToReview || deckName.startsWith(tagToReview + "/")
            )
        ) {
            isTaged = true;
        }
        return isTaged;
    }

    isTagedDeckName(deckName: string) {
        let isTaged = false;
        if (
            this.plugin.data.settings.flashcardTags.some(
                (flashcardTag) =>
                    deckName === flashcardTag || deckName.startsWith(flashcardTag + "/")
            )
        ) {
            isTaged = true;
        }
        return isTaged;
    }

    getNoteDeckName(tags: string[]) {
        let deckName = null;
        for (const tag of tags) {
            if (
                this.plugin.data.settings.tagsToReview.some(
                    (tagToReview) => tag === tagToReview || tag.startsWith(tagToReview + "/")
                )
            ) {
                deckName = tag;
                break;
            }
        }
        return deckName;
    }

    /**
     * syncTrackfileCardSched
     * @param note
     * @param deckName
     * @param lineNo
     * @param cardTextHash
     * @param count
     * @param scheduling RegExpMatchArray[]
     */
    syncTrackfileCardSched(
        note: TFile,
        deckName: string,
        lineNo: number,
        cardTextHash: string,
        count: number,
        scheduling?: RegExpMatchArray[]
    ): RegExpMatchArray[] | null {
        if (scheduling == null) {
            scheduling = [];
        }

        let carditem = this.getAndSyncCardInfo(note, lineNo, cardTextHash);
        if (carditem == null) {
            carditem = this.trackFileCard(note, lineNo, cardTextHash);
        }

        if (!this.isTagedDeckName(deckName) && !this.isTagedNoteDeckName(deckName)) {
            deckName = this.getDefaultDackName();
        }
        this.updateCardItems(note, carditem, count, deckName);
        carditem.itemIds.forEach((id) => {
            const sched = this.getSchedbyId(id);
            // ignore new add card
            if (sched != null) {
                scheduling.push(sched);
            }
        });

        return scheduling;
    }
}
