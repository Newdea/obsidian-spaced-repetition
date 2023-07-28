import ObsidianSrsPlugin from "./main";
// import { ItemInfoModal } from "./modals/info";

export default class Commands {
    plugin: ObsidianSrsPlugin;

    constructor(plugin: ObsidianSrsPlugin) {
        this.plugin = plugin;
    }

    addCommands() {
        const plugin = this.plugin;

        plugin.addCommand({
            id: "track-file",
            name: "Track Note",
            checkCallback: (checking: boolean) => {
                const file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (!plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.trackFile(file.path, "default");
                            // plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "untrack-file",
            name: "Untrack Note",
            checkCallback: (checking: boolean) => {
                const file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.untrackFile(file.path);
                            // plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "update-file",
            name: "Update Note",
            checkCallback: (checking: boolean) => {
                const file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.updateItems(file.path);
                            // plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "build-queue",
            name: "Build Queue",
            callback: () => {
                plugin.store.buildQueue();
            },
        });

        plugin.addCommand({
            id: "review-view",
            name: "Review",
            callback: () => {
                this.recallReviewNote();
            },
        });
    }

    recallReviewNote() {
        const plugin = this.plugin;
        this.plugin.store.buildQueue();
        const item = this.plugin.store.getNext();
        const state: any = { mode: "empty" };
        if (item != null) {
            const path = this.plugin.store.getFilePath(item);
            if (path != null) {
                state.file = path;
                state.item = this.plugin.store.getNextId();
                // state.mode = "note";
                // state.mode = "question";
                const fid = plugin.store.getFileId(path);
                const item = plugin.store.data.items[fid];
                plugin.reviewNoteFloatBar.algoDisplay(
                    true,
                    plugin.algorithm.calcAllOptsIntervals(item)
                );
                // plugin.reviewNoteFloatBar.algoDisplay(true, plugin.store.calcReviewInterval(fid));
            }
        }
        const leaf = this.plugin.app.workspace.getLeaf();
        leaf.setViewState({
            type: "markdown",
            state: state,
        });

        this.plugin.app.workspace.setActiveLeaf(leaf);
    }

    addDebugCommands() {
        console.log("Injecting debug commands...");
        const plugin = this.plugin;

        plugin.addCommand({
            id: "debug-print-view-state",
            name: "Print View State",
            callback: () => {
                console.log(plugin.app.workspace.activeLeaf.getViewState());
            },
        });

        plugin.addCommand({
            id: "debug-print-eph-state",
            name: "Print Ephemeral State",
            callback: () => {
                console.log(plugin.app.workspace.activeLeaf.getEphemeralState());
            },
        });

        plugin.addCommand({
            id: "debug-print-queue",
            name: "Print Queue",
            callback: () => {
                console.log(plugin.store.data.queue);
                console.log("There are " + plugin.store.data.queue.length + " items in queue.");
                console.log(plugin.store.data.newAdded + " new where added to today.");
                console.log("repeatQueue: " + plugin.store.data.repeatQueue);
                console.log("cardQueue: " + plugin.store.data.cardQueue);
                console.log("cardRepeatQueue: " + plugin.store.data.cardRepeatQueue);
            },
        });

        plugin.addCommand({
            id: "debug-clear-queue",
            name: "Clear Queue",
            callback: () => {
                plugin.store.data.queue = [];
                plugin.store.data.repeatQueue = [];
                plugin.store.data.cardQueue = [];
                plugin.store.data.cardRepeatQueue = [];
            },
        });

        plugin.addCommand({
            id: "debug-queue-all",
            name: "Queue All",
            callback: () => {
                plugin.store.data.queue = [];
                for (let i = 0; i < plugin.store.data.items.length; i++) {
                    if (plugin.store.data.items[i] != null) {
                        plugin.store.data.queue.push(i);
                    }
                }
                console.log("Queue Size: " + plugin.store.queueSize());
            },
        });

        plugin.addCommand({
            id: "debug-print-data",
            name: "Print Data",
            callback: () => {
                console.log(plugin.store.data);
            },
        });

        plugin.addCommand({
            id: "debug-reset-data",
            name: "Reset Data",
            callback: () => {
                console.log("Resetting data...");
                plugin.store.resetData();
                console.log(plugin.store.data);
            },
        });

        plugin.addCommand({
            id: "debug-prune-data",
            name: "Prune Data",
            callback: () => {
                console.log("Pruning data...");
                plugin.store.pruneData();
                console.log(plugin.store.data);
            },
        });
    }
}
