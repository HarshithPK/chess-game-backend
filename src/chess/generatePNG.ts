import { Game } from '../game/gameTypes';

function resultString(game: Game): string {
    if (game.endReason === 'checkmate') {
        return game.winner === 'white' ? '1-0' : '0-1';
    }

    if (
        game.endReason === 'stalemate' ||
        game.endReason === 'threefold' ||
        game.endReason === 'fifty-move' ||
        game.endReason === 'insufficient-material'
    ) {
        return '1/2-1/2';
    }

    if (game.endReason === 'resign') {
        return game.winner === 'white' ? '1-0' : '0-1';
    }

    return '*';
}

function annotatedSAN(san?: string, annotation?: string | null): string {
    if (!san) return '';
    if (!annotation) return san;
    return `${san}${annotation}`;
}

export function generatePGN(game: Game): string {
    const headers = [
        `[Event "Online Game"]`,
        `[Site "Your App"]`,
        `[Date "${new Date(game.createdAt).toISOString().slice(0, 10)}"]`,
        `[White "${game.players.white?.playerId ?? 'Unknown'}"]`,
        `[Black "${game.players.black?.playerId ?? 'Unknown'}"]`,
        `[Result "${resultString(game)}"]`,
    ];

    const moves: string[] = [];

    for (let i = 0; i < game.moveHistory.length; i++) {
        const move = game.moveHistory[i];
        if (!move.san) continue;

        const sanWithAnnotation = annotatedSAN(move.san, move.annotation);

        if (i % 2 === 0) {
            // White move
            moves.push(`${Math.floor(i / 2) + 1}. ${sanWithAnnotation}`);
        } else {
            // Black move
            moves[moves.length - 1] += ` ${sanWithAnnotation}`;
        }
    }

    return `${headers.join('\n')}\n\n${moves.join(' ')} ${resultString(game)}`;
}
