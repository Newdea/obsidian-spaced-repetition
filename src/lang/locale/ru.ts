// Перевод на русский язык

// @ytatichno Сафронов Максим
// https://github.com/ytatichno

// Микко Ведру
// https://github.com/mikkovedru

// Калашников Иван
// https://github.com/Steindvart

export default {
    // flashcard-modal.tsx
    DECKS: "Колоды",
    DUE_CARDS: "Повторяемые карточки",
    NEW_CARDS: "Новые карточки",
    TOTAL_CARDS: "Всего карточек",
    BACK: "Назад",
    SKIP: "Пропустить",
    EDIT_CARD: "Редактировать карточку",
    RESET_CARD_PROGRESS: "Сбросить прогресс карточки",
    RESET: "Reset",
    HARD: "Сложно",
    GOOD: "Нормально",
    EASY: "Легко",
    SHOW_ANSWER: "Показать ответ",
    CARD_PROGRESS_RESET: "Сбросить прогресс изучения карточки",
    SAVE: "Сохранить",
    CANCEL: "Отмена",
    NO_INPUT: "Пустой ввод.",
    CURRENT_EASE_HELP_TEXT: "Текущий прогресс: ",
    CURRENT_INTERVAL_HELP_TEXT: "Текущий интервал: ",
    CARD_GENERATED_FROM: "Сгенерированно из: ${notePath}",
    OPEN_NOTE: "Open Note",

    // main.ts
    OPEN_NOTE_FOR_REVIEW: "Открыть заметку для изучения",
    REVIEW_CARDS: "Изучать карточки",
    REVIEW_DIFFICULTY_FILE_MENU: "Изучение: ${difficulty}",
    REVIEW_NOTE_DIFFICULTY_CMD: "Изучать заметку как ${difficulty}",
    CRAM_ALL_CARDS: "Зубрить все карточки в этой колоде",
    REVIEW_ALL_CARDS: "Изучать все карточки во всех заметках",
    REVIEW_CARDS_IN_NOTE: "Изучать карточки в этой заметке",
    CRAM_CARDS_IN_NOTE: "Зубрить карточки в этой заметке",
    VIEW_STATS: "Посмотреть статистику",
    OPEN_REVIEW_QUEUE_VIEW: "Открыть очередь повторения заметок на боковой панели",
    STATUS_BAR: "Повторить: ${dueNotesCount} заметок, ${dueFlashcardsCount} карточек",
    SYNC_TIME_TAKEN: "Синхронизация заняла ${t}мс",
    NOTE_IN_IGNORED_FOLDER: "Заметка сохранена в игнорируемую папку (см. настройки).",
    NOTE_IN_IGNORED_TAGS: "Note is saved with ignored tag (check settings).",
    PLEASE_TAG_NOTE: "Для изучения, пожалуйста, правильно пометьте заметку тегом (см. настройки).",
    RESPONSE_RECEIVED: "Ответ получен.",
    NO_DECK_EXISTS: "Не существует уровня ${deckName}",
    ALL_CAUGHT_UP: "Молодец! Ты справился и дошел до конца! :D",

    // scheduling.ts
    DAYS_STR_IVL: "${interval} дней",
    MONTHS_STR_IVL: "${interval} месяцев",
    YEARS_STR_IVL: "${interval} годов",
    DAYS_STR_IVL_MOBILE: "${interval}д.",
    MONTHS_STR_IVL_MOBILE: "${interval}м.",
    YEARS_STR_IVL_MOBILE: "${interval}г.",
    HOURS_STR_IVL: "${interval}hour(s)",
    MINUTES_STR_IVL: "${interval}minute(s)",
    HOURS_STR_IVL_MOBILE: "${interval}h",
    MINUTES_STR_IVL_MOBILE: "${interval}min",

    // settings.ts
    SETTINGS_HEADER: "Плагин Spaced Repetition - Настройки",
    GROUP_TAGS_FOLDERS: "Tags & Folders",
    GROUP_FLASHCARD_REVIEW: "Flashcard Review",
    GROUP_FLASHCARD_SEPARATORS: "Flashcard Separators",
    GROUP_DATA_STORAGE: "Storage of Scheduling Data",
    GROUP_FLASHCARDS_NOTES: "Flashcards & Notes",
    GROUP_CONTRIBUTING: "Contributing",
    CHECK_WIKI: 'Для дополнительной информации посетите: <a href="${wiki_url}">wiki</a>.',
    GITHUB_DISCUSSIONS:
        'Visit the <a href="${discussions_url}">discussions</a> section for Q&A help, feedback, and general discussion.',
    GITHUB_ISSUES:
        'Raise an issue <a href="${issues_url}">here</a> if you have a feature request or a bug-report.',
    GITHUB_SOURCE_CODE:
        'Project source code available on <a href="${github_project_url}">GitHub</a>',
    CODE_CONTRIBUTION_INFO:
        'Information on <a href="${code_contribution_url}">code contributions</a>',
    TRANSLATION_CONTRIBUTION_INFO:
        'Information on <a href="${translation_contribution_url}">translating the plugin</a> to your language',
    PROJECT_CONTRIBUTIONS:
        'Raise an issue <a href="${issues_url}">here</a> if you have a feature request or a bug-report',
    FOLDERS_TO_IGNORE: "Игнорируемые папки",
    FOLDERS_TO_IGNORE_DESC: `Укажите пути папок, каждый на своей строке, например: Templates Meta/Scripts.
Note that this setting is common to both Flashcards and Notes.`,
    TAGS_TO_IGNORE: "Tags to ignore",
    TAGS_TO_IGNORE_DESC: `Enter tags separated by newlines i.e. #excalidraw.
Note that this setting is common to both Flashcards and Notes.`,
    FLASHCARDS: "Карточки",
    FLASHCARD_EASY_LABEL: 'Текст кнопки "Легко"',
    FLASHCARD_GOOD_LABEL: 'Текст кнопки "Нормально"',
    FLASHCARD_HARD_LABEL: 'Текст кнопки "Сложно"',
    FLASHCARD_EASY_DESC: 'Настроить ярлык для кнопки "Легко"',
    FLASHCARD_GOOD_DESC: 'Настроить ярлык для кнопки "Нормально"',
    FLASHCARD_HARD_DESC: 'Настроить ярлык для кнопки "Сложно"',
    FLASHCARD_TAGS: "Теги карточек",
    FLASHCARD_TAGS_DESC:
        "Укажите теги разделенные Enter-ом или пробелом, например: #flashcards #deck2 #deck3.",
    CONVERT_FOLDERS_TO_DECKS: "Конвертировать папки в уровни и подуровни?",
    CONVERT_FOLDERS_TO_DECKS_DESC: "Это альтернатива описанному выше варианту тегов флэш-карт",
    INLINE_SCHEDULING_COMMENTS: "Сохранять комментарий планирования на последней строке карточки?",
    INLINE_SCHEDULING_COMMENTS_DESC:
        "Включение этой настройки сделает так, что HTML комментарии не будут ломать форматирование списка.",
    BURY_SIBLINGS_TILL_NEXT_DAY: "Прятать родственные карточки до следующего дня?",
    BURY_SIBLINGS_TILL_NEXT_DAY_DESC:
        "Родственные карточки - те, которые образованы из одного текста, пример: карточки с пропусками ([...])",
    MULTI_CLOZE: "enable multi-cloze card?",
    MULTI_CLOZE_DESC: "Combine new/ondue sibling clozes into one card.",
    SHOW_CARD_CONTEXT: "Показывать контекст (уровень) в карточках (во время повторения)?",
    SHOW_CARD_CONTEXT_DESC: "пример: Title > Heading 1 > Subheading > ... > Subheading",
    CARD_MODAL_HEIGHT_PERCENT: "Высота карточки в процентах",
    CARD_MODAL_SIZE_PERCENT_DESC:
        "Если пользуетесь мобильным телефоном, выставьте 100%. Иначе у вас будут огромные изображения",
    RESET_DEFAULT: "Настройки по-умолчанию",
    CARD_MODAL_WIDTH_PERCENT: "Ширина карточки в процентах",
    RANDOMIZE_CARD_ORDER: "Случайный порядок карт во время изучения?",
    REVIEW_CARD_ORDER_WITHIN_DECK: "Порядок отображения карт колоды во время изучения",
    REVIEW_CARD_ORDER_NEW_FIRST_SEQUENTIAL:
        "Последовательно внутри колоды (сначала все новые карты)",
    REVIEW_CARD_ORDER_DUE_FIRST_SEQUENTIAL:
        "Последовательно внутри колоды (сначала все повторяемые карты)",
    REVIEW_CARD_ORDER_NEW_FIRST_RANDOM: "Случайно внутри колоды (сначала все новые карты)",
    REVIEW_CARD_ORDER_DUE_FIRST_RANDOM: "Случайно внутри колоды (сначала все повторяемые карты)",
    REVIEW_CARD_ORDER_RANDOM_DECK_AND_CARD: "Случайная карта из случайной колоды",
    REVIEW_DECK_ORDER: "Порядок отображения колод во время изучения",
    REVIEW_DECK_ORDER_PREV_DECK_COMPLETE_SEQUENTIAL:
        "Последовательно  (после изучения всех карт из предыдущей колоды)",
    REVIEW_DECK_ORDER_PREV_DECK_COMPLETE_RANDOM:
        "Случайно (после изучения всех карт из предыдущей колоды)",
    REVIEW_DECK_ORDER_RANDOM_DECK_AND_CARD: "Случайная карта из случайной колоды",
    DISABLE_CLOZE_CARDS: "Выключить карты с пропусками (пример: [...])?",
    CONVERT_HIGHLIGHTS_TO_CLOZES: "Конвертировать ==выделенный текст== в пропуски (пример: [...])?",
    CONVERT_BOLD_TEXT_TO_CLOZES: "Конвертировать **жирный текст** в пропуски (пример: [...])?",
    CONVERT_CURLY_BRACKETS_TO_CLOZES:
        "Конвертировать {{фигурные скобки}} в пропуски (пример: [...])?",
    INLINE_CARDS_SEPARATOR: "Разделитель для внутристрочных карточек",
    FIX_SEPARATORS_MANUALLY_WARNING:
        "Внимание! После изменения этого вам придётся вручную редактировать уже существующие карточки",
    INLINE_REVERSED_CARDS_SEPARATOR: "Разделитель для обратных внутристрочных карточек",
    MULTILINE_CARDS_SEPARATOR: "Разделитель для многострочных карточек",
    MULTILINE_REVERSED_CARDS_SEPARATOR: "Разделитель для обратных многострочных карточек",
    MULTILINE_CARDS_END_MARKER: "Символы, обозначающие конец клозов и многострочных карточек",
    NOTES: "Заметки",
    REVIEW_PANE_ON_STARTUP: "Включить панель изучения карточек при запуске программы",
    TAGS_TO_REVIEW: "Теги для изучения",
    TAGS_TO_REVIEW_DESC:
        "Введите теги, разделенные Enter-ами или пробелами, например: #review #tag2 #tag3.",
    OPEN_RANDOM_NOTE: "Открыть случайную заметку для изучения",
    OPEN_RANDOM_NOTE_DESC: "Если выключить, то заметки будут отсортированы по важности (PageRank).",
    AUTO_NEXT_NOTE: "После изучения автоматически открывать следующую заметку",
    DISABLE_FILE_MENU_REVIEW_OPTIONS:
        "Выключить выбор сложности изучения в меню файла, т.е.: Изучение: Легко Нормально Сложно",
    DISABLE_FILE_MENU_REVIEW_OPTIONS_DESC:
        "После выключения вы сможете изучать карточки при помощи горячих клавиш. Перезагрузите Obsidian после изменения этой настройки.",
    MAX_N_DAYS_REVIEW_QUEUE: "Наибольшее количество дней для отображение на панели справа",
    MIN_ONE_DAY: "Количество дней не меньше 1.",
    VALID_NUMBER_WARNING: "Пожалуйста, введите подходящее число.",
    UI_PREFERENCES: "Пользовательский интерфейс - Настройки",
    INITIALLY_EXPAND_SUBDECKS_IN_TREE:
        "Деревья колод должны изначально отображаться как развернутые",
    INITIALLY_EXPAND_SUBDECKS_IN_TREE_DESC:
        "Отключите этот параметр, чтобы свернуть вложенные колоды на одной карточке. Полезно, если у вас есть карты, которые принадлежат многим колодам в одном файле.",
    ALGORITHM: "Алгоритм",
    CHECK_ALGORITHM_WIKI:
        'За дополнительной информацией обращайтесь к <a href="${algo_url}">реализация алгоритма</a>.',
    BASE_EASE: "Базовая Лёгкость",
    BASE_EASE_DESC: "минимум = 130, предпочтительно около 250.",
    BASE_EASE_MIN_WARNING: "Лёгкость должна быть минимум 130.",
    LAPSE_INTERVAL_CHANGE:
        'Изменение интервала при выборе "Сложно" во время изучения карточки/заметки',
    LAPSE_INTERVAL_CHANGE_DESC: "новыйПромежуток = старыйПромежуток * изменениеПромежутка / 100.",
    EASY_BONUS: "Легко: бонус",
    EASY_BONUS_DESC:
        "Бонус за Легко позволяет вам установить разницу в промежутках между ответами Хорошо и Легко на карточке/заметке (мин. = 100%).",
    EASY_BONUS_MIN_WARNING: 'Бонус за "Легко" должен быть не меньше 100.',
    MAX_INTERVAL: "Максимальный интервал повторения в днях",
    MAX_INTERVAL_DESC:
        "Позволяет вам устанавливать верхнюю границу на интервал повторения (по умолчанию = 100 лет).",
    MAX_INTERVAL_MIN_WARNING: "Максимальный интервал должен быть не меньше 1.",
    MAX_LINK_CONTRIB: "Максимальный вклад связи (ссылки)",
    MAX_LINK_CONTRIB_DESC:
        'Максимальный вклад среднего значения "Лёгкости" связанных заметок в начальную "Лёгкость".',
    FUZZING: "Fuzzing",
    FUZZING_DESC:
        "When enabled, this adds a small random delay to the new interval time to prevent cards from sticking together and always being reviewed on the same day.",
    SWITCH_SHORT_TERM: "Switch to Short-term Scheduler",
    SWITCH_SHORT_TERM_DESC:
        "When disabled, this allow user to skip the short-term scheduler and directly switch to the long-term scheduler.",
    LOGGING: "Журналирование",
    DISPLAY_DEBUG_INFO: "Отображать отладочную информацию в консоли разработчика",
    DISPLAY_PARSER_DEBUG_INFO:
        "Display debugging information for the parser on the developer console",

    DATA_LOC: "Data Location",
    DATA_LOC_DESC: "Where to store the data file for spaced repetition items.",
    DATA_FOLDER: "Folder for `tracked_files.json`",
    NEW_PER_DAY: "New Per Day",
    NEW_PER_DAY_DESC: "Maximum number of new (unreviewed) notes to add to the queue each day.",
    NEW_PER_DAY_NAN: "Timeout must be a number",
    NEW_PER_DAY_NEG: "New per day must be -1 or greater.",
    REPEAT_ITEMS: "Repeat Items",
    REPEAT_ITEMS_DESC: "Should items marked as incorrect be repeated until correct?",
    ALGORITHMS_CONFIRM: `Switching algorithms might reset or impact review timings on existing items.
    This change is irreversible. Changing algorithms only takes effect after a restart
    or a plugin reload. Are you sure you want to switch algorithms?
    `,
    ALGORITHMS_DESC:
        'The algorithm used for spaced repetition. For more information see <a href="https://github.com/martin-jw/obsidian-recall">algorithms</a>.',
    CONVERT_TRACKED_TO_DECK: "Convert Tracked Notes to decks?",
    REVIEW_FLOATBAR: "Review Response FloatBar",
    REVIEW_FLOATBAR_DESC:
        "only working when autoNextNote is true. show it when reviewing note via click statusbar/sidebar/command.",
    REVIEW_NOTE_DIRECTLY: "Reviewing Note directly?",
    REVIEW_NOTE_DIRECTLY_DESC:
        "when reviewing note via click statusbar or command, open it directly without having to select a tag to open a note",
    INTERVAL_SHOWHIDE: "Display Next Review Interval",
    INTERVAL_SHOWHIDE_DESC: "whether to display next revivew iterval on the response buttons.",
    REQUEST_RETENTION: "Request_retention",
    REQUEST_RETENTION_DESC:
        "The probability (percentage) that you expect to recall the answer the next time you review",
    REVLOG_TAGS: "Tags for output review log",
    REVLOG_TAGS_DESC: "Tags for output review log, could be flashcards tags or/and notes tags",

    FLASHCARD_AGAIN_LABEL: "Again Button Text",
    FLASHCARD_BLACKOUT_LABEL: "Blackout Button Text",
    FLASHCARD_INCORRECT_LABEL: "Incorrect Button Text",
    "FLASHCARD_INCORRECT (EASY)_LABEL": "Incorrect (Easy) Button Text",
    FLASHCARD_AGAIN_DESC: 'Customize the label for the "Again" Button',
    FLASHCARD_BLACKOUT_DESC: 'Customize the label for the "Blackout" Button',
    FLASHCARD_INCORRECT_DESC: 'Customize the label for the "Incorrect" Button',
    "FLASHCARD_INCORRECT (EASY)_DESC": 'Customize the label for the "Incorrect (Easy)" Button',
    UNTRACK_WITH_REVIEWTAG: "UntrackWithReviewTag",

    // sidebar.ts
    NOTES_REVIEW_QUEUE: "Очередь заметок на повторение",
    CLOSE: "Закрыть",
    NEW: "Новые",
    YESTERDAY: "Вчерашние",
    TODAY: "Сегодняшние",
    TOMORROW: "Завтрашние",

    // stats-modal.tsx
    STATS_TITLE: "Статистика",
    MONTH: "Месяц",
    QUARTER: "Квартал",
    YEAR: "Год",
    LIFETIME: "Всё время",
    FORECAST: "Прогноз",
    FORECAST_DESC: "Количество карточек предстоящих для повторения",
    SCHEDULED: "Запланировано",
    DAYS: "Дни",
    NUMBER_OF_CARDS: "Количество карточек",
    REVIEWS_PER_DAY: "Среднее количество: ${avg} повторений в день",
    INTERVALS: "Интервалы",
    INTERVALS_DESC: "Промежутки времени до следующего показа карточек во время повторения",
    COUNT: "Количество",
    INTERVALS_SUMMARY: "Средний промежуток: ${avg}, Самый длинный промежуток: ${longest}",
    EASES: "Прогресс изучения",
    EASES_SUMMARY: "Среднее значение прогресса: ${avgEase}",
    CARD_TYPES: "Типы карточек",
    CARD_TYPES_DESC: "Включая спрятанные карточки, если такие существуют.",
    CARD_TYPE_NEW: "Новых",
    CARD_TYPE_YOUNG: "Повторяемых",
    CARD_TYPE_MATURE: "Изученных",
    CARD_TYPES_SUMMARY: "Всего карточек: ${totalCardsCount}",
    REVIEWED_TODAY: "Reviewed today",
    REVIEWED_TODAY_DESC: "counts of cards/notes you have reviewed today",
    NEW_LEARNED: "New Learned",
    DUE_REVIEWED: "due Reviewed",
    REVIEWED_TODAY_SUMMARY: "Total Reviewed today: ${totalreviewedCount}",
    DATE: "Date",
};
