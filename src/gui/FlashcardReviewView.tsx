import { App, MarkdownView, Notice, Platform, setIcon } from "obsidian";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import type SRPlugin from "src/main";
import { SRSettings } from "src/settings";
import { textInterval, ReviewResponse } from "src/scheduling";
import { t } from "src/lang/helpers";
import { Card } from "../Card";
import { CardListType, Deck } from "../Deck";
import { CardType, Question } from "../Question";
import {
    FlashcardReviewMode,
    IFlashcardReviewSequencer as IFlashcardReviewSequencer,
} from "src/FlashcardReviewSequencer";
import { Note } from "src/Note";
import { RenderMarkdownWrapper } from "src/util/RenderMarkdownWrapper";
import { CardScheduleInfo } from "src/CardSchedule";
import { FlashcardModalMode } from "./FlashcardModal";
import { RPITEMTYPE, RepetitionItem } from "src/dataStore/repetitionItem";
import { SrTFile } from "src/SRFile";
import { ItemInfoModal } from "./info";
import { setDueDates } from "src/algorithms/balance/balance";
import { DataLocation } from "src/dataStore/dataLocation";
import { BlockUtils, debug } from "src/util/utils_recall";

export class FlashcardReviewView {
    public app: App;
    public plugin: SRPlugin;
    public modalContentEl: HTMLElement;
    public modalEl: HTMLElement;
    public mode: FlashcardModalMode;

    public view: HTMLDivElement;

    public header: HTMLDivElement;
    public title: HTMLDivElement;
    public backButton: HTMLDivElement;

    public controls: HTMLDivElement;
    public editButton: HTMLButtonElement;
    public resetButton: HTMLButtonElement;
    public infoButton: HTMLButtonElement;
    public skipButton: HTMLButtonElement;

    public content: HTMLDivElement;
    public context: HTMLElement;

    public response: HTMLDivElement;
    public responseBtns: HTMLButtonElement[];
    public hardButton: HTMLButtonElement;
    public goodButton: HTMLButtonElement;
    public easyButton: HTMLButtonElement;
    public answerButton: HTMLButtonElement;
    public openNoteFileButton: HTMLElement;

    private reviewSequencer: IFlashcardReviewSequencer;
    private settings: SRSettings;
    private reviewMode: FlashcardReviewMode;
    private backClickHandler: () => void;
    private editClickHandler: () => void;

    public cardItem: RepetitionItem;
    public options: string[];
    private _previousCard: Card;

    constructor(
        app: App,
        plugin: SRPlugin,
        settings: SRSettings,
        reviewSequencer: IFlashcardReviewSequencer,
        reviewMode: FlashcardReviewMode,
        contentEl: HTMLElement,
        modalEl: HTMLElement,
        backClickHandler: () => void,
        editClickHandler: () => void,
    ) {
        // Init properties
        this.app = app;
        this.plugin = plugin;
        this.options = this.plugin.algorithm.srsOptions();
        this.settings = settings;
        this.reviewSequencer = reviewSequencer;
        this.reviewMode = reviewMode;
        this.backClickHandler = backClickHandler;
        this.editClickHandler = editClickHandler;
        this.modalContentEl = contentEl;
        this.modalEl = modalEl;

        // Build ui
        this.init();
    }

    /**
     * Initializes all static elements in the FlashcardView
     */
    init() {
        this.view = this.modalContentEl.createDiv();
        this.view.addClasses(["sr-flashcard", "sr-is-hidden"]);

        this.header = this.view.createDiv();
        this.header.addClass("sr-header");

        this._createBackButton();

        this.title = this.header.createDiv();
        this.title.addClass("sr-title");

        this.controls = this.header.createDiv();
        this.controls.addClass("sr-controls");

        this._createCardControls();

        if (this.settings.showContextInCards) {
            this.context = this.view.createDiv();
            this.context.addClass("sr-context");
        }

        this.content = this.view.createDiv();
        this.content.addClass("sr-content");

        this.response = this.view.createDiv();
        this.response.addClass("sr-response");

        this._createResponseButtons();
    }

    /**
     * Shows the FlashcardView & rerenders all dynamic elements
     */
    async show() {
        this.mode = FlashcardModalMode.Front;
        const deck: Deck = this.reviewSequencer.currentDeck;

        // Setup title
        this._setTitle(deck);
        this.resetButton.disabled = true;

        // Setup context
        if (this.settings.showContextInCards) {
            this.context.setText(
                this._formatQuestionContextText(this._currentQuestion.questionContext),
            );
        }

        // Setup card content
        this.content.empty();
        const wrapper: RenderMarkdownWrapper = new RenderMarkdownWrapper(
            this.app,
            this.plugin,
            this._currentNote.filePath,
        );
        await wrapper.renderMarkdownWrapper(this._currentCard.front, this.content);

        // Setup response buttons
        this._resetResponseButtons();

        // Prevents the following code, from running if this show is just a redraw and not an unhide
        if (!this.view.hasClass("sr-is-hidden")) {
            return;
        }
        this.view.removeClass("sr-is-hidden");
        this.backButton.removeClass("sr-is-hidden");
        document.addEventListener("keydown", this._keydownHandler);
    }

    /**
     * Hides the FlashcardView
     */
    hide() {
        // Prevents the following code, from running if this was executed multiple times after one another
        if (this.view.hasClass("sr-is-hidden")) {
            return;
        }
        this.view.addClass("sr-is-hidden");
        this.backButton.addClass("sr-is-hidden");
        document.removeEventListener("keydown", this._keydownHandler);
    }

    /**
     * Closes the FlashcardView
     */
    close() {
        document.removeEventListener("keydown", this._keydownHandler);
        this.hide();
    }

    // -> Functions & helpers

    private _keydownHandler = (e: KeyboardEvent) => {
        // Prevents any input, if the edit modal is open
        if (
            document.activeElement.nodeName === "TEXTAREA" ||
            this.mode === FlashcardModalMode.Closed
        ) {
            return;
        }

        const consumeKeyEvent = () => {
            e.preventDefault();
            e.stopPropagation();
        };

        switch (e.code) {
            case "KeyS":
                this._skipCurrentCard();
                consumeKeyEvent();
                break;
            case "Space":
                if (this.mode === FlashcardModalMode.Front) {
                    this._showAnswer();
                    consumeKeyEvent();
                } else if (this.mode === FlashcardModalMode.Back) {
                    this._processReview(ReviewResponse.Good);
                    consumeKeyEvent();
                }
                break;
            case "Enter":
            case "NumpadEnter":
                if (this.mode !== FlashcardModalMode.Front) {
                    break;
                }
                this._showAnswer();
                consumeKeyEvent();
                break;
            case "Numpad1":
            case "Digit1":
                if (this.mode !== FlashcardModalMode.Back) {
                    break;
                }
                this._processReview(ReviewResponse.Hard);
                consumeKeyEvent();
                break;
            case "Numpad2":
            case "Digit2":
                if (this.mode !== FlashcardModalMode.Back) {
                    break;
                }
                this._processReview(ReviewResponse.Good);
                consumeKeyEvent();
                break;
            case "Numpad3":
            case "Digit3":
                if (this.mode !== FlashcardModalMode.Back) {
                    break;
                }
                this._processReview(ReviewResponse.Easy);
                consumeKeyEvent();
                break;
            case "Numpad0":
            case "Digit0":
                if (this.mode !== FlashcardModalMode.Back) {
                    break;
                }
                this._processReview(ReviewResponse.Reset);
                consumeKeyEvent();
                break;
            default:
                break;
        }
    };

    private _displayCurrentCardInfoNotice() {
        const schedule = this._currentCard.scheduleInfo;

        const currentEaseStr = t("CURRENT_EASE_HELP_TEXT") + (schedule?.ease ?? t("NEW"));
        const currentIntervalStr =
            t("CURRENT_INTERVAL_HELP_TEXT") + textInterval(schedule?.interval, false);
        const generatedFromStr = t("CARD_GENERATED_FROM", {
            notePath: this._currentQuestion.note.filePath,
        });

        new Notice(currentEaseStr + "\n" + currentIntervalStr + "\n" + generatedFromStr);
    }

    private get _currentCard(): Card {
        return this.reviewSequencer.currentCard;
    }

    private get _currentQuestion(): Question {
        return this.reviewSequencer.currentQuestion;
    }

    private get _currentNote(): Note {
        return this.reviewSequencer.currentNote;
    }

    private _showAnswer(): void {
        this.mode = FlashcardModalMode.Back;
        this._previousCard =
            this._currentCard?.multiClozeIndex >= 0 ? this._currentCard : undefined;

        this.resetButton.disabled = false;

        // Show answer text
        if (this._currentQuestion.questionType !== CardType.Cloze) {
            const hr: HTMLElement = document.createElement("hr");
            hr.addClass("sr-card-divide");
            this.content.appendChild(hr);
        } else {
            this.content.empty();
        }

        const wrapper: RenderMarkdownWrapper = new RenderMarkdownWrapper(
            this.app,
            this.plugin,
            this._currentNote.filePath,
        );
        wrapper.renderMarkdownWrapper(this._currentCard.back, this.content);

        // Show response buttons
        this.answerButton.addClass("sr-is-hidden");
        this.hardButton.removeClass("sr-is-hidden");
        this.easyButton.removeClass("sr-is-hidden");

        const settings = this.settings;
        const algo = settings.algorithm;
        const btnTexts = settings.responseOptionBtnsText[algo];

        if (this.reviewMode == FlashcardReviewMode.Cram) {
            // Same for mobile/desktop
            this.response.addClass("is-cram");
            for (let i = 2; i < this.responseBtns.length - 1; i++) {
                this.responseBtns[i].addClass("sr-is-hidden");
            }
            // this.hardButton.setText(`${this.settings.flashcardHardText}`);
            // this.easyButton.setText(`${this.settings.flashcardEasyText}`);
            this.hardButton.setText(`${btnTexts[1]}`);
            this.easyButton.setText(`${btnTexts.last()}`);
            return;
        } else {
            for (let i = 2; i < this.responseBtns.length - 1; i++) {
                this.responseBtns[i].removeClass("sr-is-hidden");
            }
        }
        if (!settings.intervalShowHide) {
            for (let i = 1; i < this.responseBtns.length; i++) {
                this.responseBtns[i].setText(`${btnTexts[i]}`);
            }
        } else if (settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            this._setupResponseBtns(btnTexts);
            const item = this.plugin.store.getItembyID(this._currentCard.Id);
            if (
                item.nextReview > Date.now() &&
                this._currentCard.hasSchedule &&
                !this._currentCard.scheduleInfo.isDue()
            ) {
                debug("复习了还没到期的卡片" + item);
            }
        } else {
            this.goodButton.removeClass("sr-is-hidden");
            this._setupEaseButton(
                this.hardButton,
                this.settings.flashcardHardText,
                ReviewResponse.Hard,
            );
            this._setupEaseButton(
                this.goodButton,
                this.settings.flashcardGoodText,
                ReviewResponse.Good,
            );
            this._setupEaseButton(
                this.easyButton,
                this.settings.flashcardEasyText,
                ReviewResponse.Easy,
            );
        }
    }

    private async _processReview(response: ReviewResponse): Promise<void> {
        if (this.settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            // just update storedata
            this._processReviewbyAlgo(response);
        }
        await this.reviewSequencer.processReview(response);
        await this._handleSkipCard();
    }

    private _processReviewbyAlgo(response: ReviewResponse) {
        const algo = this.plugin.algorithm;
        setDueDates(this.plugin.cardStats.delayedDays.dict, this.plugin.cardStats.delayedDays.dict);
        const opt = algo.srsOptions()[response];
        const store = this.plugin.store;
        const id = this._currentCard.Id;
        store.updateReviewedCounts(id, RPITEMTYPE.CARD);
        store.reviewId(id, opt);
        store.save();
    }

    private async _skipCurrentCard(): Promise<void> {
        this.reviewSequencer.skipCurrentCard();
        await this._handleSkipCard();
    }

    private async _handleSkipCard(): Promise<void> {
        if (this._currentCard != null) {
            await this.show();
            if (
                this?._previousCard &&
                this._previousCard.isMultiCloze &&
                this._currentCard.isMultiCloze &&
                this._currentCard !== this._currentCard.getFirstClozeCard()
            ) {
                this._showAnswer();
            }
        } else this.backClickHandler();
    }

    private _formatQuestionContextText(questionContext: string[]): string {
        const separator: string = " > ";
        let result = this._currentNote.file.basename;
        if (questionContext.length > 0) {
            result += separator + questionContext.join(separator);
        }
        return result + separator + "...";
    }

    // -> Header

    private _createBackButton() {
        this.backButton = this.modalEl.createDiv();
        this.backButton.addClasses(["sr-back-button", "sr-is-hidden"]);
        setIcon(this.backButton, "arrow-left");
        this.backButton.setAttribute("aria-label", t("BACK"));
        this.backButton.addEventListener("click", () => {
            /* this.plugin.data.historyDeck = ""; */
            this.backClickHandler();
        });
    }

    private _setTitle(deck: Deck) {
        this.title.setText(`${deck.deckName}: ${deck.getCardCount(CardListType.All, true)}`);
    }

    // -> Controls

    private _createCardControls() {
        this._createOpenFileButton();
        this._createEditButton();
        this._createResetButton();
        this._createCardInfoButton();
        this._createSkipButton();
    }

    private _createOpenFileButton() {
        this.openNoteFileButton = this.controls.createEl("button");
        this.openNoteFileButton.addClass("sr-flashcard-menu-item");
        setIcon(this.openNoteFileButton, "file-edit");
        this.openNoteFileButton.setAttribute("aria-label", t("OPEN_NOTE"));
        this.openNoteFileButton.addEventListener("click", async () => {
            const activeLeaf = this.plugin.app.workspace.getLeaf("tab");
            const noteFile = this._currentCard.question.note.file as SrTFile;
            await activeLeaf.openFile(noteFile.file);
            if (activeLeaf.view instanceof MarkdownView) {
                const activeView = activeLeaf.view;
                const pos = {
                    line: this._currentCard.question.lineNo,
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

    private _createEditButton() {
        this.editButton = this.controls.createEl("button");
        this.editButton.addClasses(["sr-button", "sr-edit-button"]);
        setIcon(this.editButton, "edit");
        this.editButton.setAttribute("aria-label", t("EDIT_CARD"));
        this.editButton.addEventListener("click", async () => {
            this.editClickHandler();
        });
    }

    private _createResetButton() {
        this.resetButton = this.controls.createEl("button");
        this.resetButton.addClasses(["sr-button", "sr-reset-button"]);
        setIcon(this.resetButton, "refresh-cw");
        this.resetButton.setAttribute("aria-label", t("RESET_CARD_PROGRESS"));
        this.resetButton.addEventListener("click", () => {
            this._processReview(ReviewResponse.Reset);
        });
        this.responseBtns = [];
        this.responseBtns.push(this.resetButton);
    }

    private _createCardInfoButton() {
        this.infoButton = this.controls.createEl("button");
        this.infoButton.addClasses(["sr-button", "sr-info-button"]);
        setIcon(this.infoButton, "info");
        this.infoButton.setAttribute("aria-label", "View Card Info");
        this.infoButton.addEventListener("click", async () => {
            this._displayCurrentCardInfoNotice();
            const srfile = this._currentNote.file as SrTFile;
            const store = this.plugin.store;
            const id = this._currentCard.Id;
            const infoM = new ItemInfoModal(this.plugin, srfile.file, store.getItembyID(id));
            infoM.open();
        });
    }

    private _createSkipButton() {
        this.skipButton = this.controls.createEl("button");
        this.skipButton.addClasses(["sr-button", "sr-skip-button"]);
        setIcon(this.skipButton, "chevrons-right");
        this.skipButton.setAttribute("aria-label", t("SKIP"));
        this.skipButton.addEventListener("click", () => {
            this._skipCurrentCard();
        });
    }

    // -> Response

    private _createResponseBtns() {
        const optBtnCounts = this.plugin.algorithm.srsOptions().length;
        let btnCols = 4;
        if (!Platform.isMobile && optBtnCounts > btnCols) {
            btnCols = optBtnCounts;
        }
        for (let i = 1; i < this.options.length; i++) {
            this.responseBtns.push(document.createElement("button"));
            this.responseBtns[i].setAttribute("id", "sr-" + this.options[i].toLowerCase() + "-btn");
            this.responseBtns[i].addClasses(["sr-response-button", "sr-is-hidden"]);
            this.responseBtns[i].setText(this.plugin.data.settings.flashcardHardText);
            this.responseBtns[i].addEventListener("click", () => {
                this._processReview(i);
            });
            this.response.appendChild(this.responseBtns[i]);
        }
        this.hardButton = this.responseBtns[1];
        this.goodButton = this.responseBtns.at(-2);
        this.easyButton = this.responseBtns.last();
    }

    private _setupResponseBtns(btnTexts: string[]) {
        const store = this.plugin.store;
        const cardItem = store.getItembyID(this._currentCard.Id);
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

    private _createResponseButtons() {
        this._createShowAnswerButton();
        this._createResponseBtns();
        // this._createHardButton();
        // this._createGoodButton();
        // this._createEasyButton();
    }

    private _resetResponseButtons() {
        // Sets all buttons in to their default state
        this.answerButton.removeClass("sr-is-hidden");
        this.hardButton.addClass("sr-is-hidden");
        this.goodButton.addClass("sr-is-hidden");
        this.easyButton.addClass("sr-is-hidden");
    }

    private _createShowAnswerButton() {
        this.answerButton = this.response.createEl("button");
        this.answerButton.addClasses(["sr-response-button", "sr-show-answer-button", "sr-bg-blue"]);
        this.answerButton.setText(t("SHOW_ANSWER"));
        this.answerButton.addEventListener("click", () => {
            this._showAnswer();
        });
    }

    private _createHardButton() {
        this.hardButton = this.response.createEl("button");
        this.hardButton.addClasses([
            "sr-response-button",
            "sr-hard-button",
            "sr-bg-red",
            "sr-is-hidden",
        ]);
        this.hardButton.setText(this.settings.flashcardHardText);
        this.hardButton.addEventListener("click", () => {
            this._processReview(ReviewResponse.Hard);
        });
    }

    private _createGoodButton() {
        this.goodButton = this.response.createEl("button");
        this.goodButton.addClasses([
            "sr-response-button",
            "sr-good-button",
            "sr-bg-blue",
            "sr-is-hidden",
        ]);
        this.goodButton.setText(this.settings.flashcardGoodText);
        this.goodButton.addEventListener("click", () => {
            this._processReview(ReviewResponse.Good);
        });
    }

    private _createEasyButton() {
        this.easyButton = this.response.createEl("button");
        this.easyButton.addClasses([
            "sr-response-button",
            "sr-hard-button",
            "sr-bg-green",
            "sr-is-hidden",
        ]);
        this.easyButton.setText(this.settings.flashcardEasyText);
        this.easyButton.addEventListener("click", () => {
            this._processReview(ReviewResponse.Easy);
        });
    }

    private _setupEaseButton(
        button: HTMLElement,
        buttonName: string,
        reviewResponse: ReviewResponse,
    ) {
        const schedule: CardScheduleInfo = this.reviewSequencer.determineCardSchedule(
            reviewResponse,
            this._currentCard,
        );
        const interval: number = schedule.interval;

        if (Platform.isMobile) {
            button.setText(textInterval(interval, true));
        } else {
            button.setText(`${buttonName} - ${textInterval(interval, false)}`);
        }
    }
}
