import { Token, TokenType, SQLSyntaxError } from './ast-types';
const KEYWORDS: Record<string, TokenType> = {
  'SELECT': 'SELECT', 'FROM': 'FROM', 'WHERE': 'WHERE',
  'INSERT': 'INSERT', 'INTO': 'INTO', 'VALUES': 'VALUES',
  'UPDATE': 'UPDATE', 'SET': 'SET', 'DELETE': 'DELETE',
  'CREATE': 'CREATE', 'DROP': 'DROP', 'ALTER': 'ALTER',
  'TABLE': 'TABLE', 'DATABASE': 'DATABASE', 'INDEX': 'INDEX',
  'VIEW': 'VIEW', 'TRIGGER': 'TRIGGER', 'PROCEDURE': 'PROCEDURE',
  'FUNCTION': 'FUNCTION', 'JOIN': 'JOIN', 'INNER': 'INNER',
  'LEFT': 'LEFT', 'RIGHT': 'RIGHT', 'FULL': 'FULL',
  'OUTER': 'OUTER', 'CROSS': 'CROSS', 'ON': 'ON',
  'AND': 'AND', 'OR': 'OR', 'NOT': 'NOT', 'IN': 'IN',
  'EXISTS': 'EXISTS', 'BETWEEN': 'BETWEEN', 'LIKE': 'LIKE',
  'REGEXP': 'REGEXP', 'IS': 'IS', 'NULL': 'NULL',
  'TRUE': 'TRUE', 'FALSE': 'FALSE', 'AS': 'AS',
  'DISTINCT': 'DISTINCT', 'ALL': 'ALL', 'UNION': 'UNION',
  'INTERSECT': 'INTERSECT', 'EXCEPT': 'EXCEPT', 'ORDER': 'ORDER',
  'BY': 'BY', 'ASC': 'ASC', 'DESC': 'DESC', 'LIMIT': 'LIMIT',
  'OFFSET': 'OFFSET', 'GROUP': 'GROUP', 'HAVING': 'HAVING',
  'CASE': 'CASE', 'WHEN': 'WHEN', 'THEN': 'THEN',
  'ELSE': 'ELSE', 'END': 'END', 'IF': 'IF',
  'PRIMARY': 'PRIMARY', 'KEY': 'KEY', 'FOREIGN': 'FOREIGN',
  'REFERENCES': 'REFERENCES', 'UNIQUE': 'UNIQUE', 'DEFAULT': 'DEFAULT',
  'AUTO_INCREMENT': 'AUTO_INCREMENT', 'CHECK': 'CHECK',
  'CONSTRAINT': 'CONSTRAINT', 'ADD': 'ADD', 'MODIFY': 'MODIFY',
  'CHANGE': 'CHANGE', 'COLUMN': 'COLUMN', 'RENAME': 'RENAME',
  'TO': 'TO', 'GRANT': 'GRANT', 'REVOKE': 'REVOKE',
  'ROLE': 'ROLE', 'USER': 'USER', 'IDENTIFIED': 'IDENTIFIED',
  'BEGIN': 'BEGIN', 'COMMIT': 'COMMIT', 'ROLLBACK': 'ROLLBACK',
  'TRANSACTION': 'TRANSACTION', 'SAVEPOINT': 'SAVEPOINT',
  'EXPLAIN': 'EXPLAIN', 'ANALYZE': 'ANALYZE', 'SHOW': 'SHOW',
  'DESCRIBE': 'DESCRIBE', 'USE': 'USE',
  'PARTITION': 'PARTITION', 'PARTITIONS': 'PARTITIONS',
  'RANGE': 'RANGE', 'LIST': 'LIST', 'HASH': 'HASH',
  'FULLTEXT': 'FULLTEXT', 'MATCH': 'MATCH', 'AGAINST': 'AGAINST',
  'NATURAL': 'NATURAL', 'LANGUAGE': 'LANGUAGE', 'MODE': 'MODE',
  'BOOLEAN': 'BOOLEAN', 'OVER': 'OVER', 'WINDOW': 'WINDOW',
  'ROWS': 'ROWS', 'PRECEDING': 'PRECEDING', 'FOLLOWING': 'FOLLOWING',
  'UNBOUNDED': 'UNBOUNDED', 'CURRENT': 'CURRENT', 'ROW': 'ROW',
  'WITH': 'WITH', 'RECURSIVE': 'RECURSIVE', 'CASCADE': 'CASCADE',
  'RESTRICT': 'RESTRICT', 'NO': 'NO', 'ACTION': 'ACTION',
  'TRUNCATE': 'TRUNCATE', 'START': 'START', 'RELEASE': 'RELEASE',
  'TABLES': 'TABLES', 'DATABASES': 'DATABASES', 'COLUMNS': 'COLUMNS',
  'INDEXES': 'INDEXES',
  'INT': 'INT', 'INTEGER': 'INTEGER', 'TINYINT': 'TINYINT',
  'SMALLINT': 'SMALLINT', 'MEDIUMINT': 'MEDIUMINT', 'BIGINT': 'BIGINT',
  'FLOAT': 'FLOAT', 'DOUBLE': 'DOUBLE', 'REAL': 'REAL',
  'DECIMAL': 'DECIMAL', 'NUMERIC': 'NUMERIC', 'VARCHAR': 'VARCHAR',
  'CHAR': 'CHAR', 'TEXT': 'TEXT', 'TINYTEXT': 'TINYTEXT',
  'MEDIUMTEXT': 'MEDIUMTEXT', 'LONGTEXT': 'LONGTEXT', 'BOOL': 'BOOL',
  'BIT': 'BIT', 'DATE': 'DATE', 'DATETIME': 'DATETIME',
  'TIMESTAMP': 'TIMESTAMP', 'TIME': 'TIME', 'YEAR': 'YEAR',
  'JSON': 'JSON', 'BLOB': 'BLOB', 'TINYBLOB': 'TINYBLOB',
  'MEDIUMBLOB': 'MEDIUMBLOB', 'LONGBLOB': 'LONGBLOB',
  'BINARY': 'BINARY', 'VARBINARY': 'VARBINARY', 'ENUM': 'ENUM',
  'GEOMETRY': 'GEOMETRY', 'POINT': 'POINT'
};

export class SQLLexer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  tokenize(sql: string): Token[] {
    this.input = sql;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (!this.isAtEnd()) {
      this.scanToken();
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    if (pos >= this.input.length) return '\0';
    return this.input[pos];
  }

  private advance(): string {
    const char = this.input[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      position: this.position - value.length,
      line: this.line,
      column: this.column - value.length
    });
  }

  private scanToken(): void {
    const startPos = this.position;
    const startLine = this.line;
    const startCol = this.column;
    const char = this.advance();

    switch (char) {
      case ' ':
      case '\t':
      case '\r':
      case '\n':
        break;
      case '(':
        this.addToken('LPAREN', '(');
        break;
      case ')':
        this.addToken('RPAREN', ')');
        break;
      case '[':
        this.addToken('LBRACKET', '[');
        break;
      case ']':
        this.addToken('RBRACKET', ']');
        break;
      case '{':
        this.addToken('LBRACE', '{');
        break;
      case '}':
        this.addToken('RBRACE', '}');
        break;
      case ',':
        this.addToken('COMMA', ',');
        break;
      case '.':
        this.addToken('DOT', '.');
        break;
      case ';':
        this.addToken('SEMICOLON', ';');
        break;
      case ':':
        this.addToken('COLON', ':');
        break;
      case '?':
        this.addToken('QUESTION', '?');
        break;
      case '+':
        this.addToken('PLUS', '+');
        break;
      case '*':
        this.addToken('STAR', '*');
        break;
      case '/':
        if (this.peek() === '*') {
          this.scanBlockComment();
        } else if (this.peek() === '/') {
          this.scanLineComment();
        } else {
          this.addToken('SLASH', '/');
        }
        break;
      case '%':
        this.addToken('PERCENT', '%');
        break;
      case '^':
        this.addToken('CARET', '^');
        break;
      case '&':
        this.addToken('BIT_AND', '&');
        break;
      case '~':
        this.addToken('BIT_NOT', '~');
        break;
      case '-':
        if (this.peek() === '-') {
          this.scanLineComment();
        } else {
          this.addToken('MINUS', '-');
        }
        break;

      case '|':
        if (this.peek() === '|') {
          this.advance();
          this.addToken('DOUBLE_PIPE', '||');
        } else {
          this.addToken('BIT_OR', '|');
        }
        break;

      case '=':
        this.addToken('EQ', '=');
        break;

      case '!':
        if (this.peek() === '=') {
          this.advance();
          this.addToken('NEQ', '!=');
        } else {
          this.addToken('NOT', '!');
        }
        break;

      case '<':
        if (this.peek() === '=') {
          this.advance();
          if (this.peek() === '>') {
            this.advance();
            this.addToken('SPACESHIP', '<=>');
          } else {
            this.addToken('LTE', '<=');
          }
        } else if (this.peek() === '>') {
          this.advance();
          this.addToken('NEQ', '<>');
        } else if (this.peek() === '<') {
          this.advance();
          this.addToken('LSHIFT', '<<');
        } else {
          this.addToken('LT', '<');
        }
        break;

      case '>':
        if (this.peek() === '=') {
          this.advance();
          this.addToken('GTE', '>=');
        } else if (this.peek() === '>') {
          this.advance();
          this.addToken('RSHIFT', '>>');
        } else {
          this.addToken('GT', '>');
        }
        break;
      case "'":
      case '"':
        this.scanString(char);
        break;
      case '`':
        this.scanBacktickIdentifier();
        break;
      default:
        if (this.isDigit(char)) {
          this.scanNumber(char);
        } else if (this.isAlpha(char) || char === '_') {
          this.scanIdentifier(char);
        } else {
          throw new SQLSyntaxError(
            `Unexpected character: '${char}'`,
            startPos,
            startLine,
            startCol
          );
        }
    }
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private scanString(quote: string): void {
    const startPos = this.position - 1;
    let value = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case "'": value += "'"; break;
          case '"': value += '"'; break;
          case '0': value += '\0'; break;
          default: value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new SQLSyntaxError(
        'Unterminated string literal',
        startPos,
        this.line,
        this.column
      );
    }

    this.advance();
    this.addToken('STRING', value);
  }

  private scanBacktickIdentifier(): void {
    const startPos = this.position - 1;
    let value = '';

    while (!this.isAtEnd() && this.peek() !== '`') {
      value += this.advance();
    }

    if (this.isAtEnd()) {
      throw new SQLSyntaxError(
        'Unterminated identifier',
        startPos,
        this.line,
        this.column
      );
    }

    this.advance();
    this.tokens.push({
      type: 'IDENTIFIER',
      value: value,
      position: startPos,
      line: this.line,
      column: this.column - value.length - 2
    });
  }

  private scanNumber(firstChar: string): void {
    let value = firstChar;
    let hasDot = false;
    let hasE = false;

    while (!this.isAtEnd()) {
      const char = this.peek();
      
      if (this.isDigit(char)) {
        value += this.advance();
      } else if (char === '.' && !hasDot && !hasE) {
        hasDot = true;
        value += this.advance();
      } else if ((char === 'e' || char === 'E') && !hasE) {
        hasE = true;
        value += this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          value += this.advance();
        }
      } else {
        break;
      }
    }

    this.addToken('NUMBER', value);
  }

  private scanIdentifier(firstChar: string): void {
    let value = firstChar;

    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      value += this.advance();
    }

    const upper = value.toUpperCase();
    const keyword = KEYWORDS[upper];
    if (keyword) {
      this.addToken(keyword, value);
    } else {
      this.addToken('IDENTIFIER', value);
    }
  }

  private scanLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private scanBlockComment(): void {
    this.advance();
    
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }

    throw new SQLSyntaxError(
      'Unterminated block comment',
      this.position,
      this.line,
      this.column
    );
  }
}
export const lexer = new SQLLexer();
