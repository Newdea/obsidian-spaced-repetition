import { SrsAlgorithm, algorithmNames } from "src/algorithms/algorithms";
import { setDueDates } from "src/algorithms/balance/balance";
import { DefaultAlgorithm } from "src/algorithms/scheduling_default";
import { DataStore } from "src/dataStore/data";
import { DataLocation } from "src/dataStore/dataLocation";
import { RPITEMTYPE } from "src/dataStore/repetitionItem";
import { DEFAULT_SETTINGS, SRSettings } from "src/settings";
import { Stats } from "src/stats";

const settings_tkfile = Object.assign({}, DEFAULT_SETTINGS);
settings_tkfile.dataLocation = DataLocation.PluginFolder;

export class SampleDataStore {
    static roundInt = (num: number) => Math.round(Math.random() * num);

    static async create(settings: SRSettings) {
        let store: DataStore;
        let algo: SrsAlgorithm;
        let arr: number[];
        // const roundInt = (num: number) => Math.round(Math.random() * num);
        // beforeEach(async () => {
        // eslint-disable-next-line prefer-const
        store = new DataStore(settings, "./");
        await store.load();
        // store.toInstances();
        // eslint-disable-next-line prefer-const
        algo = new DefaultAlgorithm();
        algo.updateSettings(settings.algorithmSettings[algorithmNames.Default]);
        const opts = algo.srsOptions();
        // eslint-disable-next-line prefer-const
        arr = Array.from(new Array(30)).map((_v, _idx) => {
            const type = this.roundInt(1) > 0 ? RPITEMTYPE.CARD : RPITEMTYPE.NOTE;
            store.trackFile("testPath" + _idx, type, true);
            if (type === RPITEMTYPE.CARD) {
                const tkfile = store.data.trackedFiles[_idx];

                Array.from(Array(this.roundInt(10))).map((_v, _idx) => {
                    const carditem = tkfile.trackCard(_idx * 3, "chash" + _idx);
                    store.updateCardItems(tkfile, carditem, this.roundInt(10), "fcard", false);
                });
            }
            return this.roundInt(50);
        });
        const noteStats = new Stats();
        const cardStats = new Stats();
        store.items
            .filter((item) => item.isTracked)
            .filter((item) => {
                if (item.isCard) {
                    cardStats.updateStats(item);
                } else {
                    noteStats.updateStats(item);
                }
            });
        setDueDates(noteStats.delayedDays.dict, cardStats.delayedDays.dict);
        const size = store.itemSize;
        arr.map((_v) => {
            store.reviewId(
                SampleDataStore.roundInt(size - 1),
                opts[SampleDataStore.roundInt(opts.length - 1)],
            );
        });
        Array.from(Array(SampleDataStore.roundInt(10))).map((_v) => {
            store.unTrackItem(SampleDataStore.roundInt(size - 1));
        });
        // });
        return { store, algo };
    }
}

describe("jsonfiy", () => {
    test("record", () => {
        const que: Record<number, string> = {};
        que[23] = "default";
        const result = JSON.stringify(que);
        const expected = '{"23":"default"}'; // key值为number会自动转换为string
        expect(result).toEqual(expected);
    });

    test("Map stringify", () => {
        const myMap = new Map([
            [10, "value1"],
            [11, "value2"],
        ]);
        // 不能直接转，需先处理为字面量
        const result = JSON.stringify(Object.fromEntries(myMap));
        // const result = JSON.stringify([...myMap.entries()]); // "[[10,"value1"],[11,"value2"]]"
        const expected = '{"10":"value1","11":"value2"}';
        expect(result).toEqual(expected);
    });
    test("Map values stringify", () => {
        const myMap = new Map([
            [10, { ID: 10, v: "value1" }],
            [11, { ID: 10, v: "value2" }],
        ]);
        // 不能直接转，需先处理为字面量
        const result = JSON.stringify([...myMap.values()]);
        const expected = '[{"ID":10,"v":"value1"},{"ID":10,"v":"value2"}]';
        expect(result).toEqual(expected);
    });
});
describe("pruneDate", () => {
    const settings_tkfile = Object.assign({}, DEFAULT_SETTINGS);
    settings_tkfile.dataLocation = DataLocation.PluginFolder;
    let store: DataStore;
    // let algo: SrsAlgorithm;
    // let arr: number[];
    beforeEach(async () => {
        const sample = await SampleDataStore.create(settings_tkfile);
        store = sample.store;
    });

    it("pruneData", () => {
        store.pruneData();
        const itemResult = store.items.every((item) => item != null && item.isTracked);
        const tkfileResult = store.data.trackedFiles.every((tkfile) => tkfile != null);
        const check =
            store.data.trackedFiles.map((tkfile) => tkfile?.itemIDs.filter((id) => id >= 0)).flat()
                .length === store.itemSize;
        const checkcard = store.data.trackedFiles.every((tkfile) =>
            tkfile?.hasCards ? tkfile?.cardIDs.length > 0 : tkfile.noteID >= 0,
        );
        expect(itemResult).toBe(true);
        expect(tkfileResult).toBe(true);
        expect(check).toBe(true);
        expect(checkcard).toBe(true);
    });
});
