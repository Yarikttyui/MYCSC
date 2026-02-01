import express, { Request, Response, NextFunction, Router } from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';


export interface APIConfig {
  port: number;
  host: string;
  enableCors: boolean;
  enableCompression: boolean;
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  enableAuth: boolean;
  apiPrefix: string;
  enableSwagger: boolean;
}

export interface APIContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    requestId: string;
    timestamp: string;
    duration: number;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: string;
  fields?: string;
}

export interface DatabaseService {
  query(sql: string): Promise<any>;
  queryMultiple(sql: string): Promise<any[]>;
  getTables(): string[];
  getTableSchema(table: string): any;
  getCurrentDatabase(): string;
  getDatabases(): string[];
}

export interface AuthService {
  login(username: string, password: string): Promise<{ token: string; user: any }>;
  logout(token: string): void;
  validateToken(token: string): Promise<any>;
  createUser(username: string, password: string, role: string): Promise<any>;
}


const DEFAULT_CONFIG: APIConfig = {
  port: 3001,
  host: '0.0.0.0',
  enableCors: true,
  enableCompression: true,
  enableRateLimit: true,
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 1000,
  enableAuth: true,
  apiPrefix: '/api/v1',
  enableSwagger: true
};


export class RESTAPIServer {
  private app: express.Application;
  private server: HttpServer | null = null;
  private config: APIConfig;
  private db: DatabaseService;
  private auth: AuthService | null;
  private activeConnections: Set<any> = new Set();

  constructor(
    db: DatabaseService,
    auth?: AuthService,
    config: Partial<APIConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db;
    this.auth = auth || null;
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }


  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: false
    }));
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-Request-ID', 'X-Total-Count']
      }));
    }
    if (this.config.enableCompression) {
      this.app.use(compression());
    }
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimitWindow,
        max: this.config.rateLimitMax,
        message: {
          success: false,
          error: 'Too many requests, please try again later.'
        }
      });
      this.app.use(limiter);
    }
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const context: APIContext = {
        requestId: req.headers['x-request-id'] as string || uuidv4(),
        startTime: Date.now()
      };
      (req as any).context = context;
      res.setHeader('X-Request-ID', context.requestId);
      next();
    });
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const context = (req as any).context as APIContext;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - RequestID: ${context.requestId}`);
      next();
    });
  }


  private authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.config.enableAuth || !this.auth) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(this.formatResponse({
        success: false,
        error: 'Authentication required'
      }, req));
    }

    const token = authHeader.substring(7);
    try {
      const user = await this.auth.validateToken(token);
      (req as any).context.userId = user.id;
      (req as any).user = user;
      next();
    } catch (error) {
      res.status(401).json(this.formatResponse({
        success: false,
        error: 'Invalid or expired token'
      }, req));
    }
  };


  private setupRoutes(): void {
    const router = Router();
    router.get('/health', (req, res) => {
      res.json(this.formatResponse({
        success: true,
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database: this.db.getCurrentDatabase()
        }
      }, req));
    });
    router.get('/', (req, res) => {
      res.json(this.formatResponse({
        success: true,
        data: {
          name: 'MYCSC REST API',
          version: '1.0.0',
          endpoints: this.getEndpointsList()
        }
      }, req));
    });
    this.setupAuthRoutes(router);
    this.setupDatabaseRoutes(router);
    this.setupTableRoutes(router);
    this.setupQueryRoutes(router);
    this.setupSchemaRoutes(router);
    this.setupIndexRoutes(router);
    this.setupTransactionRoutes(router);
    if (this.config.enableSwagger) {
      router.get('/docs', (req, res) => {
        res.json(this.getSwaggerSpec());
      });
    }

    this.app.use(this.config.apiPrefix, router);
  }


  private setupAuthRoutes(router: Router): void {
    router.post('/auth/login', async (req, res) => {
      try {
        if (!this.auth) {
          throw new Error('Authentication not configured');
        }
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Username and password are required'
          }, req));
        }

        const session = await this.auth.login(username, password);
        res.json(this.formatResponse({
          success: true,
          data: {
            token: session.token,
            user: session.user,
            expiresIn: 86400 // 24 hours
          }
        }, req));
      } catch (error: any) {
        res.status(401).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/auth/register', async (req, res) => {
      try {
        if (!this.auth) {
          throw new Error('Authentication not configured');
        }
        const { username, password, role = 'user' } = req.body;
        
        if (!username || !password) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Username and password are required'
          }, req));
        }

        const user = await this.auth.createUser(username, password, role);
        res.status(201).json(this.formatResponse({
          success: true,
          data: { user }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/auth/logout', this.authMiddleware, async (req, res) => {
      try {
        if (!this.auth) {
          throw new Error('Authentication not configured');
        }
        const token = req.headers.authorization?.substring(7);
        if (token) {
          this.auth.logout(token);
        }
        res.json(this.formatResponse({
          success: true,
          data: { message: 'Logged out successfully' }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.get('/auth/me', this.authMiddleware, (req, res) => {
      res.json(this.formatResponse({
        success: true,
        data: { user: (req as any).user }
      }, req));
    });
  }


  private setupDatabaseRoutes(router: Router): void {
    router.get('/databases', this.authMiddleware, async (req, res) => {
      try {
        const databases = this.db.getDatabases();
        res.json(this.formatResponse({
          success: true,
          data: { databases }
        }, req));
      } catch (error: any) {
        res.status(500).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.get('/databases/current', this.authMiddleware, (req, res) => {
      res.json(this.formatResponse({
        success: true,
        data: { database: this.db.getCurrentDatabase() }
      }, req));
    });
    router.post('/databases', this.authMiddleware, async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Database name is required'
          }, req));
        }

        await this.db.query(`CREATE DATABASE ${name}`);
        res.status(201).json(this.formatResponse({
          success: true,
          data: { message: `Database "${name}" created` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/databases/:name/use', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query(`USE ${req.params.name}`);
        res.json(this.formatResponse({
          success: true,
          data: { database: req.params.name }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.delete('/databases/:name', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query(`DROP DATABASE ${req.params.name}`);
        res.json(this.formatResponse({
          success: true,
          data: { message: `Database "${req.params.name}" dropped` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupTableRoutes(router: Router): void {
    router.get('/tables', this.authMiddleware, (req, res) => {
      try {
        const tables = this.db.getTables();
        res.json(this.formatResponse({
          success: true,
          data: { tables }
        }, req));
      } catch (error: any) {
        res.status(500).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.get('/tables/:name', this.authMiddleware, (req, res) => {
      try {
        const tableName = req.params.name as string;
        const schema = this.db.getTableSchema(tableName);
        if (!schema) {
          return res.status(404).json(this.formatResponse({
            success: false,
            error: `Table "${tableName}" not found`
          }, req));
        }
        res.json(this.formatResponse({
          success: true,
          data: { table: schema }
        }, req));
      } catch (error: any) {
        res.status(500).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/tables', this.authMiddleware, async (req, res) => {
      try {
        const { name, columns, options } = req.body;
        
        if (!name || !columns || !Array.isArray(columns)) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Table name and columns are required'
          }, req));
        }

        const columnDefs = columns.map((col: any) => {
          let def = `${col.name} ${col.type}`;
          if (col.length) def += `(${col.length})`;
          if (col.primaryKey) def += ' PRIMARY KEY';
          if (col.autoIncrement) def += ' AUTO_INCREMENT';
          if (!col.nullable) def += ' NOT NULL';
          if (col.unique) def += ' UNIQUE';
          if (col.default !== undefined) def += ` DEFAULT ${col.default}`;
          return def;
        }).join(', ');

        const sql = `CREATE TABLE ${name} (${columnDefs})`;
        await this.db.query(sql);

        res.status(201).json(this.formatResponse({
          success: true,
          data: { message: `Table "${name}" created`, sql }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.delete('/tables/:name', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query(`DROP TABLE ${req.params.name}`);
        res.json(this.formatResponse({
          success: true,
          data: { message: `Table "${req.params.name}" dropped` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/tables/:name/truncate', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query(`TRUNCATE TABLE ${req.params.name}`);
        res.json(this.formatResponse({
          success: true,
          data: { message: `Table "${req.params.name}" truncated` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.get('/tables/:name/rows', this.authMiddleware, async (req, res) => {
      try {
        const table = req.params.name;
        const params = this.parseQueryParams(req.query);
        let sql = `SELECT ${params.fields || '*'} FROM ${table}`;
        
        if (params.filter) {
          sql += ` WHERE ${params.filter}`;
        }
        
        if (params.sort) {
          sql += ` ORDER BY ${params.sort} ${params.order || 'ASC'}`;
        }
        const countResult = await this.db.query(`SELECT COUNT(*) as total FROM ${table}`);
        const total = countResult.rows?.[0]?.total || 0;
        const pageSize = params.pageSize || 100;
        const page = params.page || 1;
        const offset = (page - 1) * pageSize;
        sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

        const result = await this.db.query(sql);
        
        res.setHeader('X-Total-Count', total);
        res.json(this.formatResponse({
          success: true,
          data: { rows: result.rows || [] },
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            hasNext: page * pageSize < total,
            hasPrev: page > 1
          }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/tables/:name/rows', this.authMiddleware, async (req, res) => {
      try {
        const table = req.params.name;
        const data = req.body;

        if (!data || typeof data !== 'object') {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Row data is required'
          }, req));
        }

        const columns = Object.keys(data);
        const values = Object.values(data).map(v => 
          typeof v === 'string' ? `'${v}'` : v
        );

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
        const result = await this.db.query(sql);

        res.status(201).json(this.formatResponse({
          success: true,
          data: {
            insertId: result.insertId,
            affectedRows: result.affectedRows
          }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/tables/:name/rows/bulk', this.authMiddleware, async (req, res) => {
      try {
        const table = req.params.name;
        const { rows } = req.body;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Rows array is required'
          }, req));
        }

        const columns = Object.keys(rows[0]);
        const valuesList = rows.map(row => {
          const values = columns.map(col => {
            const v = row[col];
            return typeof v === 'string' ? `'${v}'` : v;
          });
          return `(${values.join(', ')})`;
        });

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuesList.join(', ')}`;
        const result = await this.db.query(sql);

        res.status(201).json(this.formatResponse({
          success: true,
          data: {
            insertedCount: rows.length,
            affectedRows: result.affectedRows
          }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.patch('/tables/:name/rows', this.authMiddleware, async (req, res) => {
      try {
        const table = req.params.name;
        const { data, where } = req.body;

        if (!data || !where) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Data and where clause are required'
          }, req));
        }

        const setClause = Object.entries(data)
          .map(([k, v]) => `${k} = ${typeof v === 'string' ? `'${v}'` : v}`)
          .join(', ');

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
        const result = await this.db.query(sql);

        res.json(this.formatResponse({
          success: true,
          data: { affectedRows: result.affectedRows }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.delete('/tables/:name/rows', this.authMiddleware, async (req, res) => {
      try {
        const table = req.params.name;
        const { where } = req.body;

        if (!where) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Where clause is required for delete'
          }, req));
        }

        const sql = `DELETE FROM ${table} WHERE ${where}`;
        const result = await this.db.query(sql);

        res.json(this.formatResponse({
          success: true,
          data: { affectedRows: result.affectedRows }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupQueryRoutes(router: Router): void {
    router.post('/query', this.authMiddleware, async (req, res) => {
      try {
        const { sql, params } = req.body;
        
        if (!sql) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'SQL query is required'
          }, req));
        }

        const result = await this.db.query(sql);
        res.json(this.formatResponse({
          success: true,
          data: result
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/query/batch', this.authMiddleware, async (req, res) => {
      try {
        const { queries } = req.body;
        
        if (!queries || !Array.isArray(queries)) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Queries array is required'
          }, req));
        }

        const results = [];
        for (const sql of queries) {
          try {
            const result = await this.db.query(sql);
            results.push({ success: true, result });
          } catch (error: any) {
            results.push({ success: false, error: error.message });
          }
        }

        res.json(this.formatResponse({
          success: true,
          data: { results }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/query/script', this.authMiddleware, async (req, res) => {
      try {
        const { sql } = req.body;
        
        if (!sql) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'SQL script is required'
          }, req));
        }

        const results = await this.db.queryMultiple(sql);
        res.json(this.formatResponse({
          success: true,
          data: { results }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/query/explain', this.authMiddleware, async (req, res) => {
      try {
        const { sql } = req.body;
        
        if (!sql) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'SQL query is required'
          }, req));
        }

        const result = await this.db.query(`EXPLAIN ${sql}`);
        res.json(this.formatResponse({
          success: true,
          data: result
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupSchemaRoutes(router: Router): void {
    router.get('/schema/:table/columns', this.authMiddleware, (req, res) => {
      try {
        const tableName = req.params.table as string;
        const schema = this.db.getTableSchema(tableName);
        if (!schema) {
          return res.status(404).json(this.formatResponse({
            success: false,
            error: `Table "${tableName}" not found`
          }, req));
        }
        res.json(this.formatResponse({
          success: true,
          data: { columns: schema.columns }
        }, req));
      } catch (error: any) {
        res.status(500).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/schema/:table/columns', this.authMiddleware, async (req, res) => {
      try {
        const { name, type, nullable, default: defaultValue } = req.body;
        
        if (!name || !type) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Column name and type are required'
          }, req));
        }

        let sql = `ALTER TABLE ${req.params.table} ADD COLUMN ${name} ${type}`;
        if (!nullable) sql += ' NOT NULL';
        if (defaultValue !== undefined) sql += ` DEFAULT ${defaultValue}`;

        await this.db.query(sql);
        res.status(201).json(this.formatResponse({
          success: true,
          data: { message: `Column "${name}" added` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.delete('/schema/:table/columns/:column', this.authMiddleware, async (req, res) => {
      try {
        const sql = `ALTER TABLE ${req.params.table} DROP COLUMN ${req.params.column}`;
        await this.db.query(sql);
        res.json(this.formatResponse({
          success: true,
          data: { message: `Column "${req.params.column}" dropped` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.patch('/schema/:table/rename', this.authMiddleware, async (req, res) => {
      try {
        const { newName } = req.body;
        
        if (!newName) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'New name is required'
          }, req));
        }

        const sql = `ALTER TABLE ${req.params.table} RENAME TO ${newName}`;
        await this.db.query(sql);
        res.json(this.formatResponse({
          success: true,
          data: { message: `Table renamed to "${newName}"` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupIndexRoutes(router: Router): void {
    router.post('/indexes', this.authMiddleware, async (req, res) => {
      try {
        const { name, table, columns, unique = false } = req.body;
        
        if (!name || !table || !columns) {
          return res.status(400).json(this.formatResponse({
            success: false,
            error: 'Index name, table and columns are required'
          }, req));
        }

        const columnsStr = Array.isArray(columns) ? columns.join(', ') : columns;
        const sql = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON ${table} (${columnsStr})`;
        await this.db.query(sql);

        res.status(201).json(this.formatResponse({
          success: true,
          data: { message: `Index "${name}" created` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.delete('/indexes/:name', this.authMiddleware, async (req, res) => {
      try {
        const { table } = req.query;
        const sql = `DROP INDEX ${req.params.name}${table ? ` ON ${table}` : ''}`;
        await this.db.query(sql);

        res.json(this.formatResponse({
          success: true,
          data: { message: `Index "${req.params.name}" dropped` }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupTransactionRoutes(router: Router): void {
    router.post('/transactions/begin', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query('BEGIN');
        res.json(this.formatResponse({
          success: true,
          data: { message: 'Transaction started' }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/transactions/commit', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query('COMMIT');
        res.json(this.formatResponse({
          success: true,
          data: { message: 'Transaction committed' }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
    router.post('/transactions/rollback', this.authMiddleware, async (req, res) => {
      try {
        await this.db.query('ROLLBACK');
        res.json(this.formatResponse({
          success: true,
          data: { message: 'Transaction rolled back' }
        }, req));
      } catch (error: any) {
        res.status(400).json(this.formatResponse({
          success: false,
          error: error.message
        }, req));
      }
    });
  }


  private setupErrorHandling(): void {
    this.app.use((req: Request, res: Response) => {
      res.status(404).json(this.formatResponse({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.path}`
      }, req));
    });
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json(this.formatResponse({
        success: false,
        error: 'Internal server error'
      }, req));
    });
  }


  private formatResponse(response: any, req: Request): APIResponse {
    const context = (req as any).context as APIContext;
    
    const result: APIResponse = {
      success: response.success,
      meta: {
        requestId: context?.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        duration: context ? Date.now() - context.startTime : 0
      }
    };

    if (response.success) {
      result.data = response.data;
    } else {
      result.error = response.error;
    }

    if (response.pagination) {
      result.meta!.pagination = response.pagination;
    }

    return result;
  }

  private parseQueryParams(query: any): QueryParams {
    return {
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      sort: query.sort,
      order: query.order as 'asc' | 'desc' | undefined,
      filter: query.filter,
      fields: query.fields
    };
  }

  private getEndpointsList(): any[] {
    return [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'POST', path: '/auth/login', description: 'User login' },
      { method: 'POST', path: '/auth/register', description: 'User registration' },
      { method: 'POST', path: '/auth/logout', description: 'User logout' },
      { method: 'GET', path: '/auth/me', description: 'Get current user' },
      { method: 'GET', path: '/databases', description: 'List databases' },
      { method: 'POST', path: '/databases', description: 'Create database' },
      { method: 'DELETE', path: '/databases/:name', description: 'Drop database' },
      { method: 'GET', path: '/tables', description: 'List tables' },
      { method: 'GET', path: '/tables/:name', description: 'Get table info' },
      { method: 'POST', path: '/tables', description: 'Create table' },
      { method: 'DELETE', path: '/tables/:name', description: 'Drop table' },
      { method: 'GET', path: '/tables/:name/rows', description: 'Get table rows' },
      { method: 'POST', path: '/tables/:name/rows', description: 'Insert row' },
      { method: 'PATCH', path: '/tables/:name/rows', description: 'Update rows' },
      { method: 'DELETE', path: '/tables/:name/rows', description: 'Delete rows' },
      { method: 'POST', path: '/query', description: 'Execute SQL query' },
      { method: 'POST', path: '/query/batch', description: 'Execute batch queries' },
      { method: 'POST', path: '/query/script', description: 'Execute SQL script' },
      { method: 'POST', path: '/indexes', description: 'Create index' },
      { method: 'DELETE', path: '/indexes/:name', description: 'Drop index' },
      { method: 'POST', path: '/transactions/begin', description: 'Begin transaction' },
      { method: 'POST', path: '/transactions/commit', description: 'Commit transaction' },
      { method: 'POST', path: '/transactions/rollback', description: 'Rollback transaction' }
    ];
  }

  private getSwaggerSpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'MYCSC REST API',
        version: '1.0.0',
        description: 'REST API for MYCSC Database Constructor'
      },
      servers: [
        { url: `http://localhost:${this.config.port}${this.config.apiPrefix}` }
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: { '200': { description: 'Server is healthy' } }
          }
        },
        '/auth/login': {
          post: {
            summary: 'User login',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      username: { type: 'string' },
                      password: { type: 'string' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Login successful' },
              '401': { description: 'Invalid credentials' }
            }
          }
        },
        '/tables': {
          get: {
            summary: 'List all tables',
            security: [{ bearerAuth: [] }],
            responses: { '200': { description: 'List of tables' } }
          },
          post: {
            summary: 'Create table',
            security: [{ bearerAuth: [] }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      columns: { type: 'array' }
                    }
                  }
                }
              }
            },
            responses: {
              '201': { description: 'Table created' },
              '400': { description: 'Invalid request' }
            }
          }
        },
        '/tables/{name}/rows': {
          get: {
            summary: 'Get table rows',
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'page', in: 'query', schema: { type: 'integer' } },
              { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
              { name: 'sort', in: 'query', schema: { type: 'string' } },
              { name: 'filter', in: 'query', schema: { type: 'string' } }
            ],
            responses: { '200': { description: 'Table rows' } }
          },
          post: {
            summary: 'Insert row',
            security: [{ bearerAuth: [] }],
            responses: { '201': { description: 'Row inserted' } }
          }
        },
        '/query': {
          post: {
            summary: 'Execute SQL query',
            security: [{ bearerAuth: [] }],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sql: { type: 'string' }
                    }
                  }
                }
              }
            },
            responses: { '200': { description: 'Query result' } }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
  }


  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer(this.app);
      
      this.server.on('connection', (conn) => {
        this.activeConnections.add(conn);
        conn.on('close', () => this.activeConnections.delete(conn));
      });

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`REST API server running at http://${this.config.host}:${this.config.port}`);
        console.log(`API endpoints: ${this.config.apiPrefix}`);
        if (this.config.enableSwagger) {
          console.log(`API docs: http://${this.config.host}:${this.config.port}${this.config.apiPrefix}/docs`);
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      for (const conn of this.activeConnections) {
        conn.destroy();
      }

      this.server.close(() => {
        console.log('REST API server stopped');
        this.server = null;
        resolve();
      });
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}


export class APIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<APIResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    return response.json();
  }
  async login(username: string, password: string): Promise<APIResponse> {
    const result = await this.request('POST', '/auth/login', { username, password });
    if (result.success && result.data && (result.data as any).token) {
      this.token = (result.data as any).token;
    }
    return result;
  }

  async logout(): Promise<APIResponse> {
    const result = await this.request('POST', '/auth/logout');
    this.token = null;
    return result;
  }
  async listDatabases(): Promise<APIResponse> {
    return this.request('GET', '/databases');
  }

  async createDatabase(name: string): Promise<APIResponse> {
    return this.request('POST', '/databases', { name });
  }

  async useDatabase(name: string): Promise<APIResponse> {
    return this.request('POST', `/databases/${name}/use`);
  }
  async listTables(): Promise<APIResponse> {
    return this.request('GET', '/tables');
  }

  async getTable(name: string): Promise<APIResponse> {
    return this.request('GET', `/tables/${name}`);
  }

  async createTable(name: string, columns: any[]): Promise<APIResponse> {
    return this.request('POST', '/tables', { name, columns });
  }

  async dropTable(name: string): Promise<APIResponse> {
    return this.request('DELETE', `/tables/${name}`);
  }
  async getRows(table: string, params?: QueryParams): Promise<APIResponse> {
    let path = `/tables/${table}/rows`;
    if (params) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.pageSize) query.set('pageSize', String(params.pageSize));
      if (params.sort) query.set('sort', params.sort);
      if (params.order) query.set('order', params.order);
      if (params.filter) query.set('filter', params.filter);
      if (params.fields) query.set('fields', params.fields);
      const queryString = query.toString();
      if (queryString) path += `?${queryString}`;
    }
    return this.request('GET', path);
  }

  async insertRow(table: string, data: Record<string, any>): Promise<APIResponse> {
    return this.request('POST', `/tables/${table}/rows`, data);
  }

  async insertRows(table: string, rows: Record<string, any>[]): Promise<APIResponse> {
    return this.request('POST', `/tables/${table}/rows/bulk`, { rows });
  }

  async updateRows(table: string, data: Record<string, any>, where: string): Promise<APIResponse> {
    return this.request('PATCH', `/tables/${table}/rows`, { data, where });
  }

  async deleteRows(table: string, where: string): Promise<APIResponse> {
    return this.request('DELETE', `/tables/${table}/rows`, { where });
  }
  async query(sql: string): Promise<APIResponse> {
    return this.request('POST', '/query', { sql });
  }

  async queryBatch(queries: string[]): Promise<APIResponse> {
    return this.request('POST', '/query/batch', { queries });
  }
  async beginTransaction(): Promise<APIResponse> {
    return this.request('POST', '/transactions/begin');
  }

  async commit(): Promise<APIResponse> {
    return this.request('POST', '/transactions/commit');
  }

  async rollback(): Promise<APIResponse> {
    return this.request('POST', '/transactions/rollback');
  }
}


export default RESTAPIServer;
