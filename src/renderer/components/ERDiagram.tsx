import React, { useState, useRef, useEffect, useCallback } from 'react';
const getThemeColors = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    bgPrimary: style.getPropertyValue('--bg-primary').trim() || '#1e1e2e',
    bgSecondary: style.getPropertyValue('--bg-secondary').trim() || '#181825',
    textPrimary: style.getPropertyValue('--text-primary').trim() || '#cdd6f4',
    border: style.getPropertyValue('--border').trim() || '#313244',
    surface1: style.getPropertyValue('--ctp-surface1').trim() || '#45475a',
    blue: style.getPropertyValue('--ctp-blue').trim() || '#89b4fa',
    orange: style.getPropertyValue('--ctp-peach').trim() || '#fab387',
    green: style.getPropertyValue('--ctp-green').trim() || '#a6e3a1',
    purple: style.getPropertyValue('--ctp-mauve').trim() || '#cba6f7',
    red: style.getPropertyValue('--ctp-red').trim() || '#f38ba8',
    pink: style.getPropertyValue('--ctp-pink').trim() || '#f5c2e7',
  };
};

interface Column {
  name: string;
  type: string;
  primaryKey?: boolean;
  foreignKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
}

interface TableNode {
  id: string;
  name: string;
  columns: Column[];
  x: number;
  y: number;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'red';
  width?: number;
  height?: number;
}

interface Relation {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: '1:1' | '1:N' | 'N:M';
}

interface ERDiagramProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; primaryKey?: boolean; nullable?: boolean; unique?: boolean }>;
  }>;
  relations: Relation[];
  onCreateRelation?: (relation: Omit<Relation, 'id'>) => void;
  onDeleteRelation?: (id: string) => void;
  dbAPI?: any;
}

const TABLE_COLORS: Record<string, 'blue' | 'orange' | 'green' | 'purple' | 'red'> = {};
const COLOR_PALETTE: Array<'blue' | 'orange' | 'green' | 'purple' | 'red'> = ['blue', 'orange', 'green', 'purple', 'red'];

export const ERDiagram: React.FC<ERDiagramProps> = ({
  isOpen,
  onClose,
  tables,
  relations,
  onCreateRelation,
  onDeleteRelation,
  dbAPI
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  
  const [nodes, setNodes] = useState<TableNode[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showRelationCreator, setShowRelationCreator] = useState(false);
  const [newRelation, setNewRelation] = useState({
    sourceTable: '',
    sourceColumn: '',
    targetTable: '',
    targetColumn: '',
    type: '1:N' as '1:1' | '1:N' | 'N:M'
  });
  const [hoveredRelation, setHoveredRelation] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [editingColumns, setEditingColumns] = useState<Column[]>([]);
  const [activeEditorTab, setActiveEditorTab] = useState<'columns' | 'indexes' | 'foreignKeys' | 'triggers' | 'options'>('columns');
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const SQL_DATA_TYPES = {
    numeric: [
      'INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
      'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
      'BIT', 'BOOLEAN', 'BOOL'
    ],
    string: [
      'CHAR', 'VARCHAR(255)', 'VARCHAR(45)', 'VARCHAR(100)',
      'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
      'BINARY', 'VARBINARY', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
      'ENUM', 'SET', 'JSON'
    ],
    datetime: [
      'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'
    ],
    spatial: [
      'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON',
      'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION'
    ]
  };
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ table: string; x: number; y: number } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<'1:1' | '1:N' | 'N:M'>('1:N');
  const [showRelationTypeSelector, setShowRelationTypeSelector] = useState(true);
  const [panelPosition, setPanelPosition] = useState({ x: 260, y: 70 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [panelDragStart, setPanelDragStart] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (tables.length > 0 && nodes.length === 0) {
      const cols = Math.ceil(Math.sqrt(tables.length));
      const newNodes: TableNode[] = tables.map((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        if (!TABLE_COLORS[table.name]) {
          TABLE_COLORS[table.name] = COLOR_PALETTE[index % COLOR_PALETTE.length];
        }
        
        return {
          id: table.name,
          name: table.name,
          columns: table.columns.map(c => ({
            name: c.name,
            type: c.type,
            primaryKey: c.primaryKey,
            nullable: c.nullable,
            unique: c.unique
          })),
          x: 100 + col * 280,
          y: 100 + row * 300,
          color: TABLE_COLORS[table.name],
          width: 220,
          height: 40 + table.columns.length * 24
        };
      });
      setNodes(newNodes);
    }
  }, [tables]);
  useEffect(() => {
    if (!minimapRef.current || nodes.length === 0) return;
    
    const canvas = minimapRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const scale = 0.1;
    const themeColors = getThemeColors();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = themeColors.bgPrimary;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    nodes.forEach(node => {
      const colors: Record<string, string> = {
        blue: themeColors.blue,
        orange: themeColors.orange,
        green: themeColors.green,
        purple: themeColors.purple,
        red: themeColors.red
      };
      
      ctx.fillStyle = colors[node.color];
      ctx.fillRect(
        (node.x + pan.x) * scale,
        (node.y + pan.y) * scale,
        (node.width || 200) * scale,
        (node.height || 150) * scale
      );
    });
    if (canvasRef.current) {
      const viewWidth = canvasRef.current.clientWidth / zoom;
      const viewHeight = canvasRef.current.clientHeight / zoom;
      ctx.strokeStyle = themeColors.pink;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        -pan.x * scale,
        -pan.y * scale,
        viewWidth * scale,
        viewHeight * scale
      );
    }
  }, [nodes, pan, zoom]);
  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x * zoom, y: e.clientY - pan.y * zoom });
    } else if (nodeId) {
      setDraggedNode(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDragStart({ x: e.clientX / zoom - node.x, y: e.clientY / zoom - node.y });
      }
      setSelectedNode(nodeId);
    } else if (e.button === 0 && !nodeId) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x * zoom, y: e.clientY - pan.y * zoom });
    }
    setIsDragging(true);
  };
  const handlePanelMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPanel(true);
    setPanelDragStart({ 
      x: e.clientX - panelPosition.x, 
      y: e.clientY - panelPosition.y 
    });
  };
  
  const handlePanelMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPanel) return;
    setPanelPosition({
      x: e.clientX - panelDragStart.x,
      y: e.clientY - panelDragStart.y
    });
  }, [isDraggingPanel, panelDragStart]);
  
  const handlePanelMouseUp = useCallback(() => {
    setIsDraggingPanel(false);
  }, []);
  useEffect(() => {
    if (isDraggingPanel) {
      window.addEventListener('mousemove', handlePanelMouseMove);
      window.addEventListener('mouseup', handlePanelMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePanelMouseMove);
        window.removeEventListener('mouseup', handlePanelMouseUp);
      };
    }
  }, [isDraggingPanel, handlePanelMouseMove, handlePanelMouseUp]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (isPanning) {
      setPan({
        x: (e.clientX - dragStart.x) / zoom,
        y: (e.clientY - dragStart.y) / zoom
      });
    } else if (draggedNode) {
      setNodes(prev => prev.map(node => {
        if (node.id === draggedNode) {
          return {
            ...node,
            x: e.clientX / zoom - dragStart.x,
            y: e.clientY / zoom - dragStart.y
          };
        }
        return node;
      }));
    } else if (isConnecting && connectionStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnectionEnd({
          x: (e.clientX - rect.left) / zoom - pan.x,
          y: (e.clientY - rect.top) / zoom - pan.y
        });
      }
    }
  }, [isDragging, isPanning, draggedNode, dragStart, zoom, isConnecting, connectionStart, pan]);

  const handleMouseUp = () => {
    if (isConnecting && connectionStart && hoveredTable && 
        connectionStart.table !== hoveredTable) {
      if (onCreateRelation) {
        const sourceTable = tables.find(t => t.name === connectionStart.table);
        const targetTable = tables.find(t => t.name === hoveredTable);
        const sourcePK = sourceTable?.columns.find(c => c.primaryKey)?.name || 'id';
        const targetPK = targetTable?.columns.find(c => c.primaryKey)?.name || 'id';
        
        onCreateRelation({
          sourceTable: connectionStart.table,
          sourceColumn: sourcePK,
          targetTable: hoveredTable,
          targetColumn: targetPK,
          type: selectedRelationType
        });
      }
    }
    
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
    setIsConnecting(false);
    setConnectionStart(null);
    setConnectionEnd(null);
    setHoveredTable(null);
  };
  const handleTableDoubleClick = (tableName: string) => {
    const table = tables.find(t => t.name === tableName);
    if (table) {
      setEditingTable(tableName);
      setEditingColumns(table.columns.map(c => ({
        name: c.name,
        type: c.type,
        primaryKey: c.primaryKey,
        nullable: c.nullable,
        unique: c.unique
      })));
    }
  };
  const handleConnectionStart = (e: React.MouseEvent, tableName: string, node: TableNode, side: 'left' | 'right') => {
    e.stopPropagation();
    const handleX = side === 'right' ? node.x + (node.width || 220) : node.x;
    const handleY = node.y + (node.height || 100) / 2;
    
    setIsConnecting(true);
    setConnectionStart({ table: tableName, x: handleX, y: handleY });
    setConnectionEnd({ x: handleX, y: handleY });
    setIsDragging(true);
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.25), 2));
  };
  const getConnectionPoints = (source: TableNode, target: TableNode, sourceCol: string, targetCol: string) => {
    const sourceColIndex = source.columns.findIndex(c => c.name === sourceCol);
    const targetColIndex = target.columns.findIndex(c => c.name === targetCol);
    
    const sourceY = source.y + 40 + sourceColIndex * 24 + 12;
    const targetY = target.y + 40 + targetColIndex * 24 + 12;
    
    const sourceRight = source.x + (source.width || 220);
    const targetRight = target.x + (target.width || 220);
    let startX, endX;
    if (sourceRight < target.x) {
      startX = sourceRight;
      endX = target.x;
    } else if (targetRight < source.x) {
      startX = source.x;
      endX = targetRight;
    } else {
      startX = sourceRight;
      endX = targetRight;
    }
    
    return { startX, startY: sourceY, endX, endY: targetY };
  };
  const getRelationPath = (rel: Relation) => {
    const source = nodes.find(n => n.id === rel.sourceTable);
    const target = nodes.find(n => n.id === rel.targetTable);
    if (!source || !target) return '';
    
    const { startX, startY, endX, endY } = getConnectionPoints(source, target, rel.sourceColumn, rel.targetColumn);
    const midX = (startX + endX) / 2;
    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  };
  const autoArrange = () => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    setNodes(prev => prev.map((node, index) => ({
      ...node,
      x: 100 + (index % cols) * 300,
      y: 100 + Math.floor(index / cols) * 350
    })));
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };
  const addNewTable = () => {
    const newTableName = `new_table_${nodes.length + 1}`;
    const colorIndex = nodes.length % COLOR_PALETTE.length;
    const cols = Math.ceil(Math.sqrt(nodes.length + 1));
    const row = Math.floor(nodes.length / cols);
    const col = nodes.length % cols;
    
    const newNode: TableNode = {
      id: newTableName,
      name: newTableName,
      columns: [
        { name: 'id', type: 'INT', primaryKey: true, nullable: false }
      ],
      x: 100 + col * 300,
      y: 100 + row * 350,
      color: COLOR_PALETTE[colorIndex],
      height: 40 + 24
    };
    
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newTableName);
    setEditingTable(newTableName);
    setEditingColumns([{ name: 'id', type: 'INT', primaryKey: true, nullable: false }]);
    setActiveEditorTab('columns');
  };
  const exportAsPNG = () => {
    if (!canvasRef.current) return;
    
    const svg = canvasRef.current.querySelector('svg');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        const themeColors = getThemeColors();
        ctx.fillStyle = themeColors.bgPrimary;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const a = document.createElement('a');
        a.download = `er_diagram_${Date.now()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (!isOpen) return null;

  return (
    <div className="er-diagram-overlay">
      <div className="er-diagram-container">
        {/* Header */}
        <div className="er-header">
          <div className="er-header-left">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <rect x="2" y="3" width="7" height="7" rx="1" fill="var(--ctp-blue)"/>
              <rect x="15" y="3" width="7" height="7" rx="1" fill="var(--ctp-peach)"/>
              <rect x="15" y="14" width="7" height="7" rx="1" fill="var(--ctp-green)"/>
              <path d="M9 6.5h3M12 6.5v11M12 17.5h3" stroke="var(--text-primary)" strokeWidth="2"/>
            </svg>
            <h2>ER Диаграмма</h2>
            <span className="table-count">{nodes.length} таблиц</span>
          </div>
          
          <div className="er-header-center">
            <div className="zoom-controls">
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.25))} title="Уменьшить">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2"/>
                  <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} title="Увеличить">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2"/>
                  <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="2"/>
                  <line x1="11" y1="7" x2="11" y2="15" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              <button onClick={() => setZoom(1)} title="100%">1:1</button>
              <button onClick={() => setZoom(0.5)} title="50%">1:2</button>
            </div>
          </div>
          
          <div className="er-header-right">
            <button className="er-btn primary" onClick={addNewTable} title="Добавить таблицу">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/>
                <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="er-btn" onClick={autoArrange} title="Авто-расположение">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="er-btn" onClick={() => setShowRelationCreator(true)} title="Добавить связь">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button className="er-btn" onClick={exportAsPNG} title="Экспорт PNG">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
            <button className="er-close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="er-content">
          {/* Sidebar */}
          <div className="er-sidebar">
            <div className="sidebar-section">
              <h4>Навигатор</h4>
              <canvas 
                ref={minimapRef} 
                width={200} 
                height={150}
                className="er-minimap"
              />
            </div>
            
            <div className="sidebar-section">
              <h4>Таблицы</h4>
              <div className="table-list">
                {nodes.map(node => (
                  <div 
                    key={node.id}
                    className={`table-item ${selectedNode === node.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedNode(node.id);
                      setPan({ x: -node.x + 400, y: -node.y + 200 });
                    }}
                  >
                    <span className={`color-dot ${node.color}`}></span>
                    <span className="table-name">{node.name}</span>
                    <span className="column-count">{node.columns.length}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="sidebar-section">
              <h4>Связи</h4>
              <div className="relation-types">
                <div className="relation-type">
                  <span className="rel-icon">1:1</span>
                  <span>Один к одному</span>
                </div>
                <div className="relation-type">
                  <span className="rel-icon">1:N</span>
                  <span>Один ко многим</span>
                </div>
                <div className="relation-type">
                  <span className="rel-icon">N:M</span>
                  <span>Многие ко многим</span>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div 
            ref={canvasRef}
            className="er-canvas"
            style={{ cursor: draggedNode ? 'move' : isPanning ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => handleMouseDown(e)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <svg 
              width="100%" 
              height="100%"
              style={{ overflow: 'visible' }}
            >
              {/* Grid Pattern - scaled with zoom */}
              <defs>
                <pattern 
                  id="gridSmall" 
                  width={50 * zoom} 
                  height={50 * zoom} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${pan.x * zoom}, ${pan.y * zoom})`}
                >
                  <path d={`M ${50 * zoom} 0 L 0 0 0 ${50 * zoom}`} fill="none" stroke="var(--border)" strokeWidth="0.5"/>
                </pattern>
                <pattern 
                  id="gridLarge" 
                  width={250 * zoom} 
                  height={250 * zoom} 
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${pan.x * zoom}, ${pan.y * zoom})`}
                >
                  <rect width={250 * zoom} height={250 * zoom} fill="url(#gridSmall)"/>
                  <path d={`M ${250 * zoom} 0 L 0 0 0 ${250 * zoom}`} fill="none" stroke="var(--ctp-surface1)" strokeWidth="1"/>
                </pattern>
                
                {/* Arrow Markers - End arrows */}
                <marker id="arrowEnd" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L0,12 L12,6 z" fill="var(--ctp-blue)"/>
                </marker>
                <marker id="arrowEndHover" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L0,12 L12,6 z" fill="var(--ctp-pink)"/>
                </marker>
                
                {/* Start markers for relationship type */}
                <marker id="markerOne" markerWidth="16" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                  <line x1="8" y1="2" x2="8" y2="14" stroke="var(--ctp-blue)" strokeWidth="2"/>
                </marker>
                <marker id="markerMany" markerWidth="20" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M4,8 L16,2 M4,8 L16,8 M4,8 L16,14" stroke="var(--ctp-blue)" strokeWidth="2" fill="none"/>
                </marker>
                <marker id="markerOneHover" markerWidth="16" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                  <line x1="8" y1="2" x2="8" y2="14" stroke="var(--ctp-pink)" strokeWidth="2"/>
                </marker>
                <marker id="markerManyHover" markerWidth="20" markerHeight="16" refX="2" refY="8" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M4,8 L16,2 M4,8 L16,8 M4,8 L16,14" stroke="var(--ctp-pink)" strokeWidth="2" fill="none"/>
                </marker>
              </defs>
              
              {/* Background grid - outside transform to keep consistent size */}
              <rect width="100%" height="100%" fill="url(#gridLarge)"/>
              
              {/* Main transform group for zoom and pan */}
              <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
                
                {/* Relations */}
                <g className="relations">
                  {relations.map(rel => {
                    const path = getRelationPath(rel);
                    if (!path) return null;
                    
                    const isHovered = hoveredRelation === rel.id;
                    const sourceNode = nodes.find(n => n.id === rel.sourceTable);
                    const targetNode = nodes.find(n => n.id === rel.targetTable);
                    let markerStart = '';
                    let markerEnd = '';
                    
                    if (rel.type === '1:1') {
                      markerStart = isHovered ? 'url(#markerOneHover)' : 'url(#markerOne)';
                      markerEnd = isHovered ? 'url(#arrowEndHover)' : 'url(#arrowEnd)';
                    } else if (rel.type === '1:N') {
                      markerStart = isHovered ? 'url(#markerOneHover)' : 'url(#markerOne)';
                      markerEnd = isHovered ? 'url(#markerManyHover)' : 'url(#markerMany)';
                    } else {
                      markerStart = isHovered ? 'url(#markerManyHover)' : 'url(#markerMany)';
                      markerEnd = isHovered ? 'url(#markerManyHover)' : 'url(#markerMany)';
                    }
                    const labelX = sourceNode && targetNode 
                      ? (sourceNode.x + (sourceNode.width || 220) / 2 + targetNode.x + (targetNode.width || 220) / 2) / 2
                      : 0;
                    const labelY = sourceNode && targetNode 
                      ? (sourceNode.y + (sourceNode.height || 100) / 2 + targetNode.y + (targetNode.height || 100) / 2) / 2 - 10
                      : 0;
                    
                    return (
                      <g 
                        key={rel.id}
                        className={`relation-line ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredRelation(rel.id)}
                        onMouseLeave={() => setHoveredRelation(null)}
                      >
                        {/* Invisible wider path for easier hover */}
                        <path
                          d={path}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={12}
                          style={{ cursor: 'pointer' }}
                        />
                        {/* Visible path */}
                        <path
                          d={path}
                          fill="none"
                          stroke={isHovered ? 'var(--ctp-pink)' : 'var(--ctp-blue)'}
                          strokeWidth={isHovered ? 3 : 2}
                          strokeDasharray={rel.type === 'N:M' ? '8,4' : 'none'}
                          markerStart={markerStart}
                          markerEnd={markerEnd}
                        />
                        {/* Relation type label - always visible */}
                        <g transform={`translate(${labelX}, ${labelY})`}>
                          <rect 
                            x="-18" 
                            y="-10" 
                            width="36" 
                            height="20" 
                            rx="4" 
                            fill={isHovered ? 'var(--ctp-pink)' : 'var(--border)'}
                            stroke={isHovered ? 'var(--ctp-pink)' : 'var(--ctp-surface1)'}
                          />
                          <text 
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={isHovered ? 'var(--ctp-crust)' : 'var(--text-primary)'}
                            fontSize="11"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {rel.type}
                          </text>
                        </g>
                      </g>
                    );
                  })}
              </g>
              
              {/* Connection line being drawn */}
              {isConnecting && connectionStart && connectionEnd && (
                <path
                  d={`M ${connectionStart.x} ${connectionStart.y} C ${(connectionStart.x + connectionEnd.x) / 2} ${connectionStart.y}, ${(connectionStart.x + connectionEnd.x) / 2} ${connectionEnd.y}, ${connectionEnd.x} ${connectionEnd.y}`}
                  fill="none"
                  stroke="var(--ctp-pink)"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  pointerEvents="none"
                />
              )}
              
              {/* Table Nodes */}
              <g className="nodes">
                {nodes.map(node => {
                  const colors: Record<string, { header: string; bg: string; border: string }> = {
                    blue: { header: 'var(--ctp-blue)', bg: 'var(--bg-primary)', border: 'var(--ctp-blue)' },
                    orange: { header: 'var(--ctp-peach)', bg: 'var(--bg-primary)', border: 'var(--ctp-peach)' },
                    green: { header: 'var(--ctp-green)', bg: 'var(--bg-primary)', border: 'var(--ctp-green)' },
                    purple: { header: 'var(--ctp-mauve)', bg: 'var(--bg-primary)', border: 'var(--ctp-mauve)' },
                    red: { header: 'var(--ctp-red)', bg: 'var(--bg-primary)', border: 'var(--ctp-red)' }
                  };
                  const c = colors[node.color];
                  const width = node.width || 220;
                  const height = node.height || (40 + node.columns.length * 24);
                  
                  return (
                    <g 
                      key={node.id}
                      className={`table-node ${selectedNode === node.id ? 'selected' : ''}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, node.id);
                      }}
                      onDoubleClick={() => handleTableDoubleClick(node.id)}
                      onMouseEnter={() => {
                        if (isConnecting && connectionStart?.table !== node.id) {
                          setHoveredTable(node.id);
                        }
                      }}
                      onMouseLeave={() => {
                        if (isConnecting) {
                          setHoveredTable(null);
                        }
                      }}
                    >
                      {/* Shadow */}
                      <rect
                        x="4"
                        y="4"
                        width={width}
                        height={height}
                        rx="6"
                        fill="rgba(0,0,0,0.3)"
                      />
                      
                      {/* Border/Background */}
                      <rect
                        x="0"
                        y="0"
                        width={width}
                        height={height}
                        rx="6"
                        fill={c.bg}
                        stroke={selectedNode === node.id ? 'var(--ctp-pink)' : c.border}
                        strokeWidth={selectedNode === node.id ? 3 : 2}
                      />
                      
                      {/* Header */}
                      <rect
                        x="0"
                        y="0"
                        width={width}
                        height="36"
                        rx="6"
                        fill={c.header}
                      />
                      <rect
                        x="0"
                        y="30"
                        width={width}
                        height="6"
                        fill={c.header}
                      />
                      
                      {/* Table Icon */}
                      <svg x="8" y="8" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="var(--ctp-crust)" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm0 0h14v3H5V7z"/>
                      </svg>
                      
                      {/* Table Name */}
                      <text
                        x="34"
                        y="24"
                        fill="var(--ctp-crust)"
                        fontWeight="bold"
                        fontSize="14"
                      >
                        {node.name}
                      </text>
                      
                      {/* Left side connection handle - for whole table */}
                      <g 
                        className="connection-handle"
                        onMouseDown={(e) => handleConnectionStart(e, node.id, node, 'left')}
                        onMouseEnter={() => !isConnecting && setHoveredTable(node.id)}
                        onMouseLeave={() => !isConnecting && setHoveredTable(null)}
                      >
                        <rect x="-12" y="36" width="16" height={height - 40} fill="transparent" style={{ cursor: 'crosshair' }}/>
                        <circle 
                          cx="-4" 
                          cy={height / 2} 
                          r={(hoveredTable === node.id || (isConnecting && connectionStart?.table !== node.id)) ? 8 : 6}
                          fill={(hoveredTable === node.id && isConnecting && connectionStart?.table !== node.id) ? 'var(--ctp-green)' : (hoveredTable === node.id ? 'var(--ctp-pink)' : c.border)}
                          stroke="var(--ctp-crust)"
                          strokeWidth="2"
                          style={{ cursor: 'crosshair', transition: 'all 0.15s' }}
                        />
                      </g>
                      
                      {/* Right side connection handle - for whole table */}
                      <g 
                        className="connection-handle"
                        onMouseDown={(e) => handleConnectionStart(e, node.id, node, 'right')}
                        onMouseEnter={() => !isConnecting && setHoveredTable(node.id)}
                        onMouseLeave={() => !isConnecting && setHoveredTable(null)}
                      >
                        <rect x={width - 4} y="36" width="16" height={height - 40} fill="transparent" style={{ cursor: 'crosshair' }}/>
                        <circle 
                          cx={width + 4} 
                          cy={height / 2} 
                          r={(hoveredTable === node.id || (isConnecting && connectionStart?.table !== node.id)) ? 8 : 6}
                          fill={(hoveredTable === node.id && isConnecting && connectionStart?.table !== node.id) ? 'var(--ctp-green)' : (hoveredTable === node.id ? 'var(--ctp-pink)' : c.border)}
                          stroke="var(--ctp-crust)"
                          strokeWidth="2"
                          style={{ cursor: 'crosshair', transition: 'all 0.15s' }}
                        />
                      </g>
                      
                      {/* Columns */}
                      {node.columns.map((col, i) => (
                        <g key={col.name} transform={`translate(0, ${40 + i * 24})`}>
                          <rect
                            x="0"
                            y="0"
                            width={width}
                            height="24"
                            fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                          />
                          
                          {/* Key Icons */}
                          {col.primaryKey && (
                            <svg x="8" y="4" width="16" height="16" viewBox="0 0 24 24">
                              <path fill="var(--ctp-yellow)" d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                            </svg>
                          )}
                          {col.foreignKey && !col.primaryKey && (
                            <svg x="8" y="4" width="16" height="16" viewBox="0 0 24 24">
                              <path fill="var(--ctp-red)" d="M17 8V7c0-2.76-2.24-5-5-5S7 4.24 7 7v1c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-5 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V7c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v1z"/>
                            </svg>
                          )}
                          
                          {/* Column Name */}
                          <text
                            x={col.primaryKey || col.foreignKey ? 28 : 12}
                            y="16"
                            fill="var(--text-primary)"
                            fontSize="12"
                          >
                            {col.name}
                          </text>
                          
                          {/* Column Type */}
                          <text
                            x={width - 12}
                            y="16"
                            fill="var(--text-muted)"
                            fontSize="11"
                            textAnchor="end"
                          >
                            {col.type}
                          </text>
                        </g>
                      ))}
                      
                      {/* Highlight when this table can be connected to */}
                      {isConnecting && connectionStart?.table !== node.id && (
                        <rect
                          x="-2"
                          y="-2"
                          width={width + 4}
                          height={height + 4}
                          rx="8"
                          fill="none"
                          stroke={hoveredTable === node.id ? 'var(--ctp-green)' : 'var(--ctp-blue)'}
                          strokeWidth="2"
                          strokeDasharray={hoveredTable === node.id ? 'none' : '5,5'}
                          pointerEvents="none"
                          onMouseEnter={() => setHoveredTable(node.id)}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
              </g>{/* End main transform group */}
            </svg>
          </div>
        </div>
        
        {/* Relation Type Selector - floating panel */}
        <div 
          className="relation-type-panel"
          style={{ 
            left: panelPosition.x, 
            top: panelPosition.y,
            cursor: isDraggingPanel ? 'grabbing' : 'default'
          }}
        >
          <div 
            className="relation-type-header"
            onMouseDown={handlePanelMouseDown}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" className="drag-handle-icon">
              <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            </svg>
            <span className="relation-type-title">Тип связи</span>
          </div>
          <button 
            className={`relation-type-btn ${selectedRelationType === '1:1' ? 'active' : ''}`}
            onClick={() => setSelectedRelationType('1:1')}
            title="Один к одному"
          >
            <svg viewBox="0 0 60 24" width="50" height="20">
              <line x1="5" y1="12" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="10" y1="6" x2="10" y2="18" stroke="currentColor" strokeWidth="2"/>
              <line x1="50" y1="6" x2="50" y2="18" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>1:1</span>
          </button>
          <button 
            className={`relation-type-btn ${selectedRelationType === '1:N' ? 'active' : ''}`}
            onClick={() => setSelectedRelationType('1:N')}
            title="Один ко многим"
          >
            <svg viewBox="0 0 60 24" width="50" height="20">
              <line x1="5" y1="12" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="10" y1="6" x2="10" y2="18" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="4" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="12" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="20" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>1:N</span>
          </button>
          <button 
            className={`relation-type-btn ${selectedRelationType === 'N:M' ? 'active' : ''}`}
            onClick={() => setSelectedRelationType('N:M')}
            title="Многие ко многим"
          >
            <svg viewBox="0 0 60 24" width="50" height="20">
              <line x1="5" y1="12" x2="55" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="4,2"/>
              <line x1="5" y1="4" x2="15" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="5" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="5" y1="20" x2="15" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="4" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="12" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="45" y1="20" x2="55" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>N:M</span>
          </button>
        </div>
        
        {/* Table Editor Modal */}
        {editingTable && (
          <div className="table-editor-overlay" onClick={() => setEditingTable(null)}>
            <div className="table-editor" onClick={e => e.stopPropagation()}>
              <div className="table-editor-header">
                <div className="table-editor-title">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="var(--ctp-blue)" d="M3 3h18v18H3V3zm2 4v12h14V7H5zm2 2h10v2H7V9zm0 4h10v2H7v-2z"/>
                  </svg>
                  <span>Редактирование таблицы: <strong>{editingTable}</strong></span>
                </div>
                <button className="close-btn" onClick={() => setEditingTable(null)}>?</button>
              </div>
              
              <div className="table-editor-tabs">
                <button 
                  className={`tab ${activeEditorTab === 'columns' ? 'active' : ''}`}
                  onClick={() => setActiveEditorTab('columns')}
                >Columns</button>
                <button 
                  className={`tab ${activeEditorTab === 'indexes' ? 'active' : ''}`}
                  onClick={() => setActiveEditorTab('indexes')}
                >Indexes</button>
                <button 
                  className={`tab ${activeEditorTab === 'foreignKeys' ? 'active' : ''}`}
                  onClick={() => setActiveEditorTab('foreignKeys')}
                >Foreign Keys</button>
                <button 
                  className={`tab ${activeEditorTab === 'triggers' ? 'active' : ''}`}
                  onClick={() => setActiveEditorTab('triggers')}
                >Triggers</button>
                <button 
                  className={`tab ${activeEditorTab === 'options' ? 'active' : ''}`}
                  onClick={() => setActiveEditorTab('options')}
                >Options</button>
              </div>
              
              <div className="table-editor-body">
                {/* Columns Tab */}
                {activeEditorTab === 'columns' && (
                  <>
                    <div className="columns-grid">
                      <div className="columns-header">
                        <span className="col-name">Column Name</span>
                        <span className="col-type">Datatype</span>
                        <span className="col-pk" title="Primary Key">PK</span>
                        <span className="col-nn" title="Not Null">NN</span>
                        <span className="col-uq" title="Unique">UQ</span>
                        <span className="col-ai" title="Auto Increment">AI</span>
                        <span className="col-default">Default/Expression</span>
                      </div>
                      
                      {editingColumns.map((col, i) => (
                        <div 
                          key={i} 
                          className={`columns-row ${selectedColumnIndex === i ? 'selected' : ''}`}
                          onClick={() => setSelectedColumnIndex(i)}
                        >
                          <input 
                            type="text" 
                            className="col-name" 
                            value={col.name}
                            onChange={(e) => {
                              const newCols = [...editingColumns];
                              newCols[i] = { ...newCols[i], name: e.target.value };
                              setEditingColumns(newCols);
                            }}
                          />
                          <select 
                            className="col-type" 
                            value={col.type}
                            onChange={(e) => {
                              const newCols = [...editingColumns];
                              newCols[i] = { ...newCols[i], type: e.target.value };
                              setEditingColumns(newCols);
                            }}
                          >
                            <optgroup label="Числовые типы">
                              {SQL_DATA_TYPES.numeric.map(t => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                            <optgroup label="Строковые типы">
                              {SQL_DATA_TYPES.string.map(t => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                            <optgroup label="Дата и время">
                              {SQL_DATA_TYPES.datetime.map(t => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                            <optgroup label="Пространственные типы">
                              {SQL_DATA_TYPES.spatial.map(t => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                          </select>
                          <input 
                            type="checkbox" 
                            className="col-pk"
                            checked={col.primaryKey || false}
                            onChange={(e) => {
                              const newCols = [...editingColumns];
                              newCols[i] = { ...newCols[i], primaryKey: e.target.checked };
                              setEditingColumns(newCols);
                            }}
                          />
                          <input 
                            type="checkbox" 
                            className="col-nn"
                            checked={!col.nullable}
                            onChange={(e) => {
                              const newCols = [...editingColumns];
                              newCols[i] = { ...newCols[i], nullable: !e.target.checked };
                              setEditingColumns(newCols);
                            }}
                          />
                          <input 
                            type="checkbox" 
                            className="col-uq"
                            checked={col.unique || false}
                            onChange={(e) => {
                              const newCols = [...editingColumns];
                              newCols[i] = { ...newCols[i], unique: e.target.checked };
                              setEditingColumns(newCols);
                            }}
                          />
                          <input type="checkbox" className="col-ai" />
                          <input type="text" className="col-default" placeholder="" />
                          <button 
                            className="col-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newCols = editingColumns.filter((_, idx) => idx !== i);
                              setEditingColumns(newCols);
                              if (selectedColumnIndex === i) setSelectedColumnIndex(null);
                            }}
                            title="Удалить колонку"
                          >?</button>
                        </div>
                      ))}
                      
                      {/* Add new column row */}
                      <div className="columns-row add-row">
                        <button 
                          className="add-column-btn"
                          onClick={() => setEditingColumns([...editingColumns, { name: '', type: 'VARCHAR(255)', nullable: true }])}
                        >
                          + Добавить колонку
                        </button>
                      </div>
                    </div>
                    
                    <div className="column-details">
                      <h4>Свойства колонки</h4>
                      {selectedColumnIndex !== null && editingColumns[selectedColumnIndex] ? (
                        <>
                          <div className="details-grid">
                            <label>Column Name:</label>
                            <input 
                              type="text" 
                              value={editingColumns[selectedColumnIndex].name}
                              onChange={(e) => {
                                const newCols = [...editingColumns];
                                newCols[selectedColumnIndex] = { ...newCols[selectedColumnIndex], name: e.target.value };
                                setEditingColumns(newCols);
                              }}
                            />
                            
                            <label>Data Type:</label>
                            <select 
                              value={editingColumns[selectedColumnIndex].type}
                              onChange={(e) => {
                                const newCols = [...editingColumns];
                                newCols[selectedColumnIndex] = { ...newCols[selectedColumnIndex], type: e.target.value };
                                setEditingColumns(newCols);
                              }}
                            >
                              <optgroup label="Числовые типы">
                                {SQL_DATA_TYPES.numeric.map(t => <option key={t} value={t}>{t}</option>)}
                              </optgroup>
                              <optgroup label="Строковые типы">
                                {SQL_DATA_TYPES.string.map(t => <option key={t} value={t}>{t}</option>)}
                              </optgroup>
                              <optgroup label="Дата и время">
                                {SQL_DATA_TYPES.datetime.map(t => <option key={t} value={t}>{t}</option>)}
                              </optgroup>
                              <optgroup label="Пространственные типы">
                                {SQL_DATA_TYPES.spatial.map(t => <option key={t} value={t}>{t}</option>)}
                              </optgroup>
                            </select>
                            
                            <label>Default:</label>
                            <input type="text" placeholder="NULL" />
                          </div>
                          
                          <div className="column-flags">
                            <label>
                              <input 
                                type="checkbox"
                                checked={editingColumns[selectedColumnIndex].primaryKey || false}
                                onChange={(e) => {
                                  const newCols = [...editingColumns];
                                  newCols[selectedColumnIndex] = { ...newCols[selectedColumnIndex], primaryKey: e.target.checked };
                                  setEditingColumns(newCols);
                                }}
                              /> Primary Key
                            </label>
                            <label>
                              <input 
                                type="checkbox"
                                checked={!editingColumns[selectedColumnIndex].nullable}
                                onChange={(e) => {
                                  const newCols = [...editingColumns];
                                  newCols[selectedColumnIndex] = { ...newCols[selectedColumnIndex], nullable: !e.target.checked };
                                  setEditingColumns(newCols);
                                }}
                              /> Not Null
                            </label>
                            <label>
                              <input 
                                type="checkbox"
                                checked={editingColumns[selectedColumnIndex].unique || false}
                                onChange={(e) => {
                                  const newCols = [...editingColumns];
                                  newCols[selectedColumnIndex] = { ...newCols[selectedColumnIndex], unique: e.target.checked };
                                  setEditingColumns(newCols);
                                }}
                              /> Unique
                            </label>
                            <label><input type="checkbox" /> Binary</label>
                            <label><input type="checkbox" /> Unsigned</label>
                            <label><input type="checkbox" /> Zero Fill</label>
                            <label><input type="checkbox" /> Auto Increment</label>
                            <label><input type="checkbox" /> Generated</label>
                          </div>
                        </>
                      ) : (
                        <p className="no-selection">Выберите колонку для редактирования</p>
                      )}
                    </div>
                  </>
                )}
                
                {/* Indexes Tab */}
                {activeEditorTab === 'indexes' && (
                  <div className="tab-content indexes-tab">
                    <div className="empty-tab-message">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                        <path fill="var(--text-muted)" d="M3 4h18v2H3V4zm0 7h12v2H3v-2zm0 7h18v2H3v-2z"/>
                      </svg>
                      <h4>Индексы таблицы</h4>
                      <p>Здесь можно управлять индексами для ускорения запросов</p>
                      <button className="add-index-btn">+ Добавить индекс</button>
                    </div>
                  </div>
                )}
                
                {/* Foreign Keys Tab */}
                {activeEditorTab === 'foreignKeys' && (
                  <div className="tab-content foreignkeys-tab">
                    <div className="empty-tab-message">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                        <path fill="var(--text-muted)" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
                      </svg>
                      <h4>Внешние ключи</h4>
                      <p>Управление связями между таблицами</p>
                      <button className="add-fk-btn">+ Добавить внешний ключ</button>
                    </div>
                  </div>
                )}
                
                {/* Triggers Tab */}
                {activeEditorTab === 'triggers' && (
                  <div className="tab-content triggers-tab">
                    <div className="empty-tab-message">
                      <svg viewBox="0 0 24 24" width="48" height="48">
                        <path fill="var(--text-muted)" d="M13 3v6h8l-8 12v-6H5l8-12z"/>
                      </svg>
                      <h4>Триггеры</h4>
                      <p>Автоматические действия при изменении данных</p>
                      <button className="add-trigger-btn">+ Добавить триггер</button>
                    </div>
                  </div>
                )}
                
                {/* Options Tab */}
                {activeEditorTab === 'options' && (
                  <div className="tab-content options-tab">
                    <div className="options-grid">
                      <div className="option-group">
                        <h5>Engine</h5>
                        <select defaultValue="InnoDB">
                          <option>InnoDB</option>
                          <option>MyISAM</option>
                          <option>MEMORY</option>
                          <option>CSV</option>
                          <option>ARCHIVE</option>
                        </select>
                      </div>
                      <div className="option-group">
                        <h5>Charset</h5>
                        <select defaultValue="utf8mb4">
                          <option>utf8mb4</option>
                          <option>utf8</option>
                          <option>latin1</option>
                          <option>ascii</option>
                        </select>
                      </div>
                      <div className="option-group">
                        <h5>Collation</h5>
                        <select defaultValue="utf8mb4_unicode_ci">
                          <option>utf8mb4_unicode_ci</option>
                          <option>utf8mb4_general_ci</option>
                          <option>utf8_general_ci</option>
                        </select>
                      </div>
                      <div className="option-group">
                        <h5>Comment</h5>
                        <textarea placeholder="Комментарий к таблице..."></textarea>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="table-editor-footer">
                <button className="btn-cancel" onClick={() => setEditingTable(null)}>Отмена</button>
                <button className="btn-apply" onClick={() => setEditingTable(null)}>Применить</button>
              </div>
            </div>
          </div>
        )}

        {/* Relation Creator Modal */}
        {showRelationCreator && (
          <div className="relation-creator-overlay" onClick={() => setShowRelationCreator(false)}>
            <div className="relation-creator" onClick={e => e.stopPropagation()}>
              <h3>Создать связь</h3>
              
              <div className="form-group">
                <label>Исходная таблица</label>
                <select 
                  value={newRelation.sourceTable}
                  onChange={e => setNewRelation(prev => ({ ...prev, sourceTable: e.target.value, sourceColumn: '' }))}
                >
                  <option value="">Выберите таблицу</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              
              {newRelation.sourceTable && (
                <div className="form-group">
                  <label>Колонка</label>
                  <select 
                    value={newRelation.sourceColumn}
                    onChange={e => setNewRelation(prev => ({ ...prev, sourceColumn: e.target.value }))}
                  >
                    <option value="">Выберите колонку</option>
                    {nodes.find(n => n.id === newRelation.sourceTable)?.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Тип связи</label>
                <div className="relation-type-buttons">
                  {(['1:1', '1:N', 'N:M'] as const).map(type => (
                    <button
                      key={type}
                      className={newRelation.type === type ? 'active' : ''}
                      onClick={() => setNewRelation(prev => ({ ...prev, type }))}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>Целевая таблица</label>
                <select 
                  value={newRelation.targetTable}
                  onChange={e => setNewRelation(prev => ({ ...prev, targetTable: e.target.value, targetColumn: '' }))}
                >
                  <option value="">Выберите таблицу</option>
                  {nodes.filter(n => n.id !== newRelation.sourceTable).map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              
              {newRelation.targetTable && (
                <div className="form-group">
                  <label>Колонка</label>
                  <select 
                    value={newRelation.targetColumn}
                    onChange={e => setNewRelation(prev => ({ ...prev, targetColumn: e.target.value }))}
                  >
                    <option value="">Выберите колонку</option>
                    {nodes.find(n => n.id === newRelation.targetTable)?.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setShowRelationCreator(false)}>
                  Отмена
                </button>
                <button 
                  className="btn-create"
                  disabled={!newRelation.sourceTable || !newRelation.sourceColumn || !newRelation.targetTable || !newRelation.targetColumn}
                  onClick={() => {
                    if (onCreateRelation) {
                      onCreateRelation(newRelation);
                    }
                    setShowRelationCreator(false);
                    setNewRelation({
                      sourceTable: '',
                      sourceColumn: '',
                      targetTable: '',
                      targetColumn: '',
                      type: '1:N'
                    });
                  }}
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .er-diagram-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .er-diagram-container {
          width: 95vw;
          height: 90vh;
          background: var(--bg-primary);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        /* Header */
        .er-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }

        .er-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .er-header-left h2 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
        }

        .table-count {
          background: var(--bg-tertiary);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .er-header-center {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-tertiary);
          padding: 4px 8px;
          border-radius: 8px;
        }

        .zoom-controls button {
          background: transparent;
          border: none;
          color: var(--text-primary);
          padding: 4px 8px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zoom-controls button:hover {
          background: var(--ctp-surface1);
        }

        .zoom-level {
          color: var(--text-secondary);
          font-size: 13px;
          min-width: 50px;
          text-align: center;
        }

        .er-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .er-btn {
          background: var(--bg-tertiary);
          border: none;
          color: var(--text-primary);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .er-btn:hover {
          background: var(--ctp-surface1);
        }
        
        .er-btn.primary {
          background: var(--accent);
          color: var(--bg-primary);
        }
        
        .er-btn.primary:hover {
          background: var(--ctp-lavender);
        }

        .er-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .er-close-btn:hover {
          background: var(--ctp-red);
          color: var(--bg-primary);
        }

        /* Content */
        .er-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        /* Sidebar */
        .er-sidebar {
          width: 240px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .sidebar-section {
          padding: 16px;
          border-bottom: 1px solid var(--border);
        }

        .sidebar-section h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .er-minimap {
          width: 100%;
          border-radius: 6px;
          border: 1px solid var(--border);
        }

        .table-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .table-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .table-item:hover {
          background: var(--bg-tertiary);
        }

        .table-item.selected {
          background: var(--ctp-surface1);
        }

        .color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .color-dot.blue { background: var(--ctp-blue); }
        .color-dot.orange { background: var(--ctp-peach); }
        .color-dot.green { background: var(--ctp-green); }
        .color-dot.purple { background: var(--ctp-mauve); }
        .color-dot.red { background: var(--ctp-red); }

        .table-name {
          flex: 1;
          color: var(--text-primary);
          font-size: 13px;
        }

        .column-count {
          color: var(--text-muted);
          font-size: 12px;
        }

        .relation-types {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .relation-type {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .rel-icon {
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: 4px;
          font-family: monospace;
          color: var(--accent);
        }

        /* Canvas */
        .er-canvas {
          flex: 1;
          overflow: hidden;
          cursor: grab;
          background: var(--ctp-crust);
        }

        .er-canvas:active {
          cursor: grabbing;
        }

        .er-canvas svg {
          display: block;
        }

        .table-node {
          cursor: move;
        }

        .table-node.selected rect:first-of-type {
          filter: drop-shadow(0 0 10px rgba(245, 194, 231, 0.5));
        }

        .relation-line path {
          transition: stroke 0.2s, stroke-width 0.2s;
        }

        /* Relation Creator Modal */
        .relation-creator-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .relation-creator {
          background: var(--bg-primary);
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          border: 1px solid var(--border);
        }

        .relation-creator h3 {
          margin: 0 0 20px 0;
          color: var(--text-primary);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .form-group select {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .form-group select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .relation-type-buttons {
          display: flex;
          gap: 8px;
        }

        .relation-type-buttons button {
          flex: 1;
          padding: 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          cursor: pointer;
          font-family: monospace;
          font-size: 14px;
        }

        .relation-type-buttons button:hover {
          background: var(--ctp-surface1);
        }

        .relation-type-buttons button.active {
          background: var(--accent);
          color: var(--bg-primary);
          border-color: var(--accent);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-cancel {
          padding: 10px 20px;
          background: var(--bg-tertiary);
          border: none;
          border-radius: 6px;
          color: var(--text-primary);
          cursor: pointer;
        }

        .btn-cancel:hover {
          background: var(--ctp-surface1);
        }

        .btn-create {
          padding: 10px 20px;
          background: var(--accent);
          border: none;
          border-radius: 6px;
          color: var(--bg-primary);
          cursor: pointer;
          font-weight: 500;
        }

        .btn-create:hover:not(:disabled) {
          background: var(--ctp-lavender);
        }

        .btn-create:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Table Editor Modal */
        .table-editor-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }
        
        .table-editor {
          width: 95%;
          max-width: 1100px;
          max-height: 85vh;
          background: var(--bg-primary);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        
        .table-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        
        .table-editor-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-primary);
          font-size: 14px;
        }
        
        .table-editor-title strong {
          color: var(--accent);
        }
        
        .table-editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .columns-grid {
          flex: 1;
          overflow: auto;
          background: var(--ctp-crust);
        }
        
        .columns-header {
          display: grid;
          grid-template-columns: 180px 120px 40px 40px 40px 40px 1fr;
          gap: 2px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        
        .columns-header span {
          padding: 4px 6px;
        }
        
        .columns-row {
          display: grid;
          grid-template-columns: 180px 120px 40px 40px 40px 40px 1fr;
          gap: 2px;
          padding: 4px 12px;
          border-bottom: 1px solid var(--border);
        }
        
        .columns-row:hover {
          background: rgba(137, 180, 250, 0.1);
        }
        
        .columns-row input[type="text"] {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          padding: 4px 8px;
          color: var(--text-primary);
          font-size: 12px;
          border-radius: 4px;
        }
        
        .columns-row input[type="text"]:focus {
          border-color: var(--accent);
          outline: none;
        }
        
        .columns-row input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin: auto;
          accent-color: var(--accent);
        }
        
        .columns-row.add-row {
          padding: 12px;
        }
        
        .add-column-btn {
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border: 1px dashed var(--ctp-surface1);
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .add-column-btn:hover {
          background: var(--ctp-surface1);
          border-color: var(--accent);
          color: var(--text-primary);
        }
        
        .column-details {
          width: 300px;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border);
          padding: 16px;
          overflow-y: auto;
        }
        
        .column-details h4 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px 12px;
          margin-bottom: 20px;
        }
        
        .details-grid label {
          color: var(--text-secondary);
          font-size: 12px;
          align-self: center;
        }
        
        .details-grid input,
        .details-grid select {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          padding: 6px 10px;
          color: var(--text-primary);
          font-size: 12px;
          border-radius: 4px;
        }
        
        .storage-options {
          margin-bottom: 16px;
        }
        
        .storage-options h5 {
          margin: 0 0 8px 0;
          color: var(--text-secondary);
          font-size: 11px;
        }
        
        .storage-options label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-right: 16px;
          color: var(--text-primary);
          font-size: 12px;
        }
        
        .column-flags {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        
        .column-flags label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-primary);
          font-size: 11px;
        }
        
        .columns-row.selected {
          background: var(--bg-tertiary) !important;
        }
        
        .columns-row .col-delete {
          width: 24px;
          height: 24px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 16px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.15s;
        }
        
        .columns-row:hover .col-delete {
          opacity: 1;
        }
        
        .columns-row .col-delete:hover {
          background: var(--ctp-red);
          color: var(--bg-primary);
        }
        
        .no-selection {
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
          padding: 40px 20px;
        }
        
        /* Tab content styles */
        .tab-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }
        
        .empty-tab-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          text-align: center;
          gap: 12px;
        }
        
        .empty-tab-message h4 {
          margin: 0;
          color: var(--text-secondary);
          font-size: 16px;
        }
        
        .empty-tab-message p {
          margin: 0;
          font-size: 13px;
          max-width: 300px;
        }
        
        .empty-tab-message button {
          margin-top: 12px;
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--ctp-surface1);
          color: var(--text-primary);
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        
        .empty-tab-message button:hover {
          background: var(--ctp-surface1);
          border-color: var(--accent);
        }
        
        .options-tab {
          padding: 20px;
        }
        
        .options-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        
        .option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .option-group h5 {
          margin: 0;
          color: var(--text-secondary);
          font-size: 12px;
        }
        
        .option-group select,
        .option-group textarea {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 13px;
          border-radius: 6px;
        }
        
        .option-group textarea {
          min-height: 80px;
          resize: vertical;
        }
        
        .columns-grid .col-type {
          min-width: 140px;
        }
        
        .columns-grid select.col-type {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          padding: 4px 8px;
          color: var(--text-primary);
          font-size: 11px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .columns-grid select.col-type:focus {
          border-color: var(--accent);
          outline: none;
        }
        
        .columns-grid select.col-type optgroup {
          background: var(--bg-primary);
          color: var(--accent);
          font-weight: 600;
        }
        
        .columns-grid select.col-type option {
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 4px 8px;
        }
        
        .table-editor-tabs {
          display: flex;
          gap: 0;
          padding: 0 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        
        .table-editor-tabs .tab {
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        
        .table-editor-tabs .tab:hover {
          color: var(--text-secondary);
        }
        
        .table-editor-tabs .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
          background: var(--bg-primary);
        }
        
        .table-editor-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
        }
        
        .btn-apply {
          padding: 8px 20px;
          background: var(--accent);
          border: none;
          border-radius: 6px;
          color: var(--bg-primary);
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
        }
        
        .btn-apply:hover {
          background: var(--ctp-lavender);
        }
        
        /* Connection handles */
        .connection-handle circle {
          transition: all 0.15s ease;
        }
        
        .connection-handle:hover circle {
          fill: var(--ctp-pink) !important;
        }
        
        /* Relation Type Selector Panel */
        .relation-type-panel {
          position: absolute;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          user-select: none;
        }
        
        .relation-type-header {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: grab;
          padding: 4px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 4px;
        }
        
        .relation-type-header:active {
          cursor: grabbing;
        }
        
        .drag-handle-icon {
          color: var(--text-muted);
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        .relation-type-header:hover .drag-handle-icon {
          opacity: 1;
        }
        
        .relation-type-title {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .relation-type-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 2px solid transparent;
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .relation-type-btn:hover {
          background: var(--ctp-surface1);
          color: var(--text-primary);
        }
        
        .relation-type-btn.active {
          background: var(--ctp-surface1);
          border-color: var(--accent);
          color: var(--text-primary);
        }
        
        .relation-type-btn svg {
          flex-shrink: 0;
        }
        
        .relation-type-btn span {
          font-family: monospace;
          font-weight: 600;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};
