import { Notice } from "obsidian";
import { SrsAlgorithm, algorithmNames } from "src/algorithms/algorithms";
import SRPlugin from "src/main";
import { AnkiAlgorithm } from "./anki";
import { FsrsAlgorithm } from "./fsrs";
import { DefaultAlgorithm } from "./scheduling_default";
import { Sm2Algorithm } from "./supermemo";

export const algorithms: Record<string, SrsAlgorithm | null> = {
    Default: new DefaultAlgorithm(),
    Anki: new AnkiAlgorithm(),
    Fsrs: new FsrsAlgorithm(),
    SM2: new Sm2Algorithm(),
};

/**
 * algorithmSwitchData
 * @param fromAlgo
 * @param toAlgo
 * @returns Promise<boolean> return true if switchData success.
 */
export async function algorithmSwitchData(
    plugin: SRPlugin,
    fromAlgo: algorithmNames,
    toAlgo: algorithmNames,
): Promise<boolean> {
    // const plugin = this.plugin;
    const store = plugin.store;
    const items = store.data.items;

    const old_path = store.dataPath;
    const bak_path = old_path + "." + fromAlgo + ".bak";

    await store.save(bak_path);
    await store.pruneData();
    await store.verifyItems();
    const fromTo = " from " + fromAlgo + " to: " + toAlgo;
    try {
        const algo = algorithms[toAlgo];
        algo.updateSettings(plugin.data.settings.algorithmSettings[toAlgo]);
        // algo.setDueDates(plugin.noteStats.delayedDays.dict, plugin.cardStats.delayedDays.dict);
        algo.importer(fromAlgo, items);
        if (toAlgo === algorithmNames.Fsrs) {
            store.data.items.find((item) => {
                if (Object.prototype.hasOwnProperty.call(item.data, "ease")) {
                    throw new Error("conv to fsrs failed");
                }
            });
        } else if (fromAlgo === algorithmNames.Fsrs) {
            store.data.items.find((item) => {
                if (Object.prototype.hasOwnProperty.call(item.data, "state")) {
                    throw new Error("conv to fsrs failed");
                }
            });
        }

        await store.save();
        const msg = fromTo + "转换完成，因算法参数不同，会导致后续复习间隔调整";
        new Notice(msg);
        console.debug(msg);
        return true;
    } catch (error) {
        await store.load(bak_path);
        new Notice(error + fromTo + "转换失败，已恢复旧算法及数据" + "please issue it.");
        console.log(error);
        return false;
    }
}
