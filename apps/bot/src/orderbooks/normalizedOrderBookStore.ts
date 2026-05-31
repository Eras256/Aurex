import { NormalizedOrderBook } from '@arbitrage/core';

type BookUpdateListener = (book: NormalizedOrderBook) => void;

export class NormalizedOrderBookStore {
  // Structure: books[exchangeId][symbol] = NormalizedOrderBook
  private books: Record<string, Record<string, NormalizedOrderBook>> = {};
  private listeners: BookUpdateListener[] = [];

  updateBook(book: NormalizedOrderBook) {
    if (!this.books[book.exchangeId]) {
      this.books[book.exchangeId] = {};
    }
    
    this.books[book.exchangeId][book.symbol] = book;

    // Broadcast to listeners (primarily the ArbitrageEngine)
    for (const listener of this.listeners) {
      try {
        listener(book);
      } catch (error) {
        // Suppress and log listener failures to maintain cache throughput
        console.error('NormalizedOrderBookStore: Listener update failed', error);
      }
    }
  }

  getBook(exchangeId: string, symbol: string): NormalizedOrderBook | null {
    return this.books[exchangeId]?.[symbol] || null;
  }

  getAllBooks(): Record<string, Record<string, NormalizedOrderBook>> {
    return this.books;
  }

  addListener(listener: BookUpdateListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: BookUpdateListener) {
    this.listeners = this.listeners.filter((l) => l !== l);
  }
}

export const orderBookStore = new NormalizedOrderBookStore();
