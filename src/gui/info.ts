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
    nextReview: number;
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
    }

    onOpen() {
        const { contentEl } = this;
        //TODO: Implement Item info.
        const path = this.file.path;
        // contentEl.createEl("p").setText("Item info of " + this.file.path);
        const buttonDivAll = contentEl.createDiv("srs-flex-row");
        const contentdiv = contentEl.createEl("div");
        contentdiv.setAttr("style", "min-height: 200px");

        const tkfile = this.store.getTrackedFile(path);
        if (tkfile.hasCards) {
            new ButtonComponent(buttonDivAll).setButtonText(this.item.itemType).onClick(() => {
                this.displayitem(contentdiv, this.item);
            });
            new ButtonComponent(buttonDivAll).setButtonText("Cards in this Note").onClick(() => {
                this.displayAllitems(contentdiv, tkfile);
                // this.close();
            });
        }
        this.displayitem(contentdiv, this.item);

        const buttonDiv = contentEl.createDiv("srs-flex-row");

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

        summary.setText(text);
        items.forEach((item) => {
            const divdetails = details.createEl("details");
            const divsummary = divdetails.createEl("summary");
            const dt = window.moment(item.nextReview).format("YYYY-MM-DD HH:mm:ss");
            divsummary.setText(`ID: ${item.ID} \t nextReivew: ${dt}`);
            const div = divdetails.createDiv();
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
                        this.nextReview = undefined;
                        const dt = window.moment(item.nextReview).format("YYYY-MM-DD HH:mm:ss");
                        text.setValue(dt).onChange((value) => {
                            const nr = window.moment(value).valueOf();
                            this.nextReview = nr ?? 0;
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
        if (this.nextReview) {
            const nr = window.moment(this.nextReview).valueOf();
            this.nextReview = nr ?? 0;
            item.nextReview = this.nextReview > 0 ? this.nextReview : item.nextReview;
            if (algo === algorithmNames.Fsrs) {
                const data = item.data as FsrsData;
                data.due = new Date(item.nextReview);
            }
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
