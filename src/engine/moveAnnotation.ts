import type { MoveAnnotation } from '../game/gameTypes';

export function annotateMove(evalLoss: number): MoveAnnotation {
    if (evalLoss <= -300) return '!!'; // brilliant (big improvement)
    if (evalLoss <= -150) return '!'; // strong improvement
    if (evalLoss <= -75) return '!?'; // interesting
    if (evalLoss >= 300) return '??'; // blunder
    if (evalLoss >= 150) return '?'; // mistake
    if (evalLoss >= 75) return '?!'; // dubious
    return null; // normal
}
