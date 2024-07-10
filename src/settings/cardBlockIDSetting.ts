import { Setting } from "obsidian";
import ConfirmModal from "src/gui/confirm";
import { t } from "src/lang/helpers";
import SRPlugin from "src/main";

export function addcardBlockIDSetting(containerEl: HTMLElement, plugin: SRPlugin) {
    const desc = createFragment((frag) => {
        frag.createDiv().innerHTML =
            "use Card Block ID instead of line number and text hash.<br>  <b>If set True, block id will keep in note after reset to False again.</b>";
    });
    const mesg =
        "\
    **!!! If set True, block id will keep in note after reset to False again.**\n\
    **!!! If set True, block id will keep in note after reset to False again.**\n\
    **!!! If set True, block id will keep in note after reset to False again.**\n\
    ";
    let confirmP: Promise<boolean>;
    new Setting(containerEl)
        .setName("Card Block ID")
        .setDesc(desc)
        .addToggle((toggle) => {
            const value = plugin.data.settings.cardBlockID;
            toggle.setValue(value);
            // if (value) {
            //     toggle.setDisabled(true);
            //     return;
            // }
            toggle.onChange(async (newValue) => {
                if (newValue) {
                    confirmP = new Promise(function (resolve) {
                        new ConfirmModal(plugin, mesg, async (confirm) => {
                            if (confirm) {
                                plugin.data.settings.cardBlockID = newValue;
                                await plugin.savePluginData();
                                resolve(true);
                            } else {
                                toggle.setValue(false);
                                plugin.data.settings.cardBlockID = newValue;
                                await plugin.savePluginData();
                                resolve(false);
                            }
                        }).open();
                    });
                    // if (await confirmP) {
                    //     toggle.setDisabled(true);
                    // } else {
                    //     toggle.setValue(false);
                    // }
                }
            });
        });
}
