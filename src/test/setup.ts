// Les repos de stockage lisent `localStorage`, qui n'existe pas sous Node.
// Un stub en mémoire suffit : les tests portent sur la logique, pas sur le
// navigateur. Évite d'avoir à tirer jsdom pour quelques lectures de clés.

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

globalThis.localStorage = new MemoryStorage();
