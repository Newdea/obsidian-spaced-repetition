import { ItemView, WorkspaceLeaf, Menu, TFile } from "obsidian";

import type SRPlugin from "src/main";
import { COLLAPSE_ICON } from "src/constants";
import { t } from "src/lang/helpers";

export const REVIEW_QUEUE_VIEW_TYPE: string = "review-queue-list-view";

export class ReviewQueueListView extends ItemView {
    private plugin: SRPlugin;
    private activeFolders: Set<string>;

    constructor(leaf: WorkspaceLeaf, plugin: SRPlugin) {
        super(leaf);

        this.plugin = plugin;
        this.activeFolders = new Set([t("Today")]);
        this.registerEvent(this.app.workspace.on("file-open", (_: any) => this.redraw()));
        this.registerEvent(this.app.vault.on("rename", (_: any) => this.redraw()));
    }

    public getViewType(): string {
        return REVIEW_QUEUE_VIEW_TYPE;
    }

    public getDisplayText(): string {
        return t("Notes Review Queue");
    }

    public getIcon(): string {
        return "crosshairs";
    }

    public onHeaderMenu(menu: Menu): void {
        menu.addItem((item) => {
            item.setTitle(t("Close"))
                .setIcon("cross")
                .onClick(() => {
                    this.app.workspace.detachLeavesOfType(REVIEW_QUEUE_VIEW_TYPE);
                });
        });
    }

    public redraw(): void {
        let openFile: TFile | null = this.app.workspace.getActiveFile();

        let rootEl: HTMLElement = createDiv("nav-folder mod-root"),
            childrenEl: HTMLElement = rootEl.createDiv("nav-folder-children");

        if (Object.keys(this.plugin.reviewDecks).length > 0) {
            for (let deckKey in this.plugin.reviewDecks) {
                if (this.plugin.reviewDecks.hasOwnProperty(deckKey)) {
                    let deck = this.plugin.reviewDecks[deckKey];

                    let deckFolderEl: HTMLElement = this.createRightPaneFolder(
                        childrenEl,
                        deckKey,
                        !this.activeFolders.has(deckKey),
                        true
                    );

                    if (deck.newNotes.length > 0) {
                        let newNotesFolderEl: HTMLElement = this.createRightPaneFolder(
                            deckFolderEl,
                            "New",
                            !this.activeFolders.has("New")
                        );

                        for (let newFile of deck.newNotes) {
                            this.createRightPaneFile(
                                newNotesFolderEl,
                                newFile,
                                openFile! && newFile.path === openFile.path,
                                !this.activeFolders.has("New")
                            );
                        }
                    }

                    if (deck.scheduledNotes.length > 0) {
                        let now: number = Date.now();
                        let currUnix: number = -1;
                        let schedFolderEl: HTMLElement | null = null,
                            folderTitle: string = "";
                        let maxDaysToRender: number =
                            this.plugin.data.settings.maxNDaysNotesReviewQueue;

                        for (let sNote of deck.scheduledNotes) {
                            if (sNote.dueUnix != currUnix) {
                                let nDays: number = Math.ceil(
                                    (sNote.dueUnix - now) / (24 * 3600 * 1000)
                                );

                                if (nDays > maxDaysToRender) {
                                    break;
                                }

                                folderTitle =
                                    nDays == -1
                                        ? "Yesterday"
                                        : nDays == 0
                                        ? "Today"
                                        : nDays == 1
                                        ? "Tomorrow"
                                        : new Date(sNote.dueUnix).toDateString();

                                schedFolderEl = this.createRightPaneFolder(
                                    deckFolderEl,
                                    folderTitle,
                                    !this.activeFolders.has(folderTitle)
                                );
                                currUnix = sNote.dueUnix;
                            }

                            this.createRightPaneFile(
                                schedFolderEl!,
                                sNote.note,
                                openFile! && sNote.note.path === openFile.path,
                                !this.activeFolders.has(folderTitle)
                            );
                        }
                    }
                }
            }
        }

        let contentEl: Element = this.containerEl.children[1];
        contentEl.empty();
        contentEl.appendChild(rootEl);
    }

    private createRightPaneFolder(
        parentEl: HTMLElement,
        folderTitle: string,
        collapsed: boolean,
        isRoot: boolean = false
    ): HTMLElement {
        if (!isRoot) {
            parentEl = parentEl
                .getElementsByClassName("nav-folder-children")[0]
                .createDiv("nav-folder");
        }

        let folderEl: HTMLDivElement = parentEl.createDiv("nav-folder"),
            folderTitleEl: HTMLDivElement = folderEl.createDiv("nav-folder-title"),
            childrenEl: HTMLDivElement = folderEl.createDiv("nav-folder-children"),
            collapseIconEl: HTMLDivElement = folderTitleEl.createDiv(
                "nav-folder-collapse-indicator collapse-icon"
            );

        collapseIconEl.innerHTML = COLLAPSE_ICON;
        if (collapsed) {
            (collapseIconEl.childNodes[0] as HTMLElement).style.transform = "rotate(-90deg)";
        }

        folderTitleEl.createDiv("nav-folder-title-content").setText(folderTitle);

        folderTitleEl.onClickEvent((_) => {
            for (let child of childrenEl.childNodes as NodeListOf<HTMLElement>) {
                if (child.style.display === "block" || child.style.display === "") {
                    child.style.display = "none";
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform =
                        "rotate(-90deg)";
                    this.activeFolders.delete(folderTitle);
                } else {
                    child.style.display = "block";
                    (collapseIconEl.childNodes[0] as HTMLElement).style.transform = "";
                    this.activeFolders.add(folderTitle);
                }
            }
        });

        return folderEl;
    }

    private createRightPaneFile(
        folderEl: HTMLElement,
        file: TFile,
        fileElActive: boolean,
        hidden: boolean
    ): void {
        let navFileEl: HTMLElement = folderEl
            .getElementsByClassName("nav-folder-children")[0]
            .createDiv("nav-file");
        if (hidden) {
            navFileEl.style.display = "none";
        }

        let navFileTitle: HTMLElement = navFileEl.createDiv("nav-file-title");
        if (fileElActive) {
            navFileTitle.addClass("is-active");
        }

        navFileTitle.createDiv("nav-file-title-content").setText(file.basename);
        navFileTitle.addEventListener(
            "click",
            (event: MouseEvent) => {
                event.preventDefault();
                this.app.workspace.activeLeaf.openFile(file);
                return false;
            },
            false
        );

        navFileTitle.addEventListener(
            "contextmenu",
            (event: MouseEvent) => {
                event.preventDefault();
                let fileMenu: Menu = new Menu(this.app);
                this.app.workspace.trigger("file-menu", fileMenu, file, "my-context-menu", null);
                fileMenu.showAtPosition({
                    x: event.pageX,
                    y: event.pageY,
                });
                return false;
            },
            false
        );
    }
}
