export function timeControlToCategory(tc: string): 'blitz' | 'rapid' {
    if (tc.startsWith('3+') || tc.startsWith('5+')) return 'blitz';
    return 'rapid';
}
