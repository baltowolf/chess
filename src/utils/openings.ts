import { Chess } from 'chess.js';

export interface ChessOpening {
  eco: string;
  nameRu: string;
  nameEn: string;
  moves: string; // Space-separated SAN moves
}

// Extensive dictionary of popular chess openings
export const OPENING_DATABASE: ChessOpening[] = [
  // --- 1. e4 Open Games ---
  { eco: "C20", nameRu: "Открытый дебют", nameEn: "Open Game", moves: "e4 e5" },
  { eco: "C20", nameRu: "Дебют слона", nameEn: "Bishop's Opening", moves: "e4 e5 Bc4" },
  { eco: "C21", nameRu: "Центральный дебют", nameEn: "Center Game", moves: "e4 e5 d4 exd4" },
  { eco: "C22", nameRu: "Центральный дебют, классический", nameEn: "Center Game, Classical", moves: "e4 e5 d4 exd4 Qxd4" },
  { eco: "C23", nameRu: "Венская партия", nameEn: "Vienna Game", moves: "e4 e5 Nc3" },
  { eco: "C24", nameRu: "Венская партия, вариант Фалькбеера", nameEn: "Vienna Game, Falkbeer Var.", moves: "e4 e5 Nc3 Nf6" },
  { eco: "C26", nameRu: "Венская партия, закрытая система", nameEn: "Vienna Game, Falkbeer/Closed", moves: "e4 e5 Nc3 Nf6 g3" },
  { eco: "C30", nameRu: "Королевский гамбит", nameEn: "King's Gambit", moves: "e4 e5 f4" },
  { eco: "C33", nameRu: "Принятый королевский гамбит", nameEn: "King's Gambit Accepted", moves: "e4 e5 f4 exf4" },
  { eco: "C34", nameRu: "Королевский гамбит, дебют королевского коня", nameEn: "King's Gambit Accepted, Knight's Var.", moves: "e4 e5 f4 exf4 Nf3" },
  { eco: "C30", nameRu: "Отказанный королевский гамбит", nameEn: "King's Gambit Declined", moves: "e4 e5 f4 d6" },
  { eco: "C31", nameRu: "Контргамбит Фалькбеера", nameEn: "Falkbeer Countergambit", moves: "e4 e5 f4 d5" },
  { eco: "C40", nameRu: "Дебют королевского коня", nameEn: "King's Knight Opening", moves: "e4 e5 Nf3" },
  { eco: "C40", nameRu: "Защита Дамиано", nameEn: "Damiano Defense", moves: "e4 e5 Nf3 f6" },
  { eco: "C40", nameRu: "Латвийский гамбит", nameEn: "Latvian Gambit", moves: "e4 e5 Nf3 f5" },
  { eco: "C40", nameRu: "Гамбит слона", nameEn: "Elephant Gambit", moves: "e4 e5 Nf3 d5" },
  { eco: "C41", nameRu: "Защита Филидора", nameEn: "Philidor Defense", moves: "e4 e5 Nf3 d6" },
  { eco: "C42", nameRu: "Русская партия (Защита Петрова)", nameEn: "Petrov's Defense", moves: "e4 e5 Nf3 Nf6" },
  { eco: "C43", nameRu: "Русская партия, атака Стейница", nameEn: "Petrov's Defense, Steinitz Attack", moves: "e4 e5 Nf3 Nf6 d4" },
  { eco: "C44", nameRu: "Дебют трех коней", nameEn: "Three Knights Game", moves: "e4 e5 Nf3 Nc6 Nc3" },
  { eco: "C44", nameRu: "Шотландская партия", nameEn: "Scotch Game", moves: "e4 e5 Nf3 Nc6 d4" },
  { eco: "C45", nameRu: "Шотландская партия, основной вариант", nameEn: "Scotch Game, Main Line", moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4" },
  { eco: "C45", nameRu: "Шотландская партия, атака Мизеса", nameEn: "Scotch Game, Mieses Var.", moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6" },
  { eco: "C46", nameRu: "Дебют четырех коней", nameEn: "Four Knights Game", moves: "e4 e5 Nf3 Nc6 Nc3 Nf6" },
  { eco: "C47", nameRu: "Дебют четырех коней, шотландский вариант", nameEn: "Four Knights Game, Scotch Var.", moves: "e4 e5 Nf3 Nc6 Nc3 Nf6 d4" },
  { eco: "C48", nameRu: "Дебют четырех коней, испанский вариант", nameEn: "Four Knights Game, Spanish Var.", moves: "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5" },
  { eco: "C50", nameRu: "Итальянская партия", nameEn: "Italian Game", moves: "e4 e5 Nf3 Nc6 Bc4" },
  { eco: "C50", nameRu: "Защита двух коней", nameEn: "Two Knights Defense", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6" },
  { eco: "C55", nameRu: "Защита двух коней, современный вариант", nameEn: "Two Knights Defense, Modern Line", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 d3" },
  { eco: "C51", nameRu: "Гамбит Эванса", nameEn: "Evans Gambit", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4" },
  { eco: "C52", nameRu: "Гамбит Эванса, принятый", nameEn: "Evans Gambit Accepted", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3" },
  { eco: "C53", nameRu: "Итальянская партия, тихий вариант (Giuoco Piano)", nameEn: "Italian Game, Giuoco Piano", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5" },
  { eco: "C54", nameRu: "Итальянская партия, тихое начало (Giuoco Pianissimo)", nameEn: "Italian Game, Giuoco Pianissimo", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3" },
  { eco: "C57", nameRu: "Защита двух коней, атака жареной печени (Fried Liver Attack)", nameEn: "Fried Liver Attack", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7" },
  { eco: "C60", nameRu: "Испанская партия (Ruy Lopez)", nameEn: "Ruy Lopez", moves: "e4 e5 Nf3 Nc6 Bb5" },
  { eco: "C61", nameRu: "Испанская партия, защита Берда", nameEn: "Ruy Lopez, Bird's Defense", moves: "e4 e5 Nf3 Nc6 Bb5 Nd4" },
  { eco: "C62", nameRu: "Испанская партия, старая защита Стейница", nameEn: "Ruy Lopez, Old Steinitz", moves: "e4 e5 Nf3 Nc6 Bb5 d6" },
  { eco: "C63", nameRu: "Испанская партия, гамбит Яниша", nameEn: "Ruy Lopez, Schliemann Defense", moves: "e4 e5 Nf3 Nc6 Bb5 f5" },
  { eco: "C64", nameRu: "Испанская партия, классическая защита", nameEn: "Ruy Lopez, Classical Defense", moves: "e4 e5 Nf3 Nc6 Bb5 Bc5" },
  { eco: "C65", nameRu: "Испанская партия, берлинская защита", nameEn: "Ruy Lopez, Berlin Defense", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6" },
  { eco: "C66", nameRu: "Испанская партия, берлинская защита (улучшенная Стейница)", nameEn: "Ruy Lopez, Berlin/Steinitz", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O d6" },
  { eco: "C68", nameRu: "Испанская партия, разменный вариант", nameEn: "Ruy Lopez, Exchange Var.", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6" },
  { eco: "C70", nameRu: "Испанская партия, защита Морфи", nameEn: "Ruy Lopez, Morphy Defense", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4" },
  { eco: "C77", nameRu: "Испанская партия, берлинский вариант защиты Морфи", nameEn: "Ruy Lopez, Anderssen Var.", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6" },
  { eco: "C78", nameRu: "Испанская партия, архангельский вариант", nameEn: "Ruy Lopez, Archangelsk Defense", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7" },
  { eco: "C80", nameRu: "Испанская партия, открытый вариант", nameEn: "Ruy Lopez, Open Var.", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4" },
  { eco: "C90", nameRu: "Испанская партия, закрытый вариант", nameEn: "Ruy Lopez, Closed Var.", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7" },
  { eco: "C92", nameRu: "Испанская партия, вариант Чигорина", nameEn: "Ruy Lopez, Chigorin Defense", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4" },

  // --- 1. e4 Semi-Open Games ---
  { eco: "B00", nameRu: "Дебют Нимцовича", nameEn: "Nimzowitsch Defense", moves: "e4 Nc6" },
  { eco: "B01", nameRu: "Скандинавская защита", nameEn: "Scandinavian Defense", moves: "e4 d5" },
  { eco: "B01", nameRu: "Скандинавская защита, разменный вариант", nameEn: "Scandinavian Defense, Exchange", moves: "e4 d5 exd5" },
  { eco: "B01", nameRu: "Скандинавская защита, главный вариант", nameEn: "Scandinavian Defense, Modern", moves: "e4 d5 exd5 Qxd5" },
  { eco: "B02", nameRu: "Защита Алехина", nameEn: "Alekhine's Defense", moves: "e4 Nf6" },
  { eco: "B03", nameRu: "Защита Алехина, современный вариант", nameEn: "Alekhine's Defense, Modern", moves: "e4 Nf6 e5 Nd5 d4 d6 Nf3" },
  { eco: "B06", nameRu: "Современная защита (Робача)", nameEn: "Modern Defense", moves: "e4 g6" },
  { eco: "B07", nameRu: "Защита Пирца-Уфимцева", nameEn: "Pirc Defense", moves: "e4 d6" },
  { eco: "B07", nameRu: "Защита Пирца-Уфимцева, классический вариант", nameEn: "Pirc Defense, Classical", moves: "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7" },
  { eco: "B09", nameRu: "Защита Пирца-Уфимцева, австрийская атака", nameEn: "Pirc Defense, Austrian Attack", moves: "e4 d6 d4 Nf6 Nc3 g6 f4" },
  { eco: "B10", nameRu: "Защита Каро-Канн", nameEn: "Caro-Kann Defense", moves: "e4 c6" },
  { eco: "B12", nameRu: "Защита Каро-Канн, закрытый вариант", nameEn: "Caro-Kann Defense, Advance Var.", moves: "e4 c6 d4 d5 e5" },
  { eco: "B12", nameRu: "Защита Каро-Канн, закрытый (вариант Таля)", nameEn: "Caro-Kann Defense, Tal Var.", moves: "e4 c6 d4 d5 e5 Bf5 h4" },
  { eco: "B13", nameRu: "Защита Каро-Канн, разменный вариант", nameEn: "Caro-Kann Defense, Exchange", moves: "e4 c6 d4 d5 exd5" },
  { eco: "B14", nameRu: "Защита Каро-Канн, атака Панова", nameEn: "Caro-Kann Defense, Panov Attack", moves: "e4 c6 d4 d5 exd5 cxd5 c4" },
  { eco: "B15", nameRu: "Защита Каро-Канн, классический вариант", nameEn: "Caro-Kann Defense, Classical", moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4" },
  { eco: "B18", nameRu: "Защита Каро-Канн, классический вариант (Смыслова/Петросяна)", nameEn: "Caro-Kann Defense, Classical Main Line", moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5" },
  { eco: "B20", nameRu: "Сицилианская защита", nameEn: "Sicilian Defense", moves: "e4 c5" },
  { eco: "B21", nameRu: "Сицилианская защита, гамбит Морра", nameEn: "Sicilian, Smith-Morra Gambit", moves: "e4 c5 d4 cxd4 c3" },
  { eco: "B21", nameRu: "Сицилианская защита, чикагский гамбит", nameEn: "Sicilian, Halasz-McDonnell Gambit", moves: "e4 c5 f4" },
  { eco: "B22", nameRu: "Сицилианская защита, вариант Алапина", nameEn: "Sicilian Defense, Alapin Variation", moves: "e4 c5 c3" },
  { eco: "B22", nameRu: "Сицилианская защита, вариант Алапина (основной)", nameEn: "Sicilian Defense, Alapin Main Line", moves: "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4" },
  { eco: "B23", nameRu: "Закрытая сицилианская защита", nameEn: "Closed Sicilian", moves: "e4 c5 Nc3" },
  { eco: "B24", nameRu: "Закрытая сицилианская защита, современная система", nameEn: "Closed Sicilian, Modern System", moves: "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6" },
  { eco: "B27", nameRu: "Сицилианская защита, вариант дракона в первой руке", nameEn: "Sicilian Defense, Katalymov Var.", moves: "e4 c5 Nf3 b6" },
  { eco: "B30", nameRu: "Сицилианская защита, старая сицилианская", nameEn: "Sicilian Defense, Old Sicilian", moves: "e4 c5 Nf3 Nc6" },
  { eco: "B31", nameRu: "Сицилианская защита, атака Россолимо", nameEn: "Sicilian Defense, Rossolimo Attack", moves: "e4 c5 Nf3 Nc6 Bb5 g6" },
  { eco: "B32", nameRu: "Сицилианская защита, открытая (Калашников)", nameEn: "Sicilian Defense, Kalashnikov Var.", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5" },
  { eco: "B33", nameRu: "Сицилианская защита, вариант Свешникова", nameEn: "Sicilian Defense, Sveshnikov Var.", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5" },
  { eco: "B40", nameRu: "Сицилианская защита, французский вариант", nameEn: "Sicilian Defense, French Variation", moves: "e4 c5 Nf3 e6" },
  { eco: "B41", nameRu: "Сицилианская защита, вариант Кана", nameEn: "Sicilian Defense, Kan Variation", moves: "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6" },
  { eco: "B44", nameRu: "Сицилианская защита, вариант Тайманова", nameEn: "Sicilian Defense, Taimanov Variation", moves: "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6" },
  { eco: "B50", nameRu: "Сицилианская защита, современный вариант", nameEn: "Sicilian Defense, Modern Line", moves: "e4 c5 Nf3 d6" },
  { eco: "B51", nameRu: "Сицилианская защита, московский вариант", nameEn: "Sicilian Defense, Moscow Variation", moves: "e4 c5 Nf3 d6 Bb5+" },
  { eco: "B52", nameRu: "Сицилианская защита, московский вариант (с c6/Bd7)", nameEn: "Sicilian Defense, Moscow/Canal", moves: "e4 c5 Nf3 d6 Bb5+ Bd7" },
  { eco: "B54", nameRu: "Сицилианская защита, открытая", nameEn: "Open Sicilian", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4" },
  { eco: "B56", nameRu: "Сицилианская защита, классический вариант", nameEn: "Sicilian Defense, Classical", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6" },
  { eco: "B70", nameRu: "Сицилианская защита, вариант Дракона", nameEn: "Sicilian Defense, Dragon Variation", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6" },
  { eco: "B72", nameRu: "Сицилианская защита, дракон (атака Югославская/классическая)", nameEn: "Sicilian Defense, Dragon Classical", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 Be2" },
  { eco: "B75", nameRu: "Сицилианская защита, югославская атака", nameEn: "Sicilian Defense, Yugoslav Attack", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3" },
  { eco: "B80", nameRu: "Сицилианская защита, Шевенингенский вариант", nameEn: "Sicilian Defense, Scheveningen", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6" },
  { eco: "B90", nameRu: "Сицилианская защита, вариант Найдорфа", nameEn: "Sicilian Defense, Najdorf Variation", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6" },
  { eco: "B90", nameRu: "Сицилианская защита, Найдорф (английская атака)", nameEn: "Sicilian, Najdorf English Attack", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3" },
  { eco: "B94", nameRu: "Сицилианская защита, Найдорф (основной вариант)", nameEn: "Sicilian, Najdorf Main Line", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4" },
  { eco: "C00", nameRu: "Французская защита", nameEn: "French Defense", moves: "e4 e6" },
  { eco: "C00", nameRu: "Французская защита, вариант Чигорина", nameEn: "French Defense, Chigorin Var.", moves: "e4 e6 Qe2" },
  { eco: "C01", nameRu: "Французская защита, разменный вариант", nameEn: "French Defense, Exchange", moves: "e4 e6 d4 d5 exd5 exd5" },
  { eco: "C02", nameRu: "Французская защита, закрытая система", nameEn: "French Defense, Advance Var.", moves: "e4 e6 d4 d5 e5" },
  { eco: "C03", nameRu: "Французская защита, вариант Тарраша", nameEn: "French Defense, Tarrasch Variation", moves: "e4 e6 d4 d5 Nd2" },
  { eco: "C05", nameRu: "Французская защита, вариант Тарраша (закрытый)", nameEn: "French Defense, Tarrasch Closed", moves: "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7" },
  { eco: "C10", nameRu: "Французская защита, открытый вариант", nameEn: "French Defense, Open", moves: "e4 e6 d4 d5 Nc3" },
  { eco: "C11", nameRu: "Французская защита, классический вариант", nameEn: "French Defense, Classical", moves: "e4 e6 d4 d5 Nc3 Nf6" },
  { eco: "C11", nameRu: "Французская защита, атака Штейна", nameEn: "French Defense, Steinitz Variation", moves: "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7" },
  { eco: "C12", nameRu: "Французская защита, вариант Мак-Кэтчона", nameEn: "French Defense, MacCutcheon Var.", moves: "e4 e6 d4 d5 Nc3 Nf6 Bg5 Bb4" },
  { eco: "C15", nameRu: "Французская защита, вариант Винавера", nameEn: "French Defense, Winawer Var.", moves: "e4 e6 d4 d5 Nc3 Bb4" },

  // --- 1. d4 Closed Games ---
  { eco: "D00", nameRu: "Дебют ферзевых пешек", nameEn: "Queen's Pawn Game", moves: "d4 d5" },
  { eco: "D00", nameRu: "Гамбит Блэкмара-Димера", nameEn: "Blackmar-Diemer Gambit", moves: "d4 d5 e4 dxe4 Nc3" },
  { eco: "D00", nameRu: "Дебют ферзевых пешек, атака Левитского", nameEn: "Levitsky Attack", moves: "d4 d5 Bg5" },
  { eco: "D02", nameRu: "Лондонская система", nameEn: "London System", moves: "d4 d5 Nf3 Nf6 Bf4" },
  { eco: "D02", nameRu: "Лондонская система (упрощенная)", nameEn: "London System (General)", moves: "d4 d5 Bf4" },
  { eco: "D02", nameRu: "Дебют ферзевых пешек, новоиндийское построение", nameEn: "Queen's Pawn Game, Symmetrical", moves: "d4 d5 Nf3 Nf6" },
  { eco: "D03", nameRu: "Дебют ферзевых пешек, система Колле", nameEn: "Colle System", moves: "d4 d5 Nf3 Nf6 e3" },
  { eco: "D04", nameRu: "Дебют ферзевых пешек, система Колле (с c3)", nameEn: "Colle System (Classical)", moves: "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3" },
  { eco: "D05", nameRu: "Дебют ферзевых пешек, система Цукерторта", nameEn: "Colle-Zukertort System", moves: "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3" },
  { eco: "D06", nameRu: "Ферзевый гамбит", nameEn: "Queen's Gambit", moves: "d4 d5 c4" },
  { eco: "D06", nameRu: "Ферзевый гамбит, симметричная защита", nameEn: "Queen's Gambit, Symmetrical Def.", moves: "d4 d5 c4 c5" },
  { eco: "D06", nameRu: "Защита Маршалла", nameEn: "Marshall Defense", moves: "d4 d5 c4 Nf6" },
  { eco: "D07", nameRu: "Защита Чигорина", nameEn: "Chigorin Defense", moves: "d4 d5 c4 Nc3" },
  { eco: "D08", nameRu: "Контргамбит Альбина", nameEn: "Albin Countergambit", moves: "d4 d5 c4 e5" },
  { eco: "D09", nameRu: "Контргамбит Альбина, ловушка Ласкера", nameEn: "Albin Countergambit, Lasker Trap", moves: "d4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3" },
  { eco: "D10", nameRu: "Славянская защита", nameEn: "Slav Defense", moves: "d4 d5 c4 c6" },
  { eco: "D11", nameRu: "Славянская защита, тихий вариант", nameEn: "Slav Defense, Quiet Variation", moves: "d4 d5 c4 c6 Nf3 Nf6" },
  { eco: "D13", nameRu: "Славянская защита, разменный вариант", nameEn: "Slav Defense, Exchange Variation", moves: "d4 d5 c4 c6 cxd5 cxd5" },
  { eco: "D15", nameRu: "Славянская защита, челябинский вариант", nameEn: "Slav Defense, Czech Variation", moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5" },
  { eco: "D20", nameRu: "Принятый ферзевый гамбит", nameEn: "Queen's Gambit Accepted", moves: "d4 d5 c4 dxc4" },
  { eco: "D21", nameRu: "Принятый ферзевый гамбит, классический вариант", nameEn: "Queen's Gambit Accepted, Modern", moves: "d4 d5 c4 dxc4 Nf3 Nf6" },
  { eco: "D30", nameRu: "Отказанный ферзевый гамбит", nameEn: "Queen's Gambit Declined", moves: "d4 d5 c4 e6" },
  { eco: "D31", nameRu: "Полуславянская защита", nameEn: "Semi-Slav Defense", moves: "d4 d5 c4 e6 Nc3 c6" },
  { eco: "D35", nameRu: "Отказанный ферзевый гамбит, разменный вариант", nameEn: "Queen's Gambit Declined, Exchange", moves: "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5" },
  { eco: "D37", nameRu: "Отказанный ферзевый гамбит, вариант 4.Nf3", nameEn: "Queen's Gambit Declined, Classical", moves: "d4 d5 c4 e6 Nc3 Nf6 Nf3" },
  { eco: "D43", nameRu: "Полуславянская защита, основной вариант", nameEn: "Semi-Slav Defense, Main Line", moves: "d4 d5 c4 e6 Nc3 Nf6 Nf3 c6" },
  { eco: "D45", nameRu: "Полуславянская защита, система Ботвинника", nameEn: "Semi-Slav, Botvinnik System", moves: "d4 d5 c4 e6 Nc3 Nf6 Nf3 c6 e3 Nbd7" },
  { eco: "D50", nameRu: "Отказанный ферзевый гамбит, атака Пильсбери", nameEn: "Queen's Gambit Declined, Lasker Var.", moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5" },
  { eco: "D55", nameRu: "Отказанный ферзевый гамбит, защита Тарраша", nameEn: "Queen's Gambit Declined, Tarrasch Def.", moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 Nf3 O-O e3" },

  // --- 1. d4 Semi-Closed Games (Indian Family) ---
  { eco: "A45", nameRu: "Атака Тромповского", nameEn: "Trompowsky Attack", moves: "d4 Nf6 Bg5" },
  { eco: "A46", nameRu: "Дебют ферзевых пешек, индийское построение", nameEn: "Queen's Pawn, Indian Setup", moves: "d4 Nf6 Nf3" },
  { eco: "A48", nameRu: "Новоиндийское начало", nameEn: "East Indian Defense", moves: "d4 Nf6 Nf3 g6" },
  { eco: "A48", nameRu: "Новоиндийское начало, лондонский вариант", nameEn: "East Indian, London System", moves: "d4 Nf6 Nf3 g6 Bf4" },
  { eco: "E00", nameRu: "Каталонское начало", nameEn: "Catalan Opening", moves: "d4 Nf6 c4 e6 g3" },
  { eco: "E01", nameRu: "Каталонское начало, закрытый вариант", nameEn: "Catalan, Closed Var.", moves: "d4 Nf6 c4 e6 g3 d5 Bg2" },
  { eco: "E06", nameRu: "Каталонское начало, открытый вариант", nameEn: "Catalan, Open Var.", moves: "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O" },
  { eco: "E10", nameRu: "Будапештский гамбит", nameEn: "Budapest Gambit", moves: "d4 Nf6 c4 e5" },
  { eco: "E11", nameRu: "Защита Боголюбова", nameEn: "Bogo-Indian Defense", moves: "d4 Nf6 c4 e6 Nf3 Bb4+" },
  { eco: "E12", nameRu: "Новоиндийская защита", nameEn: "Queen's Indian Defense", moves: "d4 Nf6 c4 e6 Nf3 b6" },
  { eco: "E20", nameRu: "Защита Нимцовича", nameEn: "Nimzo-Indian Defense", moves: "d4 Nf6 c4 e6 Nc3 Bb4" },
  { eco: "A56", nameRu: "Защита Бенони", nameEn: "Benoni Defense", moves: "d4 Nf6 c4 c5" },
  { eco: "A57", nameRu: "Волжский гамбит (гамбит Бенко)", nameEn: "Benko Gambit", moves: "d4 Nf6 c4 c5 d5 b5" },
  { eco: "A60", nameRu: "Модерн-Бенони", nameEn: "Modern Benoni", moves: "d4 Nf6 c4 c5 d5 e6" },
  { eco: "A80", nameRu: "Голландская защита", nameEn: "Dutch Defense", moves: "d4 f5" },
  { eco: "A81", nameRu: "Голландская защита, Ленинградская система", nameEn: "Dutch, Leningrad System", moves: "d4 f5 g3 Nf6 Bg2 g6" },
  { eco: "E60", nameRu: "Староиндийское семейство", nameEn: "King's Indian Family", moves: "d4 Nf6 c4 g6" },
  { eco: "E61", nameRu: "Староиндийская защита", nameEn: "King's Indian Defense", moves: "d4 Nf6 c4 g6 Nc3 Bg7" },
  { eco: "E62", nameRu: "Староиндийская защита, фианкетто", nameEn: "King's Indian, Fianchetto Var.", moves: "d4 Nf6 c4 g6 Nc3 Bg7 Nf3 d6 g3 O-O Bg2" },
  { eco: "E90", nameRu: "Староиндийская защита, классическая система", nameEn: "King's Indian, Classical System", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O" },
  { eco: "D70", nameRu: "Защита Грюнфельда", nameEn: "Grünfeld Defense", moves: "d4 Nf6 c4 g6 Nc3 d5" },
  { eco: "D80", nameRu: "Защита Грюнфельда, классическая система", nameEn: "Grünfeld Defense, Classical System", moves: "d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7" },

  // --- Flank Openings (1. c4, 1. Nf3, etc.) ---
  { eco: "A10", nameRu: "Английское начало", nameEn: "English Opening", moves: "c4" },
  { eco: "A11", nameRu: "Английское начало, англо-славянский вариант", nameEn: "English Opening, Slav System", moves: "c4 c6" },
  { eco: "A13", nameRu: "Английское начало, англо-новоиндийский вариант", nameEn: "English Opening, King's English", moves: "c4 e6" },
  { eco: "A15", nameRu: "Английское начало, англо-индийский вариант", nameEn: "English Opening, Anglo-Indian", moves: "c4 Nf6" },
  { eco: "A20", nameRu: "Английское начало, сицилианская в первой руке", nameEn: "English, King's English Var.", moves: "c4 e5" },
  { eco: "A30", nameRu: "Английское начало, симметричный вариант", nameEn: "English Opening, Symmetrical", moves: "c4 c5" },
  { eco: "A04", nameRu: "Дебют Рети", nameEn: "Réti Opening", moves: "Nf3" },
  { eco: "A05", nameRu: "Дебют Рети, королевско-индийское начало", nameEn: "Réti Opening, Anglo-Indian Setup", moves: "Nf3 Nf6" },
  { eco: "A07", nameRu: "Староиндийское начало", nameEn: "King's Indian Attack", moves: "Nf3 d5 g3" },
  { eco: "A08", nameRu: "Староиндийское начало, французский вариант", nameEn: "King's Indian Attack, French Setup", moves: "Nf3 d5 g3 e6 Bg2 Nf6 O-O Be7 d3" },
  { eco: "A09", nameRu: "Дебют Рети, гамбит Рети", nameEn: "Réti Opening, Réti Gambit", moves: "Nf3 d5 c4" },
  { eco: "A02", nameRu: "Дебют Берда", nameEn: "Bird's Opening", moves: "f4" },
  { eco: "A03", nameRu: "Дебют Берда, классический вариант", nameEn: "Bird's Opening, Symmetrical", moves: "f4 d5" },
  { eco: "A01", nameRu: "Дебют Ларсена (b3)", nameEn: "Nimzowitsch-Larsen Attack", moves: "b3" },
  { eco: "A00", nameRu: "Дебют Бенко (g3)", nameEn: "Benko's Opening / King's Fianchetto", moves: "g3" },
  { eco: "A00", nameRu: "Дебют Сокольского (b4)", nameEn: "Polish (Sokolsky) Opening", moves: "b4" },
  { eco: "A00", nameRu: "Атака Гроба (g4)", nameEn: "Grob's Attack", moves: "g4" },
  { eco: "A00", nameRu: "Дебют Сарагосы (c3)", nameEn: "Saragossa Opening", moves: "c3" },
  { eco: "A00", nameRu: "Дебют Андерсена (a3)", nameEn: "Anderssen's Opening", moves: "a3" },
];

/**
 * Finds the chess opening that matches the longest prefix of the provided SAN moves list.
 * 
 * @param moveSans Array of played moves in Standard Algebraic Notation (SAN), e.g., ["e4", "c5", "Nf3", "d6"]
 * @returns The matching ChessOpening, or null if no openings are matched.
 */
export function getOpeningFromMoves(moveSans: string[]): ChessOpening | null {
  if (!moveSans || moveSans.length === 0) {
    return null;
  }

  // Generate sequence of moves
  const currentSequence = moveSans.map(m => m.trim()).join(" ");

  let bestMatch: ChessOpening | null = null;
  let bestMatchLength = 0;

  for (const opening of OPENING_DATABASE) {
    // Normalise spaces in the database move list
    const openingMoves = opening.moves.trim();
    
    // Check if the current game is exactly equal to or starts with the opening's moves
    if (currentSequence === openingMoves || currentSequence.startsWith(openingMoves + " ")) {
      const openingMovesLength = openingMoves.split(" ").length;
      if (openingMovesLength > bestMatchLength) {
        bestMatch = opening;
        bestMatchLength = openingMovesLength;
      }
    }
  }

  return bestMatch;
}

// Let's normalize FEN to just piece placement, turn, castling rights, and en passant (fields 0-3)
export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

// We can enrich the ChessOpening interface or have a map
const openingFenMap = new Map<string, string>(); // maps opening moves string -> normalized FEN

export function getOpeningFen(movesStr: string): string {
  const cached = openingFenMap.get(movesStr);
  if (cached) return cached;

  try {
    const chess = new Chess();
    const moves = movesStr.trim().split(/\s+/);
    for (const move of moves) {
      if (move) chess.move(move);
    }
    const norm = normalizeFen(chess.fen());
    openingFenMap.set(movesStr, norm);
    return norm;
  } catch (e) {
    openingFenMap.set(movesStr, '');
    return '';
  }
}

export function getTranspositions(currentMoves: string[], currentOpening: ChessOpening | null): ChessOpening[] {
  if (currentMoves.length === 0) return [];
  
  try {
    const chess = new Chess();
    for (const m of currentMoves) {
      chess.move(m);
    }
    const currentNormFen = normalizeFen(chess.fen());
    if (!currentNormFen) return [];

    const currentMovesStr = currentMoves.map(m => m.trim()).join(' ');

    const matches: ChessOpening[] = [];
    for (const op of OPENING_DATABASE) {
      // Skip the current matched opening to avoid listing itself
      if (currentOpening && op.eco === currentOpening.eco && op.nameEn === currentOpening.nameEn) {
        continue;
      }
      
      const opFen = getOpeningFen(op.moves);
      if (opFen === currentNormFen) {
        // Also ensure the moves are actually different textually (transposition!)
        if (op.moves.trim() !== currentMovesStr) {
          matches.push(op);
        }
      }
    }
    return matches;
  } catch (e) {
    return [];
  }
}

export interface OpeningVariation {
  nextMove: string;
  opening: ChessOpening;
}

export function getOpeningVariations(currentMoves: string[]): OpeningVariation[] {
  const currentMovesStr = currentMoves.map(m => m.trim()).join(' ');
  const prefix = currentMovesStr ? currentMovesStr + ' ' : '';

  const map = new Map<string, ChessOpening>(); // nextMove -> Best/shortest opening that matches

  for (const op of OPENING_DATABASE) {
    const opMoves = op.moves.trim();
    if (prefix === '') {
      // At starting position, immediate moves are the first moves of openings
      const parts = opMoves.split(/\s+/);
      const nextMove = parts[0];
      if (nextMove) {
        const existing = map.get(nextMove);
        const partsLen = parts.length;
        if (!existing || partsLen < existing.moves.trim().split(/\s+/).length) {
          map.set(nextMove, op);
        }
      }
    } else if (opMoves.startsWith(prefix)) {
      const rest = opMoves.slice(prefix.length).trim();
      if (rest) {
        const parts = rest.split(/\s+/);
        const nextMove = parts[0];
        if (nextMove) {
          const existing = map.get(nextMove);
          const opLen = opMoves.split(/\s+/).length;
          if (!existing || opLen < existing.moves.trim().split(/\s+/).length) {
            map.set(nextMove, op);
          }
        }
      }
    }
  }

  const results: OpeningVariation[] = [];
  map.forEach((opening, nextMove) => {
    results.push({ nextMove, opening });
  });

  return results.sort((a, b) => a.nextMove.localeCompare(b.nextMove));
}

