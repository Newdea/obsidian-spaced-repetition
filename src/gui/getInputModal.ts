import { App, ButtonComponent, Modal, Setting } from "obsidian";

export class GetInputModal extends Modal {
    private promptText: string = "";
    private days: number;
    public submitCallback: (days: number) => void;

    constructor(app: App, promptText: string) {
        super(app);
        this.promptText = promptText;
    }

    onOpen(): void {
        const { contentEl } = this;
        // contentEl.createEl("p").setText(this.promptText);
        new Setting(contentEl.createDiv()).setDesc(this.promptText).addText((text) => {
            text.setValue("").onChange((value) => {
                const day = Number(value);
                day > 0 ? (this.days = day) : text.setValue("");
            });
        });

        const buttonDiv = contentEl.createDiv("srs-flex-row");
        // buttonDiv.setAttribute("align", "center");

        new ButtonComponent(buttonDiv)
            .setButtonText("Do it")
            .onClick(() => {
                if (this.days > 0) {
                    this.submitCallback(this.days);
                    this.close();
                }
            })
            .setCta();

        new ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => {
            this.close();
        });
    }
}
