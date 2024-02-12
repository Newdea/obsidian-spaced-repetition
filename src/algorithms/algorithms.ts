import { MiscUtils } from "src/util/utils_recall";
import { RPITEMTYPE, RepetitionItem, ReviewResult } from "src/dataStore/repetitionItem";

export enum algorithmNames {
    Default = "Default",
    Anki = "Anki",
    Fsrs = "Fsrs",
    SM2 = "SM2",
}

export abstract class SrsAlgorithm {
    settings: unknown;
    // plugin: SRPlugin;
    public static instance: SrsAlgorithm;

    public static getInstance(): SrsAlgorithm {
        if (!SrsAlgorithm.instance) {
            // SrsAlgorithm.instance = new SrsAlgorithm();
            throw Error("there is not algorithm instance.");
        }
        return SrsAlgorithm.instance;
    }

    updateSettings(settings: unknown) {
        this.settings = MiscUtils.assignOnly(this.defaultSettings(), settings);
        // this.plugin = plugin;
        SrsAlgorithm.instance = this;
    }

    abstract defaultSettings(): unknown;
    abstract defaultData(): unknown;
    abstract onSelection(item: RepetitionItem, option: string, repeat: boolean): ReviewResult;
    abstract calcAllOptsIntervals(item: RepetitionItem): number[];
    abstract srsOptions(): string[];
    abstract importer(fromAlgo: algorithmNames, items: RepetitionItem[]): void;
    abstract displaySettings(
        containerEl: HTMLElement,
        update: (settings: unknown, refresh?: boolean) => void,
    ): void;
}
