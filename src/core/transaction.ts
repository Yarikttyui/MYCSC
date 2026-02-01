import { v4 as uuidv4 } from 'uuid';
import { Row, Transaction, TransactionOperation } from './types';

export class TransactionManager {
  private transactions: Map<string, TransactionContext> = new Map();
  private globalLocks: Map<string, Set<string>> = new Map();
  begin(): string {
    const id = uuidv4();
    const transaction: TransactionContext = {
      id,
      startedAt: new Date(),
      operations: [],
      status: 'active',
      savepoints: new Map(),
      locks: new Set()
    };
    this.transactions.set(id, transaction);
    return id;
  }
  get(transactionId: string): TransactionContext | undefined {
    return this.transactions.get(transactionId);
  }
  recordInsert(transactionId: string, table: string, row: Row, rowId: number): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.operations.push({
      type: 'INSERT',
      table,
      rowId,
      newData: { ...row }
    });

    this.acquireLock(transactionId, table);
  }
  recordUpdate(transactionId: string, table: string, rowId: number, oldData: Row, newData: Row): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.operations.push({
      type: 'UPDATE',
      table,
      rowId,
      oldData: { ...oldData },
      newData: { ...newData }
    });

    this.acquireLock(transactionId, table);
  }
  recordDelete(transactionId: string, table: string, rowId: number, oldData: Row): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.operations.push({
      type: 'DELETE',
      table,
      rowId,
      oldData: { ...oldData }
    });

    this.acquireLock(transactionId, table);
  }
  savepoint(transactionId: string, name: string): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.savepoints.set(name, tx.operations.length);
  }
  rollbackToSavepoint(transactionId: string, name: string): TxOperation[] {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    const savepointIndex = tx.savepoints.get(name);
    if (savepointIndex === undefined) {
      throw new Error(`Savepoint "${name}" not found`);
    }
    const operationsToRollback = tx.operations.splice(savepointIndex);
    return operationsToRollback.reverse();
  }
  releaseSavepoint(transactionId: string, name: string): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    if (!tx.savepoints.has(name)) {
      throw new Error(`Savepoint "${name}" not found`);
    }

    tx.savepoints.delete(name);
  }
  commit(transactionId: string): void {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.status = 'committed';
    this.releaseLocks(transactionId);
    this.transactions.delete(transactionId);
  }
  rollback(transactionId: string): TxOperation[] {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'active') {
      throw new Error('Transaction not found or not active');
    }

    tx.status = 'rolledback';
    this.releaseLocks(transactionId);
    const operations = [...tx.operations].reverse();
    this.transactions.delete(transactionId);
    
    return operations;
  }
  isActive(transactionId: string): boolean {
    const tx = this.transactions.get(transactionId);
    return tx?.status === 'active';
  }
  private acquireLock(transactionId: string, table: string): void {
    const tx = this.transactions.get(transactionId);
    if (!tx) return;

    if (!this.globalLocks.has(table)) {
      this.globalLocks.set(table, new Set());
    }
    
    this.globalLocks.get(table)!.add(transactionId);
    tx.locks.add(table);
  }
  private releaseLocks(transactionId: string): void {
    const tx = this.transactions.get(transactionId);
    if (!tx) return;

    for (const table of tx.locks) {
      const tableLocks = this.globalLocks.get(table);
      if (tableLocks) {
        tableLocks.delete(transactionId);
        if (tableLocks.size === 0) {
          this.globalLocks.delete(table);
        }
      }
    }
    tx.locks.clear();
  }
  isTableLocked(table: string, excludeTransactionId?: string): boolean {
    const locks = this.globalLocks.get(table);
    if (!locks || locks.size === 0) return false;
    
    if (excludeTransactionId) {
      for (const txId of locks) {
        if (txId !== excludeTransactionId) return true;
      }
      return false;
    }
    
    return true;
  }
  getStats(): TransactionStats {
    let active = 0;
    let totalOperations = 0;

    for (const tx of this.transactions.values()) {
      if (tx.status === 'active') active++;
      totalOperations += tx.operations.length;
    }

    return {
      activeTransactions: active,
      totalOperations,
      lockedTables: Array.from(this.globalLocks.keys())
    };
  }
}
interface TransactionContext {
  id: string;
  startedAt: Date;
  operations: TxOperation[];
  status: 'active' | 'committed' | 'rolledback';
  savepoints: Map<string, number>;
  locks: Set<string>;
}
export interface TxOperation {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  rowId: number;
  oldData?: Row;
  newData?: Row;
}
interface TransactionStats {
  activeTransactions: number;
  totalOperations: number;
  lockedTables: string[];
}

export const transactionManager = new TransactionManager();
