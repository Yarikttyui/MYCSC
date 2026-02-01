import React, { useState, useEffect } from 'react';

type RelationType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
type ReferentialAction = 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';

interface Relation {
  id: string;
  name: string;
  type: RelationType;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

interface Table {
  name: string;
  columns: Array<{ name: string; type: string; primaryKey: boolean }>;
}

interface RelationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Table[];
  relations: Relation[];
  onCreateRelation: (relation: Omit<Relation, 'id'>) => void;
  onDeleteRelation: (id: string) => void;
}

export const RelationsModal: React.FC<RelationsModalProps> = ({
  isOpen,
  onClose,
  tables,
  relations,
  onCreateRelation,
  onDeleteRelation
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newRelation, setNewRelation] = useState<Omit<Relation, 'id'>>({
    name: '',
    type: 'ONE_TO_MANY',
    sourceTable: '',
    sourceColumn: '',
    targetTable: '',
    targetColumn: '',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  const [selectedSourceTable, setSelectedSourceTable] = useState<Table | null>(null);
  const [selectedTargetTable, setSelectedTargetTable] = useState<Table | null>(null);

  useEffect(() => {
    if (newRelation.sourceTable) {
      setSelectedSourceTable(tables.find(t => t.name === newRelation.sourceTable) || null);
    } else {
      setSelectedSourceTable(null);
    }
  }, [newRelation.sourceTable, tables]);

  useEffect(() => {
    if (newRelation.targetTable) {
      setSelectedTargetTable(tables.find(t => t.name === newRelation.targetTable) || null);
    } else {
      setSelectedTargetTable(null);
    }
  }, [newRelation.targetTable, tables]);

  const handleCreate = () => {
    if (
      newRelation.name.trim() &&
      newRelation.sourceTable &&
      newRelation.sourceColumn &&
      newRelation.targetTable &&
      newRelation.targetColumn
    ) {
      onCreateRelation(newRelation);
      setNewRelation({
        name: '',
        type: 'ONE_TO_MANY',
        sourceTable: '',
        sourceColumn: '',
        targetTable: '',
        targetColumn: '',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      });
      setIsCreating(false);
    }
  };

  const getRelationIcon = (type: RelationType) => {
    switch (type) {
      case 'ONE_TO_ONE':
        return '1:1';
      case 'ONE_TO_MANY':
        return '1:N';
      case 'MANY_TO_MANY':
        return 'N:M';
    }
  };

  const getRelationColor = (type: RelationType) => {
    switch (type) {
      case 'ONE_TO_ONE':
        return 'var(--ctp-blue)';
      case 'ONE_TO_MANY':
        return 'var(--ctp-green)';
      case 'MANY_TO_MANY':
        return 'var(--ctp-yellow)';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="relations-modal-overlay" onClick={onClose}>
      <div className="relations-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Связи между таблицами</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Diagram View */}
          <div className="relations-diagram">
            <h4>Диаграмма связей</h4>
            <div className="diagram-canvas">
              {relations.length === 0 ? (
                <div className="no-relations">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" opacity="0.3" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <p>Нет связей</p>
                </div>
              ) : (
                <div className="diagram-relations">
                  {relations.map(rel => (
                    <div key={rel.id} className="relation-line">
                      <div className="relation-table source">
                        <span className="table-name">{rel.sourceTable}</span>
                        <span className="column-name">{rel.sourceColumn}</span>
                      </div>
                      <div className="relation-connector">
                        <div 
                          className="relation-type-badge"
                          style={{ background: getRelationColor(rel.type) }}
                        >
                          {getRelationIcon(rel.type)}
                        </div>
                        <div className="connector-line"></div>
                      </div>
                      <div className="relation-table target">
                        <span className="table-name">{rel.targetTable}</span>
                        <span className="column-name">{rel.targetColumn}</span>
                      </div>
                      <button 
                        className="delete-relation-btn"
                        onClick={() => onDeleteRelation(rel.id)}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Relations List */}
          <div className="relations-list">
            <div className="list-header">
              <h4>Список связей</h4>
              <button 
                className="add-relation-btn"
                onClick={() => setIsCreating(true)}
              >
                + Добавить связь
              </button>
            </div>

            {isCreating && (
              <div className="create-relation-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Имя связи</label>
                    <input
                      type="text"
                      value={newRelation.name}
                      onChange={(e) => setNewRelation({ ...newRelation, name: e.target.value })}
                      placeholder="fk_user_orders"
                    />
                  </div>
                  <div className="form-group">
                    <label>Тип связи</label>
                    <select
                      value={newRelation.type}
                      onChange={(e) => setNewRelation({ ...newRelation, type: e.target.value as RelationType })}
                    >
                      <option value="ONE_TO_ONE">Один к одному (1:1)</option>
                      <option value="ONE_TO_MANY">Один ко многим (1:N)</option>
                      <option value="MANY_TO_MANY">Многие ко многим (N:M)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Исходная таблица</label>
                    <select
                      value={newRelation.sourceTable}
                      onChange={(e) => setNewRelation({ 
                        ...newRelation, 
                        sourceTable: e.target.value,
                        sourceColumn: ''
                      })}
                    >
                      <option value="">Выберите таблицу</option>
                      {tables.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Колонка</label>
                    <select
                      value={newRelation.sourceColumn}
                      onChange={(e) => setNewRelation({ ...newRelation, sourceColumn: e.target.value })}
                      disabled={!selectedSourceTable}
                    >
                      <option value="">Выберите колонку</option>
                      {selectedSourceTable?.columns.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name} {c.primaryKey ? '(PK)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relation-arrow">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                  </svg>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Целевая таблица</label>
                    <select
                      value={newRelation.targetTable}
                      onChange={(e) => setNewRelation({ 
                        ...newRelation, 
                        targetTable: e.target.value,
                        targetColumn: ''
                      })}
                    >
                      <option value="">Выберите таблицу</option>
                      {tables.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Колонка</label>
                    <select
                      value={newRelation.targetColumn}
                      onChange={(e) => setNewRelation({ ...newRelation, targetColumn: e.target.value })}
                      disabled={!selectedTargetTable}
                    >
                      <option value="">Выберите колонку</option>
                      {selectedTargetTable?.columns.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name} {c.primaryKey ? '(PK)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ON DELETE</label>
                    <select
                      value={newRelation.onDelete}
                      onChange={(e) => setNewRelation({ ...newRelation, onDelete: e.target.value as ReferentialAction })}
                    >
                      <option value="RESTRICT">RESTRICT</option>
                      <option value="CASCADE">CASCADE</option>
                      <option value="SET_NULL">SET NULL</option>
                      <option value="SET_DEFAULT">SET DEFAULT</option>
                      <option value="NO_ACTION">NO ACTION</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ON UPDATE</label>
                    <select
                      value={newRelation.onUpdate}
                      onChange={(e) => setNewRelation({ ...newRelation, onUpdate: e.target.value as ReferentialAction })}
                    >
                      <option value="CASCADE">CASCADE</option>
                      <option value="RESTRICT">RESTRICT</option>
                      <option value="SET_NULL">SET NULL</option>
                      <option value="SET_DEFAULT">SET DEFAULT</option>
                      <option value="NO_ACTION">NO ACTION</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button className="cancel-btn" onClick={() => setIsCreating(false)}>
                    Отмена
                  </button>
                  <button className="create-btn" onClick={handleCreate}>
                    Создать связь
                  </button>
                </div>
              </div>
            )}

            <div className="relations-items">
              {relations.map(rel => (
                <div key={rel.id} className="relation-item">
                  <div 
                    className="relation-badge"
                    style={{ background: getRelationColor(rel.type) }}
                  >
                    {getRelationIcon(rel.type)}
                  </div>
                  <div className="relation-info">
                    <span className="relation-name">{rel.name}</span>
                    <span className="relation-path">
                      {rel.sourceTable}.{rel.sourceColumn} → {rel.targetTable}.{rel.targetColumn}
                    </span>
                  </div>
                  <div className="relation-actions-info">
                    <span className="action-badge delete">DEL: {rel.onDelete}</span>
                    <span className="action-badge update">UPD: {rel.onUpdate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .relations-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .relations-modal {
          width: 90%;
          max-width: 900px;
          max-height: 85vh;
          background: var(--bg-primary);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 28px;
          cursor: pointer;
          line-height: 1;
        }

        .close-btn:hover {
          color: var(--text-primary);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .relations-diagram {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
        }

        .relations-diagram h4 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 14px;
        }

        .diagram-canvas {
          min-height: 200px;
          background: var(--bg-primary);
          border-radius: 8px;
          padding: 16px;
        }

        .no-relations {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
        }

        .no-relations p {
          margin: 12px 0 0 0;
        }

        .diagram-relations {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .relation-line {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--bg-tertiary);
          border-radius: 6px;
        }

        .relation-table {
          display: flex;
          flex-direction: column;
          padding: 8px 12px;
          background: var(--ctp-surface1);
          border-radius: 4px;
        }

        .relation-table .table-name {
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
        }

        .relation-table .column-name {
          color: var(--text-secondary);
          font-size: 11px;
        }

        .relation-connector {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .connector-line {
          flex: 1;
          height: 2px;
          background: linear-gradient(90deg, var(--ctp-blue), var(--ctp-mauve));
        }

        .relation-type-badge {
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--bg-primary);
          font-size: 11px;
          font-weight: 700;
        }

        .delete-relation-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-muted);
          cursor: pointer;
        }

        .delete-relation-btn:hover {
          color: var(--ctp-red);
          background: rgba(243, 139, 168, 0.1);
        }

        .relations-list {
          display: flex;
          flex-direction: column;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .list-header h4 {
          margin: 0;
          color: var(--text-primary);
          font-size: 14px;
        }

        .add-relation-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          border: none;
          border-radius: 6px;
          color: var(--bg-primary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .create-relation-form {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .form-group input,
        .form-group select {
          padding: 10px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--ctp-surface1);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--accent);
        }

        .relation-arrow {
          display: flex;
          justify-content: center;
          color: var(--accent);
          margin: 8px 0;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .cancel-btn,
        .create-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }

        .cancel-btn {
          background: var(--ctp-surface1);
          color: var(--text-primary);
        }

        .create-btn {
          background: linear-gradient(135deg, var(--ctp-blue), var(--ctp-mauve));
          color: var(--bg-primary);
          font-weight: 500;
        }

        .relations-items {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .relation-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }

        .relation-badge {
          padding: 6px 10px;
          border-radius: 4px;
          color: var(--bg-primary);
          font-size: 12px;
          font-weight: 700;
        }

        .relation-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .relation-name {
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
        }

        .relation-path {
          color: var(--text-muted);
          font-size: 12px;
          font-family: monospace;
        }

        .relation-actions-info {
          display: flex;
          gap: 6px;
        }

        .action-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }

        .action-badge.delete {
          background: rgba(243, 139, 168, 0.2);
          color: var(--ctp-red);
        }

        .action-badge.update {
          background: rgba(166, 227, 161, 0.2);
          color: var(--ctp-green);
        }
      `}</style>
    </div>
  );
};
