import { Notice, Plugin, TAbstractFile, TFile, getAllTags, FrontMatterCache } from "obsidian";
import * as graph from "pagerank.js";

import { SRSettingTab, SRSettings, DEFAULT_SETTINGS, upgradeSettings } from "src/settings";
import { FlashcardModal } from "src/gui/flashcard-modal";
import { StatsModal } from "src/gui/stats-modal";
import { ReviewQueueListView, REVIEW_QUEUE_VIEW_TYPE } from "src/gui/sidebar";
import { ReviewResponse, schedule } from "src/scheduling";
import { YAML_FRONT_MATTER_REGEX, SCHEDULING_INFO_REGEX } from "src/constants";
import { ReviewDeck, SchedNote } from "src/ReviewDeck";
import { t } from "src/lang/helpers";
import { appIcon } from "src/icons/appicon";
import { TopicPath } from "./TopicPath";
import { CardListType, Deck, DeckTreeFilter } from "./Deck";
import { Stats } from "./stats";
import {
    FlashcardReviewMode,
    FlashcardReviewSequencer as FlashcardReviewSequencer,
    IFlashcardReviewSequencer as IFlashcardReviewSequencer,
} from "./FlashcardReviewSequencer";
import {
    CardOrder,
    DeckTreeIterator,
    IDeckTreeIterator,
    IIteratorOrder,
    IteratorDeckSource,
    DeckOrder,
} from "./DeckTreeIterator";
import { CardScheduleCalculator } from "./CardSchedule";
import { Note } from "./Note";
import { NoteFileLoader } from "./NoteFileLoader";
import { ISRFile, SrTFile as SrTFile } from "./SRFile";
import { NoteEaseCalculator } from "./NoteEaseCalculator";
import { DeckTreeStatsCalculator } from "./DeckTreeStatsCalculator";
import { NoteEaseList } from "./NoteEaseList";
import { QuestionPostponementList } from "./QuestionPostponementList";

// https://github.com/martin-jw/obsidian-recall
import { DataStore } from "./dataStore/data";
import Commands from "./commands";
import { SrsAlgorithm, algorithmNames } from "src/algorithms/algorithms";

import { reviewResponseModal } from "src/gui/reviewresponse-modal";
import {
    DateUtils,
    debug,
    isVersionNewerThanOther,
    logExecutionTime,
    isIgnoredPath,
} from "./util/utils_recall";
import { ReleaseNotes } from "src/gui/ReleaseNotes";

import { algorithms } from "src/algorithms/algorithms_switch";
import { DataLocation } from "./dataStore/dataLocation";
import { addFileMenuEvt, registerTrackFileEvents } from "./Events/trackFileEvents";
import { ReviewNote } from "src/reviewNote/review-note";
import { Tags } from "./tags";
import { ItemToDecks } from "./dataStore/itemToDecks";
import { LinkRank } from "src/algorithms/priorities/linkPageranks";
import { Queue } from "./dataStore/queue";
import { ReviewDeckSelectionModal } from "./gui/reviewDeckSelectionModal";
import { setDueDates } from "./algorithms/balance/balance";

interface PluginData {
    settings: SRSettings;
    buryDate: string;
    // hashes of card texts
    // should work as long as user doesn't modify card's text
    // which covers most of the cases
    buryList: string[];
    historyDeck: string | null;
}

const DEFAULT_DATA: PluginData = {
    settings: DEFAULT_SETTINGS,
    buryDate: "",
    buryList: [],
    historyDeck: null,
};

// export interface SchedNote {
//     note: TFile;
//     dueUnix: number;
// }

// export interface LinkStat {
//     sourcePath: string;
//     linkCount: number;
// }

export default class SRPlugin extends Plugin {
    private statusBar: HTMLElement;
    private reviewQueueView: ReviewQueueListView;
    public data: PluginData;
    public syncLock = false;

    public reviewDecks: { [deckKey: string]: ReviewDeck } = {};
    public lastSelectedReviewDeck: string;

    public easeByPath: NoteEaseList;
    private questionPostponementList: QuestionPostponementList;
    // public incomingLinks: Record<string, LinkStat[]> = {}; // del, has linkRank
    // public pageranks: Record<string, number> = {}; // del, has linkRank
    private linkRank: LinkRank;
    private dueNotesCount = 0; // del , has noteStats
    public dueDatesNotes: Record<number, number> = {}; // Record<# of days in future, due count>

    public deckTree: Deck = new Deck("root", null);
    private remainingDeckTree: Deck;
    public cardStats: Stats;
    public noteStats: Stats;

    // https://github.com/martin-jw/obsidian-recall/blob/main/src/main.ts
    public store: DataStore;
    public commands: Commands;
    public algorithm: SrsAlgorithm;
    public reviewFloatBar: reviewResponseModal;
    public settingTab: SRSettingTab;

    public clock_start: number;

    async onload(): Promise<void> {
        await this.loadPluginData();
        this.easeByPath = new NoteEaseList(this.data.settings);
        this.questionPostponementList = new QuestionPostponementList(
            this,
            this.data.settings,
            this.data.buryList,
        );

        appIcon();

        const PLUGIN_VERSION = this.manifest.version;
        const obsidianJustInstalled = this.data.settings.previousRelease === "0.0.0";
        if (isVersionNewerThanOther(PLUGIN_VERSION, this.data.settings.previousRelease)) {
            new ReleaseNotes(this.app, this, obsidianJustInstalled ? null : PLUGIN_VERSION).open();
        }

        const settings = this.data.settings;
        this.algorithm = algorithms[settings.algorithm];
        this.algorithm.updateSettings(settings.algorithmSettings[settings.algorithm]);
        settings.algorithmSettings[settings.algorithm] = this.algorithm.settings;
        this.savePluginData();

        this.commands = new Commands(this);
        this.commands.addCommands();
        if (this.data.settings.showDebugMessages) {
            this.commands.addDebugCommands();
        }

        this.reviewFloatBar = new reviewResponseModal(settings);
        this.reviewFloatBar.submitCallback = (note, resp) => {
            this.saveReviewResponse(note, resp);
        };

        registerTrackFileEvents(this);

        // if (this.data.settings.dataLocation != DataLocation.SaveOnNoteFile) {
        //     this.registerInterval(window.setInterval(() => this.sync(), 5 * 60 * 1000));
        // }

        this.statusBar = this.addStatusBarItem();
        this.statusBar.classList.add("mod-clickable");
        this.statusBar.setAttribute("aria-label", t("OPEN_NOTE_FOR_REVIEW"));
        this.statusBar.setAttribute("aria-label-position", "top");
        this.statusBar.addEventListener("click", async () => {
            if (!this.syncLock) {
                await this.sync();
                this.reviewNextNoteModal();
            }
        });

        this.addRibbonIcon("SpacedRepIcon", t("REVIEW_CARDS"), async () => {
            if (!this.syncLock) {
                await this.sync();
                this.openFlashcardModal(
                    this.deckTree,
                    this.remainingDeckTree,
                    FlashcardReviewMode.Review,
                );
            }
        });

        if (!this.data.settings.disableFileMenuReviewOptions) {
            this.registerEvent(
                this.app.workspace.on("file-menu", (menu, fileish: TAbstractFile) => {
                    if (fileish instanceof TFile && fileish.extension === "md") {
                        const options = this.algorithm.srsOptions();
                        const algo = this.data.settings.algorithm;
                        const showtext = this.data.settings.responseOptionBtnsText;
                        for (let i = 1; i < options.length; i++) {
                            menu.addItem((item) => {
                                // item.setTitle(t("REVIEW_EASY_FILE_MENU"))
                                item.setTitle(
                                    t("REVIEW_DIFFICULTY_FILE_MENU", {
                                        difficulty: showtext[algo][i],
                                    }),
                                )
                                    .setIcon("SpacedRepIcon")
                                    .onClick(() => {
                                        this.saveReviewResponse(fileish, i);
                                    });
                            });
                        }
                    }

                    addFileMenuEvt(this, menu, fileish);
                }),
            );
        }

        this.addCommand({
            id: "srs-note-review-open-note",
            name: t("OPEN_NOTE_FOR_REVIEW"),
            callback: async () => {
                if (!this.syncLock) {
                    await this.sync();
                    this.reviewNextNoteModal();
                }
            },
        });

        const options = this.algorithm.srsOptions();
        const algo = this.data.settings.algorithm;
        const showtext = this.data.settings.responseOptionBtnsText;
        options.map((option, i) => {
            this.addCommand({
                id: "srs-note-review-" + option.toLowerCase(),
                name: t("REVIEW_NOTE_DIFFICULTY_CMD", {
                    difficulty: showtext[algo][i],
                }),
                callback: () => {
                    const openFile: TFile | null = this.app.workspace.getActiveFile();
                    if (openFile && openFile.extension === "md") {
                        this.saveReviewResponse(openFile, i);
                    }
                },
            });
        });

        this.addCommand({
            id: "srs-review-flashcards",
            name: t("REVIEW_ALL_CARDS"),
            callback: async () => {
                if (!this.syncLock) {
                    await this.sync();
                    this.openFlashcardModal(
                        this.deckTree,
                        this.remainingDeckTree,
                        FlashcardReviewMode.Review,
                    );
                }
            },
        });

        this.addCommand({
            id: "srs-cram-flashcards",
            name: t("CRAM_ALL_CARDS"),
            callback: async () => {
                await this.sync();
                this.openFlashcardModal(this.deckTree, this.deckTree, FlashcardReviewMode.Cram);
            },
        });

        this.addCommand({
            id: "srs-review-flashcards-in-note",
            name: t("REVIEW_CARDS_IN_NOTE"),
            callback: async () => {
                const openFile: TFile | null = this.app.workspace.getActiveFile();
                if (openFile && openFile.extension === "md") {
                    this.openFlashcardModalForSingleNote(openFile, FlashcardReviewMode.Review);
                }
            },
        });

        this.addCommand({
            id: "srs-cram-flashcards-in-note",
            name: t("CRAM_CARDS_IN_NOTE"),
            callback: async () => {
                const openFile: TFile | null = this.app.workspace.getActiveFile();
                if (openFile && openFile.extension === "md") {
                    this.openFlashcardModalForSingleNote(openFile, FlashcardReviewMode.Cram);
                }
            },
        });

        this.addCommand({
            id: "srs-view-stats",
            name: t("VIEW_STATS"),
            callback: async () => {
                if (!this.syncLock) {
                    await this.sync();
                    new StatsModal(this.app, this).open();
                }
            },
        });

        this.settingTab = new SRSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);

        this.app.workspace.onLayoutReady(() => {
            setTimeout(async () => {
                this.initView();
                if (!this.syncLock) {
                    await this.sync();
                }
            }, 3000);
        });
    }

    onunload(): void {
        console.log("Unloading Obsidian spaced repetition Recall. ...");
        this.app.workspace.getLeavesOfType(REVIEW_QUEUE_VIEW_TYPE).forEach((leaf) => leaf.detach());
        this.reviewFloatBar.selfDestruct();
    }

    private async openFlashcardModalForSingleNote(
        noteFile: TFile,
        reviewMode: FlashcardReviewMode,
    ): Promise<void> {
        const topicPath: TopicPath = this.findTopicPath(this.createSrTFile(noteFile));
        const note: Note = await this.loadNote(noteFile, topicPath);

        const deckTree = new Deck("root", null);
        note.appendCardsToDeck(deckTree);
        const remainingDeckTree = DeckTreeFilter.filterForRemainingCards(
            this.questionPostponementList,
            deckTree,
            reviewMode,
        );
        this.openFlashcardModal(deckTree, remainingDeckTree, reviewMode);
    }

    private openFlashcardModal(
        fullDeckTree: Deck,
        remainingDeckTree: Deck,
        reviewMode: FlashcardReviewMode,
    ): void {
        const deckIterator = SRPlugin.createDeckTreeIterator(this.data.settings);
        const cardScheduleCalculator = new CardScheduleCalculator(
            this.data.settings,
            this.easeByPath,
        );
        const reviewSequencer: IFlashcardReviewSequencer = new FlashcardReviewSequencer(
            reviewMode,
            deckIterator,
            this.data.settings,
            cardScheduleCalculator,
            this.questionPostponementList,
        );

        reviewSequencer.setDeckTree(fullDeckTree, remainingDeckTree);
        new FlashcardModal(this.app, this, this.data.settings, reviewSequencer, reviewMode).open();
    }

    private static createDeckTreeIterator(settings: SRSettings): IDeckTreeIterator {
        let cardOrder: CardOrder = CardOrder[settings.flashcardCardOrder as keyof typeof CardOrder];
        if (cardOrder === undefined) cardOrder = CardOrder.DueFirstSequential;
        let deckOrder: DeckOrder = DeckOrder[settings.flashcardDeckOrder as keyof typeof DeckOrder];
        if (deckOrder === undefined) deckOrder = DeckOrder.PrevDeckComplete_Sequential;
        console.log(`createDeckTreeIterator: CardOrder: ${cardOrder}, DeckOrder: ${deckOrder}`);

        const iteratorOrder: IIteratorOrder = {
            deckOrder,
            cardOrder,
        };
        return new DeckTreeIterator(iteratorOrder, IteratorDeckSource.UpdatedByIterator);
    }

    async sync(): Promise<void> {
        // this.clock_start = Date.now();
        const settings = this.data.settings;

        if (this.syncLock) {
            return;
        }
        this.syncLock = true;

        // reset notes stuff
        graph.reset();
        this.easeByPath = new NoteEaseList(this.data.settings);
        // this.incomingLinks = {};
        // this.pageranks = {};
        this.linkRank = new LinkRank(this.data.settings, this.app.metadataCache);
        this.reviewDecks = {};

        // reset flashcards stuff
        const fullDeckTree = new Deck("root", null);

        const now = window.moment(Date.now());
        const todayDate: string = now.format("YYYY-MM-DD");
        // clear bury list if we've changed dates
        if (todayDate !== this.data.buryDate) {
            this.data.buryDate = todayDate;
            this.questionPostponementList.clear();

            // The following isn't needed for plug-in functionality; but can aid during debugging
            await this.savePluginData();
        }

        let notes: TFile[] = this.app.vault.getMarkdownFiles();
        notes = notes.filter(
            (noteFile) => !isIgnoredPath(this.data.settings.noteFoldersToIgnore, noteFile.path),
        );
        this.linkRank.readLinks(notes);
        await Promise.all(
            notes.map(async (noteFile) => {
                const topicPath: TopicPath = this.findTopicPath(this.createSrTFile(noteFile));
                if (topicPath.hasPath) {
                    const note: Note = await this.loadNote(noteFile, topicPath);
                    const flashcardsInNoteAvgEase: number = NoteEaseCalculator.Calculate(
                        note,
                        this.data.settings,
                    );
                    note.appendCardsToDeck(fullDeckTree);

                    if (flashcardsInNoteAvgEase > 0) {
                        this.easeByPath.setEaseForPath(note.filePath, flashcardsInNoteAvgEase);
                    }
                }
            }),
        );
        if (settings.dataLocation != DataLocation.SaveOnNoteFile) {
            await this.sync_trackfiles(notes);
            // this.getTimeDuration(this.sync.name);
        } else {
            this.sync_onNote(notes);
        }

        // Reviewable cards are all except those with the "edit later" tag
        this.deckTree = DeckTreeFilter.filterForReviewableCards(fullDeckTree);

        // sort the deck names
        this.deckTree.sortSubdecksList();
        this.remainingDeckTree = DeckTreeFilter.filterForRemainingCards(
            this.questionPostponementList,
            this.deckTree,
            FlashcardReviewMode.Review,
        );
        const calc: DeckTreeStatsCalculator = new DeckTreeStatsCalculator();
        this.cardStats = calc.calculate(this.deckTree);

        if (this.data.settings.showDebugMessages) {
            this.showSyncInfo();
        }

        if (this.data.settings.showDebugMessages) {
            console.log(
                "SR: " +
                    t("SYNC_TIME_TAKEN", {
                        t: Date.now() - now.valueOf(),
                    }),
            );
        }

        this.updateAndSortDueNotes();

        this.syncLock = false;
    }

    private sync_onNote(notes: TFile[]) {
        notes.map((noteFile) => {
            const fileCachedData = this.app.metadataCache.getFileCache(noteFile) || {};

            const frontmatter: FrontMatterCache | Record<string, unknown> =
                fileCachedData.frontmatter || {};
            const tags = getAllTags(fileCachedData) || [];

            let shouldIgnore = true;
            const matchedNoteTags = [];

            for (const tagToReview of this.data.settings.tagsToReview) {
                if (tags.some((tag) => tag === tagToReview || tag.startsWith(tagToReview + "/"))) {
                    if (!Object.prototype.hasOwnProperty.call(this.reviewDecks, tagToReview)) {
                        this.reviewDecks[tagToReview] = new ReviewDeck(tagToReview);
                    }
                    matchedNoteTags.push(tagToReview);
                    shouldIgnore = false;
                    break;
                }
            }
            if (shouldIgnore) {
                return;
            }

            // file has no scheduling information
            if (
                !(
                    Object.prototype.hasOwnProperty.call(frontmatter, "sr-due") &&
                    Object.prototype.hasOwnProperty.call(frontmatter, "sr-interval") &&
                    Object.prototype.hasOwnProperty.call(frontmatter, "sr-ease")
                )
            ) {
                for (const matchedNoteTag of matchedNoteTags) {
                    this.reviewDecks[matchedNoteTag].newNotes.push({ note: noteFile });
                }
                return;
            }

            const dueUnix: number = window
                .moment(frontmatter["sr-due"], ["YYYY-MM-DD", "DD-MM-YYYY", "ddd MMM DD YYYY"])
                .valueOf();

            const ease: number = frontmatter["sr-ease"];
            this.easeByPath.setEaseForPath(noteFile.path, ease);

            const interval = Number(frontmatter["sr-interval"]);

            for (const matchedNoteTag of matchedNoteTags) {
                this.reviewDecks[matchedNoteTag].scheduledNotes.push({
                    note: noteFile,
                    dueUnix,
                    interval,
                    ease,
                });
            }
        });
    }

    private updateAndSortDueNotes() {
        this.dueNotesCount = 0;
        this.dueDatesNotes = {};
        this.noteStats = new Stats();

        const now = window.moment(Date.now());
        Object.values(this.reviewDecks).forEach((reviewDeck: ReviewDeck) => {
            reviewDeck.dueNotesCount = 0;
            reviewDeck.scheduledNotes.forEach((scheduledNote: SchedNote) => {
                if (scheduledNote.dueUnix <= now.valueOf()) {
                    reviewDeck.dueNotesCount++;
                    this.dueNotesCount++;
                }

                const nDays: number = Math.ceil(
                    (scheduledNote.dueUnix - now.valueOf()) / (24 * 3600 * 1000),
                );
                if (!Object.prototype.hasOwnProperty.call(this.dueDatesNotes, nDays)) {
                    this.dueDatesNotes[nDays] = 0;
                }
                this.dueDatesNotes[nDays]++;
                this.noteStats.update(nDays, scheduledNote.interval, scheduledNote.ease);
            });
            this.noteStats.newCount += reviewDeck.newNotes.length;

            reviewDeck.sortNotes(this.linkRank.pageranks);
        });

        setDueDates(this.noteStats.delayedDays.dict, this.cardStats.delayedDays.dict);

        this.updateStatusBar();

        if (this.data.settings.enableNoteReviewPaneOnStartup) this.reviewQueueView.redraw();
    }

    private getTimeDuration(fname: string) {
        const tdur = Date.now() - this.clock_start;
        const msg = `${fname} time duration: ${tdur}`;
        debug(fname, undefined, { msg });
    }

    // @logExecutionTime()
    async sync_trackfiles(notes: TFile[]): Promise<void> {
        // const settings = this.data.settings;
        const store = this.store;
        store.data.queues.buildQueue();

        // check trackfile
        await store.reLoad();

        ItemToDecks.create(this.data.settings).itemToReviewDecks(
            this.reviewDecks,
            notes,
            this.easeByPath,
        );
    }

    async loadNote(noteFile: TFile, topicPath: TopicPath): Promise<Note> {
        const loader: NoteFileLoader = new NoteFileLoader(this.data.settings);
        const note: Note = await loader.load(this.createSrTFile(noteFile), topicPath);
        ItemToDecks.updateCardsSchedbyItems(note, topicPath);
        if (note.hasChanged) note.writeNoteFile(this.data.settings);
        return note;
    }

    async saveReviewResponse(note: TFile, response: ReviewResponse): Promise<void> {
        const settings = this.data.settings;
        if (isIgnoredPath(settings.noteFoldersToIgnore, note.path)) {
            new Notice(t("NOTE_IN_IGNORED_FOLDER"));
            return;
        }
        let result: { sNote: SchedNote; buryList?: string[] };
        let ease = this.getLinkedEase(note);

        if (settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            let deckName = Tags.getNoteDeckName(note, settings);
            if (deckName == null && !this.store.getTrackedFile(note.path)?.isTrackedNote) {
                new Notice(t("PLEASE_TAG_NOTE"));
                return;
            }
            if (deckName == null) {
                deckName = this.store.getTrackedFile(note.path).lastTag;
            }
            if (deckName == null) return;
            const opt = this.algorithm.srsOptions()[response];

            result = ReviewNote.saveReviewResponse_trackfiles(
                note,
                opt,
                settings.burySiblingCards,
                ease,
            );
            if (settings.burySiblingCards) {
                this.data.buryList.push(...result.buryList);
                await this.savePluginData();
            }
        } else {
            // let ease = this.linkRank.getContribution(note, this.easeByPath).ease;
            ease = Math.round(ease);
            result = await this.saveReviewResponse_onNote(note, response, ease);
            this.easeByPath.setEaseForPath(note.path, ease);
        }
        // Update note's properties to update our due notes.
        this.postponeResponse(note, result.sNote);
    }

    async saveReviewResponse_onNote(note: TFile, response: ReviewResponse, ease: number) {
        const fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        const frontmatter: FrontMatterCache | Record<string, unknown> =
            fileCachedData.frontmatter || {};

        const tags = getAllTags(fileCachedData) || [];
        let shouldIgnore = true;
        for (const tag of tags) {
            if (
                this.data.settings.tagsToReview.some(
                    (tagToReview) => tag === tagToReview || tag.startsWith(tagToReview + "/"),
                )
            ) {
                shouldIgnore = false;
                break;
            }
        }

        if (shouldIgnore) {
            new Notice(t("PLEASE_TAG_NOTE"));
            return;
        }

        let fileText: string = await this.app.vault.read(note);
        let interval: number, delayBeforeReview: number;
        const now: number = Date.now();
        // new note
        if (
            !(
                Object.prototype.hasOwnProperty.call(frontmatter, "sr-due") &&
                Object.prototype.hasOwnProperty.call(frontmatter, "sr-interval") &&
                Object.prototype.hasOwnProperty.call(frontmatter, "sr-ease")
            )
        ) {
            // ease = this.linkRank.getContribution(note, this.easeByPath).ease;
            ease = Math.round(ease);
            interval = 1.0;
            delayBeforeReview = 0;
        } else {
            interval = frontmatter["sr-interval"];
            ease = frontmatter["sr-ease"];
            delayBeforeReview =
                now -
                window
                    .moment(frontmatter["sr-due"], ["YYYY-MM-DD", "DD-MM-YYYY", "ddd MMM DD YYYY"])
                    .valueOf();
        }

        const schedObj: Record<string, number> = schedule(
            response,
            interval,
            ease,
            delayBeforeReview,
            this.data.settings,
            this.dueDatesNotes,
        );
        interval = schedObj.interval;
        ease = schedObj.ease;

        const due = window.moment(now + interval * 24 * 3600 * 1000);
        const dueString: string = due.format("YYYY-MM-DD");

        // check if scheduling info exists
        if (SCHEDULING_INFO_REGEX.test(fileText)) {
            const schedulingInfo = SCHEDULING_INFO_REGEX.exec(fileText);
            fileText = fileText.replace(
                SCHEDULING_INFO_REGEX,
                `---\n${schedulingInfo[1]}sr-due: ${dueString}\n` +
                    `sr-interval: ${interval}\nsr-ease: ${ease}\n` +
                    `${schedulingInfo[5]}---\n`,
            );
        } else if (YAML_FRONT_MATTER_REGEX.test(fileText)) {
            // new note with existing YAML front matter
            const existingYaml = YAML_FRONT_MATTER_REGEX.exec(fileText);
            fileText = fileText.replace(
                YAML_FRONT_MATTER_REGEX,
                `---\n${existingYaml[1]}sr-due: ${dueString}\n` +
                    `sr-interval: ${interval}\nsr-ease: ${ease}\n---`,
            );
        } else {
            fileText =
                `---\nsr-due: ${dueString}\nsr-interval: ${interval}\n` +
                `sr-ease: ${ease}\n---\n\n${fileText}`;
        }

        await this.app.vault.modify(note, fileText);

        if (this.data.settings.burySiblingCards) {
            const topicPath: TopicPath = this.findTopicPath(this.createSrTFile(note));
            const noteX: Note = await this.loadNote(note, topicPath);
            for (const question of noteX.questionList) {
                this.data.buryList.push(question.questionText.textHash);
            }
            await this.savePluginData();
        }

        return { sNote: { note, dueUnix: due.valueOf() } };
    }

    private postponeResponse(note: TFile, sNote: SchedNote) {
        Object.values(this.reviewDecks).forEach((reviewDeck: ReviewDeck) => {
            let wasDueInDeck = false;
            reviewDeck.scheduledNotes.findIndex((newNote, ind) => {
                if (newNote.note.path === note.path) {
                    reviewDeck.scheduledNotes[ind] = sNote;
                    wasDueInDeck = true;
                    return true;
                }
            });

            // It was a new note, remove it from the new notes and schedule it.
            if (!wasDueInDeck) {
                reviewDeck.newNotes.splice(
                    reviewDeck.newNotes.findIndex((newNote) => newNote.note.path === note.path),
                    1,
                );
                reviewDeck.scheduledNotes.push(sNote);
            }
        });

        this.updateAndSortDueNotes();

        new Notice(t("RESPONSE_RECEIVED"));

        if (this.data.settings.autoNextNote) {
            if (!this.lastSelectedReviewDeck) {
                const reviewDeckKeys: string[] = Object.keys(this.reviewDecks);
                if (reviewDeckKeys.length > 0) this.lastSelectedReviewDeck = reviewDeckKeys[0];
                else {
                    new Notice(t("ALL_CAUGHT_UP"));
                    return;
                }
            }
            this.reviewNextNote(this.lastSelectedReviewDeck);
        }
    }

    async reviewNextNoteModal(): Promise<void> {
        const reviewDeckNames: string[] = Object.keys(this.reviewDecks);
        if (reviewDeckNames.length === 1) {
            this.reviewNextNote(reviewDeckNames[0]);
        } else if (this.data.settings.reviewingNoteDirectly) {
            const rdname =
                this.lastSelectedReviewDeck ??
                ReviewNote.getDeckNameForReviewDirectly(this.reviewDecks) ??
                reviewDeckNames[0];
            this.reviewNextNote(rdname);
        } else {
            const deckSelectionModal = new ReviewDeckSelectionModal(this.app, reviewDeckNames);
            deckSelectionModal.submitCallback = (deckKey: string) => this.reviewNextNote(deckKey);
            deckSelectionModal.open();
        }
    }

    async reviewNextNote(deckKey: string): Promise<void> {
        if (!Object.prototype.hasOwnProperty.call(this.reviewDecks, deckKey)) {
            new Notice(t("NO_DECK_EXISTS", { deckName: deckKey }));
            return;
        }

        this.lastSelectedReviewDeck = deckKey;
        const deck = this.reviewDecks[deckKey];
        const queue = this.store.data.queues;
        let show = false;
        let item;
        let index = -1;

        index = ReviewNote.getNextDueNoteIndex(
            deck.dueNotesCount,
            this.data.settings.openRandomNote,
        );
        if (index >= 0) {
            await this.app.workspace.getLeaf().openFile(deck.scheduledNotes[index].note);
            item = deck.scheduledNotes[index].item;
            show = true;
            // return;
        } else if (queue.queueSize(deckKey) > 0) {
            item = this.store.getNext(deckKey);
            const path = this.store.getFilePath(item);
            const note = this.app.vault.getAbstractFileByPath(path) as TFile;
            if (item != null && item.isTracked && path != null && note instanceof TFile) {
                // debug("nextNote inside que");
                await this.app.workspace.getLeaf().openFile(note);
                show = true;
            } else {
                queue.remove(item, queue.queue[deckKey]);
            }
        } else if (deck.newNotes.length > 0) {
            const index = this.data.settings.openRandomNote
                ? Math.floor(Math.random() * deck.newNotes.length)
                : 0;
            await this.app.workspace.getLeaf().openFile(deck.newNotes[index].note);
            item = deck.newNotes[index].item;
            show = true;
            // return;
        }
        if (show) {
            if (this.data.settings.dataLocation !== DataLocation.SaveOnNoteFile) {
                const calcDueCnt = deck.scheduledNotes.filter(
                    (snote) => snote.dueUnix < Date.now(),
                ).length;
                if (calcDueCnt !== deck.dueNotesCount) {
                    debug(
                        "check cnt",
                        0,
                        deck,
                        `${deck.deckName} due cnt error: calc ${calcDueCnt}, dnc: ${deck.dueNotesCount}`,
                    );
                }
                this.reviewFloatBar.display(item);
                if (
                    item.nextReview > Date.now() &&
                    !Object.keys(this.store.data.queues.toDayLatterQueue).includes(
                        item.ID.toString(),
                    )
                ) {
                    const id = "obsidian-spaced-repetition-recall:view-item-info";
                    // eslint-disable-next-line
                    // @ts-ignore
                    this.app.commands.executeCommandById(id);
                }
            }
            // this.getTimeDuration("reviewNextNote");
            return;
        }

        // add repeat items to review.
        // this.store.loadRepeatQueue(this.reviewDecks);
        await this.sync();

        if (
            this.data.settings.reviewingNoteDirectly &&
            this.noteStats.onDueCount + this.noteStats.newCount > 0
        ) {
            const rdname: string = ReviewNote.getDeckNameForReviewDirectly(this.reviewDecks);
            if (rdname != undefined) {
                this.reviewNextNote(rdname);
                return;
            }
        }

        ReviewNote.nextReviewNotice(Queue.getInstance().toDayLatterQueue);

        this.reviewFloatBar.selfDestruct();
        this.reviewQueueView.redraw();
        new Notice(t("ALL_CAUGHT_UP"));
    }

    createSrTFile(note: TFile): SrTFile {
        return new SrTFile(this.app.vault, this.app.metadataCache, note);
    }

    findTopicPath(note: ISRFile): TopicPath {
        return TopicPath.getTopicPathOfFile(note, this.data.settings, this.store);
    }

    async loadPluginData(): Promise<void> {
        const loadedData: PluginData = await this.loadData();
        if (loadedData?.settings) upgradeSettings(loadedData.settings);
        this.data = Object.assign({}, DEFAULT_DATA, loadedData);
        this.data.settings = Object.assign({}, DEFAULT_SETTINGS, this.data.settings);
        this.store = new DataStore(this.data.settings, this.manifest.dir);
        await this.store.load();
    }

    async savePluginData(): Promise<void> {
        await this.saveData(this.data);
    }

    async initView(): Promise<void> {
        this.registerView(
            REVIEW_QUEUE_VIEW_TYPE,
            (leaf) => (this.reviewQueueView = new ReviewQueueListView(leaf, this)),
        );

        if (
            this.data.settings.enableNoteReviewPaneOnStartup &&
            this.app.workspace.getLeavesOfType(REVIEW_QUEUE_VIEW_TYPE).length == 0
        ) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: REVIEW_QUEUE_VIEW_TYPE,
                active: true,
            });
            this.reviewQueueView = this.app.workspace.getActiveViewOfType(ReviewQueueListView);
        }
    }

    showSyncInfo() {
        console.log(`SR: ${t("EASES")}`, this.easeByPath);
        console.log(`SR: ${t("DECKS")}`, this.deckTree);
        console.log(`SR: NOTE ${t("DECKS")}`, this.reviewDecks);
        console.log("SR: cardStats ", this.cardStats);
        console.log("SR: noteStats ", this.noteStats);
        console.log("SR: this.dueDatesNotes", this.dueDatesNotes);
    }

    updateStatusBar() {
        this.statusBar.setText(
            t("STATUS_BAR", {
                dueNotesCount: this.noteStats.onDueCount + this.store.data.queues.todaylatterSize(),
                dueFlashcardsCount: this.remainingDeckTree.getCardCount(CardListType.All, true),
            }),
        );
    }

    getLinkedEase(note: TFile) {
        const settings = this.data.settings;
        if (
            settings.algorithm === algorithmNames.Anki ||
            settings.algorithm === algorithmNames.Default ||
            settings.algorithm === algorithmNames.SM2
        ) {
            const ease = this.linkRank.getContribution(note, this.easeByPath).ease;
            return ease;
        }
    }
}
