export function migrationName(path: string): string;
export function isMigrationFile(path: string): boolean;
export function pendingMigrations(paths: string[], applied: string[]): Array<{ name: string; path: string }>;
