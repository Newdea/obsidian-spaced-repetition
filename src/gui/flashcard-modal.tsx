import { Modal, App, Notice, Platform, setIcon, MarkdownView, TFile } from "obsidian";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import h from "vhtml";

import type SRPlugin from "src/main";
import { SRSettings } from "src/settings";
import { textInterval, ReviewResponse } from "src/scheduling";
import { COLLAPSE_ICON } from "src/constants";
import { t } from "src/lang/helpers";
import { Card } from "../Card";
import { CardListType, Deck } from "../Deck";
import { CardType, Question } from "../Question";
import {
    DeckStats,
    FlashcardReviewMode,
    IFlashcardReviewSequencer as IFlashcardReviewSequencer,
} from "src/FlashcardReviewSequencer";
import { FlashcardEditModal } from "./flashcards-edit-modal";
import { Note } from "src/Note";
import { RenderMarkdownWrapper } from "src/util/RenderMarkdownWrapper";
import { CardScheduleInfo } from "src/CardSchedule";
import { TopicPath } from "src/TopicPath";
import { DataLocation } from "src/dataStore/dataLocation";
import { SrTFile } from "src/SRFile";
import { RepetitionItem, RPITEMTYPE } from "src/dataStore/repetitionItem";
import { debug } from "src/util/utils_recall";
import { ItemInfoModal } from "./info";
import { setDueDates } from "src/algorithms/balance/balance";

export enum FlashcardModalMode {
    DecksList,
    Front,
    Back,
    Closed,
}

export class FlashcardModal extends Modal {
    public plugin: SRPlugin;
    public answerBtn: HTMLElement;
    public flashcardView: HTMLElement;
    private flashCardMenu: HTMLDivElement;
    public responseBtns: HTMLElement[];
    public hardBtn: HTMLElement;
    public goodBtn: HTMLElement;
    public easyBtn: HTMLElement;
    public nextBtn: HTMLElement;
    public responseDiv: HTMLElement;
    public resetButton: HTMLButtonElement;
    public openNoteFileButton: HTMLElement;
    public editButton: HTMLElement;
    public contextView: HTMLElement;
    public mode: FlashcardModalMode;
    private reviewSequencer: IFlashcardReviewSequencer;
    private settings: SRSettings;
    private reviewMode: FlashcardReviewMode;

    public cardItem: RepetitionItem;
    public options: string[];

    private get currentCard(): Card {
        return this.reviewSequencer.currentCard;
    }

    private get currentQuestion(): Question {
        return this.reviewSequencer.currentQuestion;
    }

    private get currentNote(): Note {
        return this.reviewSequencer.currentNote;
    }

    constructor(
        app: App,
        plugin: SRPlugin,
        settings: SRSettings,
        reviewSequencer: IFlashcardReviewSequencer,
        reviewMode: FlashcardReviewMode,
    ) {
        super(app);

        this.plugin = plugin;
        this.options = this.plugin.algorithm.srsOptions();
        this.settings = settings;
        this.reviewSequencer = reviewSequencer;
        this.reviewMode = reviewMode;

        this.titleEl.setText(t("DECKS"));
        this.titleEl.addClass("sr-centered");

        if (Platform.isMobile) {
            this.contentEl.style.display = "block";
        }
        this.modalEl.style.position = "relative";
        this.modalEl.style.height = this.settings.flashcardHeightPercentage + "%";
        this.modalEl.style.width = this.settings.flashcardWidthPercentage + "%";

        this.contentEl.style.position = "relative";
        this.contentEl.style.height = "92%";
        this.contentEl.addClass("sr-modal-content");

        // TODO: refactor into event handler?
        document.body.onkeydown = (e) => {
            // TODO: Please fix this. It's ugly.
            // Checks if the input textbox is in focus before processing keyboard shortcuts.
            if (
                document.activeElement.nodeName !== "TEXTAREA" &&
                this.mode !== FlashcardModalMode.DecksList
            ) {
                const consume = () => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                if (this.mode !== FlashcardModalMode.Closed && e.code === "KeyS") {
                    this.skipCurrentCard();
                    consume();
                } else if (
                    this.mode === FlashcardModalMode.Front &&
                    (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter")
                ) {
                    this.showAnswer();
                    consume();
                } else if (this.mode === FlashcardModalMode.Back) {
                    if (e.code === "Numpad1" || e.code === "Digit1") {
                        this.processReview(ReviewResponse.Hard);
                        consume();
                    } else if (e.code === "Numpad2" || e.code === "Digit2" || e.code === "Space") {
                        this.processReview(ReviewResponse.Good);
                        consume();
                    } else if (e.code === "Numpad3" || e.code === "Digit3") {
                        this.processReview(ReviewResponse.Easy);
                        consume();
                    } else if (e.code === "Numpad0" || e.code === "Digit0") {
                        this.processReview(ReviewResponse.Reset);
                        consume();
                    }
                }
            }
        };
    }

    onOpen(): void {
        this.renderDecksList();
    }

    onClose(): void {
        this.mode = FlashcardModalMode.Closed;
    }

    renderDecksList(): void {
        this.mode = FlashcardModalMode.DecksList;
        const stats: DeckStats = this.reviewSequencer.getDeckStats(TopicPath.emptyPath);
        this.titleEl.setText(t("DECKS"));
        this.titleEl.innerHTML += (
            <p style="margin:0px;line-height:12px;">
                <span
                    style="background-color:#4caf50;color:#ffffff;"
                    aria-label={t("DUE_CARDS")}
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {stats.dueCount.toString()}
                </span>
                <span
                    style="background-color:#2196f3;"
                    aria-label={t("NEW_CARDS")}
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {stats.newCount.toString()}
                </span>
                <span
                    style="background-color:#ff7043;"
                    aria-label={t("TOTAL_CARDS")}
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {stats.totalCount.toString()}
                </span>
            </p>
        );
        this.contentEl.empty();
        this.contentEl.setAttribute("id", "sr-flashcard-view");

        for (const deck of this.reviewSequencer.originalDeckTree.subdecks) {
            this.renderDeck(deck, this.contentEl, this);
        }
    }

    renderDeck(deck: Deck, containerEl: HTMLElement, modal: FlashcardModal): void {
        const deckView: HTMLElement = containerEl.createDiv("tree-item");

        const deckViewSelf: HTMLElement = deckView.createDiv(
            "tree-item-self tag-pane-tag is-clickable",
        );
        const shouldBeInitiallyExpanded: boolean = modal.settings.initiallyExpandAllSubdecksInTree;
        let collapsed = !shouldBeInitiallyExpanded;
        let collapseIconEl: HTMLElement | null = null;
        if (deck.subdecks.length > 0) {
            collapseIconEl = deckViewSelf.createDiv("tree-item-icon collapse-icon");
            collapseIconEl.innerHTML = COLLAPSE_ICON;
            (collapseIconEl.childNodes[0] as HTMLElement).style.transform = collapsed
                ? "rotate(-90deg)"
                : "";
        }

        const deckViewInner: HTMLElement = deckViewSelf.createDiv("tree-item-inner");
        const deckViewInnerText: HTMLElement = deckViewInner.createDiv("tag-pane-tag-text");
        deckViewInnerText.innerHTML += <span class="tag-pane-tag-self">{deck.deckName}</span>;
        const deckViewOuter: HTMLElement = deckViewSelf.createDiv("tree-item-flair-outer");
        const deckStats = this.reviewSequencer.getDeckStats(deck.getTopicPath());
        deckViewOuter.innerHTML += (
            <span>
                <span
                    style="background-color:#4caf50;"
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {deckStats.dueCount.toString()}
                </span>
                <span
                    style="background-color:#2196f3;"
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {deckStats.newCount.toString()}
                </span>
                <span
                    style="background-color:#ff7043;"
                    class="tag-pane-tag-count tree-item-flair sr-deck-counts"
                >
                    {deckStats.totalCount.toString()}
                </span>
            </span>
        );

        const deckViewChildren: HTMLElement = deckView.createDiv("tree-item-children");
        deckViewChildren.style.display = collapsed ? "none" : "block";
        if (deck.subdecks.length > 0) {
            collapseIconEl.addEventListener("click", (e) => {
                if (collapsed) {
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform = "";
                    deckViewChildren.style.display = "block";
                } else {
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform =
                        "rotate(-90deg)";
                    deckViewChildren.style.display = "none";
                }

                // We stop the propagation of the event so that the click event for deckViewSelf doesn't get called
                // if the user clicks on the collapse icon
                e.stopPropagation();
                collapsed = !collapsed;
            });
        }

        // Add the click handler to deckViewSelf instead of deckViewInner so that it activates
        // over the entire rectangle of the tree item, not just the text of the topic name
        // https://github.com/st3v3nmw/obsidian-spaced-repetition/issues/709
        deckViewSelf.addEventListener("click", () => {
            this.startReviewOfDeck(deck);
        });

        for (const subdeck of deck.subdecks) {
            this.renderDeck(subdeck, deckViewChildren, modal);
        }
    }

    startReviewOfDeck(deck: Deck) {
        this.reviewSequencer.setCurrentDeck(deck.getTopicPath());
        if (this.reviewSequencer.hasCurrentCard) {
            this.setupCardsView();
            this.showCurrentCard();
        } else this.renderDecksList();
    }

    setupCardsView(): void {
        this.contentEl.empty();

        this.flashCardMenu = this.contentEl.createDiv("sr-flashcard-menu");

        this.createBackButton();
        this.createOpenFileButton();
        this.createEditButton();
        this.createResetButton();
        this.createCardInfoButton();
        this.createSkipButton();

        if (this.settings.showContextInCards) {
            this.contextView = this.contentEl.createDiv();
            this.contextView.setAttribute("id", "sr-context");
        }

        this.flashcardView = this.contentEl.createDiv("div");
        this.flashcardView.setAttribute("id", "sr-flashcard-view");

        this.createResponseButtons();

        this.createShowAnswerButton();

        if (this.reviewMode == FlashcardReviewMode.Cram) {
            this.goodBtn.style.display = "none";
            for (let i = 2; i < this.responseBtns.length - 1; i++) {
                this.responseBtns[i].style.display = "none";
            }

            this.responseDiv.addClass("sr-ignorestats-response");
            this.easyBtn.addClass("sr-ignorestats-btn");
            this.hardBtn.addClass("sr-ignorestats-btn");
        }
    }

    createShowAnswerButton() {
        this.answerBtn = this.contentEl.createDiv();
        this.answerBtn.setAttribute("id", "sr-show-answer");
        this.answerBtn.setText(t("SHOW_ANSWER"));
        this.answerBtn.addEventListener("click", () => {
            this.showAnswer();
        });
    }

    createResponseButtons() {
        this.responseDiv = this.contentEl.createDiv("sr-flashcard-response");
        const optBtnCounts = this.plugin.algorithm.srsOptions().length;
        let btnCols = 4;
        if (!Platform.isMobile && optBtnCounts > btnCols) {
            btnCols = optBtnCounts;
        }
        this.responseDiv.setAttribute(
            "style",
            `grid-template-columns: ${"1fr ".repeat(btnCols - 1)}`,
        );

        for (let i = 1; i < this.options.length; i++) {
            this.responseBtns.push(document.createElement("button"));
            this.responseBtns[i].setAttribute("id", "sr-" + this.options[i].toLowerCase() + "-btn");
            this.responseBtns[i].setAttribute("class", "ResponseFloatBarCommandItem");
            this.responseBtns[i].setText(this.plugin.data.settings.flashcardHardText);
            this.responseBtns[i].addEventListener("click", () => {
                this.processReview(i);
            });
            this.responseDiv.appendChild(this.responseBtns[i]);
        }
        this.hardBtn = this.responseBtns[1];
        this.goodBtn = this.responseBtns.at(-2);
        this.easyBtn = this.responseBtns.last();

        this.responseDiv.style.display = "none";
    }

    createSkipButton() {
        const skipButton = this.flashCardMenu.createEl("button");
        skipButton.addClass("sr-flashcard-menu-item");
        setIcon(skipButton, "chevrons-right");
        skipButton.setAttribute("aria-label", t("SKIP"));
        skipButton.addEventListener("click", () => {
            this.skipCurrentCard();
        });
    }

    createCardInfoButton() {
        const cardInfo = this.flashCardMenu.createEl("button");
        cardInfo.addClass("sr-flashcard-menu-item");
        setIcon(cardInfo, "info");
        cardInfo.setAttribute("aria-label", "View Card Info");
        cardInfo.addEventListener("click", async () => {
            this.displayCurrentCardInfoNotice();
        });
    }

    displayCurrentCardInfoNotice() {
        const schedule = this.currentCard.scheduleInfo;
        const currentEaseStr = t("CURRENT_EASE_HELP_TEXT") + (schedule?.ease ?? t("NEW"));
        const currentIntervalStr =
            t("CURRENT_INTERVAL_HELP_TEXT") + textInterval(schedule?.interval, false);
        const generatedFromStr = t("CARD_GENERATED_FROM", {
            notePath: this.currentQuestion.note.filePath,
        });
        new Notice(currentEaseStr + "\n" + currentIntervalStr + "\n" + generatedFromStr);
        const srfile = this.currentNote.file as SrTFile;
        const store = this.plugin.store;
        const id = this.currentCard.Id;
        const infoM = new ItemInfoModal(this.settings, srfile.file, store.getItembyID(id));
        infoM.open();
    }

    createBackButton() {
        const backButton = this.flashCardMenu.createEl("button");
        backButton.addClass("sr-flashcard-menu-item");
        setIcon(backButton, "arrow-left");
        backButton.setAttribute("aria-label", t("BACK"));
        backButton.addEventListener("click", () => {
            /* this.plugin.data.historyDeck = ""; */
            this.renderDecksList();
        });
    }

    createResetButton() {
        this.resetButton = this.flashCardMenu.createEl("button");
        this.resetButton.addClass("sr-flashcard-menu-item");
        setIcon(this.resetButton, "refresh-cw");
        this.resetButton.setAttribute("aria-label", t("RESET_CARD_PROGRESS"));
        this.resetButton.addEventListener("click", () => {
            this.processReview(ReviewResponse.Reset);
        });
        this.responseBtns = [];
        this.responseBtns.push(this.resetButton);
    }

    createEditButton() {
        this.editButton = this.flashCardMenu.createEl("button");
        this.editButton.addClass("sr-flashcard-menu-item");
        setIcon(this.editButton, "edit");
        this.editButton.setAttribute("aria-label", t("EDIT_CARD"));
        this.editButton.addEventListener("click", async () => {
            this.doEditQuestionText();
        });
    }

    createOpenFileButton() {
        this.openNoteFileButton = this.flashCardMenu.createEl("button");
        this.openNoteFileButton.addClass("sr-flashcard-menu-item");
        setIcon(this.openNoteFileButton, "file-edit");
        this.openNoteFileButton.setAttribute("aria-label", t("OPEN_NOTE"));
        this.openNoteFileButton.addEventListener("click", async () => {
            const activeLeaf = this.plugin.app.workspace.getLeaf("tab");
            const noteFile = this.currentCard.question.note.file as SrTFile;
            await activeLeaf.openFile(noteFile.file);
            if (activeLeaf.view instanceof MarkdownView) {
                const activeView = activeLeaf.view;
                const pos = {
                    line: this.currentCard.question.lineNo,
                    ch: 0,
                };
                // const posEnd = {}
                activeView.editor.setCursor(pos);
                if (activeView.getMode() === "preview") {
                    activeView.currentMode.applyScroll(pos.line);
                } else {
                    activeView.editor.scrollIntoView(
                        {
                            from: pos,
                            to: pos,
                        },
                        true,
                    );
                }
            }
        });
    }

    async doEditQuestionText(): Promise<void> {
        const currentQ: Question = this.reviewSequencer.currentQuestion;

        // Just the question/answer text; without any preceding topic tag
        const textPrompt = currentQ.questionText.actualQuestion;

        const editModal = FlashcardEditModal.Prompt(this.app, textPrompt);
        editModal
            .then(async (modifiedCardText) => {
                this.reviewSequencer.updateCurrentQuestionText(modifiedCardText);
            })
            .catch((reason) => console.log(reason));
    }

    private showAnswer(): void {
        this.mode = FlashcardModalMode.Back;

        this.answerBtn.style.display = "none";
        this.responseDiv.style.display = "grid";

        if (this.currentCard.hasSchedule) {
            this.resetButton.disabled = false;
        }

        if (this.currentQuestion.questionType !== CardType.Cloze) {
            const hr: HTMLElement = document.createElement("hr");
            hr.setAttribute("id", "sr-hr-card-divide");
            this.flashcardView.appendChild(hr);
        } else {
            this.flashcardView.empty();
        }

        const wrapper: RenderMarkdownWrapper = new RenderMarkdownWrapper(
            this.app,
            this.plugin,
            this.currentNote.filePath,
        );
        wrapper.renderMarkdownWrapper(this.currentCard.back, this.flashcardView);
    }

    private async processReview(response: ReviewResponse): Promise<void> {
        if (this.settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            // just update storedata
            this.processReviewbyAlgo(response);
        }
        await this.reviewSequencer.processReview(response);
        // console.log(`processReview: ${response}: ${this.currentCard?.front ?? 'None'}`)
        await this.handleNextCard();
    }

    private processReviewbyAlgo(response: ReviewResponse) {
        const algo = this.plugin.algorithm;
        setDueDates(
            this.plugin.noteStats.delayedDays.dict,
            this.plugin.noteStats.delayedDays.dict,
        );
        const opt = algo.srsOptions()[response];
        const store = this.plugin.store;
        const id = this.currentCard.Id;

        store.updateReviewedCounts(id, RPITEMTYPE.CARD);
        store.reviewId(id, opt);
        store.save();
    }

    private async skipCurrentCard(): Promise<void> {
        this.reviewSequencer.skipCurrentCard();
        // console.log(`skipCurrentCard: ${this.currentCard?.front ?? 'None'}`)
        await this.handleNextCard();
    }

    private async handleNextCard(): Promise<void> {
        if (this.currentCard != null) await this.showCurrentCard();
        else this.renderDecksList();
    }

    private async showCurrentCard(): Promise<void> {
        const deck: Deck = this.reviewSequencer.currentDeck;

        this.responseDiv.style.display = "none";
        this.resetButton.disabled = true;
        this.titleEl.setText(`${deck.deckName}: ${deck.getCardCount(CardListType.All, true)}`);

        this.answerBtn.style.display = "initial";
        this.flashcardView.empty();
        this.mode = FlashcardModalMode.Front;

        const wrapper: RenderMarkdownWrapper = new RenderMarkdownWrapper(
            this.app,
            this.plugin,
            this.currentNote.filePath,
        );
        await wrapper.renderMarkdownWrapper(this.currentCard.front, this.flashcardView);

        // const intervals: number[] = [];
        const settings = this.plugin.data.settings;
        const algo = settings.algorithm;
        const btnTexts = settings.responseOptionBtnsText[algo];
        // const opts = this.plugin.algorithm.srsOptions();
        // todo: opts and ReviewResponse
        if (this.reviewMode == FlashcardReviewMode.Cram) {
            // Same for mobile/desktop
            this.hardBtn.setText(`${btnTexts[1]}`);
            this.easyBtn.setText(`${btnTexts.last()}`);
        } else if (!settings.intervalShowHide) {
            for (let i = 1; i < this.responseBtns.length; i++) {
                this.responseBtns[i].setText(`${btnTexts[i]}`);
            }
        } else if (settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            this.setupResponseBtns(btnTexts);
            const item = this.plugin.store.getItembyID(this.currentCard.Id);
            if (item.nextReview > Date.now()) {
                debug("复习了还没到期的卡片" + item);
            }
        } else {
            this.setupEaseButton(
                this.hardBtn,
                this.settings.flashcardHardText,
                ReviewResponse.Hard,
            );
            this.setupEaseButton(
                this.goodBtn,
                this.settings.flashcardGoodText,
                ReviewResponse.Good,
            );
            this.setupEaseButton(
                this.easyBtn,
                this.settings.flashcardEasyText,
                ReviewResponse.Easy,
            );
        }

        if (this.settings.showContextInCards)
            this.contextView.setText(
                this.formatQuestionContextText(this.currentQuestion.questionContext),
            );
    }

    private formatQuestionContextText(questionContext: string[]): string {
        const result = `${this.currentNote.file.basename} > ${questionContext.join(" > ")}`;
        return result;
    }

    private setupResponseBtns(btnTexts: string[]) {
        const store = this.plugin.store;
        // const lineNo: number = this.currentCard.question.lineNo;
        // const hash: string = BlockUtils.getTxtHash(
        //     this.currentCard.question.questionText.actualQuestion,
        // );
        // const file: SrTFile = this.currentCard.question.note.file as SrTFile;
        // const cardinfo = store.getSyncCardInfo(file.file, lineNo, hash);
        // const cardId = cardinfo.itemIds[this.currentCard.cardIdx];
        // const cardItem = store.getItembyID(cardId);
        const cardItem = store.getItembyID(this.currentCard.Id);
        // console.debug("item:", cardItem);
        const intervals = this.plugin.algorithm.calcAllOptsIntervals(cardItem);

        if (Platform.isMobile) {
            for (let i = 1; i < this.responseBtns.length; i++) {
                this.responseBtns[i].setText(textInterval(intervals[i], true));
            }
        } else {
            for (let i = 1; i < this.responseBtns.length; i++) {
                this.responseBtns[i].setText(
                    `${btnTexts[i]} - ${textInterval(intervals[i], false)}`,
                );
            }
        }
    }

    private setupEaseButton(
        button: HTMLElement,
        buttonName: string,
        reviewResponse: ReviewResponse,
    ) {
        const schedule: CardScheduleInfo = this.reviewSequencer.determineCardSchedule(
            reviewResponse,
            this.currentCard,
        );
        const interval: number = schedule.interval;

        if (Platform.isMobile) {
            button.setText(textInterval(interval, true));
        } else {
            button.setText(`${buttonName} - ${textInterval(interval, false)}`);
        }
    }
}
