import { QueryResult, Row } from './types';


export interface ParallelTask<T = any> {
  id: string;
  fn: () => Promise<T>;
  priority?: number;
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

export interface TaskResult<T = any> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  retryCount: number;
}

export interface BatchResult<T = any> {
  results: TaskResult<T>[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

export interface WorkerStats {
  id: number;
  tasksProcessed: number;
  totalTime: number;
  idle: boolean;
}

export interface ExecutorConfig {
  maxConcurrency: number;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enablePriority: boolean;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface QueuedTask<T = any> extends ParallelTask<T> {
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
  retryCount: number;
  resolve: (result: TaskResult<T>) => void;
  reject: (error: Error) => void;
}


const DEFAULT_CONFIG: ExecutorConfig = {
  maxConcurrency: 4,
  defaultTimeout: 30000,
  maxRetries: 3,
  retryDelay: 100,
  enablePriority: true
};


export class ParallelExecutor {
  private config: ExecutorConfig;
  private taskQueue: QueuedTask[] = [];
  private runningTasks: Map<string, QueuedTask> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private workerStats: WorkerStats[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initWorkerStats();
  }

  private initWorkerStats(): void {
    this.workerStats = [];
    for (let i = 0; i < this.config.maxConcurrency; i++) {
      this.workerStats.push({
        id: i,
        tasksProcessed: 0,
        totalTime: 0,
        idle: true
      });
    }
  }


  setMaxConcurrency(value: number): void {
    this.config.maxConcurrency = Math.max(1, value);
    this.initWorkerStats();
  }

  getConfig(): ExecutorConfig {
    return { ...this.config };
  }


  /**
   * Добавить одну задачу в очередь
   */
  async submit<T>(task: ParallelTask<T>): Promise<TaskResult<T>> {
    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask<T> = {
        ...task,
        status: 'pending',
        retryCount: 0,
        resolve,
        reject
      };

      this.enqueue(queuedTask);
      this.processQueue();
    });
  }

  /**
   * Добавить несколько задач и дождаться выполнения всех
   */
  async submitAll<T>(tasks: ParallelTask<T>[]): Promise<BatchResult<T>> {
    const startTime = Date.now();
    
    const promises = tasks.map(task => this.submit(task));
    const results = await Promise.all(promises);

    const successCount = results.filter(r => r.success).length;
    
    return {
      results,
      totalDuration: Date.now() - startTime,
      successCount,
      failureCount: results.length - successCount
    };
  }

  /**
   * Выполнить задачи параллельно с ограничением
   */
  async executeParallel<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<any>,
    batchSize?: number
  ): Promise<BatchResult> {
    const tasks: ParallelTask[] = items.map((item, index) => ({
      id: `task-${index}`,
      fn: () => processor(item, index)
    }));

    if (batchSize) {
      return this.executeBatched(tasks, batchSize);
    }

    return this.submitAll(tasks);
  }

  /**
   * Выполнить задачи пакетами
   */
  async executeBatched<T>(
    tasks: ParallelTask<T>[],
    batchSize: number
  ): Promise<BatchResult<T>> {
    const allResults: TaskResult<T>[] = [];
    const startTime = Date.now();

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResult = await this.submitAll(batch);
      allResults.push(...batchResult.results);
    }

    const successCount = allResults.filter(r => r.success).length;

    return {
      results: allResults,
      totalDuration: Date.now() - startTime,
      successCount,
      failureCount: allResults.length - successCount
    };
  }


  private enqueue<T>(task: QueuedTask<T>): void {
    if (this.config.enablePriority && task.priority !== undefined) {
      const insertIndex = this.taskQueue.findIndex(
        t => (t.priority || 0) < (task.priority || 0)
      );
      
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }
    } else {
      this.taskQueue.push(task);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isPaused) return;
    
    while (this.taskQueue.length > 0 && this.runningTasks.size < this.config.maxConcurrency) {
      const task = this.getNextReadyTask();
      if (!task) break;

      this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
      this.executeTask(task);
    }
  }

  private getNextReadyTask(): QueuedTask | undefined {
    for (const task of this.taskQueue) {
      if (this.areDependenciesSatisfied(task)) {
        return task;
      }
    }
    return undefined;
  }

  private areDependenciesSatisfied(task: QueuedTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const completed = this.completedTasks.get(depId);
      return completed && completed.success;
    });
  }

  private async executeTask<T>(task: QueuedTask<T>): Promise<void> {
    task.status = 'running';
    task.startTime = Date.now();
    this.runningTasks.set(task.id, task);
    const worker = this.workerStats.find(w => w.idle);
    if (worker) {
      worker.idle = false;
    }

    try {
      const result = await this.runWithTimeout(task);
      
      task.status = 'completed';
      task.endTime = Date.now();
      
      const taskResult: TaskResult<T> = {
        id: task.id,
        success: true,
        result,
        duration: task.endTime - task.startTime!,
        retryCount: task.retryCount
      };

      this.completedTasks.set(task.id, taskResult);
      task.resolve(taskResult);

    } catch (error: any) {
      if (task.retryCount < (task.retries ?? this.config.maxRetries)) {
        task.retryCount++;
        task.status = 'pending';
        this.runningTasks.delete(task.id);
        
        await this.delay(this.config.retryDelay * task.retryCount);
        this.enqueue(task);
      } else {
        task.status = 'failed';
        task.endTime = Date.now();
        
        const taskResult: TaskResult<T> = {
          id: task.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: task.endTime - task.startTime!,
          retryCount: task.retryCount
        };

        this.completedTasks.set(task.id, taskResult);
        task.resolve(taskResult);
      }
    } finally {
      this.runningTasks.delete(task.id);
      
      if (worker) {
        worker.idle = true;
        worker.tasksProcessed++;
        worker.totalTime += Date.now() - (task.startTime || 0);
      }
      this.processQueue();
    }
  }

  private async runWithTimeout<T>(task: QueuedTask<T>): Promise<T> {
    const timeout = task.timeout ?? this.config.defaultTimeout;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);

      task.fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processQueue();
  }

  async cancel(taskId: string): Promise<boolean> {
    const index = this.taskQueue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const task = this.taskQueue[index];
      task.status = 'cancelled';
      this.taskQueue.splice(index, 1);
      
      const result: TaskResult = {
        id: taskId,
        success: false,
        error: new Error('Task cancelled'),
        duration: 0,
        retryCount: task.retryCount
      };
      task.resolve(result);
      return true;
    }
    return false;
  }

  async cancelAll(): Promise<number> {
    let cancelled = 0;
    for (const task of [...this.taskQueue]) {
      if (await this.cancel(task.id)) {
        cancelled++;
      }
    }
    return cancelled;
  }

  clear(): void {
    this.taskQueue = [];
    this.completedTasks.clear();
  }


  getQueueSize(): number {
    return this.taskQueue.length;
  }

  getRunningCount(): number {
    return this.runningTasks.size;
  }

  getCompletedCount(): number {
    return this.completedTasks.size;
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    const queued = this.taskQueue.find(t => t.id === taskId);
    if (queued) return queued.status;

    const running = this.runningTasks.get(taskId);
    if (running) return running.status;

    const completed = this.completedTasks.get(taskId);
    if (completed) return completed.success ? 'completed' : 'failed';

    return undefined;
  }

  getWorkerStats(): WorkerStats[] {
    return [...this.workerStats];
  }

  getStats(): {
    queueSize: number;
    running: number;
    completed: number;
    workers: WorkerStats[];
  } {
    return {
      queueSize: this.taskQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      workers: this.getWorkerStats()
    };
  }
}


export interface QueryTask {
  sql: string;
  params?: any[];
  priority?: number;
}

export interface ParallelQueryResult {
  query: string;
  result: QueryResult;
  duration: number;
}

export class ParallelQueryRunner {
  private executor: ParallelExecutor;
  private queryExecutor: (sql: string, params?: any[]) => Promise<QueryResult>;

  constructor(
    queryExecutor: (sql: string, params?: any[]) => Promise<QueryResult>,
    config?: Partial<ExecutorConfig>
  ) {
    this.executor = new ParallelExecutor(config);
    this.queryExecutor = queryExecutor;
  }

  /**
   * Выполнить один запрос
   */
  async executeQuery(sql: string, params?: any[]): Promise<QueryResult> {
    return this.queryExecutor(sql, params);
  }

  /**
   * Выполнить несколько запросов параллельно
   */
  async executeParallel(queries: QueryTask[]): Promise<ParallelQueryResult[]> {
    const tasks: ParallelTask<QueryResult>[] = queries.map((query, index) => ({
      id: `query-${index}`,
      fn: () => this.queryExecutor(query.sql, query.params),
      priority: query.priority
    }));

    const batchResult = await this.executor.submitAll(tasks);

    return batchResult.results.map((result, index) => ({
      query: queries[index].sql,
      result: result.result || { success: false, error: result.error?.message, executionTime: 0 },
      duration: result.duration
    }));
  }

  /**
   * Выполнить запросы последовательно с зависимостями
   */
  async executeSequential(queries: QueryTask[]): Promise<ParallelQueryResult[]> {
    const results: ParallelQueryResult[] = [];

    for (const query of queries) {
      const startTime = Date.now();
      const result = await this.queryExecutor(query.sql, query.params);
      results.push({
        query: query.sql,
        result,
        duration: Date.now() - startTime
      });
    }

    return results;
  }

  /**
   * Выполнить запросы с зависимостями
   */
  async executeWithDependencies(
    queries: Array<QueryTask & { id: string; dependencies?: string[] }>
  ): Promise<Map<string, ParallelQueryResult>> {
    const tasks: ParallelTask<QueryResult>[] = queries.map(query => ({
      id: query.id,
      fn: () => this.queryExecutor(query.sql, query.params),
      priority: query.priority,
      dependencies: query.dependencies
    }));

    const batchResult = await this.executor.submitAll(tasks);
    const resultMap = new Map<string, ParallelQueryResult>();

    batchResult.results.forEach((result, index) => {
      resultMap.set(queries[index].id, {
        query: queries[index].sql,
        result: result.result || { success: false, error: result.error?.message, executionTime: 0 },
        duration: result.duration
      });
    });

    return resultMap;
  }

  getStats() {
    return this.executor.getStats();
  }

  setMaxConcurrency(value: number): void {
    this.executor.setMaxConcurrency(value);
  }
}


export class ParallelDataProcessor {
  private executor: ParallelExecutor;

  constructor(maxConcurrency: number = 4) {
    this.executor = new ParallelExecutor({ maxConcurrency });
  }

  /**
   * Параллельный map для массива строк
   */
  async parallelMap<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const result = await this.executor.executeParallel(items, mapper);
    return result.results
      .filter(r => r.success)
      .map(r => r.result as R);
  }

  /**
   * Параллельный filter
   */
  async parallelFilter<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>
  ): Promise<T[]> {
    const result = await this.executor.executeParallel(
      items,
      async (item, index) => ({ item, keep: await predicate(item, index) })
    );

    return result.results
      .filter(r => r.success && r.result?.keep)
      .map(r => r.result.item);
  }

  /**
   * Параллельный reduce (делим на части и объединяем)
   */
  async parallelReduce<T, R>(
    items: T[],
    reducer: (acc: R, item: T) => R,
    initialValue: R,
    combiner: (a: R, b: R) => R,
    chunkSize: number = 100
  ): Promise<R> {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    const chunkResults = await this.parallelMap(chunks, async (chunk) => {
      return chunk.reduce(reducer, initialValue);
    });
    return chunkResults.reduce(combiner, initialValue);
  }

  /**
   * Параллельный forEach
   */
  async parallelForEach<T>(
    items: T[],
    action: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    await this.executor.executeParallel(items, action);
  }

  /**
   * Параллельная сортировка (merge sort)
   */
  async parallelSort<T>(
    items: T[],
    comparator: (a: T, b: T) => number,
    threshold: number = 1000
  ): Promise<T[]> {
    if (items.length <= threshold) {
      return [...items].sort(comparator);
    }

    const mid = Math.floor(items.length / 2);
    const left = items.slice(0, mid);
    const right = items.slice(mid);

    const [sortedLeft, sortedRight] = await Promise.all([
      this.parallelSort(left, comparator, threshold),
      this.parallelSort(right, comparator, threshold)
    ]);

    return this.merge(sortedLeft, sortedRight, comparator);
  }

  private merge<T>(left: T[], right: T[], comparator: (a: T, b: T) => number): T[] {
    const result: T[] = [];
    let i = 0, j = 0;

    while (i < left.length && j < right.length) {
      if (comparator(left[i], right[j]) <= 0) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }

    return result.concat(left.slice(i)).concat(right.slice(j));
  }

  /**
   * Параллельная группировка
   */
  async parallelGroupBy<T, K extends string | number>(
    items: T[],
    keySelector: (item: T) => K
  ): Promise<Map<K, T[]>> {
    const chunkSize = Math.ceil(items.length / this.executor.getConfig().maxConcurrency);
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    const chunkMaps = await this.parallelMap(chunks, async (chunk) => {
      const map = new Map<K, T[]>();
      for (const item of chunk) {
        const key = keySelector(item);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(item);
      }
      return map;
    });
    const result = new Map<K, T[]>();
    for (const chunkMap of chunkMaps) {
      for (const [key, values] of chunkMap) {
        if (!result.has(key)) {
          result.set(key, []);
        }
        result.get(key)!.push(...values);
      }
    }

    return result;
  }

  /**
   * Параллельный поиск
   */
  async parallelFind<T>(
    items: T[],
    predicate: (item: T) => Promise<boolean>
  ): Promise<T | undefined> {
    const chunkSize = Math.ceil(items.length / this.executor.getConfig().maxConcurrency);
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    for (const chunk of chunks) {
      for (const item of chunk) {
        if (await predicate(item)) {
          return item;
        }
      }
    }

    return undefined;
  }

  /**
   * Параллельный some (есть ли хотя бы один элемент)
   */
  async parallelSome<T>(
    items: T[],
    predicate: (item: T) => Promise<boolean>
  ): Promise<boolean> {
    const found = await this.parallelFind(items, predicate);
    return found !== undefined;
  }

  /**
   * Параллельный every (все ли элементы)
   */
  async parallelEvery<T>(
    items: T[],
    predicate: (item: T) => Promise<boolean>
  ): Promise<boolean> {
    const failed = await this.parallelFind(items, async (item) => !(await predicate(item)));
    return failed === undefined;
  }

  setMaxConcurrency(value: number): void {
    this.executor.setMaxConcurrency(value);
  }

  getStats() {
    return this.executor.getStats();
  }
}


export type PipelineStage<TIn, TOut> = (input: TIn) => Promise<TOut>;

export class ParallelPipeline<TIn, TOut = TIn> {
  private stages: PipelineStage<any, any>[] = [];
  private executor: ParallelExecutor;

  constructor(maxConcurrency: number = 4) {
    this.executor = new ParallelExecutor({ maxConcurrency });
  }

  /**
   * Добавить стадию в pipeline
   */
  pipe<TNext>(stage: PipelineStage<TOut, TNext>): ParallelPipeline<TIn, TNext> {
    this.stages.push(stage);
    return this as unknown as ParallelPipeline<TIn, TNext>;
  }

  /**
   * Выполнить pipeline для одного элемента
   */
  async execute(input: TIn): Promise<TOut> {
    let result: any = input;
    for (const stage of this.stages) {
      result = await stage(result);
    }
    return result;
  }

  /**
   * Выполнить pipeline параллельно для массива
   */
  async executeAll(inputs: TIn[]): Promise<TOut[]> {
    const tasks: ParallelTask<TOut>[] = inputs.map((input, index) => ({
      id: `pipeline-${index}`,
      fn: () => this.execute(input)
    }));

    const result = await this.executor.submitAll(tasks);
    return result.results
      .filter(r => r.success)
      .map(r => r.result as TOut);
  }

  /**
   * Выполнить pipeline в потоковом режиме
   */
  async* stream(inputs: AsyncIterable<TIn>): AsyncGenerator<TOut> {
    for await (const input of inputs) {
      yield await this.execute(input);
    }
  }

  /**
   * Сбросить pipeline
   */
  reset(): ParallelPipeline<TIn, TIn> {
    this.stages = [];
    return this as unknown as ParallelPipeline<TIn, TIn>;
  }
}


interface WorkQueue<T> {
  tasks: T[];
  workerId: number;
}

export class WorkStealingScheduler<T> {
  private queues: WorkQueue<T>[] = [];
  private numWorkers: number;

  constructor(numWorkers: number = 4) {
    this.numWorkers = numWorkers;
    for (let i = 0; i < numWorkers; i++) {
      this.queues.push({ tasks: [], workerId: i });
    }
  }

  /**
   * Добавить задачу (round-robin)
   */
  addTask(task: T): void {
    const minQueue = this.queues.reduce((min, q) => 
      q.tasks.length < min.tasks.length ? q : min
    );
    minQueue.tasks.push(task);
  }

  /**
   * Добавить несколько задач
   */
  addTasks(tasks: T[]): void {
    tasks.forEach(task => this.addTask(task));
  }

  /**
   * Получить задачу для воркера (с work stealing)
   */
  getTask(workerId: number): T | undefined {
    const myQueue = this.queues[workerId];
    if (myQueue.tasks.length > 0) {
      return myQueue.tasks.shift();
    }
    for (const queue of this.queues) {
      if (queue.workerId !== workerId && queue.tasks.length > 0) {
        return queue.tasks.pop();
      }
    }

    return undefined;
  }

  /**
   * Проверить есть ли ещё задачи
   */
  hasMoreTasks(): boolean {
    return this.queues.some(q => q.tasks.length > 0);
  }

  /**
   * Выполнить все задачи
   */
  async execute(
    processor: (task: T, workerId: number) => Promise<void>
  ): Promise<void> {
    const workers = Array(this.numWorkers).fill(null).map(async (_, workerId) => {
      while (this.hasMoreTasks()) {
        const task = this.getTask(workerId);
        if (task !== undefined) {
          await processor(task, workerId);
        }
      }
    });

    await Promise.all(workers);
  }

  getTotalTasks(): number {
    return this.queues.reduce((sum, q) => sum + q.tasks.length, 0);
  }

  clear(): void {
    this.queues.forEach(q => q.tasks = []);
  }
}


/**
 * Выполнить функции параллельно с ограничением
 */
export async function parallelLimit<T>(
  fns: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const executor = new ParallelExecutor({ maxConcurrency: limit });
  const tasks: ParallelTask<T>[] = fns.map((fn, i) => ({
    id: `fn-${i}`,
    fn
  }));

  const result = await executor.submitAll(tasks);
  return result.results.map(r => r.result as T);
}

/**
 * Выполнить с повторами при ошибке
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> {
  const executor = new ParallelExecutor({ 
    maxConcurrency: 1, 
    maxRetries, 
    retryDelay: delay 
  });
  
  const result = await executor.submit({
    id: 'retry-task',
    fn,
    retries: maxRetries
  });

  if (result.success) {
    return result.result as T;
  }
  throw result.error;
}

/**
 * Выполнить с таймаутом
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  const executor = new ParallelExecutor({ 
    maxConcurrency: 1, 
    defaultTimeout: timeout 
  });
  
  const result = await executor.submit({
    id: 'timeout-task',
    fn,
    timeout
  });

  if (result.success) {
    return result.result as T;
  }
  throw result.error;
}

/**
 * Debounce для async функций
 */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<any> | null = null;

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }) as T;
}

/**
 * Throttle для async функций
 */
export function asyncThrottle<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number
): T {
  let lastRun = 0;
  let pendingPromise: Promise<any> | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    
    if (now - lastRun >= limit) {
      lastRun = now;
      return fn(...args);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve) => {
        setTimeout(async () => {
          lastRun = Date.now();
          pendingPromise = null;
          resolve(await fn(...args));
        }, limit - (now - lastRun));
      });
    }

    return pendingPromise;
  }) as T;
}
