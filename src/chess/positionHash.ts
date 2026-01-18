import { BoardState, PlayerColor } from '../game/gameTypes';

export function getPositionHash(
    board: BoardState,
    turn: PlayerColor,
    enPassantTarget: number | null
): string {
    const pieces = board
        .map((sq) =>
            sq.piece ? `${sq.piece.type[0]}${sq.piece.color[0]}${sq.piece.hasMoved ? 1 : 0}` : '__'
        )
        .join('');

    return `${pieces}|${turn}|${enPassantTarget ?? '-'}`;
}
