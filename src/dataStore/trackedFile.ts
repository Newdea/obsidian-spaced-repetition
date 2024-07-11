import { SRSettings } from "src/settings";
import { BlockUtils } from "src/util/utils_recall";
import { CardType } from "src/Question";
import { parseEx, ParsedQuestionInfo } from "src/parser";
import { RPITEMTYPE } from "./repetitionItem";
import { DEFAULT_DECKNAME } from "src/constants";
import { Tags } from "src/tags";

/**
 * TrackedFile.
 */
export interface ITrackedFile {
    /**
     * @type {string}
     */
    path: string;
    /**
     * @type {Record<string, number>}
     */
    items: Record<string, number>;
    /**
     * @type {CardInfo[]}
     */
    cardItems?: CardInfo[];
    /**
     * @type {string[]} only save reviewnote tags, exclude flashcards tags.
     */
    tags: string[];
}

/**
 * CardInfo
 */
export class CardInfo {
    /**
     * @type {number}
     */
    lineNo: number;
    /**
     * @type {string}
     */
    cardTextHash: string;
    /**
     * @type {string}
     */
    blockID?: string;
    /**
     * @type {number[]}
     */
    itemIds: number[];

    constructor(lineNo: number = -1, cardTextHash: string = "", blockid?: string) {
        this.lineNo = lineNo;
        this.cardTextHash = cardTextHash;
        if (blockid) {
            this.blockID = blockid;
        }
        this.itemIds = [];
    }
}

export class TrackedFile implements ITrackedFile {
    /**
     * @type {string}
     */
    path: string;
    /**
     * @type {Record<string, number>}
     */
    items: Record<string, number>;
    /**
     * @type {CardInfo[]}
     */
    cardItems?: CardInfo[];
    /**
     * @type {string[]}
     */
    tags: string[];
    // private _isTracked?: boolean;

    static create(trackedfile: ITrackedFile): TrackedFile {
        let tf: TrackedFile;
        try {
            tf = new TrackedFile(trackedfile.path, RPITEMTYPE.NOTE, trackedfile.tags.last());
            Object.assign(tf, trackedfile);
        } catch (error) {
            return tf;
        }
        return tf;
    }

    constructor(path: string = "", type: RPITEMTYPE = RPITEMTYPE.NOTE, dname?: string) {
        this.path = path;
        this.items = {};
        if (type === RPITEMTYPE.CARD) {
            this.cardItems = [];
        }
        this.setTracked(type, dname);
    }

    /**
     * renameTrackedFile.
     *
     * @param {string} newPath
     */
    rename(newPath: string) {
        const old = this.path;
        this.path = newPath;
        console.log("Updated tracking: " + old + " -> " + newPath);
    }

    /**
     * getSyncCardInfoIndex
     * @param lineNo
     * @param cardTextHash
     * @returns {CardInfo} cardinfo | null: didn't have cardInfo
     */
    getSyncCardInfo(lineNo: number, cardTextHash?: string, blockID?: string): CardInfo {
        const cardinfo = this.getCardInfo(lineNo, cardTextHash, blockID);
        if (cardinfo !== null) {
            if (cardinfo.lineNo !== lineNo) {
                cardinfo.lineNo = lineNo;
                // console.debug("syncCardInfo, change line");
            }
            if (cardTextHash != undefined && cardinfo.cardTextHash !== cardTextHash) {
                cardinfo.cardTextHash = cardTextHash;
                // console.debug("syncCardInfo, change hash");
            }
            if (blockID != undefined && cardinfo.blockID !== blockID) {
                cardinfo.blockID = blockID;
            }
        }
        return cardinfo;
    }
    /**
     * getCardInfoIndex
     * @param lineNo
     * @param cardTextHash
     * @returns {CardInfo} cardinfo | null: didn't have cardInfo
     */
    getCardInfo(lineNo: number, cardTextHash?: string, blockID?: string): CardInfo {
        let cardind = -2;
        if (this.cardItems != undefined) {
            if (blockID) {
                cardind = this.cardItems.findIndex((cinfo, _ind) => {
                    return cinfo.blockID === blockID;
                });
            }
            if (cardind < 0 && cardTextHash) {
                cardind = this.cardItems.findIndex((cinfo, _ind) => {
                    return cinfo.cardTextHash.includes(cardTextHash);
                });
            }
            if (cardind < 0) {
                cardind = this.cardItems.findIndex((cinfo, _ind) => {
                    return cinfo.lineNo === lineNo;
                });
            }
        }
        return cardind >= 0 ? this.cardItems[cardind] : null;
    }

    /**
     * syncNoteCardsIndex
     * only check and sync index, not add/remove cardinfo/ids/items.
     * @param note
     * @returns
     */
    syncNoteCardsIndex(
        fileText: string,
        settings: SRSettings,
        callback?: (cardText: string, cardinfo: CardInfo) => void,
    ) {
        if (callback == null) {
            if (!this.hasCards) {
                return;
            }
        }

        // const settings = plugin.data.settings;
        let negIndFlag = false;
        const lines: number[] = [];
        const cardHashList: Record<number, string> = {};

        const parsedCards: ParsedQuestionInfo[] = parseEx(
            fileText,
            settings.singleLineCardSeparator,
            settings.singleLineReversedCardSeparator,
            settings.multilineCardSeparator,
            settings.multilineReversedCardSeparator,
            settings.convertHighlightsToClozes,
            settings.convertBoldTextToClozes,
            settings.convertCurlyBracketsToClozes,
        );
        if (!this.hasCards && parsedCards.length === 0) {
            return false;
        }

        for (const parsedCard of parsedCards) {
            // deckPath = noteDeckPath;
            const lineNo: number = parsedCard.firstLineNum;
            let cardText: string = parsedCard.text;

            if (cardText.includes(settings.editLaterTag)) {
                continue;
            }

            if (!settings.convertFoldersToDecks) {
                const tagInCardRegEx = /^#[^\s#]+/gi;
                const cardDeckPath = cardText
                    .match(tagInCardRegEx)
                    ?.slice(-1)[0]
                    .replace("#", "")
                    .split("/");
                if (cardDeckPath) {
                    // deckPath = cardDeckPath;
                    cardText = cardText.replaceAll(tagInCardRegEx, "");
                }
            }

            const cardTextHash: string = BlockUtils.getTxtHash(cardText);

            const cardinfo = this.getSyncCardInfo(lineNo, cardTextHash);
            if (callback != null) {
                callback(cardText, {
                    lineNo: lineNo,
                    cardTextHash: cardTextHash,
                    itemIds: cardinfo?.itemIds,
                });
            }
            lines.push(lineNo);
            cardHashList[lineNo] = cardTextHash;
            if (cardinfo == null) {
                negIndFlag = true;
            }
        }
        // console.debug("cardHashList: ", cardHashList);

        // sync by total parsedCards.length
        if (!this.hasCards) {
            return false;
        }
        const carditems = this?.cardItems;
        if (lines.length === carditems.length && negIndFlag) {
            for (let i = 0; i < lines.length; i++) {
                // fix: don't match
                // if (this.getSyncCardInfo(lines[i], cardHashList[lines[i]]) == null) {
                // }
                if (lines[i] !== carditems[i].lineNo) {
                    carditems[i].lineNo = lines[i];
                    this.getSyncCardInfo(lines[i], cardHashList[lines[i]]);
                }
            }
        }
        // store.save();
        return true;
    }

    get lastTag() {
        const last = this.tags.last();
        if (last) {
            if (last !== RPITEMTYPE.NOTE && last !== RPITEMTYPE.CARD) {
                return last;
            }
        }
        return null;
    }

    updateTags(deckName: string) {
        if (!this.tags.includes(deckName) || this.lastTag !== deckName) {
            this.tags.remove(deckName);
            this.tags.push(deckName);
        }
    }

    get isTracked(): boolean {
        return this.isTrackedCards || this.isTrackedNote;
    }

    get isTrackedNote(): boolean {
        return this.tags.length > 1;
    }

    private get isTrackedCards(): boolean {
        return this.tags.length > 0 && this.hasCards;
    }

    get isDefault() {
        return Tags.isDefaultDackName(this.lastTag);
    }

    get noteID(): number {
        return this.items.file;
    }

    get cardIDs(): number[] {
        return this.hasCards
            ? this.cardItems
                  .map((cinfo) => {
                      return cinfo.itemIds;
                  })
                  .flat()
            : [];
    }

    /**
     * [this.noteID, ...this.cardIDs]
     */
    get itemIDs(): number[] {
        return [this.noteID, ...this.cardIDs];
    }

    get hasCards() {
        return this.cardItems !== undefined;
    }

    /**
     * trackCard
     * 添加笔记中特定行的卡片（组）
     * @param note
     * @param lineNo
     * @param cardTextHash
     * @returns {CardInfo} cardInfo of new add.
     */
    trackCard(lineNo: number, cardTextHash: string): CardInfo {
        if (!this.hasCards) {
            // didn't have cardItems
            this.cardItems = [];
        }

        const cardinfo = this.getSyncCardInfo(lineNo, cardTextHash);
        if (cardinfo != null) {
            return cardinfo;
        }

        const newcardItem: CardInfo = new CardInfo(lineNo, cardTextHash);

        const _cind = this.cardItems.push(newcardItem) - 1;
        this.cardItems.sort((a, b) => {
            return a.lineNo - b.lineNo;
        });
        return newcardItem;
    }
    setTracked(type: RPITEMTYPE, dname?: string) {
        this.tags = [type];
        if (dname !== undefined) {
            this.tags.push(dname);
        } else if (type === RPITEMTYPE.NOTE) {
            this.tags.push(DEFAULT_DECKNAME);
        }
        // if (this._isTracked === false) {
        //     this._isTracked = true;
        // }
    }
    setUnTracked() {
        this.tags = [this.tags[0]];
        // this._isTracked = false;
    }
}
