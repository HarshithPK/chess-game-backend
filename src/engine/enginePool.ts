import { StockfishEngine } from './stockfishEngine';

const engines = new Map<string, StockfishEngine>();

export function getEngine(gameId: string): StockfishEngine {
    if (!engines.has(gameId)) {
        engines.set(gameId, new StockfishEngine());
    }
    return engines.get(gameId)!;
}

export function releaseEngine(gameId: string) {
    const engine = engines.get(gameId);
    if (engine) {
        engine.destroy();
        engines.delete(gameId);
    }
}
