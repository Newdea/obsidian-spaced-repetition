import { Notice } from "obsidian";
import { DataStore } from "src/dataStore/data";
import { reviewResponseModal } from "src/gui/reviewresponse-modal";
import { t } from "src/lang/helpers";
import SRPlugin from "src/main";
import { IReviewNote } from "src/reviewNote/review-note";

import { SRSettings } from "src/settings";

export class ReviewView {
    private static _instance: ReviewView;
    itemId: number;

    private plugin: SRPlugin;
    private settings: SRSettings;

    static create(plugin: SRPlugin, settings: SRSettings) {
        return new ReviewView(plugin, settings);
    }

    static getInstance() {
        if (!ReviewView._instance) {
            throw Error("there is not ReviewView instance.");
        }
        return ReviewView._instance;
    }

    constructor(plugin: SRPlugin, settings: SRSettings) {
        this.plugin = plugin;
        this.settings = settings;
        ReviewView._instance = this;
    }

    recallReviewNote(settings: SRSettings) {
        // const plugin = this.plugin;
        const store = DataStore.getInstance();
        const reviewFloatBar = reviewResponseModal.getInstance();
        // const settings = plugin.data.settings;
        const que = store.data.queues;
        que.buildQueue();
        const item = store.getNext();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state: any = { mode: "empty" };
        if (item != null && item.isTracked) {
            this.itemId = item.ID;
            console.debug("item:", item, que.queueSize());
            const path = store.getFilePath(item);
            if (path != null) {
                state.file = path;
                state.item = que.getNextId();
                // state.mode = "question";

                reviewFloatBar.display(item, (opt) => {
                    IReviewNote.recallReviewResponse(this.itemId, opt);
                    if (settings.autoNextNote) {
                        this.recallReviewNote(settings);
                    }
                });
            }
        }
        const leaf = this.plugin.app.workspace.getLeaf();
        leaf.setViewState({
            type: "markdown",
            state: state,
        });

        this.plugin.app.workspace.setActiveLeaf(leaf);

        if (item != null) {
            const newstate = leaf.getViewState();
            console.debug(newstate);
            return;
        }

        ReviewView.nextReviewNotice(IReviewNote.minNextView, store.data.queues.laterSize);

        this.plugin.updateStatusBar();

        reviewFloatBar.selfDestruct();
        new Notice(t("ALL_CAUGHT_UP"));
    }

    static nextReviewNotice(minNextView: number, laterSize: number) {
        if (minNextView > 0 && laterSize > 0) {
            const now = Date.now();
            const interval = Math.round((minNextView - now) / 1000 / 60);
            if (interval < 60) {
                new Notice("可以在" + interval + "分钟后来复习");
            } else if (interval < 60 * 5) {
                new Notice("可以在" + interval / 60 + "小时后来复习");
            }
        }
    }
}
