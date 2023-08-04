import { Setting, Notice } from "obsidian";
import { DateUtils } from "src/utils_recall";
import SrsAlgorithm from "../algorithms";
import { RepetitionItem, ReviewResult } from "../data";

import * as fsrsjs from "fsrs.js";
import { t } from "src/lang/helpers";
import deepcopy from "deepcopy";

// https://github.com/mgmeyers/obsidian-kanban/blob/main/src/Settings.ts
let applyDebounceTimer = 0;
function applySettingsUpdate(callback: () => void): void {
    clearTimeout(applyDebounceTimer);
    applyDebounceTimer = window.setTimeout(callback, 512);
}

export type FsrsData = fsrsjs.Card;

export class RevLog {
    // https://github.com/open-spaced-repetition/fsrs-optimizer
    card_id = -1;
    review_time = 0;
    review_rating = 0;
    review_state = 0;
    review_duration = 0;
    tag = "";

    constructor() {
        return;
    }

    // https://qastack.cn/programming/43909566/get-keys-of-a-typescript-interface-as-array-of-strings
    static getKeyNames() {
        return Object.keys(new RevLog());
    }
}

interface FsrsSettings {
    revlog_tags: string[];
    request_retention: number;
    maximum_interval: number;
    w: number[];
}

const FsrsOptions: string[] = ["Again", "Hard", "Good", "Easy"];

/**
 * This is an implementation of the Free Spaced Repetition Scheduling Algorithm as described in
 * https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler
 * https://github.com/open-spaced-repetition/fsrs.js
 */
export class FsrsAlgorithm extends SrsAlgorithm {
    fsrs = new fsrsjs.FSRS();
    card = new fsrsjs.Card();

    initFlag = false;

    filename = "ob_revlog.csv";
    logfilepath: string = null;
    REVLOG_sep = ",";
    REVLOG_TITLE = RevLog.getKeyNames().join(this.REVLOG_sep) + "\n";
    review_duration = 0;

    constructor() {
        super();
        //Set algorithm parameters
        this.updateFsrsParams();
    }

    defaultSettings(): FsrsSettings {
        return {
            revlog_tags: [],
            request_retention: 0.9,
            maximum_interval: 36500,
            w: [
                0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34,
                1.26, 0.29, 2.61,
            ],
        };
    }

    updateFsrsParams() {
        if (this.settings != undefined) {
            this.fsrs.p = deepcopy(this.settings);
        }
    }

    getLogfilepath() {
        const filepath = this.plugin.store.getStorePath();
        const fder_index = filepath.lastIndexOf("/");
        this.logfilepath = filepath.substring(0, fder_index + 1) + this.filename;
    }

    defaultData(): FsrsData {
        return deepcopy(this.card);
    }

    srsOptions(): string[] {
        return FsrsOptions;
    }

    calcAllOptsIntervals(item: RepetitionItem) {
        if (!this.initFlag) {
            this.getLogfilepath();
            this.updateFsrsParams();
            this.initFlag = true;
        }

        const data = item.data as FsrsData;
        data.due = new Date(data.due);
        data.last_review = new Date(data.last_review);
        const card = deepcopy(data);
        const now = new Date();
        const scheduling_cards = this.fsrs.repeat(card, now);
        const intvls: number[] = [];
        this.srsOptions().forEach((opt, ind) => {
            const due = scheduling_cards[ind + 1].card.due.valueOf();
            const lastrv = scheduling_cards[ind + 1].card.last_review.valueOf();
            const nextInterval = due - lastrv;
            intvls.push(nextInterval / DateUtils.DAYS_TO_MILLIS);
            // console.debug("due:" + due + ", last: " + lastrv + ", intvl: " + nextInterval);
        });
        this.review_duration = new Date().getTime();
        return intvls;
    }
    onSelection(item: RepetitionItem, optionStr: string, repeat: boolean): ReviewResult {
        const data = item.data as FsrsData;
        data.due = new Date(data.due);
        data.last_review = new Date(data.last_review);
        const response = FsrsOptions.indexOf(optionStr) + 1;

        if (!this.initFlag) {
            this.getLogfilepath();
            this.updateFsrsParams();
            this.initFlag = true;
        }

        let correct = true;
        if (response == 1) {
            // Again
            correct = false;
        }
        if (repeat) {
            return {
                correct,
                nextReview: -1,
            };
        }

        const now = new Date();
        const scheduling_cards = this.fsrs.repeat(data, now);
        // console.log(scheduling_cards);

        //Update the card after rating:
        item.data = deepcopy(scheduling_cards[response].card) as FsrsData;

        //Get the due date for card:
        // const due = card.due;

        //Get the state for card:
        // state = card.state;

        //Get the review log after rating `Good`:
        // review_log = scheduling_cards[2].review_log;

        const nextInterval = item.data.due.valueOf() - item.data.last_review.valueOf();

        this.appendRevlog(now, item, response);

        return {
            correct,
            nextReview: nextInterval,
        };
    }

    /**
     * 记录重复数据 日志，
     * @param now
     * @param cid 对应数据项ID
     * @param rating
     */
    async appendRevlog(now: Date, item: RepetitionItem, rating: number) {
        if (this.settings.revlog_tags.length > 0) {
            if (item.deckName.includes("/")) {
                if (
                    !this.settings.revlog_tags.some(
                        (tag: string) =>
                            item.deckName === tag || item.deckName.startsWith(tag + "/")
                    )
                ) {
                    return;
                }
            } else if (!this.settings.revlog_tags.includes(item.deckName)) {
                return;
            }
        }

        const plugin = this.plugin;
        const adapter = plugin.app.vault.adapter;
        const rlog = new RevLog();
        rlog.card_id = item.ID;
        rlog.review_time = now.getTime();
        rlog.review_rating = rating;
        const carddata = item.data as FsrsData;
        rlog.review_duration =
            this.review_duration > 0 ? new Date().getTime() - this.review_duration : 0;
        this.review_duration = 0;
        rlog.review_state = carddata.state;
        rlog.tag = item.deckName;

        let data = Object.values(rlog).join(this.REVLOG_sep);
        data += "\n";

        if (!(await adapter.exists(this.logfilepath))) {
            data = this.REVLOG_TITLE + data;
        }
        adapter.append(this.logfilepath, data);
    }

    /**
     * 重写 重复数据 日志，
     * @param now
     * @param cid 对应数据项ID，
     * @param rating
     */
    reWriteRevlog(data: string, withTitle = false) {
        const plugin = this.plugin;
        const adapter = plugin.app.vault.adapter;

        if (withTitle) {
            data = this.REVLOG_TITLE + data;
        }
        adapter.write(this.logfilepath, data);
    }

    async readRevlog() {
        const plugin = this.plugin;
        const adapter = plugin.app.vault.adapter;
        let data = "";
        if (await adapter.exists(this.logfilepath)) {
            data = await adapter.read(this.logfilepath);
        }
        return data;
    }

    displaySettings(containerEl: HTMLElement, update: (settings: FsrsSettings) => void) {
        if (!this.initFlag) {
            this.getLogfilepath();
            this.updateFsrsParams();
            this.initFlag = true;
        }

        containerEl.createDiv().innerHTML =
            '用于间隔重复的算法. 更多信息请查阅 <a href="https://github.com/open-spaced-repetition/fsrs.js">FSRS算法</a>.';

        new Setting(containerEl)
            .setName(t("REVLOG_TAGS"))
            .setDesc(t("REVLOG_TAGS_DESC"))
            .addTextArea((text) =>
                text.setValue(this.settings.revlog_tags.join(" ")).onChange((value) => {
                    applySettingsUpdate(async () => {
                        const tags = value.split(/[\n\s]+/);
                        tags.last() === "" ? tags.pop() : tags;
                        this.settings.revlog_tags = tags;
                        update(this.settings);
                        // await this.plugin.savePluginData();
                    });
                })
            );

        new Setting(containerEl)
            .setName(t("REQUEST_RETENTION"))
            .setDesc(t("REQUEST_RETENTION_DESC"))
            .addSlider((slider) =>
                slider
                    .setLimits(50, 100, 1)
                    .setValue(this.settings.request_retention * 100)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.settings.request_retention = this.fsrs.p.request_retention =
                            value / 100;
                        update(this.settings);
                    })
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.settings.request_retention = this.defaultSettings().request_retention;
                        this.fsrs.p.request_retention = this.settings.request_retention;
                        update(this.settings);
                        this.plugin.settingTab.display();
                    });
            });

        new Setting(containerEl)
            .setName(t("MAX_INTERVAL"))
            .setDesc(t("MAX_INTERVAL_DESC"))
            .addText((text) =>
                text.setValue(this.settings.maximum_interval.toString()).onChange((value) => {
                    applySettingsUpdate(async () => {
                        const numValue: number = Number.parseInt(value);
                        if (!isNaN(numValue)) {
                            if (numValue < 1) {
                                new Notice(t("MAX_INTERVAL_MIN_WARNING"));
                                text.setValue(this.settings.maximum_interval.toString());
                                return;
                            }

                            this.settings.maximum_interval = this.fsrs.p.maximum_interval =
                                numValue;
                            text.setValue(this.settings.maximum_interval.toString());
                            update(this.settings);
                        } else {
                            new Notice(t("VALID_NUMBER_WARNING"));
                        }
                    });
                })
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.settings.maximum_interval = this.fsrs.p.maximum_interval =
                            this.defaultSettings().maximum_interval;
                        update(this.settings);
                        this.plugin.settingTab.display();
                    });
            });

        new Setting(containerEl)
            .setName("w")
            // .setDesc("")
            .addText((text) =>
                text.setValue(this.settings.w.join(", ")).onChange((value) => {
                    applySettingsUpdate(async () => {
                        try {
                            const numValue: number[] = value.split(/[ ,]+/).map((v) => {
                                return Number.parseFloat(v);
                            });
                            if (numValue.length === this.settings.w.length) {
                                this.settings.w = this.fsrs.p.w = numValue;
                                update(this.settings);
                                return;
                            }
                        } catch (error) {
                            console.log(error);
                        }
                        new Notice(t("VALID_NUMBER_WARNING"));
                        text.setValue(this.settings.w.toString());
                    });
                })
            )
            .addExtraButton((button) => {
                button
                    .setIcon("reset")
                    .setTooltip(t("RESET_DEFAULT"))
                    .onClick(async () => {
                        this.settings.w = this.fsrs.p.w = this.defaultSettings().w;
                        update(this.settings);
                        this.plugin.settingTab.display();
                    });
            })
            .settingEl.querySelector(".setting-item-description").innerHTML =
            '查阅 <a href= "https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm"> FSRS V4 WIKI </a> 以对各参数进行设置.';

        return;
    }
}
