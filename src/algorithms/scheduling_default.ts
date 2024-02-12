import { Notice, Setting } from "obsidian";

import { t } from "src/lang/helpers";

import { DateUtils } from "src/util/utils_recall";
import { SrsAlgorithm, algorithmNames } from "./algorithms";
import deepcopy from "deepcopy";
import { AnkiData } from "./anki";
import { FsrsData } from "./fsrs";
import { balance } from "./balance/balance";
import { RepetitionItem, ReviewResult } from "src/dataStore/repetitionItem";

// https://github.com/mgmeyers/obsidian-kanban/blob/main/src/Settings.ts
let applyDebounceTimer = 0;
function applySettingsUpdate(callback: () => void): void {
    clearTimeout(applyDebounceTimer);
    applyDebounceTimer = window.setTimeout(callback, 512);
}

export enum ReviewResponse {
    Reset,
    Hard,
    Good,
    Easy,
}

interface DefaultAlgoSettings {
    baseEase: number;
    lapsesIntervalChange: number;
    easyBonus: number;
    maximumInterval: number;
    maxLinkFactor: number;
}

interface Sm2Data {
    ease: number;
    lastInterval: number;
    iteration: number;
}

const Sm2Options: string[] = ["Reset", "Hard", "Good", "Easy"];

export function schedule(
    response: ReviewResponse,
    interval: number,
    ease: number,
    delayBeforeReview: number,
    settingsObj: DefaultAlgoSettings,
    dueDates?: Record<number, number>,
): Record<string, number> {
    delayBeforeReview = Math.max(0, Math.floor(delayBeforeReview / (24 * 3600 * 1000)));

    if (response === ReviewResponse.Easy) {
        ease += 20;
        interval = ((interval + delayBeforeReview) * ease) / 100;
        interval *= settingsObj.easyBonus;
    } else if (response === ReviewResponse.Good) {
        interval = ((interval + delayBeforeReview / 2) * ease) / 100;
    } else if (response === ReviewResponse.Hard) {
        ease = Math.max(130, ease - 20);
        interval = Math.max(
            1,
            (interval + delayBeforeReview / 4) * settingsObj.lapsesIntervalChange,
        );
    }

    // replaces random fuzz with load balancing over the fuzz interval

    // interval = balance(interval, dueDates, settingsObj.maximumInterval);

    return { interval: Math.round(interval * 10) / 10, ease };
}

export class DefaultAlgorithm extends SrsAlgorithm {
    settings: DefaultAlgoSettings;
    defaultSettings(): DefaultAlgoSettings {
        return {
            // algorithm
            baseEase: 250,
            lapsesIntervalChange: 0.5,
            easyBonus: 1.3,
            maximumInterval: 36525,
            maxLinkFactor: 1.0,
        };
    }

    defaultData(): Sm2Data {
        return {
            ease: this.settings.baseEase,
            lastInterval: 1, // the anki is 0.
            iteration: 1,
        };
    }

    srsOptions(): string[] {
        return Sm2Options;
    }

    calcAllOptsIntervals(item: RepetitionItem): number[] {
        const data: Sm2Data = item.data as Sm2Data;
        const due = item.nextReview;
        const now: number = Date.now();
        const delayBeforeReview = due === 0 ? 0 : now - due; //just in case.
        // console.log("item.data:", item.data);
        // const dueDatesNotesorCards = this.getDueDates(item.itemType);

        const intvls: number[] = [];
        this.srsOptions().forEach((opt, ind) => {
            const dataCopy = deepcopy(data);
            // const dueDates = deepcopy(dueDatesNotesorCards);

            const schedObj: Record<string, number> = schedule(
                ind,
                dataCopy.lastInterval,
                dataCopy.ease,
                delayBeforeReview,
                this.settings,
                // dueDates,
            );
            const nextInterval = schedObj.interval;
            intvls.push(nextInterval);
        });
        return intvls;
    }

    onSelection(item: RepetitionItem, optionStr: string, repeat: boolean): ReviewResult {
        const data = item.data as Sm2Data;
        // console.log("item.data:", item.data);

        const response = Sm2Options.indexOf(optionStr) as ReviewResponse;

        let correct = true;
        if (repeat) {
            if (response < 1) {
                correct = false;
            } else {
                correct = true;
            }
            return { correct: correct, nextReview: -1 };
        }

        const due = item.nextReview;
        const now: number = Date.now();
        const delayBeforeReview = due === 0 ? 0 : now - due; //just in case.
        const schedObj: Record<string, number> = schedule(
            response,
            data.lastInterval,
            data.ease,
            delayBeforeReview,
            this.settings,
            // this.getDueDates(item.itemType),
        );

        const nextReview = schedObj.interval;
        data.ease = Math.round(schedObj.ease);
        if (response < 1) {
            data.iteration = 1;
            data.lastInterval = nextReview;
            return {
                correct: false,
                nextReview: nextReview * DateUtils.DAYS_TO_MILLIS,
            };
        } else {
            data.iteration += 1;
            data.lastInterval = nextReview;
            return {
                correct: true,
                nextReview: nextReview * DateUtils.DAYS_TO_MILLIS,
            };
        }
    }

    importer(fromAlgo: algorithmNames, items: RepetitionItem[]): void {
        if (fromAlgo === algorithmNames.Anki || fromAlgo === algorithmNames.SM2) {
            this.importer_Anki(items);
        } else if (fromAlgo === algorithmNames.Fsrs) {
            this.importer_Fsrs(items);
        } else {
            throw Error(fromAlgo + "can't import to Default");
        }
    }

    private importer_Anki(items: RepetitionItem[]) {
        items.forEach((item) => {
            if (item != null && item.data != null) {
                const data: AnkiData = item.data as AnkiData;
                data.ease *= 100;
                if (data.lastInterval === 0) {
                    data.lastInterval = 1;
                } else {
                    data.lastInterval *= 1;
                }
            }
        });
    }

    private importer_Fsrs(items: RepetitionItem[]) {
        items.forEach((item) => {
            if (item != null && item.data != null) {
                const data = item.data as FsrsData;
                const lastitval = data.scheduled_days;
                const iter = data.reps;
                const newdata = this.defaultData() as AnkiData;
                newdata.lastInterval =
                    lastitval > newdata.lastInterval ? lastitval : newdata.lastInterval;
                newdata.iteration = iter;
                item.data = deepcopy(newdata);
            }
        });
    }

    displaySettings(
        containerEl: HTMLElement,
        update: (settings: DefaultAlgoSettings, refresh?: boolean) => void,
    ): void {
        containerEl.createDiv().innerHTML = t("CHECK_ALGORITHM_WIKI", {
            algo_url: "https://www.stephenmwangi.com/obsidian-spaced-repetition/algorithms/",
        });
        containerEl.createDiv().innerHTML =
            '用于间隔重复的算法. 更多信息请查阅 <a href="https://www.stephenmwangi.com/obsidian-spaced-repetition/algorithms/">anki修改算法</a>.';

        const DEFAULTSETTINGS = this.defaultSettings();

        new Setting(containerEl)
            .setName(t("BASE_EASE"))
            .setDesc(t("BASE_EASE_DESC"))
            .addText((text) =>
                text.setValue(this.settings.baseEase.toString()).onChange((value) => {
                    applySettingsUpdate(async () => {
                        const numValue: number = Number.parseInt(value);
                        if (!isNaN(numValue)) {
                            if (numValue < 130) {
                                new Notice(t("BASE_EASE_MIN_WARNING"));
                                text.setValue(this.settings.baseEase.toString());
                                return;
                            }

                            this.settings.baseEase = numValue;
                            update(this.settings);
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
                        applySettingsUpdate(() => {
                            this.settings.baseEase = DEFAULTSETTINGS.baseEase;
                            update(this.settings, true);
                        });
                    });
            });

        new Setting(containerEl)
            .setName(t("LAPSE_INTERVAL_CHANGE"))
            .setDesc(t("LAPSE_INTERVAL_CHANGE_DESC"))
            .addSlider((slider) =>
                slider
                    .setLimits(1, 99, 1)
                    .setValue(this.settings.lapsesIntervalChange * 100)
                    .setDynamicTooltip()
                    .onChange(async (value: number) => {
                        this.settings.lapsesIntervalChange = value / 100;
                        update(this.settings);
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        applySettingsUpdate(async () => {
                            this.settings.lapsesIntervalChange =
                                DEFAULTSETTINGS.lapsesIntervalChange;
                            update(this.settings, true);
                        });
                    });
            });

        new Setting(containerEl)
            .setName(t("EASY_BONUS"))
            .setDesc(t("EASY_BONUS_DESC"))
            .addText((text) =>
                text.setValue((this.settings.easyBonus * 100).toString()).onChange((value) => {
                    applySettingsUpdate(async () => {
                        const numValue: number = Number.parseInt(value) / 100;
                        if (!isNaN(numValue)) {
                            if (numValue < 1.0) {
                                new Notice(t("EASY_BONUS_MIN_WARNING"));
                                text.setValue((this.settings.easyBonus * 100).toString());
                                return;
                            }

                            this.settings.easyBonus = numValue;
                            update(this.settings);
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
                        applySettingsUpdate(async () => {
                            this.settings.easyBonus = DEFAULTSETTINGS.easyBonus;
                            update(this.settings, true);
                        });
                    });
            });

        new Setting(containerEl)
            .setName(t("MAX_INTERVAL"))
            .setDesc(t("MAX_INTERVAL_DESC"))
            .addText((text) =>
                text.setValue(this.settings.maximumInterval.toString()).onChange((value) => {
                    applySettingsUpdate(async () => {
                        const numValue: number = Number.parseInt(value);
                        if (!isNaN(numValue)) {
                            if (numValue < 1) {
                                new Notice(t("MAX_INTERVAL_MIN_WARNING"));
                                text.setValue(this.settings.maximumInterval.toString());
                                return;
                            }

                            this.settings.maximumInterval = numValue;
                            update(this.settings);
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
                        applySettingsUpdate(async () => {
                            this.settings.maximumInterval = DEFAULTSETTINGS.maximumInterval;
                            update(this.settings, true);
                        });
                    });
            });

        new Setting(containerEl)
            .setName(t("MAX_LINK_CONTRIB"))
            .setDesc(t("MAX_LINK_CONTRIB_DESC"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 100, 1)
                    .setValue(this.settings.maxLinkFactor * 100)
                    .setDynamicTooltip()
                    .onChange(async (value: number) => {
                        this.settings.maxLinkFactor = value / 100;
                        update(this.settings);
                    }),
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        applySettingsUpdate(async () => {
                            this.settings.maxLinkFactor = DEFAULTSETTINGS.maxLinkFactor;
                            update(this.settings, true);
                        });
                    });
            });
        return;
    }
}
