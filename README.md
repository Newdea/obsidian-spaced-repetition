This is a modified version of [obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) and merging [recall plugin](https://github.com/martin-jw/obsidian-recall) to use seperate json data file, and add some interesting features.

就是 SR 的时间排程信息可以单独保存，~~不修改原笔记文件内容~~(如果卡片复习，开启blockid设置，会在卡片文本后追加BlockID)，以及添加其他功能。

# Flashcard-Based and Note-Based Spaced Repetition Plugin

## Features

-   [@st3v3nmw's ReadMe](https://github.com/st3v3nmw/obsidian-spaced-repetition#readme)
-   [中文使用手册](./docs/README_ZH.md)

-   merge [recall plugin](https://github.com/martin-jw/obsidian-recall) to use seperate file
    -   setting where to save schedule info by Data Location
        -   save on note file, just as used do.
        -   save on seperate tracked_files.json.
    -   setting convert tracked note to decks
    -   switch Algorithm(only work on saving on seperate tracked_files.json.): Default, anki, [Fsrs](https://github.com/open-spaced-repetition/fsrs.js)
    -   file menu to tracknote/untracknote
-   show floatbar for reviewing response when reviewing note by click statusbar or review command or sidebar, and can set whether showing the interval or not;
-   Reviewing a Notes directly [#635];
-   when using fsrs, output `ob-revlog.csv`, to optimize the algorithm parameters using [optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer) for better review;
-   Statistics: add note view statistics,and today review statistics;
-   Postpone notes/cards;
-   postpone to review after x days;
-   reschedule all scheduled items;
-   support multi-clozes;
-   setting `burySiblingCards` split into `burySiblingCards`(origin) and `burySiblingCardsByNoteReview`, and multi-clozes will not be buried;
-   Setting: Card index uses BlockID, which appends BlockID (e.g. `^blkid1`) to the card text, **will modify the original notes file**. Off by default, but card index may not be accurate enough;
-   Setting: Mix ondue and new notes queue when reviewing(default: 3 ondue notes, then 2 new notes);

## Maintainers Wanted

Since I am not a programmer, I don't know much about typescript programming, so I can only do some bug fixes and small feature updates. I can only do some bug fixes and small feature updates, but it is difficult to realize some of the proposed features. Welcome to join us if you are interested in this plugin, and work together to maintain and update this plugin.

You can join us by submitting an [issue](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/issues)/[PR](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/pulls)、或[论坛讨论](https://forum-zh.obsidian.md/t/topic/20551) directly.

## How to install the plugin

1. Download main.js, manifest.json, styles.css from the latest release (see [releases](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/releases/))
2. Create a new folder in `Vault-name/.obsidian/plugins` and put the downloaded files in there
3. Reload your plugins and enable the plugin

OR USE BRAT pulgin;

## Usage

Check the [docs](./docs/usage.md) for more details.

## Thanks

I develop this plugin as a hobby, spending my free time doing this. If you find it valuable, then please say THANK YOU or buy me a coffee...

<div class="ex-coffee-div" align = "center">
<a ><img src="https://github.com/Newdea/newdea/blob/main/.github/funding/QR_alipay.png?v=3" height=120></a>
<a ><img src="https://github.com/Newdea/newdea/blob/main/.github/funding/QR_wechat.png?v=3" height=120></a>
</div>

or buy original plugin author(@st3v3nmw) a coffee...

## Supported By

<a href='https://ko-fi.com/M4M44DEN6' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi3.png?v=2' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

Thank you to everyone who has created a plugin that inspired me and I took code from.

-   first, thanks to [@st3v3nmw's obsidian-spaced-repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) and [@martin-jw recall plugin](https://github.com/martin-jw/obsidian-recall)
-   floatbar(thanks to [@chetachi's cMenu](https://github.com/chetachiezikeuzor/cMenu-Plugin))
-   [Fsrs Algorithm](https://github.com/open-spaced-repetition/fsrs.js)
-   ReleaseNotes(thanks to [@Zsolt Viczian Excalidraw](https://zsolt.blog))
