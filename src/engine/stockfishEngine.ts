import { spawn } from 'child_process';
import { getStockfishPath } from './stockfishPath';

type EngineEval = { type: 'cp'; value: number } | { type: 'mate'; value: number };

export class StockfishEngine {
    private process = spawn(getStockfishPath(), [], {
        stdio: ['pipe', 'pipe', 'ignore'],
    });

    private resolveEval: ((evalResult: EngineEval) => void) | null = null;

    constructor() {
        this.process.stdout.on('data', (data) => {
            this.handleOutput(data.toString());
        });

        this.send('uci');
    }

    evaluate(fen: string): Promise<EngineEval> {
        return new Promise((resolve) => {
            this.resolveEval = resolve;
            this.send('ucinewgame');
            this.send(`position fen ${fen}`);
            this.send('go depth 15');
        });
    }

    private handleOutput(output: string) {
        if (!this.resolveEval) return;

        const cpMatch = output.match(/score cp (-?\d+)/);
        if (cpMatch) {
            this.resolveEval({
                type: 'cp',
                value: parseInt(cpMatch[1], 10),
            });
            this.cleanup();
            return;
        }

        const mateMatch = output.match(/score mate (-?\d+)/);
        if (mateMatch) {
            this.resolveEval({
                type: 'mate',
                value: parseInt(mateMatch[1], 10),
            });
            this.cleanup();
        }
    }

    private cleanup() {
        this.send('stop');
        this.resolveEval = null;
    }

    private send(cmd: string) {
        this.process.stdin.write(cmd + '\n');
    }

    destroy() {
        this.process.kill();
    }
}
