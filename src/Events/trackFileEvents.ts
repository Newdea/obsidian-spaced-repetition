import { Menu, TAbstractFile, TFile, TFolder } from "obsidian";
import { DataLocation } from "src/dataStore/dataLocation";
import SRPlugin from "src/main";

export function registerTrackFileEvents(plugin: SRPlugin) {
    const settings = plugin.data.settings;
    plugin.registerEvent(
        plugin.app.vault.on("rename", async (file, old) => {
            const trackFile = plugin.store.getTrackedFile(old);
            if (trackFile != null) {
                trackFile.rename(file.path);
                await plugin.store.save();
            }
        }),
    );

    plugin.registerEvent(
        plugin.app.vault.on("delete", (file) => {
            plugin.store.untrackFile(file.path);
            plugin.store.save();
        }),
    );

    plugin.registerEvent(
        plugin.app.vault.on("modify", async (file: TFile) => {
            if (file.extension === "md") {
                if (plugin.data.settings.dataLocation === DataLocation.SaveOnNoteFile) {
                    return;
                }
                if (settings.cardBlockID) {
                    return;
                }
                if (plugin.store.isTrackedCardfile(file.path)) {
                    const trackFile = plugin.store.getTrackedFile(file.path);
                    const fileText = await plugin.app.vault.read(file);
                    trackFile.syncNoteCardsIndex(fileText, plugin.data.settings);
                }
            }
        }),
    );
}

export function addFileMenuEvt(plugin: SRPlugin, menu: Menu, fileish: TAbstractFile) {
    const store = plugin.store;
    if (plugin.data.settings.dataLocation === DataLocation.SaveOnNoteFile) {
        return;
    }
    if (fileish instanceof TFolder) {
        const folder = fileish as TFolder;

        menu.addItem((item) => {
            item.setIcon("plus-with-circle");
            item.setTitle("Track All Notes");
            item.onClick(async (_evt) => {
                store.trackFilesInFolder(folder);
                await store.save();
                plugin.sync();
            });
        });

        menu.addItem((item) => {
            item.setIcon("minus-with-circle");
            item.setTitle("Untrack All Notes");
            item.onClick(async (_evt) => {
                store.untrackFilesInFolder(folder);
                await store.save();
                plugin.sync();
            });
        });
    } else if (fileish instanceof TFile) {
        if (store.getTrackedFile(fileish.path)?.isTrackedNote) {
            menu.addItem((item) => {
                item.setIcon("minus-with-circle");
                item.setTitle("Untrack Note");
                item.onClick(async (_evt) => {
                    store.untrackFile(fileish.path, true);
                    await store.save();
                    if (plugin.reviewFloatBar.isDisplay() && plugin.data.settings.autoNextNote) {
                        plugin.reviewNextNote(plugin.lastSelectedReviewDeck);
                    }
                    await plugin.sync();
                });
            });
        } else {
            menu.addItem((item) => {
                item.setIcon("plus-with-circle");
                item.setTitle("Track Note");
                item.onClick(async (_evt) => {
                    store.trackFile(fileish.path, undefined, true);
                    await store.save();
                    plugin.sync();
                });
            });
        }
    }
}
