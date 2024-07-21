import { Setting } from "obsidian";
import ConfirmModal from "src/gui/confirm";
import { t } from "src/lang/helpers";
import SRPlugin from "src/main";

export function addcardBlockIDSetting(containerEl: HTMLElement, plugin: SRPlugin) {
    const desc = createFragment((frag) => {
        frag.createDiv().innerHTML =
            "use Card Block ID instead of line number and text hash.<br>  <b>If set True, block id will append after card text. And block id will keep in note after reset to False again.</b>";
    });
    const mesg = `**If set True, block id will append after card text. And block id will keep in note after reset to False again. ** \n
Suggestion： backup your vault before set True. Or try it in sandbox vault. \n
设置打开后，就会在所有卡片后添加blockid, 就算再关闭添加的blockid也依然保留在笔记中，不会被删除。\n
建议 ** 先备份 ** 笔记库，或在沙盒库中试用。
    `;
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
