import { Notice, PluginSettingTab, Setting, App, Platform } from "obsidian";
import type SRPlugin from "src/main";
import { t } from "src/lang/helpers";
import { addMultiClozeSetting } from "./settings/multiClozeSetting";

// https://github.com/martin-jw/obsidian-recall/blob/main/src/settings.ts

import { algorithms } from "./algorithms/algorithms_switch";
import { addResponseFloatBarSetting } from "src/settings/responseBarSetting";
import { DataLocation } from "./dataStore/dataLocation";
import { addDataLocationSettings } from "./settings/locationSetting";
import {
    DEFAULT_responseOptionBtnsText,
    addAlgorithmSetting,
    addAlgorithmSpecificDisplaySetting,
    addResponseButtonTextSetting,
} from "./settings/algorithmSetting";
import { addUntrackSetting, addTrackedNoteToDecksSetting } from "./settings/trackSetting";
import { buildDonation } from "./settings/donation";
import { addburySiblingSetting } from "./settings/burySiblingSetting";
import { addcardBlockIDSetting } from "./settings/cardBlockIDSetting";
import { addmixQueueSetting } from "./settings/mixQueueSetting";

export interface SRSettings {
    // flashcards
    responseOptionBtnsText: Record<string, string[]>;
    flashcardEasyText: string;
    flashcardGoodText: string;
    flashcardHardText: string;
    flashcardTags: string[];
    convertFoldersToDecks: boolean;
    cardCommentOnSameLine: boolean;
    burySiblingCards: boolean;
    burySiblingCardsByNoteReview: boolean;
    multiClozeCard: boolean;
    cardBlockID: boolean;
    showContextInCards: boolean;
    flashcardHeightPercentage: number;
    flashcardWidthPercentage: number;
    randomizeCardOrder: boolean;
    flashcardCardOrder: string;
    flashcardDeckOrder: string;
    convertHighlightsToClozes: boolean;
    convertBoldTextToClozes: boolean;
    convertCurlyBracketsToClozes: boolean;
    singleLineCardSeparator: string;
    singleLineReversedCardSeparator: string;
    multilineCardSeparator: string;
    multilineReversedCardSeparator: string;
    editLaterTag: string;
    intervalShowHide: boolean;
    // notes
    enableNoteReviewPaneOnStartup: boolean;
    tagsToReview: string[];
    noteFoldersToIgnore: string[];
    openRandomNote: boolean;
    autoNextNote: boolean;
    mixDue: number;
    mixNew: number;
    reviewResponseFloatBar: boolean;
    responseBarPositionPercentage: number;
    reviewingNoteDirectly: boolean;
    disableFileMenuReviewOptions: boolean;
    maxNDaysNotesReviewQueue: number;
    // UI preferences
    initiallyExpandAllSubdecksInTree: boolean;
    // algorithm
    baseEase: number;
    lapsesIntervalChange: number;
    easyBonus: number;
    maximumInterval: number;
    maxLinkFactor: number;
    // logging
    showDebugMessages: boolean;

    // trackfile: https://github.com/martin-jw/obsidian-recall/blob/main/src/settings.ts
    dataLocation: DataLocation;
    customFolder: string;
    maxNewPerDay: number;
    repeatItems: boolean;
    trackedNoteToDecks: boolean;
    untrackWithReviewTag: boolean;
    algorithm: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    algorithmSettings: any;

    previousRelease: string;
}

export const DEFAULT_SETTINGS: SRSettings = {
    // flashcards
    responseOptionBtnsText: DEFAULT_responseOptionBtnsText,
    flashcardEasyText: t("EASY"),
    flashcardGoodText: t("GOOD"),
    flashcardHardText: t("HARD"),
    flashcardTags: ["#flashcards"],
    convertFoldersToDecks: false,
    cardCommentOnSameLine: false,
    burySiblingCards: false,
    burySiblingCardsByNoteReview: false,
    multiClozeCard: false,
    cardBlockID: false,
    showContextInCards: true,
    flashcardHeightPercentage: Platform.isMobile ? 100 : 80,
    flashcardWidthPercentage: Platform.isMobile ? 100 : 40,
    randomizeCardOrder: null,
    flashcardCardOrder: "DueFirstRandom",
    flashcardDeckOrder: "PrevDeckComplete_Sequential",

    convertHighlightsToClozes: true,
    convertBoldTextToClozes: false,
    convertCurlyBracketsToClozes: false,
    singleLineCardSeparator: "::",
    singleLineReversedCardSeparator: ":::",
    multilineCardSeparator: "?",
    multilineReversedCardSeparator: "??",
    editLaterTag: "#edit-later",
    intervalShowHide: true,
    // notes
    enableNoteReviewPaneOnStartup: true,
    tagsToReview: ["#review"],
    noteFoldersToIgnore: [],
    openRandomNote: false,
    autoNextNote: false,
    mixDue: 3,
    mixNew: 2,
    reviewResponseFloatBar: false,
    responseBarPositionPercentage: 5,
    reviewingNoteDirectly: false,
    disableFileMenuReviewOptions: false,
    maxNDaysNotesReviewQueue: 365,
    // UI settings
    initiallyExpandAllSubdecksInTree: false,
    // algorithm
    baseEase: 250,
    lapsesIntervalChange: 0.5,
    easyBonus: 1.3,
    maximumInterval: 36525,
    maxLinkFactor: 1.0,
    // logging
    showDebugMessages: false,

    // trackfile: https://github.com/martin-jw/obsidian-recall/blob/main/src/settings.ts
    dataLocation: DataLocation.SaveOnNoteFile,
    customFolder: "",
    maxNewPerDay: -1,
    repeatItems: false,
    trackedNoteToDecks: false,
    untrackWithReviewTag: false,
    algorithm: Object.keys(algorithms)[0],
    algorithmSettings: { algorithm: Object.values(algorithms)[0].settings },
    previousRelease: "0.0.0",
};

export function upgradeSettings(settings: SRSettings) {
    if (
        settings.randomizeCardOrder != null &&
        settings.flashcardCardOrder == null &&
        settings.flashcardDeckOrder == null
    ) {
        console.log(`loadPluginData: Upgrading settings: ${settings.randomizeCardOrder}`);
        settings.flashcardCardOrder = settings.randomizeCardOrder
            ? "DueFirstRandom"
            : "DueFirstSequential";
        settings.flashcardDeckOrder = "PrevDeckComplete_Sequential";

        // After the upgrade, we don't need the old attribute any more
        settings.randomizeCardOrder = null;
    }
}

export class SettingsUtil {
    static isFlashcardTag(settings: SRSettings, tag: string): boolean {
        return SettingsUtil.isTagInList(settings.flashcardTags, tag);
    }

    private static isTagInList(tagList: string[], tag: string): boolean {
        for (const tagFromList of tagList) {
            if (tag === tagFromList || tag.startsWith(tagFromList + "/")) {
                return true;
            }
        }
        return false;
    }
}

// https://github.com/mgmeyers/obsidian-kanban/blob/main/src/Settings.ts
let applyDebounceTimer = 0;
export function applySettingsUpdate(callback: () => void): void {
    clearTimeout(applyDebounceTimer);
    applyDebounceTimer = window.setTimeout(callback, 512);
}

export class SRSettingTab extends PluginSettingTab {
    private plugin: SRPlugin;

    constructor(app: App, plugin: SRPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const settings = this.plugin.data.settings;
        containerEl.empty();

        const header = containerEl.createEl("h1", { text: `${t("SETTINGS_HEADER")}` });
        header.addClass("sr-centered");

        containerEl.createDiv().innerHTML = t("CHECK_WIKI", {
            wiki_url: "https://www.stephenmwangi.com/obsidian-spaced-repetition/",
        });
        const issue_url =
            "https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/issues";
        containerEl.createDiv().innerHTML = `有空时可以看看 <a href= ${issue_url} > issue </a> .`;

        // trackfile_setting
        // https://github.com/martin-jw/obsidian-recall/blob/main/src/settings.ts
        addDataLocationSettings(containerEl.createDiv(), this.plugin);

        addAlgorithmSetting(containerEl.createDiv(), this.plugin);
        // this.addNewPerDaySetting(containerEl);
        // this.addRepeatItemsSetting(containerEl);

        new Setting(containerEl)
            .setName(t("FOLDERS_TO_IGNORE"))
            .setDesc(t("FOLDERS_TO_IGNORE_DESC"))
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.data.settings.noteFoldersToIgnore.join("\n"))
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.noteFoldersToIgnore = value
                                .split(/\n+/)
                                .map((v) => v.trim())
                                .filter((v) => v);
                            await this.plugin.savePluginData();
                        });
                    }),
            );

        containerEl.createEl("h3", { text: `${t("FLASHCARDS")}` });

        new Setting(containerEl)
            .setName(t("FLASHCARD_TAGS"))
            .setDesc(t("FLASHCARD_TAGS_DESC"))
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.data.settings.flashcardTags.join(" "))
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.flashcardTags = value.split(/\s+/);
                            await this.plugin.savePluginData();
                        });
                    }),
            );

        new Setting(containerEl)
            .setName(t("CONVERT_FOLDERS_TO_DECKS"))
            .setDesc(t("CONVERT_FOLDERS_TO_DECKS_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.convertFoldersToDecks)
                    .onChange(async (value) => {
                        this.plugin.data.settings.convertFoldersToDecks = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl)
            .setName(t("INLINE_SCHEDULING_COMMENTS"))
            .setDesc(t("INLINE_SCHEDULING_COMMENTS_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.cardCommentOnSameLine)
                    .onChange(async (value) => {
                        this.plugin.data.settings.cardCommentOnSameLine = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl)
            .setName(t("BURY_SIBLINGS_TILL_NEXT_DAY"))
            .setDesc(t("BURY_SIBLINGS_TILL_NEXT_DAY_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.burySiblingCards)
                    .onChange(async (value) => {
                        this.plugin.data.settings.burySiblingCards = value;
                        await this.plugin.savePluginData();
                    }),
            );
        addburySiblingSetting(containerEl, this.plugin);
        addMultiClozeSetting(containerEl, this.plugin);
        if (settings.dataLocation !== DataLocation.SaveOnNoteFile) {
            addcardBlockIDSetting(containerEl, this.plugin);
        } else {
            settings.cardBlockID = false;
        }
        new Setting(containerEl)
            .setName(t("SHOW_CARD_CONTEXT"))
            .setDesc(t("SHOW_CARD_CONTEXT_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.showContextInCards)
                    .onChange(async (value) => {
                        this.plugin.data.settings.showContextInCards = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl)
            .setName(t("CARD_MODAL_HEIGHT_PERCENT"))
            .setDesc(t("CARD_MODAL_SIZE_PERCENT_DESC"))
            .addSlider((slider) =>
                slider
                    .setLimits(10, 100, 5)
                    .setValue(this.plugin.data.settings.flashcardHeightPercentage)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.data.settings.flashcardHeightPercentage = value;
                        await this.plugin.savePluginData();
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.flashcardHeightPercentage =
                            DEFAULT_SETTINGS.flashcardHeightPercentage;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        new Setting(containerEl)
            .setName(t("CARD_MODAL_WIDTH_PERCENT"))
            .setDesc(t("CARD_MODAL_SIZE_PERCENT_DESC"))
            .addSlider((slider) =>
                slider
                    .setLimits(10, 100, 5)
                    .setValue(this.plugin.data.settings.flashcardWidthPercentage)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.data.settings.flashcardWidthPercentage = value;
                        await this.plugin.savePluginData();
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.flashcardWidthPercentage =
                            DEFAULT_SETTINGS.flashcardWidthPercentage;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        new Setting(this.containerEl)
            .setName(t("REVIEW_CARD_ORDER_WITHIN_DECK"))
            .addDropdown((dropdown) =>
                dropdown
                    .addOptions({
                        NewFirstSequential: t("REVIEW_CARD_ORDER_NEW_FIRST_SEQUENTIAL"),
                        DueFirstSequential: t("REVIEW_CARD_ORDER_DUE_FIRST_SEQUENTIAL"),
                        NewFirstRandom: t("REVIEW_CARD_ORDER_NEW_FIRST_RANDOM"),
                        DueFirstRandom: t("REVIEW_CARD_ORDER_DUE_FIRST_RANDOM"),
                        EveryCardRandomDeckAndCard: t("REVIEW_CARD_ORDER_RANDOM_DECK_AND_CARD"),
                    })
                    .setValue(this.plugin.data.settings.flashcardCardOrder)
                    .onChange(async (value) => {
                        this.plugin.data.settings.flashcardCardOrder = value;
                        await this.plugin.savePluginData();

                        // Need to redisplay as changing this setting affects the "deck order" setting
                        this.display();
                    }),
            );

        const deckOrderEnabled: boolean =
            this.plugin.data.settings.flashcardCardOrder != "EveryCardRandomDeckAndCard";
        new Setting(this.containerEl).setName(t("REVIEW_DECK_ORDER")).addDropdown((dropdown) =>
            dropdown
                .addOptions(
                    deckOrderEnabled
                        ? {
                              PrevDeckComplete_Sequential: t(
                                  "REVIEW_DECK_ORDER_PREV_DECK_COMPLETE_SEQUENTIAL",
                              ),
                              PrevDeckComplete_Random: t(
                                  "REVIEW_DECK_ORDER_PREV_DECK_COMPLETE_RANDOM",
                              ),
                          }
                        : {
                              EveryCardRandomDeckAndCard: t(
                                  "REVIEW_DECK_ORDER_RANDOM_DECK_AND_CARD",
                              ),
                          },
                )
                .setValue(
                    deckOrderEnabled
                        ? this.plugin.data.settings.flashcardDeckOrder
                        : "EveryCardRandomDeckAndCard",
                )
                .setDisabled(!deckOrderEnabled)
                .onChange(async (value) => {
                    this.plugin.data.settings.flashcardDeckOrder = value;
                    await this.plugin.savePluginData();
                }),
        );

        new Setting(containerEl).setName(t("CONVERT_HIGHLIGHTS_TO_CLOZES")).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.data.settings.convertHighlightsToClozes)
                .onChange(async (value) => {
                    this.plugin.data.settings.convertHighlightsToClozes = value;
                    await this.plugin.savePluginData();
                }),
        );

        new Setting(containerEl).setName(t("CONVERT_BOLD_TEXT_TO_CLOZES")).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.data.settings.convertBoldTextToClozes)
                .onChange(async (value) => {
                    this.plugin.data.settings.convertBoldTextToClozes = value;
                    await this.plugin.savePluginData();
                }),
        );

        new Setting(containerEl)
            .setName(t("CONVERT_CURLY_BRACKETS_TO_CLOZES"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.convertCurlyBracketsToClozes)
                    .onChange(async (value) => {
                        this.plugin.data.settings.convertCurlyBracketsToClozes = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl)
            .setName(t("INLINE_CARDS_SEPARATOR"))
            .setDesc(t("FIX_SEPARATORS_MANUALLY_WARNING"))
            .addText((text) =>
                text
                    .setValue(this.plugin.data.settings.singleLineCardSeparator)
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.singleLineCardSeparator = value;
                            await this.plugin.savePluginData();
                        });
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.singleLineCardSeparator =
                            DEFAULT_SETTINGS.singleLineCardSeparator;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        new Setting(containerEl)
            .setName(t("INLINE_REVERSED_CARDS_SEPARATOR"))
            .setDesc(t("FIX_SEPARATORS_MANUALLY_WARNING"))
            .addText((text) =>
                text
                    .setValue(this.plugin.data.settings.singleLineReversedCardSeparator)
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.singleLineReversedCardSeparator = value;
                            await this.plugin.savePluginData();
                        });
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.singleLineReversedCardSeparator =
                            DEFAULT_SETTINGS.singleLineReversedCardSeparator;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        new Setting(containerEl)
            .setName(t("MULTILINE_CARDS_SEPARATOR"))
            .setDesc(t("FIX_SEPARATORS_MANUALLY_WARNING"))
            .addText((text) =>
                text
                    .setValue(this.plugin.data.settings.multilineCardSeparator)
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.multilineCardSeparator = value;
                            await this.plugin.savePluginData();
                        });
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.multilineCardSeparator =
                            DEFAULT_SETTINGS.multilineCardSeparator;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        new Setting(containerEl)
            .setName(t("MULTILINE_REVERSED_CARDS_SEPARATOR"))
            .setDesc(t("FIX_SEPARATORS_MANUALLY_WARNING"))
            .addText((text) =>
                text
                    .setValue(this.plugin.data.settings.multilineReversedCardSeparator)
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.multilineReversedCardSeparator = value;
                            await this.plugin.savePluginData();
                        });
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.multilineReversedCardSeparator =
                            DEFAULT_SETTINGS.multilineReversedCardSeparator;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        this.addIntervalShowHideSetting(containerEl.createDiv());

        containerEl.createEl("h3", { text: `${t("NOTES")}` });

        new Setting(containerEl).setName(t("REVIEW_PANE_ON_STARTUP")).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.data.settings.enableNoteReviewPaneOnStartup)
                .onChange(async (value) => {
                    this.plugin.data.settings.enableNoteReviewPaneOnStartup = value;
                    await this.plugin.savePluginData();
                }),
        );

        new Setting(containerEl)
            .setName(t("TAGS_TO_REVIEW"))
            .setDesc(t("TAGS_TO_REVIEW_DESC"))
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.data.settings.tagsToReview.join(" "))
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            this.plugin.data.settings.tagsToReview = value.split(/\s+/);
                            await this.plugin.savePluginData();
                        });
                    }),
            );

        new Setting(containerEl)
            .setName(t("OPEN_RANDOM_NOTE"))
            .setDesc(t("OPEN_RANDOM_NOTE_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.openRandomNote)
                    .onChange(async (value) => {
                        this.plugin.data.settings.openRandomNote = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl).setName(t("AUTO_NEXT_NOTE")).addToggle((toggle) =>
            toggle.setValue(this.plugin.data.settings.autoNextNote).onChange(async (value) => {
                this.plugin.data.settings.autoNextNote = value;
                await this.plugin.savePluginData();
            }),
        );

        addmixQueueSetting(containerEl.createDiv(), this.plugin);
        addTrackedNoteToDecksSetting(containerEl.createDiv(), this.plugin);
        addUntrackSetting(containerEl.createDiv(), this.plugin);
        addResponseFloatBarSetting(containerEl.createDiv(), this.plugin);
        this.addReviewNoteDirectlySetting(containerEl.createDiv());

        new Setting(containerEl)
            .setName(t("DISABLE_FILE_MENU_REVIEW_OPTIONS"))
            .setDesc(t("DISABLE_FILE_MENU_REVIEW_OPTIONS_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.disableFileMenuReviewOptions)
                    .onChange(async (value) => {
                        this.plugin.data.settings.disableFileMenuReviewOptions = value;
                        await this.plugin.savePluginData();
                    }),
            );

        new Setting(containerEl)
            .setName(t("MAX_N_DAYS_REVIEW_QUEUE"))
            .addText((text) =>
                text
                    .setValue(this.plugin.data.settings.maxNDaysNotesReviewQueue.toString())
                    .onChange((value) => {
                        applySettingsUpdate(async () => {
                            const numValue: number = Number.parseInt(value);
                            if (!isNaN(numValue)) {
                                if (numValue < 1) {
                                    new Notice(t("MIN_ONE_DAY"));
                                    text.setValue(
                                        this.plugin.data.settings.maxNDaysNotesReviewQueue.toString(),
                                    );
                                    return;
                                }

                                this.plugin.data.settings.maxNDaysNotesReviewQueue = numValue;
                                await this.plugin.savePluginData();
                            } else {
                                new Notice(t("VALID_NUMBER_WARNING"));
                            }
                        });
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.plugin.data.settings.maxNDaysNotesReviewQueue =
                            DEFAULT_SETTINGS.maxNDaysNotesReviewQueue;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        containerEl.createEl("h3", { text: `${t("UI_PREFERENCES")}` });

        new Setting(containerEl)
            .setName(t("INITIALLY_EXPAND_SUBDECKS_IN_TREE"))
            .setDesc(t("INITIALLY_EXPAND_SUBDECKS_IN_TREE_DESC"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.data.settings.initiallyExpandAllSubdecksInTree)
                    .onChange(async (value) => {
                        this.plugin.data.settings.initiallyExpandAllSubdecksInTree = value;
                        await this.plugin.savePluginData();
                    }),
            );

        addResponseButtonTextSetting(containerEl.createDiv(), this.plugin);

        containerEl.createEl("h3", { text: `${t("ALGORITHM")}` });

        addAlgorithmSpecificDisplaySetting(containerEl.createDiv(), this.plugin);

        containerEl.createEl("h3", { text: `${t("LOGGING")}` });
        new Setting(containerEl).setName(t("DISPLAY_DEBUG_INFO")).addToggle((toggle) =>
            toggle.setValue(this.plugin.data.settings.showDebugMessages).onChange(async (value) => {
                this.plugin.data.settings.showDebugMessages = value;
                if (value) {
                    this.plugin.commands.addDebugCommands();
                }
                await this.plugin.savePluginData();
            }),
        );

        buildDonation(this.containerEl);
    }

    addNewPerDaySetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName(t("NEW_PER_DAY"))
            .setDesc(t("NEW_PER_DAY_DESC"))
            .addText((text) =>
                text
                    .setPlaceholder("New Per Day")
                    .setValue(plugin.data.settings.maxNewPerDay.toString())
                    .onChange((newValue) => {
                        const newPerDay = Number(newValue);

                        if (isNaN(newPerDay)) {
                            new Notice(t("NEW_PER_DAY_NAN"));
                            return;
                        }

                        if (newPerDay < -1) {
                            new Notice(t("NEW_PER_DAY_NEG"));
                            return;
                        }

                        plugin.data.settings.maxNewPerDay = newPerDay;
                        plugin.savePluginData();
                    }),
            );
    }

    addRepeatItemsSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;
        new Setting(containerEl)
            .setName(t("REPEAT_ITEMS"))
            .setDesc(t("REPEAT_ITEMS_DESC"))
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.data.settings.repeatItems);
                toggle.onChange((value) => {
                    plugin.data.settings.repeatItems = value;
                    plugin.savePluginData();
                });
            });
    }

    addIntervalShowHideSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName(t("INTERVAL_SHOWHIDE"))
            .setDesc(t("INTERVAL_SHOWHIDE_DESC"))
            .addToggle((toggle) => {
                toggle.setValue(plugin.data.settings.intervalShowHide);
                toggle.onChange((newValue) => {
                    plugin.data.settings.intervalShowHide = newValue;
                    plugin.savePluginData();
                });
            });
    }

    addReviewNoteDirectlySetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName(t("REVIEW_NOTE_DIRECTLY"))
            .setDesc(t("REVIEW_NOTE_DIRECTLY_DESC"))
            .addToggle((toggle) => {
                toggle.setValue(plugin.data.settings.reviewingNoteDirectly);
                toggle.onChange((newValue) => {
                    plugin.data.settings.reviewingNoteDirectly = newValue;
                    plugin.savePluginData();
                });
            });
    }
}
