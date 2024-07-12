### Quick Guide

#### CASE1: Not using the original SR plugin, directly using this plugin

Recommended settings

-   Data Location: in plugin/vault/specified folder
-   Algorithm: Fsrs
    ![image](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/assets/9208450/a22d23df-5d11-4b19-9007-e1530e2808be)

For the specific parameter settings of the algorithm, please refer to [FSRS v4](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-v4).

Other settings can be set according to the instructions.

Review via command line
Or on the computer side, you can review the notes by clicking the notes in the status bar/right sidebar, and review the cards in the left side navigation bar by clicking

For the rest, refer to [@st3v3nmw's ReadMe](https://github.com/st3v3nmw/obsidian-spaced-repetition#readme) & [recall plugin's ReadMe](https://github. com/martin-jw/obsidian-recall)

#### CASE2: Transferred from the original SR plugin

**backup the note vault**
**backup the note vault**
**backup the note vault ！！！**

It is possible that there are bugs which may delete data in the current note. **Please make backups!**
Suggestions:

1. Close the original plugin first to avoid conflict.
2. backup the note vault (because after changing the DataLocation in the settings, the review information in the note content will be deleted and saved to a separate file tracked_files.json.)
3. close Obsidan.md, copy `obsidian-spaced-repetition/data.json` to `obsidian-spaced-repetition-recall/data.json`, then start Obsidan.md.
4. If you want to use FSRS algorithm, you need to set it as recommended [above CASE1]().

---

### Features

#### Adding notes

Tabs corresponding to review notes can be added to the notes or via the command line/menu bar [tracking notes](https://github.com/martin-jw/obsidian-recall#tracking-notes).
After delete reviewTag in note, you can untrack it via command line/menu bar.
With setting `untrackWithReviewTag` to True, you will no longer review it after delete reviewTag.

To add notes in a folder, right click on the folder, (un)track All Notes
![image](https://github.com/open-spaced-repetition/obsidian-spaced-repetition-recall/assets/9208450/163f397c-cc8f-49a6-ab6f-cb929cf91d2d)

#### Adding Cards

Add a label corresponding to a review card to your notes, or convert review notes to a card group in Settings, or convert a folder to a card group in Settings, and create a card according to [the following instructions](https://github.com/st3v3nmw/obsidian-spaced-repetition#features).

-   [Single-line style](https://www.stephenmwangi.com/obsidian-spaced-repetition/flashcards/#single-line-basic-remnote-style) (`) Question::Answer`)
-   [Single-line reversed style](https://www.stephenmwangi.com/obsidian-spaced-repetition/flashcards/#single-line-reversed) (`Question:. :Answer`)
-   [Multi-line style](https://www.stephenmwangi.com/obsidian-spaced-repetition/flashcards/#multi-line-basic) (Separated by `? `)
-   [Multi-line reversed style](https://www.stephenmwangi.com/obsidian-spaced-repetition/flashcards/#multi-line-reversed) (Separated by `? Multi-line reversed style]() (Separated by `? `)
-   [Cloze cards](https://www.stephenmwangi.com/obsidian-spaced-repetition/flashcards/#cloze-cards) (`==highlight==` your cloze deletions! , `**bolded text**`, or `{{text in curly braces}}`)

#### Review Notes

Review notes can be opened from the command line, or from your computer by clicking Notes in the status bar/right sidebar. Feedback on memorization level is available via command line, hover bar or menu bar

-   On computer , right-click on the floating bar, you can close it, set time interval visible/hidden;
-   On computer, when floatbar is show and in preview, you can use keyshortcut(0 reset, 1,2, 3 easy ) feedback;
-   On mobile, swipup from the floating bar, close it , long press the floating bar to setting time interval visible/hidden;
-   time interval visible/hidden Suggestion: review is not shown, progressive summary/incremental writing is shown;

#### Review Cards

Review is available via the command line, or on the computer by clicking on the cards in the left side navigation bar.
Centralized (CRAM) review/normal review of cards within the current/all notes (if any) via command line

Centralized Review (CRAM) mode, no review data is updated.

#### Postpone

Postpone notes/cards (with current retention greater than 65%) from before today(excluded)

_If you are not satisfied with the new schedule, simply restart Obsidian to restore the previous schedule. The new schedule is not saved until after reviewing a note/card._

#### Postpone after x days

Review the specified notes/cards after x days without judging their current review time and retention rate.
_It is recommended that you only modify individual notes or cards within notes, not a large number of them, to avoid reviewing too much content on that day._

#### Reschedule

Recalculates the next review time for all **already scheduled** notes/cards based on the parameters in the settings and before the notes/cards.
_If you are not satisfied with the new schedule, simply restart Obsidian to restore the previous schedule. The new schedule is not saved until after reviewing a note/card._

#### View data statistics

Via command line, `SR view statistics`

#### View review information

Via command line, `SR Item Info`, you can view review information for current note/all cards in current note. And can modify next review date/time.

#### Algorithms

Different algorithms have different parameters, please try to use one algorithm instead of switching algorithms repeatedly.
[Algorithms desc](. /en/algorithms.md)
[default(Anki modified)](./en/algorithms.md)、[Anki](https://github.com/martin-jw/obsidian-recall#currently-available-algorithms) 、
[FSRS](https://github.com/open-spaced-repetition/fsrs.js)

#### Experimental function

Not recommended!!!
Not recommended!!!
**Not recommended!!! **

Open Setup Logging --> Debugging Information to use the following functions from the command line (**not recommended to open for daily use**).

Print Data: Output data in the debug window

Reset Data: Delete all review data;

Update Items: Updates invalid data in the data to the default data.

Prune Data: Clear invalid data in the data, which will cause the data item id to be modified, which in turn will affect the optimizer of Fsrs to not be able to effectively process part of the data.
