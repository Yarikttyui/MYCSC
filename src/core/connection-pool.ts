import { EventEmitter } from 'events';


export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  connectionTimeout: number;
  validateOnAcquire: boolean;
  validateOnRelease: boolean;
  validationInterval: number;
  acquireRetries: number;
  acquireRetryDelay: number;
  fifo: boolean;
  autoStart: boolean;
  enableStatistics: boolean;
}

export interface ConnectionInfo {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  lastValidatedAt: number;
  useCount: number;
  state: ConnectionState;
  metadata: Record<string, any>;
}

export enum ConnectionState {
  IDLE = 'idle',
  ACQUIRED = 'acquired',
  VALIDATING = 'validating',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error'
}

export enum PoolState {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  DRAINING = 'draining',
  CLOSED = 'closed'
}

export interface PoolStatistics {
  totalConnections: number;
  idleConnections: number;
  acquiredConnections: number;
  pendingRequests: number;
  totalAcquired: number;
  totalReleased: number;
  totalCreated: number;
  totalDestroyed: number;
  totalErrors: number;
  totalTimeouts: number;
  averageAcquireTime: number;
  averageUseTime: number;
  uptime: number;
}

export interface ConnectionFactory<T> {
  create(): Promise<T>;
  destroy(connection: T): Promise<void>;
  validate(connection: T): Promise<boolean>;
  reset?(connection: T): Promise<void>;
}

export interface AcquireRequest<T> {
  resolve: (connection: PooledConnection<T>) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: NodeJS.Timeout | null;
  priority: number;
}


const DEFAULT_CONFIG: PoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  acquireTimeout: 30000,
  idleTimeout: 60000,
  connectionTimeout: 10000,
  validateOnAcquire: true,
  validateOnRelease: false,
  validationInterval: 30000,
  acquireRetries: 3,
  acquireRetryDelay: 100,
  fifo: true,
  autoStart: true,
  enableStatistics: true
};


export class PooledConnection<T> {
  readonly id: string;
  readonly connection: T;
  readonly info: ConnectionInfo;
  private pool: ConnectionPool<T>;
  private released: boolean = false;

  constructor(
    id: string,
    connection: T,
    pool: ConnectionPool<T>
  ) {
    this.id = id;
    this.connection = connection;
    this.pool = pool;
    this.info = {
      id,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      lastValidatedAt: Date.now(),
      useCount: 0,
      state: ConnectionState.IDLE,
      metadata: {}
    };
  }

  async release(): Promise<void> {
    if (this.released) {
      return;
    }
    this.released = true;
    await this.pool.release(this);
  }

  async destroy(): Promise<void> {
    if (this.released) {
      return;
    }
    this.released = true;
    await this.pool.destroy(this);
  }

  isReleased(): boolean {
    return this.released;
  }

  markAcquired(): void {
    this.released = false;
    this.info.state = ConnectionState.ACQUIRED;
    this.info.lastUsedAt = Date.now();
    this.info.useCount++;
  }

  markIdle(): void {
    this.info.state = ConnectionState.IDLE;
  }

  markValidated(): void {
    this.info.lastValidatedAt = Date.now();
  }

  setMetadata(key: string, value: any): void {
    this.info.metadata[key] = value;
  }

  getMetadata(key: string): any {
    return this.info.metadata[key];
  }
}


export class ConnectionPool<T> extends EventEmitter {
  private config: PoolConfig;
  private factory: ConnectionFactory<T>;
  private state: PoolState = PoolState.INITIALIZING;
  private connections: Map<string, PooledConnection<T>> = new Map();
  private idleConnections: PooledConnection<T>[] = [];
  private acquiredConnections: Set<string> = new Set();
  private pendingRequests: AcquireRequest<T>[] = [];
  private validationTimer: NodeJS.Timeout | null = null;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  private stats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalCreated: 0,
    totalDestroyed: 0,
    totalErrors: 0,
    totalTimeouts: 0,
    acquireTimes: [] as number[],
    useTimes: [] as number[],
    startTime: Date.now()
  };
  
  private connectionIdCounter = 0;

  constructor(
    factory: ConnectionFactory<T>,
    config: Partial<PoolConfig> = {}
  ) {
    super();
    this.factory = factory;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.autoStart) {
      this.initialize().catch(err => {
        this.emit('error', err);
      });
    }
  }


  async initialize(): Promise<void> {
    if (this.state !== PoolState.INITIALIZING) {
      throw new Error('Pool already initialized');
    }

    try {
      const createPromises: Promise<PooledConnection<T>>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        createPromises.push(this.createConnection());
      }
      await Promise.all(createPromises);

      this.state = PoolState.RUNNING;
      this.startBackgroundTasks();
      this.emit('ready');
    } catch (error) {
      this.state = PoolState.CLOSED;
      throw error;
    }
  }


  async acquire(priority: number = 0): Promise<PooledConnection<T>> {
    if (this.state !== PoolState.RUNNING) {
      throw new Error(`Pool is not running (state: ${this.state})`);
    }

    const startTime = Date.now();
    let connection = await this.tryAcquireIdle();
    
    if (!connection) {
      if (this.connections.size < this.config.maxConnections) {
        try {
          await this.createConnection();
          connection = await this.tryAcquireIdle();
        } catch (error) {
          this.stats.totalErrors++;
          this.emit('error', error);
        }
      }
    }

    if (connection) {
      this.recordAcquireTime(Date.now() - startTime);
      return connection;
    }
    return this.queueRequest(priority);
  }

  private async tryAcquireIdle(): Promise<PooledConnection<T> | null> {
    while (this.idleConnections.length > 0) {
      const connection = this.config.fifo
        ? this.idleConnections.shift()!
        : this.idleConnections.pop()!;
      if (this.config.validateOnAcquire) {
        const isValid = await this.validateConnection(connection);
        if (!isValid) {
          await this.destroyConnection(connection);
          continue;
        }
      }

      this.markAcquired(connection);
      return connection;
    }

    return null;
  }

  private queueRequest(priority: number): Promise<PooledConnection<T>> {
    return new Promise((resolve, reject) => {
      const request: AcquireRequest<T> = {
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: null,
        priority
      };
      if (this.config.acquireTimeout > 0) {
        request.timeout = setTimeout(() => {
          this.removeRequest(request);
          this.stats.totalTimeouts++;
          reject(new Error('Acquire timeout'));
        }, this.config.acquireTimeout);
      }
      let inserted = false;
      for (let i = 0; i < this.pendingRequests.length; i++) {
        if (this.pendingRequests[i].priority < priority) {
          this.pendingRequests.splice(i, 0, request);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.pendingRequests.push(request);
      }

      this.emit('enqueue', { queueSize: this.pendingRequests.length });
    });
  }

  private removeRequest(request: AcquireRequest<T>): void {
    const index = this.pendingRequests.indexOf(request);
    if (index !== -1) {
      this.pendingRequests.splice(index, 1);
    }
    if (request.timeout) {
      clearTimeout(request.timeout);
    }
  }


  async release(connection: PooledConnection<T>): Promise<void> {
    if (!this.connections.has(connection.id)) {
      return;
    }

    if (!this.acquiredConnections.has(connection.id)) {
      return;
    }

    const acquireTime = connection.info.lastUsedAt;
    this.recordUseTime(Date.now() - acquireTime);
    if (this.config.validateOnRelease) {
      const isValid = await this.validateConnection(connection);
      if (!isValid) {
        await this.destroyConnection(connection);
        this.processQueue();
        return;
      }
    }
    if (this.factory.reset) {
      try {
        await this.factory.reset(connection.connection);
      } catch (error) {
        await this.destroyConnection(connection);
        this.processQueue();
        return;
      }
    }

    this.markIdle(connection);
    this.stats.totalReleased++;
    this.emit('release', { connectionId: connection.id });
    this.processQueue();
  }

  async destroy(connection: PooledConnection<T>): Promise<void> {
    await this.destroyConnection(connection);
    this.processQueue();
  }


  private async createConnection(): Promise<PooledConnection<T>> {
    const id = `conn_${++this.connectionIdCounter}_${Date.now()}`;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Connection creation timeout'));
      }, this.config.connectionTimeout);
    });

    const createPromise = this.factory.create();
    
    const rawConnection = await Promise.race([createPromise, timeoutPromise]);
    
    const connection = new PooledConnection(id, rawConnection, this);
    this.connections.set(id, connection);
    this.idleConnections.push(connection);
    
    this.stats.totalCreated++;
    this.emit('create', { connectionId: id });
    
    return connection;
  }

  private async destroyConnection(connection: PooledConnection<T>): Promise<void> {
    const id = connection.id;
    
    if (!this.connections.has(id)) {
      return;
    }

    connection.info.state = ConnectionState.CLOSING;
    this.connections.delete(id);
    this.acquiredConnections.delete(id);
    const idleIndex = this.idleConnections.indexOf(connection);
    if (idleIndex !== -1) {
      this.idleConnections.splice(idleIndex, 1);
    }
    try {
      await this.factory.destroy(connection.connection);
    } catch (error) {
      this.emit('error', error);
    }

    connection.info.state = ConnectionState.CLOSED;
    this.stats.totalDestroyed++;
    this.emit('destroy', { connectionId: id });
    if (this.state === PoolState.RUNNING && 
        this.connections.size < this.config.minConnections) {
      this.createConnection().catch(err => {
        this.emit('error', err);
      });
    }
  }

  private async validateConnection(connection: PooledConnection<T>): Promise<boolean> {
    connection.info.state = ConnectionState.VALIDATING;
    
    try {
      const isValid = await this.factory.validate(connection.connection);
      connection.markValidated();
      return isValid;
    } catch (error) {
      return false;
    } finally {
      if (connection.info.state === ConnectionState.VALIDATING) {
        connection.info.state = this.acquiredConnections.has(connection.id)
          ? ConnectionState.ACQUIRED
          : ConnectionState.IDLE;
      }
    }
  }

  private markAcquired(connection: PooledConnection<T>): void {
    connection.markAcquired();
    this.acquiredConnections.add(connection.id);
    
    const idleIndex = this.idleConnections.indexOf(connection);
    if (idleIndex !== -1) {
      this.idleConnections.splice(idleIndex, 1);
    }
    
    this.stats.totalAcquired++;
    this.emit('acquire', { connectionId: connection.id });
  }

  private markIdle(connection: PooledConnection<T>): void {
    connection.markIdle();
    this.acquiredConnections.delete(connection.id);
    this.idleConnections.push(connection);
  }


  private async processQueue(): Promise<void> {
    while (this.pendingRequests.length > 0 && this.idleConnections.length > 0) {
      const request = this.pendingRequests.shift()!;
      if (request.timeout) {
        clearTimeout(request.timeout);
      }

      const connection = await this.tryAcquireIdle();
      if (connection) {
        const acquireTime = Date.now() - request.timestamp;
        this.recordAcquireTime(acquireTime);
        request.resolve(connection);
      } else {
        this.pendingRequests.unshift(request);
        break;
      }
    }
    while (
      this.pendingRequests.length > 0 &&
      this.connections.size < this.config.maxConnections
    ) {
      try {
        await this.createConnection();
        await this.processQueue();
      } catch (error) {
        this.stats.totalErrors++;
        break;
      }
    }
  }


  private startBackgroundTasks(): void {
    if (this.config.validationInterval > 0) {
      this.validationTimer = setInterval(async () => {
        await this.validateIdleConnections();
      }, this.config.validationInterval);
    }
    if (this.config.idleTimeout > 0) {
      this.idleCheckTimer = setInterval(() => {
        this.checkIdleConnections();
      }, Math.min(this.config.idleTimeout / 2, 10000));
    }
  }

  private stopBackgroundTasks(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  private async validateIdleConnections(): Promise<void> {
    const connectionsToValidate = [...this.idleConnections];
    
    for (const connection of connectionsToValidate) {
      if (this.idleConnections.includes(connection)) {
        const isValid = await this.validateConnection(connection);
        if (!isValid) {
          await this.destroyConnection(connection);
        }
      }
    }
  }

  private checkIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: PooledConnection<T>[] = [];

    for (const connection of this.idleConnections) {
      const idleTime = now - connection.info.lastUsedAt;
      if (this.connections.size <= this.config.minConnections) {
        break;
      }

      if (idleTime > this.config.idleTimeout) {
        connectionsToRemove.push(connection);
      }
    }

    for (const connection of connectionsToRemove) {
      this.destroyConnection(connection).catch(err => {
        this.emit('error', err);
      });
    }
  }


  private recordAcquireTime(time: number): void {
    if (!this.config.enableStatistics) return;
    
    this.stats.acquireTimes.push(time);
    if (this.stats.acquireTimes.length > 1000) {
      this.stats.acquireTimes.shift();
    }
  }

  private recordUseTime(time: number): void {
    if (!this.config.enableStatistics) return;
    
    this.stats.useTimes.push(time);
    if (this.stats.useTimes.length > 1000) {
      this.stats.useTimes.shift();
    }
  }

  getStatistics(): PoolStatistics {
    const avgAcquire = this.stats.acquireTimes.length > 0
      ? this.stats.acquireTimes.reduce((a, b) => a + b, 0) / this.stats.acquireTimes.length
      : 0;
    
    const avgUse = this.stats.useTimes.length > 0
      ? this.stats.useTimes.reduce((a, b) => a + b, 0) / this.stats.useTimes.length
      : 0;

    return {
      totalConnections: this.connections.size,
      idleConnections: this.idleConnections.length,
      acquiredConnections: this.acquiredConnections.size,
      pendingRequests: this.pendingRequests.length,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased,
      totalCreated: this.stats.totalCreated,
      totalDestroyed: this.stats.totalDestroyed,
      totalErrors: this.stats.totalErrors,
      totalTimeouts: this.stats.totalTimeouts,
      averageAcquireTime: avgAcquire,
      averageUseTime: avgUse,
      uptime: Date.now() - this.stats.startTime
    };
  }


  async drain(): Promise<void> {
    if (this.state === PoolState.CLOSED) {
      return;
    }

    this.state = PoolState.DRAINING;
    this.emit('draining');
    for (const request of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Pool is draining'));
    }
    this.pendingRequests = [];
    while (this.acquiredConnections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async close(): Promise<void> {
    await this.drain();
    
    this.stopBackgroundTasks();
    const destroyPromises = Array.from(this.connections.values()).map(
      conn => this.destroyConnection(conn)
    );
    await Promise.all(destroyPromises);

    this.state = PoolState.CLOSED;
    this.emit('close');
  }


  getState(): PoolState {
    return this.state;
  }

  getConfig(): Readonly<PoolConfig> {
    return { ...this.config };
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getIdleCount(): number {
    return this.idleConnections.length;
  }

  getAcquiredCount(): number {
    return this.acquiredConnections.size;
  }

  getPendingCount(): number {
    return this.pendingRequests.length;
  }

  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values()).map(c => ({ ...c.info }));
  }
}


export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface DatabaseConnection {
  id: string;
  config: DatabaseConnectionConfig;
  isConnected: boolean;
  query(sql: string): Promise<any>;
  close(): Promise<void>;
}

export class DatabaseConnectionPool extends ConnectionPool<DatabaseConnection> {
  private dbConfig: DatabaseConnectionConfig;

  constructor(
    dbConfig: DatabaseConnectionConfig,
    poolConfig: Partial<PoolConfig> = {}
  ) {
    const factory: ConnectionFactory<DatabaseConnection> = {
      async create(): Promise<DatabaseConnection> {
        const id = `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conn: DatabaseConnection = {
          id,
          config: dbConfig,
          isConnected: true,
          async query(sql: string): Promise<any> {
            if (!conn.isConnected) {
              throw new Error('Connection closed');
            }
            return { rows: [], affectedRows: 0 };
          },
          async close(): Promise<void> {
            conn.isConnected = false;
          }
        };
        return conn;
      },
      async destroy(connection: DatabaseConnection): Promise<void> {
        await connection.close();
      },
      async validate(connection: DatabaseConnection): Promise<boolean> {
        try {
          if (!connection.isConnected) return false;
          await connection.query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      },
      async reset(connection: DatabaseConnection): Promise<void> {
      }
    };

    super(factory, poolConfig);
    this.dbConfig = dbConfig;
  }

  async query(sql: string): Promise<any> {
    const pooledConn = await this.acquire();
    try {
      return await pooledConn.connection.query(sql);
    } finally {
      await pooledConn.release();
    }
  }

  async transaction<R>(
    callback: (conn: DatabaseConnection) => Promise<R>
  ): Promise<R> {
    const pooledConn = await this.acquire();
    try {
      await pooledConn.connection.query('BEGIN');
      const result = await callback(pooledConn.connection);
      await pooledConn.connection.query('COMMIT');
      return result;
    } catch (error) {
      await pooledConn.connection.query('ROLLBACK');
      throw error;
    } finally {
      await pooledConn.release();
    }
  }
}


export class PoolManager {
  private pools: Map<string, ConnectionPool<any>> = new Map();

  register<T>(name: string, pool: ConnectionPool<T>): void {
    if (this.pools.has(name)) {
      throw new Error(`Pool "${name}" already registered`);
    }
    this.pools.set(name, pool);
  }

  get<T>(name: string): ConnectionPool<T> {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new Error(`Pool "${name}" not found`);
    }
    return pool as ConnectionPool<T>;
  }

  has(name: string): boolean {
    return this.pools.has(name);
  }

  remove(name: string): boolean {
    return this.pools.delete(name);
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(
      pool => pool.close()
    );
    await Promise.all(closePromises);
    this.pools.clear();
  }

  getStatistics(): Record<string, PoolStatistics> {
    const stats: Record<string, PoolStatistics> = {};
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStatistics();
    }
    return stats;
  }

  listPools(): string[] {
    return Array.from(this.pools.keys());
  }
}


export class ResourcePool<T> extends ConnectionPool<T> {
  constructor(
    createFn: () => Promise<T>,
    destroyFn: (resource: T) => Promise<void>,
    validateFn?: (resource: T) => Promise<boolean>,
    config?: Partial<PoolConfig>
  ) {
    const factory: ConnectionFactory<T> = {
      create: createFn,
      destroy: destroyFn,
      validate: validateFn || (async () => true)
    };
    super(factory, config);
  }
}


export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getAvailablePermits(): number {
    return this.permits;
  }

  getWaitingCount(): number {
    return this.waiting.length;
  }
}


export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private waiting: Array<{ resolve: () => void; tokens: number }> = [];

  constructor(
    maxTokens: number,
    refillRatePerSecond: number
  ) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  async acquire(tokens: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push({ resolve, tokens });
      this.scheduleProcessing();
    });
  }

  private processingScheduled = false;

  private scheduleProcessing(): void {
    if (this.processingScheduled) return;
    this.processingScheduled = true;

    const processWaiting = () => {
      this.refill();

      while (this.waiting.length > 0) {
        const request = this.waiting[0];
        if (this.tokens >= request.tokens) {
          this.tokens -= request.tokens;
          this.waiting.shift();
          request.resolve();
        } else {
          break;
        }
      }

      if (this.waiting.length > 0) {
        setTimeout(processWaiting, 10);
      } else {
        this.processingScheduled = false;
      }
    };

    setTimeout(processWaiting, 10);
  }

  async withLimit<T>(fn: () => Promise<T>, tokens: number = 1): Promise<T> {
    await this.acquire(tokens);
    return fn();
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}


export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30000,
      resetTimeout: config.resetTimeout ?? 60000
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailure >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, this.config.timeout);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
  }
}


export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOn?: (error: Error) => boolean;
}

export class RetryPolicy {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 100,
      maxDelay: config.maxDelay ?? 10000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      retryOn: config.retryOn
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt >= this.config.maxRetries) {
          break;
        }

        if (this.config.retryOn && !this.config.retryOn(error)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
      }
    }

    throw lastError;
  }
}


export default ConnectionPool;
