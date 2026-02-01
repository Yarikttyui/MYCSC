import { IndexType, IndexDefinition } from './types';

export class BTreeNode<K, V> {
  keys: K[] = [];
  values: V[] = [];
  children: BTreeNode<K, V>[] = [];
  isLeaf: boolean = true;
  parent: BTreeNode<K, V> | null = null;

  constructor(isLeaf: boolean = true) {
    this.isLeaf = isLeaf;
  }
}

export class BTree<K, V> {
  private root: BTreeNode<K, V>;
  private order: number;
  private comparator: (a: K, b: K) => number;

  constructor(order: number = 3, comparator?: (a: K, b: K) => number) {
    this.order = order;
    this.root = new BTreeNode<K, V>(true);
    this.comparator = comparator || ((a: K, b: K) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  }
  search(key: K): V | null {
    return this.searchNode(this.root, key);
  }

  private searchNode(node: BTreeNode<K, V>, key: K): V | null {
    let i = 0;
    while (i < node.keys.length && this.comparator(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.comparator(key, node.keys[i]) === 0) {
      return node.values[i];
    }

    if (node.isLeaf) {
      return null;
    }

    return this.searchNode(node.children[i], key);
  }
  searchRange(minKey: K, maxKey: K): V[] {
    const results: V[] = [];
    this.searchRangeNode(this.root, minKey, maxKey, results);
    return results;
  }

  private searchRangeNode(node: BTreeNode<K, V>, minKey: K, maxKey: K, results: V[]): void {
    let i = 0;
    
    while (i < node.keys.length && this.comparator(minKey, node.keys[i]) > 0) {
      i++;
    }

    while (i < node.keys.length && this.comparator(node.keys[i], maxKey) <= 0) {
      if (!node.isLeaf) {
        this.searchRangeNode(node.children[i], minKey, maxKey, results);
      }
      
      if (this.comparator(node.keys[i], minKey) >= 0 && 
          this.comparator(node.keys[i], maxKey) <= 0) {
        results.push(node.values[i]);
      }
      i++;
    }

    if (!node.isLeaf && i < node.children.length) {
      this.searchRangeNode(node.children[i], minKey, maxKey, results);
    }
  }
  insert(key: K, value: V): void {
    const root = this.root;

    if (root.keys.length === 2 * this.order - 1) {
      const newRoot = new BTreeNode<K, V>(false);
      newRoot.children.push(this.root);
      this.root.parent = newRoot;
      this.root = newRoot;
      this.splitChild(newRoot, 0);
      this.insertNonFull(newRoot, key, value);
    } else {
      this.insertNonFull(root, key, value);
    }
  }

  private insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      while (i >= 0 && this.comparator(key, node.keys[i]) < 0) {
        i--;
      }
      if (i >= 0 && this.comparator(key, node.keys[i]) === 0) {
        node.values[i] = value;
        return;
      }

      node.keys.splice(i + 1, 0, key);
      node.values.splice(i + 1, 0, value);
    } else {
      while (i >= 0 && this.comparator(key, node.keys[i]) < 0) {
        i--;
      }
      i++;

      if (node.children[i].keys.length === 2 * this.order - 1) {
        this.splitChild(node, i);
        if (this.comparator(key, node.keys[i]) > 0) {
          i++;
        }
      }

      this.insertNonFull(node.children[i], key, value);
    }
  }

  private splitChild(parent: BTreeNode<K, V>, index: number): void {
    const fullNode = parent.children[index];
    const newNode = new BTreeNode<K, V>(fullNode.isLeaf);
    newNode.parent = parent;

    const midIndex = this.order - 1;
    newNode.keys = fullNode.keys.splice(midIndex + 1);
    newNode.values = fullNode.values.splice(midIndex + 1);
    if (!fullNode.isLeaf) {
      newNode.children = fullNode.children.splice(midIndex + 1);
      newNode.children.forEach(child => child.parent = newNode);
    }
    const midKey = fullNode.keys.pop()!;
    const midValue = fullNode.values.pop()!;

    parent.keys.splice(index, 0, midKey);
    parent.values.splice(index, 0, midValue);
    parent.children.splice(index + 1, 0, newNode);
  }
  delete(key: K): boolean {
    if (!this.root.keys.length) {
      return false;
    }

    const deleted = this.deleteFromNode(this.root, key);
    if (this.root.keys.length === 0 && !this.root.isLeaf) {
      this.root = this.root.children[0];
      this.root.parent = null;
    }

    return deleted;
  }

  private deleteFromNode(node: BTreeNode<K, V>, key: K): boolean {
    let i = 0;
    while (i < node.keys.length && this.comparator(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.comparator(key, node.keys[i]) === 0) {
      if (node.isLeaf) {
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        return true;
      } else {
        return this.deleteInternalNode(node, i);
      }
    } else {
      if (node.isLeaf) {
        return false;
      }
      if (node.children[i].keys.length < this.order) {
        this.fill(node, i);
      }
      return this.deleteFromNode(node.children[i], key);
    }
  }

  private deleteInternalNode(node: BTreeNode<K, V>, index: number): boolean {
    const key = node.keys[index];

    if (node.children[index].keys.length >= this.order) {
      const pred = this.getPredecessor(node, index);
      node.keys[index] = pred.key;
      node.values[index] = pred.value;
      return this.deleteFromNode(node.children[index], pred.key);
    } else if (node.children[index + 1].keys.length >= this.order) {
      const succ = this.getSuccessor(node, index);
      node.keys[index] = succ.key;
      node.values[index] = succ.value;
      return this.deleteFromNode(node.children[index + 1], succ.key);
    } else {
      this.merge(node, index);
      return this.deleteFromNode(node.children[index], key);
    }
  }

  private getPredecessor(node: BTreeNode<K, V>, index: number): { key: K; value: V } {
    let current = node.children[index];
    while (!current.isLeaf) {
      current = current.children[current.children.length - 1];
    }
    return {
      key: current.keys[current.keys.length - 1],
      value: current.values[current.values.length - 1]
    };
  }

  private getSuccessor(node: BTreeNode<K, V>, index: number): { key: K; value: V } {
    let current = node.children[index + 1];
    while (!current.isLeaf) {
      current = current.children[0];
    }
    return { key: current.keys[0], value: current.values[0] };
  }

  private fill(node: BTreeNode<K, V>, index: number): void {
    if (index > 0 && node.children[index - 1].keys.length >= this.order) {
      this.borrowFromPrev(node, index);
    } else if (index < node.children.length - 1 && node.children[index + 1].keys.length >= this.order) {
      this.borrowFromNext(node, index);
    } else {
      if (index < node.children.length - 1) {
        this.merge(node, index);
      } else {
        this.merge(node, index - 1);
      }
    }
  }

  private borrowFromPrev(node: BTreeNode<K, V>, index: number): void {
    const child = node.children[index];
    const sibling = node.children[index - 1];

    child.keys.unshift(node.keys[index - 1]);
    child.values.unshift(node.values[index - 1]);

    node.keys[index - 1] = sibling.keys.pop()!;
    node.values[index - 1] = sibling.values.pop()!;

    if (!child.isLeaf) {
      child.children.unshift(sibling.children.pop()!);
      child.children[0].parent = child;
    }
  }

  private borrowFromNext(node: BTreeNode<K, V>, index: number): void {
    const child = node.children[index];
    const sibling = node.children[index + 1];

    child.keys.push(node.keys[index]);
    child.values.push(node.values[index]);

    node.keys[index] = sibling.keys.shift()!;
    node.values[index] = sibling.values.shift()!;

    if (!child.isLeaf) {
      child.children.push(sibling.children.shift()!);
      child.children[child.children.length - 1].parent = child;
    }
  }

  private merge(node: BTreeNode<K, V>, index: number): void {
    const child = node.children[index];
    const sibling = node.children[index + 1];

    child.keys.push(node.keys[index]);
    child.values.push(node.values[index]);

    child.keys = child.keys.concat(sibling.keys);
    child.values = child.values.concat(sibling.values);

    if (!child.isLeaf) {
      child.children = child.children.concat(sibling.children);
      sibling.children.forEach(c => c.parent = child);
    }

    node.keys.splice(index, 1);
    node.values.splice(index, 1);
    node.children.splice(index + 1, 1);
  }
  getAll(): Array<{ key: K; value: V }> {
    const results: Array<{ key: K; value: V }> = [];
    this.inorderTraversal(this.root, results);
    return results;
  }

  private inorderTraversal(node: BTreeNode<K, V>, results: Array<{ key: K; value: V }>): void {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf) {
        this.inorderTraversal(node.children[i], results);
      }
      results.push({ key: node.keys[i], value: node.values[i] });
    }

    if (!node.isLeaf) {
      this.inorderTraversal(node.children[node.keys.length], results);
    }
  }
  get size(): number {
    return this.countNodes(this.root);
  }

  private countNodes(node: BTreeNode<K, V>): number {
    let count = node.keys.length;
    if (!node.isLeaf) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }
  clear(): void {
    this.root = new BTreeNode<K, V>(true);
  }
  serialize(): string {
    return JSON.stringify(this.serializeNode(this.root));
  }

  private serializeNode(node: BTreeNode<K, V>): any {
    return {
      keys: node.keys,
      values: node.values,
      isLeaf: node.isLeaf,
      children: node.isLeaf ? [] : node.children.map(c => this.serializeNode(c))
    };
  }
  static deserialize<K, V>(data: string, order: number = 3): BTree<K, V> {
    const tree = new BTree<K, V>(order);
    const parsed = JSON.parse(data);
    tree.root = tree.deserializeNode(parsed, null);
    return tree;
  }

  private deserializeNode(data: any, parent: BTreeNode<K, V> | null): BTreeNode<K, V> {
    const node = new BTreeNode<K, V>(data.isLeaf);
    node.keys = data.keys;
    node.values = data.values;
    node.parent = parent;
    
    if (!data.isLeaf) {
      node.children = data.children.map((c: any) => this.deserializeNode(c, node));
    }
    
    return node;
  }
  get height(): number {
    let h = 0;
    let node = this.root;
    while (!node.isLeaf) {
      h++;
      node = node.children[0];
    }
    return h;
  }
  getMin(): { key: K; value: V } | null {
    if (this.root.keys.length === 0) return null;
    let node = this.root;
    while (!node.isLeaf) {
      node = node.children[0];
    }
    return { key: node.keys[0], value: node.values[0] };
  }
  getMax(): { key: K; value: V } | null {
    if (this.root.keys.length === 0) return null;
    let node = this.root;
    while (!node.isLeaf) {
      node = node.children[node.children.length - 1];
    }
    return { key: node.keys[node.keys.length - 1], value: node.values[node.values.length - 1] };
  }
  searchWithOperator(key: K, operator: '>' | '>=' | '<' | '<='): V[] {
    const results: V[] = [];
    
    switch (operator) {
      case '>':
        this.collectGreaterThan(this.root, key, false, results);
        break;
      case '>=':
        this.collectGreaterThan(this.root, key, true, results);
        break;
      case '<':
        this.collectLessThan(this.root, key, false, results);
        break;
      case '<=':
        this.collectLessThan(this.root, key, true, results);
        break;
    }
    
    return results;
  }

  private collectGreaterThan(node: BTreeNode<K, V>, key: K, inclusive: boolean, results: V[]): void {
    let i = 0;
    while (i < node.keys.length && this.comparator(node.keys[i], key) < 0) {
      i++;
    }
    if (!node.isLeaf && i < node.children.length) {
      this.collectGreaterThan(node.children[i], key, inclusive, results);
    }
    while (i < node.keys.length) {
      const cmp = this.comparator(node.keys[i], key);
      
      if (cmp === 0) {
        if (inclusive) {
          results.push(node.values[i]);
        }
      } else {
        results.push(node.values[i]);
      }
      
      i++;
      if (!node.isLeaf && i < node.children.length) {
        this.collectAll(node.children[i], results);
      }
    }
  }

  private collectLessThan(node: BTreeNode<K, V>, key: K, inclusive: boolean, results: V[]): void {
    let i = 0;
    
    while (i < node.keys.length) {
      const cmp = this.comparator(node.keys[i], key);
      
      if (cmp > 0) {
        if (!node.isLeaf) {
          this.collectLessThan(node.children[i], key, inclusive, results);
        }
        return;
      }
      
      if (cmp === 0) {
        if (!node.isLeaf) {
          this.collectAll(node.children[i], results);
        }
        if (inclusive) {
          results.push(node.values[i]);
        }
        return;
      }
      if (!node.isLeaf) {
        this.collectAll(node.children[i], results);
      }
      results.push(node.values[i]);
      i++;
    }
    if (!node.isLeaf && i < node.children.length) {
      this.collectLessThan(node.children[i], key, inclusive, results);
    }
  }

  private collectAll(node: BTreeNode<K, V>, results: V[]): void {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf) {
        this.collectAll(node.children[i], results);
      }
      results.push(node.values[i]);
    }
    if (!node.isLeaf) {
      this.collectAll(node.children[node.keys.length], results);
    }
  }
  has(key: K): boolean {
    return this.search(key) !== null;
  }
  *[Symbol.iterator](): Iterator<{ key: K; value: V }> {
    yield* this.iterateNode(this.root);
  }

  private *iterateNode(node: BTreeNode<K, V>): Generator<{ key: K; value: V }> {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf) {
        yield* this.iterateNode(node.children[i]);
      }
      yield { key: node.keys[i], value: node.values[i] };
    }
    if (!node.isLeaf) {
      yield* this.iterateNode(node.children[node.keys.length]);
    }
  }
}

export class CompositeKey {
  readonly values: any[];

  constructor(values: any[]) {
    this.values = values;
  }

  static compare(a: CompositeKey, b: CompositeKey): number {
    const len = Math.min(a.values.length, b.values.length);
    for (let i = 0; i < len; i++) {
      const av = a.values[i];
      const bv = b.values[i];
      
      if (av === null && bv === null) continue;
      if (av === null) return -1;
      if (bv === null) return 1;
      
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return a.values.length - b.values.length;
  }

  toString(): string {
    return this.values.map(v => v === null ? 'NULL' : String(v)).join('|');
  }
}

export interface IndexInfo {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  type: IndexType;
  size: number;
  height: number;
}

export interface IndexStats {
  name: string;
  cardinality: number;
  nullCount: number;
  avgKeyLength: number;
  selectivity: number;
  lastAnalyzed: Date;
}

export interface IndexEntry {
  tree: BTree<any, number[]>;
  columns: string[];
  unique: boolean;
  type: IndexType;
}

export class IndexManager {
  private indexes: Map<string, Map<string, IndexEntry>> = new Map();
  private stats: Map<string, Map<string, IndexStats>> = new Map();
  createIndex(
    tableName: string, 
    indexName: string, 
    columns: string[] = [],
    unique: boolean = false,
    type: IndexType = IndexType.BTREE,
    order: number = 50
  ): void {
    if (!this.indexes.has(tableName)) {
      this.indexes.set(tableName, new Map());
    }
    const tableIndexes = this.indexes.get(tableName)!;
    
    if (tableIndexes.has(indexName)) {
      throw new Error(`Index "${indexName}" already exists on table "${tableName}"`);
    }
    
    const comparator = columns.length > 1 
      ? (a: CompositeKey, b: CompositeKey) => CompositeKey.compare(a, b)
      : undefined;
    
    tableIndexes.set(indexName, {
      tree: new BTree<any, number[]>(order, comparator),
      columns,
      unique,
      type
    });
  }
  createIndexFromDefinition(tableName: string, definition: IndexDefinition, order: number = 50): void {
    this.createIndex(
      tableName,
      definition.name,
      definition.columns,
      definition.unique,
      definition.type,
      order
    );
  }
  dropIndex(tableName: string, indexName: string): void {
    const tableIndexes = this.indexes.get(tableName);
    if (tableIndexes) {
      tableIndexes.delete(indexName);
    }
    this.stats.get(tableName)?.delete(indexName);
  }
  getIndex(tableName: string, indexName: string): BTree<any, number[]> | undefined {
    return this.indexes.get(tableName)?.get(indexName)?.tree;
  }
  getIndexEntry(tableName: string, indexName: string): IndexEntry | undefined {
    return this.indexes.get(tableName)?.get(indexName);
  }
  private makeKey(entry: IndexEntry, row: Record<string, any>): any {
    if (entry.columns.length === 1) {
      return row[entry.columns[0]];
    }
    return new CompositeKey(entry.columns.map(col => row[col]));
  }
  addToIndex(tableName: string, indexName: string, key: any, rowId: number): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;

    const existing = entry.tree.search(key);
    if (existing) {
      if (entry.unique && existing.length > 0 && !existing.includes(rowId)) {
        throw new Error(`Duplicate key value violates unique constraint "${indexName}"`);
      }
      if (!existing.includes(rowId)) {
        existing.push(rowId);
        entry.tree.insert(key, existing);
      }
    } else {
      entry.tree.insert(key, [rowId]);
    }
  }
  addRowToIndex(tableName: string, indexName: string, row: Record<string, any>, rowId: number): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;
    
    const key = this.makeKey(entry, row);
    this.addToIndex(tableName, indexName, key, rowId);
  }
  addRowToAllIndexes(tableName: string, row: Record<string, any>, rowId: number): void {
    const tableIndexes = this.indexes.get(tableName);
    if (!tableIndexes) return;

    for (const [indexName, entry] of tableIndexes) {
      const key = this.makeKey(entry, row);
      this.addToIndex(tableName, indexName, key, rowId);
    }
  }
  removeFromIndex(tableName: string, indexName: string, key: any, rowId: number): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;

    const existing = entry.tree.search(key);
    if (existing) {
      const idx = existing.indexOf(rowId);
      if (idx > -1) {
        existing.splice(idx, 1);
        if (existing.length === 0) {
          entry.tree.delete(key);
        } else {
          entry.tree.insert(key, existing);
        }
      }
    }
  }
  removeRowFromIndex(tableName: string, indexName: string, row: Record<string, any>, rowId: number): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;
    
    const key = this.makeKey(entry, row);
    this.removeFromIndex(tableName, indexName, key, rowId);
  }
  removeRowFromAllIndexes(tableName: string, row: Record<string, any>, rowId: number): void {
    const tableIndexes = this.indexes.get(tableName);
    if (!tableIndexes) return;

    for (const [indexName, entry] of tableIndexes) {
      const key = this.makeKey(entry, row);
      this.removeFromIndex(tableName, indexName, key, rowId);
    }
  }
  updateRowInIndex(
    tableName: string, 
    indexName: string, 
    oldRow: Record<string, any>, 
    newRow: Record<string, any>, 
    rowId: number
  ): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;

    const oldKey = this.makeKey(entry, oldRow);
    const newKey = this.makeKey(entry, newRow);
    if (JSON.stringify(oldKey) === JSON.stringify(newKey)) return;

    this.removeFromIndex(tableName, indexName, oldKey, rowId);
    this.addToIndex(tableName, indexName, newKey, rowId);
  }
  updateRowInAllIndexes(
    tableName: string, 
    oldRow: Record<string, any>, 
    newRow: Record<string, any>, 
    rowId: number
  ): void {
    const tableIndexes = this.indexes.get(tableName);
    if (!tableIndexes) return;

    for (const indexName of tableIndexes.keys()) {
      this.updateRowInIndex(tableName, indexName, oldRow, newRow, rowId);
    }
  }
  searchIndex(tableName: string, indexName: string, key: any): number[] {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return [];
    return entry.tree.search(key) || [];
  }
  searchIndexRange(tableName: string, indexName: string, minKey: any, maxKey: any): number[] {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return [];
    
    const results = entry.tree.searchRange(minKey, maxKey);
    return results.flat();
  }
  searchIndexWithOperator(
    tableName: string, 
    indexName: string, 
    key: any, 
    operator: '>' | '>=' | '<' | '<='
  ): number[] {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return [];
    
    const results = entry.tree.searchWithOperator(key, operator);
    return results.flat();
  }
  findBestIndex(tableName: string, columns: string[]): string | null {
    const tableIndexes = this.indexes.get(tableName);
    if (!tableIndexes) return null;

    let bestIndex: string | null = null;
    let bestScore = 0;

    for (const [indexName, entry] of tableIndexes) {
      const coveredColumns = entry.columns.filter(col => columns.includes(col));
      
      if (coveredColumns.length === 0) continue;
      let score = coveredColumns.length;
      if (entry.columns[0] === columns[0]) {
        score += 10;
      }
      if (entry.unique) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = indexName;
      }
    }

    return bestIndex;
  }
  listIndexes(tableName: string): string[] {
    const tableIndexes = this.indexes.get(tableName);
    return tableIndexes ? Array.from(tableIndexes.keys()) : [];
  }
  getIndexesInfo(tableName: string): IndexInfo[] {
    const tableIndexes = this.indexes.get(tableName);
    if (!tableIndexes) return [];

    return Array.from(tableIndexes.entries()).map(([name, entry]) => ({
      name,
      tableName,
      columns: entry.columns,
      unique: entry.unique,
      type: entry.type,
      size: entry.tree.size,
      height: entry.tree.height
    }));
  }
  analyzeIndex(tableName: string, indexName: string): IndexStats | null {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return null;

    const all = entry.tree.getAll();
    const totalRows = all.reduce((sum, item) => sum + item.value.length, 0);
    const uniqueKeys = all.length;
    
    let nullCount = 0;
    let totalKeyLength = 0;
    
    for (const item of all) {
      const key = item.key;
      if (key === null || (key instanceof CompositeKey && key.values.some(v => v === null))) {
        nullCount += item.value.length;
      }
      totalKeyLength += JSON.stringify(key).length;
    }

    const stats: IndexStats = {
      name: indexName,
      cardinality: uniqueKeys,
      nullCount,
      avgKeyLength: uniqueKeys > 0 ? totalKeyLength / uniqueKeys : 0,
      selectivity: totalRows > 0 ? uniqueKeys / totalRows : 0,
      lastAnalyzed: new Date()
    };
    if (!this.stats.has(tableName)) {
      this.stats.set(tableName, new Map());
    }
    this.stats.get(tableName)!.set(indexName, stats);

    return stats;
  }
  getIndexStats(tableName: string, indexName: string): IndexStats | undefined {
    return this.stats.get(tableName)?.get(indexName);
  }
  clearTable(tableName: string): void {
    const tableIndexes = this.indexes.get(tableName);
    if (tableIndexes) {
      for (const entry of tableIndexes.values()) {
        entry.tree.clear();
      }
    }
  }
  dropAllIndexes(tableName: string): void {
    this.indexes.delete(tableName);
    this.stats.delete(tableName);
  }
  clearAll(): void {
    for (const tableIndexes of this.indexes.values()) {
      for (const entry of tableIndexes.values()) {
        entry.tree.clear();
      }
    }
  }
  rebuildIndex(
    tableName: string, 
    indexName: string, 
    rows: Array<{ row: Record<string, any>; rowId: number }>
  ): void {
    const entry = this.getIndexEntry(tableName, indexName);
    if (!entry) return;

    entry.tree.clear();
    
    for (const { row, rowId } of rows) {
      const key = this.makeKey(entry, row);
      this.addToIndex(tableName, indexName, key, rowId);
    }
  }
  serialize(): string {
    const data: Record<string, Record<string, any>> = {};
    
    for (const [tableName, tableIndexes] of this.indexes) {
      data[tableName] = {};
      for (const [indexName, entry] of tableIndexes) {
        data[tableName][indexName] = {
          columns: entry.columns,
          unique: entry.unique,
          type: entry.type,
          tree: entry.tree.serialize()
        };
      }
    }
    
    return JSON.stringify(data);
  }
  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    
    for (const [tableName, tableIndexes] of Object.entries(parsed)) {
      for (const [indexName, indexData] of Object.entries(tableIndexes as Record<string, any>)) {
        this.createIndex(
          tableName,
          indexName,
          indexData.columns,
          indexData.unique,
          indexData.type
        );
        
        const entry = this.getIndexEntry(tableName, indexName)!;
        entry.tree = BTree.deserialize(indexData.tree);
      }
    }
  }
}
