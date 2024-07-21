import { ButtonComponent, MarkdownRenderer, Modal, Setting, TFile } from "obsidian";
import { algorithmNames } from "src/algorithms/algorithms";
import { AnkiData } from "src/algorithms/anki";
import { FsrsData } from "src/algorithms/fsrs";
import { DataStore } from "src/dataStore/data";
import { RepetitionItem } from "src/dataStore/repetitionItem";
import { TrackedFile } from "src/dataStore/trackedFile";
import SRPlugin from "src/main";
import { SRSettings } from "src/settings";

export class ItemInfoModal extends Modal {
    plugin: SRPlugin;
    store: DataStore;
    settings: SRSettings;
    file: TFile;
    item: RepetitionItem;
    mnextReview: Map<number, number> = new Map();
    lastInterval: number;

    constructor(plugin: SRPlugin, file: TFile, item: RepetitionItem = null) {
        super(app);
        this.plugin = plugin;
        this.store = DataStore.getInstance();
        this.settings = plugin.data.settings;
        this.file = file;
        if (item == null) {
            this.item = this.store.getNoteItem(file.path);
        } else {
            this.item = item;
        }
        this.modalEl.style.height = this.settings.flashcardHeightPercentage + "%";
    }

    onOpen() {
        const { contentEl } = this;
        //TODO: Implement Item info.
        const path = this.file.path;
        // contentEl.createEl("p").setText("Item info of " + this.file.path);
        const buttonDivAll = contentEl.createDiv("srs-flex-row");
        buttonDivAll.setAttr("style", "position: sticky;top: 0");
        const contentdiv = contentEl.createEl("div");

        const tkfile = this.store.getTrackedFile(path);
        if (tkfile.hasCards) {
            if (this.item) {
                new ButtonComponent(buttonDivAll).setButtonText(this.item.itemType).onClick(() => {
                    this.displayitem(contentdiv, this.item);
                });
            }
            new ButtonComponent(buttonDivAll).setButtonText("Cards in this Note").onClick(() => {
                this.displayAllitems(contentdiv, tkfile);
                // this.close();
            });
        }
        if (this.item) {
            this.displayitem(contentdiv, this.item);
        } else {
            this.displayAllitems(contentdiv, tkfile);
        }

        const buttonDiv = contentEl.createDiv("srs-flex-row");
        buttonDiv.setAttr("style", "position: sticky;bottom: 0;margin-top: auto;");

        new ButtonComponent(buttonDiv)
            .setButtonText("Save")
            .setTooltip("only save current note's item info")
            .onClick(() => {
                this.submit();
                this.close();
            });
        new ButtonComponent(buttonDiv).setButtonText("Close").onClick(() => {
            // this.callback(false);
            this.close();
        });
    }

    displayAllitems(contentEl: HTMLElement, tkfile: TrackedFile) {
        contentEl.empty();
        const stext = "LineNo:";
        tkfile.cardItems.forEach((cinfo) => {
            const ln = cinfo.lineNo + 1;
            this.displayitemWithSummary(contentEl, this.store.getItems(cinfo.itemIds), stext + ln);
        });
    }

    displayitemWithSummary(contentEl: HTMLElement, items: RepetitionItem[], text: string) {
        const details = contentEl.createEl("details");
        const summary = details.createEl("summary");

        details.open = true;
        summary.setText(text);
        summary.addClass("tree-item");
        items.forEach((item) => {
            const divdetails = details.createEl("details");
            const divsummary = divdetails.createEl("summary");
            let cardmsg = "";
            if (item.hasDue) {
                const dt = window.moment(item.nextReview).format("YYYY-MM-DD HH:mm:ss");
                cardmsg = `nextReivew: ${dt}`;
            } else {
                cardmsg = "NewCard";
            }

            divsummary.setText(`ID: ${item.ID} \t ${cardmsg}`);
            divsummary.addClass("tree-item-children");
            const div = divdetails.createDiv();
            div.addClass("tree-item-children");
            this.displayitem(div, item);
        });
    }

    displayitem(contentEl: HTMLElement, item: RepetitionItem) {
        const path = this.store.getFilePath(item);
        contentEl.empty();
        contentEl.createEl("p").setText("Item info of " + path);
        const contentdiv = contentEl.createEl("div");

        console.debug("item: ", item);
        // Object.keys(item).forEach(key => {
        //     contentEl.createDiv("li").setText(key+ ": "+ item[key])
        // });
        // type dataType = typeof plugin.algorithm.defaultData;
        const title =
            "key | value \n\
            ---|---\n";
        let tablestr = "";
        Object.keys(item).forEach((key) => {
            if (key != "data") {
                if (key === "nextReview") {
                    new Setting(contentdiv).setDesc(key).addText((text) => {
                        const dt = window.moment(item.nextReview).format("YYYY-MM-DD HH:mm:ss");
                        text.setValue(dt).onChange((value) => {
                            const nr = window.moment(value).valueOf();
                            this.mnextReview.set(item.ID, nr ?? 0);
                        });
                    });
                } else {
                    tablestr += `| ${key} | ${item[key as keyof typeof item]} |\n`;
                    // const span = contentdiv.createDiv("span");
                    // span.setText(key + "\t: " + item[key as keyof typeof item]?.toString());
                }
            }
        });
        MarkdownRenderer.render(this.plugin.app, title + tablestr, contentdiv, "", this.plugin);
        contentdiv.createEl("p").setText("Item.data info");

        tablestr = "";
        Object.keys(item.data).forEach((key) => {
            const dkey = key as keyof typeof item.data;
            if (key === "lastInterval") {
                const akey = key as keyof AnkiData;
                new Setting(contentdiv).setDesc(key).addText((text) => {
                    const data = item.data as AnkiData;
                    this.lastInterval = undefined;
                    text.setValue(data[akey]?.toString()).onChange((value) => {
                        this.lastInterval = Number(value) ?? 0;
                    });
                });
            } else {
                tablestr += `| ${key} | ${item.data[dkey]} |\n`;
            }
        });
        MarkdownRenderer.render(this.plugin.app, title + tablestr, contentdiv, "", this.plugin);
    }

    submit() {
        const item = this.item;
        console.debug(this);
        const algo = this.settings.algorithm;
        if (this.mnextReview.size > 0) {
            this.mnextReview.forEach((v, id) => {
                const item = this.store.getItembyID(id);
                console.log(
                    `update item priority from ${item.nextReview} to ${v}, current item info:`,
                    item,
                );
                const nr = window.moment(v).valueOf() ?? 0;
                item.nextReview = nr > 0 ? nr : item.nextReview;

                if (algo === algorithmNames.Fsrs) {
                    const data = item.data as FsrsData;
                    data.due = new Date(item.nextReview);
                }
            });
        }
        // item.nextReview= this.nextReview?this.nextReview:item.nextReview;
        if (algo !== algorithmNames.Fsrs) {
            const data = item.data as AnkiData;
            data.lastInterval = this.lastInterval ? this.lastInterval : data.lastInterval;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
