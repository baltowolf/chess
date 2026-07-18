import { Chess } from 'chess.js';

export interface ChessPuzzle {
  id: string;
  title: string;
  description: string;
  fen: string;
  solution: string[]; // sequence of moves in SAN, e.g., ['Qxg8+', 'Rxg8', 'Nf7#'] or simply standard SAN moves
  difficulty: 'Easy' | 'Medium' | 'Hard';
  theme: string;
  initialMove?: string;
}

export const PUZZLE_DATABASE: ChessPuzzle[] = [
  {
    id: '1',
    title: 'Smothered Mate (Philidor\'s Legacy)',
    description: 'White to move. Sacrifices are temporary, but checkmate is permanent.',
    fen: '5r1k/5Qpp/5N2/8/8/8/8/6RK w - - 0 1',
    solution: ['Qg8+', 'Rxg8', 'Nf7#'],
    difficulty: 'Medium',
    theme: 'Smothered Mate'
  },
  {
    id: '2',
    title: 'Back Rank Weakness',
    description: 'White to move. Spot the vulnerable back rank to deliver a swift mate.',
    fen: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
    solution: ['Rd8#'],
    difficulty: 'Easy',
    theme: 'Back Rank Mate'
  },
  {
    id: '3',
    title: 'Anastasia\'s Mate',
    description: 'White to move. Deliver checkmate using the knight to control escape squares and the rook to seal the h-file.',
    fen: 'q4r1k/pp2N1pp/8/3Q4/8/3R4/PPP2PP1/2K5 w - - 0 1',
    solution: ['Qxh7+', 'Kxh7', 'Rh3#'],
    difficulty: 'Hard',
    theme: 'Mating Net'
  },
  {
    id: '4',
    title: 'Back Rank Deflection',
    description: 'White to play and win by deflecting the defender of the back rank.',
    fen: '5rk1/5ppp/8/2Q5/8/8/1q3PPP/3R2K1 w - - 0 1',
    solution: ['Qxf8+', 'Kxf8', 'Rd8#'],
    difficulty: 'Medium',
    theme: 'Deflection'
  },
  {
    id: '5',
    title: 'Black\'s Counter-Strike',
    description: 'Black to play and find a deadly tactical fork.',
    fen: 'r1b1k2r/ppq2ppp/2n1p3/3p4/4P3/1N1B4/PPP1QPPP/R3K2R b KQkq - 0 1',
    solution: ['dxe4'],
    difficulty: 'Easy',
    theme: 'Free Center'
  },
  {
    id: '6',
    title: 'Opera House Masterclass',
    description: 'White to move. Can you find Paul Morphy\'s famous queen sacrifice for a brilliant smothered-like back rank mate?',
    fen: '4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 14',
    solution: ['Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#'],
    difficulty: 'Hard',
    theme: 'Queen Sacrifice'
  },
  {
    id: '7',
    title: 'Attacking the King',
    description: 'Black to play and launch a devastating attack on the exposed king.',
    fen: 'r1bqk2r/pppp1ppp/2n5/4p3/2B1P1n1/2NP4/PPP2KPP/R1BQ2NR b kq - 0 1',
    solution: ['Qh4+'],
    difficulty: 'Easy',
    theme: 'King Hunt'
  },
  {
    id: '8',
    title: 'The Fishing Pole Attack',
    description: 'Black to play and find the forced tactical sequence following a pin.',
    fen: 'r1bqk2r/pppp1ppp/2n5/4p1B1/1b2P1n1/2NP1N2/PPP2PPP/R3KB1R b KQkq - 4 5',
    solution: ['Qxg5'],
    difficulty: 'Medium',
    theme: 'Tactical Trap'
  },
  {
    id: '9',
    title: 'Legal\'s Mate',
    description: 'White to play. Sacrifice the queen for a beautiful mating sequence with minor pieces.',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4p1B1/4P3/3P1N2/PPP2PPP/R2QKB1R w KQkq - 1 6',
    solution: ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
    difficulty: 'Hard',
    theme: 'Queen Sacrifice'
  },
  {
    id: '10',
    title: 'Greek Gift Sacrifice',
    description: 'White to play. Launch a classic bishop sacrifice on h7 to expose the opponent king.',
    fen: 'r1bqrbk1/ppp2ppp/2n1pn2/3p4/3P4/PP1BPN2/1BPN1PPP/R2Q1RK1 w - - 0 1',
    solution: ['Bxh7+', 'Kxh7', 'Ng5+'],
    difficulty: 'Medium',
    theme: 'Greek Gift'
  },
  {
    id: '11',
    title: 'Underpromotion Defeats Defense',
    description: 'White to play and promote the pawn to win. Look out for stalemate traps!',
    fen: '8/P7/8/8/8/8/5K1k/8 w - - 0 1',
    solution: ['a8=R'],
    difficulty: 'Medium',
    theme: 'Underpromotion'
  },
  {
    id: '12',
    title: 'Knight Fork Victory',
    description: 'White to play and win material with a devastating fork.',
    fen: 'r3kb1r/ppp1qp1p/2np1p2/4p3/2B1P1b1/2NP3/PPP2PPP/R2QK2R w KQkq - 0 1',
    solution: ['Nd5', 'Qd8', 'Nxf6+'],
    difficulty: 'Easy',
    theme: 'Fork'
  },
  {
    id: 'reti_1921',
    title: 'Пешечный этюд Рети (1921)',
    description: 'Белые начинают и делают ничью. Кажется невозможным догнать черную пешку "h" или провести свою пешку "c", но геометрические свойства шахматной доски творят чудеса. Идея - одновременное преследование двух целей.',
    fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
    solution: ['Kg7', 'h4', 'Kf6'],
    difficulty: 'Hard',
    theme: 'Endgame Study'
  },
  {
    id: 'steinitz_1895',
    title: 'Бессмертная ладья Стейница (1895)',
    description: 'Ход белых. Начните легендарную матовую атаку Вильгельма Стейница с сумасшедшей жертвой ладьи! Фигуры черных зависли в воздухе.',
    fen: 'r3k2r/ppq1n1pp/2p2p2/3p2N1/5Q2/2N5/PP3PPP/R3R1K1 w kq - 0 22',
    solution: ['Rxe7+', 'Kf8', 'Rf7+', 'Kg8', 'Rg7+', 'Kh8', 'Rxh7+'],
    difficulty: 'Hard',
    theme: 'Rook Sacrifice'
  },
  {
    id: 'adams_torre_1920',
    title: 'Адамс против Торре (1920)',
    description: 'Ход белых. Каскад жертв ферзя по e-файлу и c-файлу ради перегрузки защиты восьмой горизонтали черных.',
    fen: 'r1r3k1/p4ppp/1p1Bp3/1Q6/3q4/8/PP3PPP/R3R1K1 w - - 0 18',
    solution: ['Qg4', 'Qb5', 'Qc4', 'Qd7', 'Qc7', 'Qb5', 'a4', 'Qxb2', 'Re2', 'Qb3', 'Qxb7'],
    difficulty: 'Hard',
    theme: 'Deflection'
  },
  {
    id: 'byrne_fischer_1956',
    title: 'Игра века: Фишер против Бирна (1956)',
    description: 'Ход черных. 13-летний Бобби Фишер делает один из самых известных ходов в истории шахмат — жертву ферзя Be6!!, принуждая белых к безнадежной позиции.',
    fen: 'r3k2r/pp3p1p/2n1p1p1/1B1p4/q1P5/2N5/PP3PPP/R3K2R b KQkq - 1 17',
    solution: ['Be6', 'Bxa4', 'Bxc4+', 'Kg1', 'Ne2+', 'Kf1', 'Nxd4+', 'Kg1', 'Ne2+', 'Kf1', 'Nc3+', 'Kg1', 'axb5'],
    difficulty: 'Hard',
    theme: 'Queen Sacrifice'
  }
];
