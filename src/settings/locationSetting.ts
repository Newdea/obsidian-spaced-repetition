import deepcopy from "deepcopy";
import { Setting } from "obsidian";
import { algorithmNames } from "src/algorithms/algorithms";
import { DataLocation, locationMap } from "src/dataStore/dataLocation";
import { LocationSwitch } from "src/dataStore/location_switch";
import ConfirmModal from "src/gui/confirm";
import { t } from "src/lang/helpers";
import SRPlugin from "src/main";
import { FolderSuggest } from "src/suggesters/FolderSuggester";

export function addDataLocationSettings(containerEl: HTMLElement, plugin: SRPlugin) {
    containerEl.empty();
    // const plugin = this.plugin;
    const settings = plugin.data.settings;
    const locSwitch = new LocationSwitch(plugin, settings);
    const desc_toNote =
        "BE CAREFUL!!!\n  if you confirm this, it will convert \
    all your scheduling informations in `tracked_files.json` to note,\
    which will change lots of your note file in the same time.\n\
    Please make sure the setting tags of flashcards and notes is what you are using.\n";
    const desc_toNote_otherAlgo =
        "if you want to save data on notefile, you **have to** use Default Algorithm.\n";
    const desc_toTrackedFiles =
        "BE CAREFUL!!! \n if you confirm this, it will converte \
    all your scheduling informations on note(which will be deleted in the same time) TO `tracked_files.json`.\n";

    new Setting(containerEl)
        .setName(t("DATA_LOC"))
        .setDesc(t("DATA_LOC_DESC"))
        .addDropdown((dropdown) => {
            Object.values(DataLocation).forEach((val) => {
                dropdown.addOption(val, val);
            });
            dropdown.setValue(plugin.data.settings.dataLocation);

            dropdown.onChange(async (val) => {
                const loc = locationMap[val];
                await plugin.sync();
                const noteStats = deepcopy(plugin.noteStats);
                const cardStats = deepcopy(plugin.cardStats);

                let confirmP: Promise<boolean>;
                // const moveP = new Promise(function (resolve) {
                if (loc === DataLocation.SaveOnNoteFile) {
                    if (settings.algorithm === algorithmNames.Default) {
                        await locSwitch.converteTrackfileToNoteSched(true);
                        confirmP = new Promise(function (resolve) {
                            new ConfirmModal(
                                plugin,
                                desc_toNote +
                                    "### review Notes\n" +
                                    locSwitch.createTable(
                                        locSwitch.beforenoteStats,
                                        locSwitch.afternoteStats,
                                    ) +
                                    "\n---\n### flashcards\n" +
                                    locSwitch.createTable(
                                        locSwitch.beforecardStats,
                                        locSwitch.aftercardStats,
                                    ),
                                async (confirm) => {
                                    if (confirm) {
                                        await locSwitch.converteTrackfileToNoteSched();
                                        plugin.data.settings.dataLocation = loc;
                                        locSwitch.moveStoreLocation();
                                        plugin.data.settings.customFolder =
                                            locSwitch.getStorePath();

                                        resolve(true);
                                    }
                                },
                            ).open();
                        });
                    } else {
                        new ConfirmModal(plugin, desc_toNote_otherAlgo, () => {
                            dropdown.setValue(plugin.data.settings.dataLocation);
                        }).open();
                    }
                } else if (settings.dataLocation === DataLocation.SaveOnNoteFile) {
                    await locSwitch.converteNoteSchedToTrackfile(true, loc);
                    confirmP = new Promise(function (resolve) {
                        new ConfirmModal(
                            plugin,
                            desc_toTrackedFiles +
                                "### review Notes\n" +
                                locSwitch.createTable(
                                    locSwitch.beforenoteStats,
                                    locSwitch.afternoteStats,
                                ) +
                                "\n---\n### flashcards\n" +
                                locSwitch.createTable(
                                    locSwitch.beforecardStats,
                                    locSwitch.aftercardStats,
                                ),
                            async (confirm) => {
                                if (confirm) {
                                    await plugin.sync();
                                    plugin.data.settings.dataLocation = loc;
                                    await locSwitch.moveStoreLocation();
                                    plugin.data.settings.customFolder = locSwitch.getStorePath();
                                    await locSwitch.converteNoteSchedToTrackfile();

                                    resolve(true);
                                }
                            },
                        ).open();
                    });
                } else {
                    plugin.data.settings.dataLocation = loc;
                    await locSwitch.moveStoreLocation();
                    plugin.data.settings.customFolder = locSwitch.getStorePath();
                    await plugin.savePluginData();
                }
                dropdown.setValue(plugin.data.settings.dataLocation);
                // });
                // if (Promise.resolve(moveP)) {
                if (await confirmP) {
                    dropdown.setValue(plugin.data.settings.dataLocation);
                    // plugin.savePluginData();
                    await plugin.savePluginData();
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    await plugin.app.plugins.disablePlugin(plugin.manifest.id);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    await plugin.app.plugins.enablePlugin(plugin.manifest.id);
                    console.debug("finish location change.");

                    await plugin.sync();
                    locSwitch.resultCheck(noteStats, cardStats, plugin.noteStats, plugin.cardStats);
                }
                // this.display();
                addDataLocationSettings(containerEl, plugin);
            });
        });

    if (settings.dataLocation === DataLocation.SpecifiedFolder) {
        settings.customFolder = plugin.store.dataPath;
        addSpecifiedFolderSetting(containerEl, plugin);
    }
}

export function addSpecifiedFolderSetting(containerEl: HTMLElement, plugin: SRPlugin) {
    // const plugin = this.plugin;
    const settings = plugin.data.settings;
    const locSwitch = new LocationSwitch(plugin, settings);
    const fder_index = plugin.data.settings.customFolder.lastIndexOf("/");
    let cusFolder = plugin.data.settings.customFolder.substring(0, fder_index);
    const cusFilename = plugin.data.settings.customFolder.substring(fder_index + 1);

    new Setting(containerEl)
        .setName(t("DATA_FOLDER"))
        // .setDesc('Folder for `tracked_files.json`')
        .addSearch((cb) => {
            new FolderSuggest(cb.inputEl);
            cb.setPlaceholder("Example: folder1/folder2")
                .setValue(cusFolder)
                .onChange((new_folder) => {
                    cusFolder = new_folder;
                    cb.setValue(cusFolder);
                });
        })
        .addButton((btn) =>
            btn
                .setButtonText("save")
                .setCta()
                .onClick(async () => {
                    plugin.data.settings.customFolder = cusFolder + "/" + cusFilename;
                    await locSwitch.moveStoreLocation();
                    await plugin.savePluginData();
                }),
        );
}
