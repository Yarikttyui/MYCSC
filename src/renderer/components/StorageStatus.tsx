import React, { useEffect, useState } from 'react';
import { getStorageInfo, migrateToIndexedDB } from '../storage-wrapper';

interface StorageInfo {
  backend: string;
  databases: number;
  tables: number;
  estimatedSize: string;
  quota?: string;
  usage?: string;
}

export const StorageStatus: React.FC = () => {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadInfo = async () => {
    try {
      const storageInfo = await getStorageInfo();
      setInfo(storageInfo);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    setMessage(null);
    try {
      const result = await migrateToIndexedDB();
      setMessage(result.message);
      if (result.success) {
        await loadInfo();
      }
    } catch (e: any) {
      setMessage(`Migration failed: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '10px', fontSize: '12px', color: '#888' }}>
        Loading storage info...
      </div>
    );
  }

  if (!info) {
    return null;
  }

  const isIndexedDB = info.backend === 'indexedDB';

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'var(--bg-secondary, #1e1e1e)',
      borderRadius: '6px',
      fontSize: '13px',
      marginBottom: '10px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isIndexedDB ? '#4CAF50' : '#FFC107'
        }} />
        <span style={{ fontWeight: 600 }}>
          Storage: {isIndexedDB ? 'IndexedDB' : 'localStorage'}
        </span>
        {isIndexedDB && (
          <span style={{
            fontSize: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            Unlimited
          </span>
        )}
      </div>

      <div style={{ color: '#888', marginBottom: '4px' }}>
        📊 {info.databases} databases, {info.tables} tables
      </div>

      <div style={{ color: '#888', marginBottom: '8px' }}>
        💾 {info.usage || info.estimatedSize}
        {info.quota && ` / ${info.quota}`}
      </div>

      {!isIndexedDB && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ 
            color: '#FFA726', 
            fontSize: '11px',
            marginBottom: '6px'
          }}>
            ⚠️ localStorage limited to ~5-10MB. Migrate to IndexedDB for unlimited storage.
          </div>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: migrating ? 'wait' : 'pointer',
              opacity: migrating ? 0.7 : 1
            }}
          >
            {migrating ? 'Migrating...' : 'Migrate to IndexedDB'}
          </button>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: '8px',
          padding: '6px',
          backgroundColor: message.includes('Error') || message.includes('failed')
            ? 'rgba(244, 67, 54, 0.2)'
            : 'rgba(76, 175, 80, 0.2)',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {message}
        </div>
      )}

      {isIndexedDB && (
        <div style={{ 
          marginTop: '8px',
          fontSize: '11px',
          color: '#4CAF50'
        }}>
          ✓ Chunked storage for large tables
          <br />
          ✓ Write-ahead logging (WAL)
          <br />
          ✓ Automatic persistence
        </div>
      )}
    </div>
  );
};

export default StorageStatus;
