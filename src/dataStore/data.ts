import { MiscUtils, debug } from "src/util/utils_recall";
import { SRSettings } from "../settings";

import { TFile, TFolder, getAllTags } from "obsidian";

import { FsrsData } from "src/algorithms/fsrs";
import { AnkiData } from "src/algorithms/anki";

import { getStorePath } from "src/dataStore/dataLocation";
import { Tags } from "src/tags";
import { SrsAlgorithm, algorithmNames } from "src/algorithms/algorithms";
import { CardInfo, TrackedFile } from "./trackedFile";
import { RPITEMTYPE, RepetitionItem, ReviewResult } from "./repetitionItem";
import { DEFAULT_QUEUE_DATA, Queue } from "./queue";
import { Iadapter } from "./adapter";

/**
 * SrsData.
 */
export interface SrsData {
    /**
     * @type {Queue}
     */
    queues: Queue;

    /**
     * @type {ReviewedCounts}
     */
    reviewedCounts: ReviewedCounts;
    /**
     * @type {ReviewedCounts}
     */
    reviewedCardCounts: ReviewedCounts;
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
    mtime: number;
}

export type ReviewedCounts = Record<string, { new: number; due: number }>;

export const DEFAULT_SRS_DATA: SrsData = {
    queues: Object.assign({}, DEFAULT_QUEUE_DATA) as Queue,
    reviewedCounts: {},
    reviewedCardCounts: {},
    items: [],
    trackedFiles: [],
    mtime: 0,
};

/**
 * DataStore.
 */
export class DataStore {
    static instance: DataStore;

    /**
     * @type {SrsData}
     */
    data: SrsData;
    /**
     * @type {SRPlugin}
     */
    // plugin: SRPlugin;
    settings: SRSettings;
    // manifestDir: string;
    /**
     * @type {string}
     */
    dataPath: string;

    public static getInstance(): DataStore {
        if (!DataStore.instance) {
            // DataStore.instance = new DataStore();
            throw Error("there is not DataStore instance.");
        }
        return DataStore.instance;
    }

    /**
     *
     * @param settings
     * @param manifestDir
     */
    constructor(settings: SRSettings, manifestDir: string) {
        // this.plugin = plugin;
        this.settings = settings;
        // this.manifestDir = manifestDir;
        this.dataPath = getStorePath(manifestDir, settings);
        DataStore.instance = this;
    }

    toInstances() {
        this.data.trackedFiles = this.data.trackedFiles.map(TrackedFile.create);
        this.data.items = this.data.items.map(RepetitionItem.create);
        this.data.queues = Queue.create(this.data.queues);
    }

    /**
     * load.
     */
    async load(path = this.dataPath) {
        try {
            const adapter = Iadapter.instance.adapter;

            if (await adapter.exists(path)) {
                const data = await adapter.read(path);
                if (data == null) {
                    console.log("Unable to read SRS data!");
                    this.data = Object.assign({}, DEFAULT_SRS_DATA);
                } else {
                    console.log("Reading tracked files...");
                    this.data = Object.assign(
                        Object.assign({}, DEFAULT_SRS_DATA),
                        JSON.parse(data),
                    );
                    this.data.mtime = await this.getmtime();
                }
            } else {
                console.log("Tracked files not found! Creating new file...");
                this.data = Object.assign({}, DEFAULT_SRS_DATA);
                await this.save();
            }
        } catch (error) {
            console.log(error + "Tracked files not found! Creating new file...");
            this.data = Object.assign({}, DEFAULT_SRS_DATA);
            await this.save();
        }
        this.toInstances();
    }

    /**
     * re load if tracked_files.json updated by other device.
     */
    async reLoad() {
        // const now: Date = new Date().getTime();
        const mtime = await this.getmtime();
        if (mtime - this.data.mtime > 10) {
            console.debug("reload newer tracked_files.json: ", mtime, mtime - this.data.mtime);
            await this.load();
        }
    }
    setdataPath(path = this.dataPath) {
        this.dataPath = path;
    }
    /**
     * save.
     */
    async save(path = this.dataPath) {
        try {
            await Iadapter.instance.adapter.write(path, JSON.stringify(this.data));
            this.data.mtime = await this.getmtime();
        } catch (error) {
            MiscUtils.notice("Unable to save data file!");
            console.log(error);
            return;
        }
    }

    /**
     * get file modified time. should only set to data.mtime when load.
     * @param path
     * @returns
     */
    async getmtime(path = this.dataPath) {
        const adapter = Iadapter.instance.adapter;
        const stat = await adapter.stat(path.normalize());
        if (stat != null) {
            return stat.mtime;
        } else {
            return 0;
        }
    }

    /**
     * Returns total number of items tracked by the SRS.
     * @returns {number}
     */
    get itemSize(): number {
        return this.data.items.length;
    }
    /**
     * Returns all items tracked by the SRS.
     * @returns {RepetitionItem}
     */
    get items(): RepetitionItem[] {
        return this.data.items;
    }

    /**
     * getFileIndex.
     *
     * @param {string} path
     * @returns {number} ind | -1
     */
    getFileIndex(path: string): number {
        return this.data.trackedFiles.findIndex((val, _ind, _obj) => {
            return val != null && val.path == path;
        });
    }

    getTrackedFile(path: string): TrackedFile {
        const ind = this.getFileIndex(path);
        if (ind < 0) {
            return null;
        }
        return this.data.trackedFiles[ind];
    }

    /**
     * Returns whether or not the given file path is tracked by the SRS.
     * @param {string} path
     * @returns {boolean}
     */
    isInTrackedFiles(path: string): boolean {
        return this.getFileIndex(path) >= 0;
    }

    /**
     * Returns whether or not the given file path is tracked by the SRS.
     * work for cards query.
     * @param {string} path
     * @returns {boolean}
     */
    isTrackedCardfile(path: string): boolean {
        return this.getTrackedFile(path)?.hasCards ?? false;
    }

    isCardItem(id: number) {
        const item = this.getItembyID(id);
        const file = this.getFileByIndex(item.fileIndex);
        return file.noteID !== id;
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
        const item = this.getItembyID(itemId);
        if (item == null) {
            return -1;
        }

        const now: Date = new Date();
        return (item.nextReview - now.getTime()) / (1000 * 60 * 60);
    }

    getItembyID(id: number): RepetitionItem {
        return id < 0
            ? null
            : this.data.items.find((item: RepetitionItem, _idx) => {
                  if (item != null && item.ID === id) {
                      return true;
                  }
              });
    }

    getFileByIndex(idx: number): TrackedFile {
        // assert(idx >= 0);
        return this.data.trackedFiles[idx];
    }

    /**
     * getItemsOfFile.
     * @param {string} path
     * @returns {RepetitionItem[]}
     */
    getItemsOfFile(path: string): RepetitionItem[] {
        const file = this.getTrackedFile(path);
        return file?.isTracked ? this.getItems(file.itemIDs) : [];
    }
    getItems = (ids: number[]): RepetitionItem[] => {
        return ids.map(this.getItembyID.bind(this));
    };
    getNoteItem(path: string): RepetitionItem {
        return this.getItembyID(this.getTrackedFile(path)?.noteID) ?? null;
    }

    /**
     * getNext. RepetitionItem
     *
     * @returns {RepetitionItem | null}
     */
    getNext(key?: string): RepetitionItem | null {
        const id = this.data.queues.getNextId(key);
        if (id != null) {
            return this.getItembyID(id);
        }

        return null;
    }

    /**
     * getFilePath.
     *
     * @param {RepetitionItem} item
     * @returns {string | null}
     */
    getFilePath(item: RepetitionItem): string | null {
        const trackedFile = this.data.trackedFiles[item.fileIndex];

        return trackedFile?.path ?? null;
    }

    getReviewedCounts() {
        return this.data.reviewedCounts;
    }
    getReviewedCardCounts(): ReviewedCounts {
        return this.data.reviewedCardCounts;
    }

    /**
     * reviewId.
     * update data according to response opt
     * @param {number} itemId
     * @param {string} option
     */
    reviewId(itemId: number, option: string | number) {
        const item = this.getItembyID(itemId);
        let result: ReviewResult;
        if (item == null) {
            return -1;
        }

        const algorithm = SrsAlgorithm.getInstance();
        if (typeof option === "number") {
            option = algorithm.srsOptions()[option] as string;
        }
        if (this.data.queues.isInRepeatQueue(itemId)) {
            result = algorithm.onSelection(item, option, true);
        } else {
            result = algorithm.onSelection(item, option, false);
            item.reviewUpdate(result);
        }
        this.data.queues.updateWhenReview(item, result.correct, this.settings.repeatItems);
        if (item.timesReviewed < 1) {
            debug("save review data error when reviewId");
        }
    }

    /**
     * untrackFilesInFolderPath.
     *
     * @param {string} path
     * @param {boolean} recursive
     */
    untrackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = Iadapter.instance.vault.getAbstractFileByPath(path) as TFolder;

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
        let firstCalled = false;
        if (recursive == null) {
            recursive = true;
            firstCalled = true;
        }

        let totalRemoved = 0;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                if (recursive) {
                    totalRemoved += this.untrackFilesInFolder(child, recursive);
                }
            } else if (child instanceof TFile) {
                if (this.getTrackedFile(child.path)?.isTrackedNote) {
                    const removed = this.untrackFile(child.path, false);
                    totalRemoved += removed;
                }
            }
        });
        if (firstCalled) {
            const msg = `在文件夹 ${folder.path} 下，共有 ${totalRemoved} 个文件不再跟踪重复了`;
            MiscUtils.notice(msg);
            console.log(msg);
        }
        return totalRemoved;
    }

    /**
     * trackFilesInFolderPath.
     *
     * @param {string} path
     * @param {boolean} recursive
     */
    trackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = Iadapter.instance.vault.getAbstractFileByPath(path) as TFolder;

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
                if (!this.getTrackedFile(child.path)?.isTrackedNote) {
                    const { added, removed } = this.trackFile(child.path, RPITEMTYPE.NOTE, false);
                    totalAdded += added;
                    totalRemoved += removed;
                }
            }
        });

        MiscUtils.notice("Added " + totalAdded + " new items, removed " + totalRemoved + " items.");
    }

    /**
     * trackFile.
     *
     * @param {string} path
     * @param {string} type? "default" , "card"
     * @param {boolean} notice
     * @returns {{ added: number; removed: number } | null}
     */
    trackFile(
        path: string,
        type?: RPITEMTYPE | string,
        notice?: boolean,
    ): { added: number; removed: number } | null {
        const isType = Object.values(RPITEMTYPE).includes(type as RPITEMTYPE);
        const itemtype = isType ? (type as RPITEMTYPE) : RPITEMTYPE.NOTE;
        const dname = !isType ? type : undefined;
        const trackedFile = new TrackedFile(path, itemtype, dname);

        const ind = this.getFileIndex(path);
        if (ind < 0) {
            this.data.trackedFiles.push(trackedFile);
        } else {
            const tkfile = this.getFileByIndex(ind);
            if (!tkfile.isTrackedNote) {
                tkfile.setTracked(itemtype, dname);
            }
        }
        const data = this.updateItems(path, itemtype, dname, notice);
        console.log("Tracked: " + path);
        // this.plugin.updateStatusBar();
        return data;
    }

    /**
     * untrackFile.
     *
     * @param {string} path
     * @param {boolean} notice
     * @returns {number}
     */
    untrackFile(path: string, notice?: boolean): number {
        const trackedFile = this.getTrackedFile(path);
        if (!trackedFile) return 0;
        
        let numItems = 0;
        const lastTag = trackedFile.lastTag;
        
        // Remove items
        for (const key in trackedFile.items) {
            const id = trackedFile.items[key];
            if (id >= 0) {
                delete this.data.items[id];  // Actually remove the item
                numItems++;
            }
        }
        
        // Remove the tracked file entry
        const index = this.data.trackedFiles.findIndex(f => f.path === path);
        if (index !== -1) {
            this.data.trackedFiles.splice(index, 1);
        }
        
        // Save changes
        this.save();

        if (notice) {
            MiscUtils.notice("Untracked " + numItems + " items");
        }

        return numItems;
    }

    unTrackItem(id: number) {
        const item = this.getItembyID(id);
        this.data.queues.remove(item);
        item.setUntracked();
    }

    get maxItemId() {
        return Math.max(
            ...this.data.items.map((item: RepetitionItem) => {
                return item ? item.ID : 0;
            }),
            this.data.items.length - 1,
        );
    }

    _updateItem(
        id: number = null,
        fileIndex: number,
        itemType: RPITEMTYPE,
        deckName: string,
    ): number {
        if (id < 0) return;
        let item: RepetitionItem;
        const algorithm = SrsAlgorithm.getInstance();

        const newItem = new RepetitionItem(
            id,
            fileIndex,
            itemType,
            deckName,
            algorithm.defaultData(),
        );

        if (id == undefined) {
            newItem.ID = this.maxItemId + 1;
            this.data.items.push(newItem);
        } else {
            item = this.getItembyID(id);
            if (item != null) {
                item.setTracked(fileIndex);
                item.itemType = itemType;
                item.data = Object.assign(algorithm.defaultData(), item.data);
            } else {
                this.data.items.push(newItem);
            }
        }

        return newItem.ID;

        // console.debug(`update items[${id}]:`, newItem);
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
        type: RPITEMTYPE,
        dname: string,
        notice?: boolean,
    ): { added: number; removed: number } | null {
        if (notice == null) notice = true;

        const ind = this.getFileIndex(path);
        if (ind == -1) {
            console.log("Attempt to update untracked file: " + path);
            return;
        }
        const trackedFile = this.getFileByIndex(ind);

        let added = 0;
        let removed = 0;

        const newItems: Record<string, number> = {};
        if ("file" in trackedFile.items && trackedFile.noteID > 0) {
            newItems["file"] = trackedFile.items["file"];
            this.getItembyID(trackedFile.noteID).setTracked(ind);
        } else if (type === RPITEMTYPE.NOTE) {
            const ID = this._updateItem(undefined, ind, type, dname);
            newItems["file"] = ID;
            added += 1;
        } else {
            newItems["file"] = -1;
        }

        for (const key in trackedFile.items) {
            if (!(key in newItems)) {
                const itemInd = trackedFile.items[key];
                this.unTrackItem(itemInd);
                console.debug("null item:" + itemInd);
                removed += 1;
            }
        }
        trackedFile.items = newItems;
        // this.save();     // will be used when plugin.sync_Algo(), which shouldn't

        if (notice) {
            MiscUtils.notice("Added " + added + " new items, removed " + removed + " items.");
        }
        return { added, removed };
    }

    updateCardItems(
        trackedFile: TrackedFile,
        cardinfo: CardInfo,
        count: number,
        deckName: string,
        notice?: boolean,
    ): { added: number; removed: number } | null {
        if (notice == null) notice = false;
        const idsLen = cardinfo.itemIds.length;
        const ind = this.getFileIndex(trackedFile.path);
        this.getItems(cardinfo.itemIds).filter((item, _idx) => {
            if (_idx < count) {
                item.setTracked(ind);
                item.updateDeckName(deckName, true);
                return true;
            }
        });
        if (idsLen === count) {
            return;
        }

        let added = 0;
        let removed = 0;

        const newitemIds: number[] = cardinfo.itemIds.slice();

        if (count < idsLen) {
            const untrackExtraItems = () => {
                const rmvIds = newitemIds.slice(count);
                rmvIds.forEach((id) => {
                    this.unTrackItem(id);
                    removed++;
                });
                newitemIds.splice(count, idsLen - count);
                console.debug("delete %d ids:", removed, rmvIds);
            };
            untrackExtraItems();
            // len = newitemIds.length;
        } else {
            // count > len
            // add new card data
            for (let i = 0; i < count - idsLen; i++) {
                const cardId = this._updateItem(undefined, ind, RPITEMTYPE.CARD, deckName);
                newitemIds.push(cardId);
                added += 1;
            }
            // console.debug("add %d ids:", added, newitemIds);
        }

        newitemIds.sort((a: number, b: number) => a - b);
        cardinfo.itemIds = newitemIds;
        // this.save();

        const msg = `${trackedFile.path} update - lineNo: ${cardinfo.lineNo}  \n Added: ${added} new card items, removed \
        ${removed}  card items.`;
        console.debug(msg);
        if (notice) {
            MiscUtils.notice(msg);
        }
        return { added, removed };
    }

    async verifyItems() {
        const items = this.data.items;
        await Promise.all(
            items.map(async (item, _idx) => {
                if (item != null && item.isTracked) {
                    // console.debug("verifyItems:", item, id);
                    const itemType = !this.isCardItem(item.ID) ? RPITEMTYPE.NOTE : RPITEMTYPE.CARD;
                    this._updateItem(item.ID, item.fileIndex, itemType, item.deckName);
                }
            }),
        );
        MiscUtils.notice("all items have been updated.");
    }

    updateReviewedCounts(id: number, type: RPITEMTYPE = RPITEMTYPE.NOTE) {
        let rc = this.data.reviewedCounts;
        if (type === RPITEMTYPE.NOTE) {
            rc = this.data.reviewedCounts;
        } else {
            rc = this.data.reviewedCardCounts;
        }
        // const date = new Date().toLocaleDateString();
        const date = window.moment(new Date()).format("YYYY-MM-DD");
        if (!(date in rc)) {
            rc[date] = { due: 0, new: 0 };
        }
        const item = this.getItembyID(id);
        if (item.isDue) {
            if (this.settings.algorithm === algorithmNames.Fsrs) {
                const data: FsrsData = item.data as FsrsData;
                if (new Date(data.last_review) < new Date(date)) {
                    rc[date].due++;
                }
            } else {
                const data: AnkiData = item.data as AnkiData;
                if (data.lastInterval >= 1) {
                    rc[date].due++;
                }
            }
        } else {
            rc[date].new++;
            console.debug("new:", rc[date].new);
        }
    }

    findMovedFile(path: string): string {
        const pathArr = path.split("/");
        const name = pathArr.last().replace(".md", "");
        const notes: TFile[] = Iadapter.instance.vault.getMarkdownFiles();
        const result: string[] = [];
        notes.some((note: TFile) => {
            if (note.basename.includes(name) || name.includes(note.basename)) {
                result.push(note.path);
            }
        });
        if (result.length > 0) {
            console.debug("find file: %s has been moved. %d", path, result.length);
            return result[0];
        }
        return null;
    }

    updateMovedFile(trackedFile: TrackedFile): boolean {
        const newpath = this.findMovedFile(trackedFile.path);
        if (newpath !== null) {
            trackedFile.rename(newpath);
            return true;
        }
        return false;
    }

    /**
     * Verify that the file of this item still exists.
     *
     * @param {string}path
     */
    async verify(path: string): Promise<boolean> {
        const adapter = Iadapter.instance.adapter;
        if (path != null) {
            return await adapter.exists(path).catch((_reason) => {
                console.error("Unable to verify file: ", path);
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
        const tracked_files = this.data.trackedFiles;
        let removedItems = this.itemSize;
        let removedtkfiles = tracked_files.length;

        this.data = MiscUtils.assignOnly(DEFAULT_SRS_DATA, this.data);

        this.data.trackedFiles = this.data.trackedFiles.filter((tkfile, _idx) => {
            if (tkfile == null || !tkfile.isTracked) {
                return false;
            }
            return this.getItems(tkfile.itemIDs).filter((item) => item?.isTracked).length > 0; // this tkfile has tracked items
        });

        this.data.items = this.data.trackedFiles
            .map((tkfile, idx) => {
                return this.getItems(tkfile.itemIDs)
                    .filter((item) => item != null) //dont have to tkfile already have filtered.
                    .filter((item) => {
                        item.fileIndex = idx;
                        return true;
                    });
            })
            .flat();

        removedtkfiles = removedtkfiles - this.data.trackedFiles.length;
        removedItems = removedItems - this.itemSize;
        this.data.queues.clearQueue();
        this.save();

        console.log(
            "removed " +
                removedtkfiles +
                " nullTrackedfile(s), removed " +
                removedItems +
                " nullitem(s).",
        );
        return;
    }

    getItemByPath(path: string): RepetitionItem | null {
        // Find item by path in the store
        return this.data.items.find(item => (item as any).path === path) || null;
    }

    removeItem(item: RepetitionItem): void {
        // Remove item from the store
        const index = this.data.items.indexOf(item);
        if (index > -1) {
            this.data.items.splice(index, 1);
        }
        // Also remove from any queues
        Object.values(this.data.queues).forEach(queue => {
            queue.remove(item);
        });
    }
}
