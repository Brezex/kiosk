import { useState, useEffect } from 'react';
import { proxyApi } from '../api/client';

interface MatrixCell {
  hostId: string;
  hostName: string;
  itemId: string;
  itemName: string;
}

interface MatrixColumn {
  id: string;
  name: string;
}

interface MatrixRow {
  id: string;
  name: string;
  cells: MatrixCell[];
}

interface Props {
  config: any;
  serverId?: number;
  onSave: (config: any) => void;
  onClose: () => void;
}

export default function MatrixEditor({ config, serverId, onSave, onClose }: Props) {
  const [rows, setRows] = useState<MatrixRow[]>(config.rows || [
    { id: '', name: 'Строка 1', cells: [{ hostId: '', hostName: '', itemId: '', itemName: '' }] },
  ]);
  
  const [columns, setColumns] = useState<MatrixColumn[]>(config.columns || [
    { id: 'col1', name: 'Столбец 1' },
  ]);

  const [hosts, setHosts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [showHostSelector, setShowHostSelector] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);

  useEffect(() => {
    if (serverId) {
      proxyApi.hosts(serverId).then((res) => setHosts(res.data)).catch(() => {});
    }
  }, [serverId]);

  useEffect(() => {
    if (selectedCell && serverId) {
      const cell = rows[selectedCell.row].cells[selectedCell.col];
      if (cell.hostId) {
        proxyApi.items(serverId, cell.hostId).then((res) => setItems(res.data)).catch(() => {});
      }
    }
  }, [selectedCell, rows, serverId]);

  const addRow = () => {
    const newRow: MatrixRow = {
      id: `row_${Date.now()}`,
      name: `Строка ${rows.length + 1}`,
      cells: columns.map(() => ({ hostId: '', hostName: '', itemId: '', itemName: '' })),
    };
    setRows([...rows, newRow]);
  };

  const addColumn = () => {
    const newCol: MatrixColumn = {
      id: `col_${Date.now()}`,
      name: `Столбец ${columns.length + 1}`,
    };
    setColumns([...columns, newCol]);
    setRows(rows.map(row => ({
      ...row,
      cells: [...row.cells, { hostId: '', hostName: '', itemId: '', itemName: '' }]
    })));
  };

  const updateRowName = (rowIndex: number, name: string) => {
    const newRows = [...rows];
    newRows[rowIndex].name = name;
    setRows(newRows);
  };

  const updateColumnName = (colIndex: number, name: string) => {
    const newCols = [...columns];
    newCols[colIndex].name = name;
    setColumns(newCols);
  };

  const openHostSelector = (rowIndex: number, colIndex: number) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
    setShowHostSelector(true);
  };

  const selectHost = (host: any) => {
    if (selectedCell) {
      const newRows = [...rows];
      newRows[selectedCell.row].cells[selectedCell.col] = {
        ...newRows[selectedCell.row].cells[selectedCell.col],
        hostId: host.hostid,
        hostName: host.name,
        itemId: '',
        itemName: '',
      };
      setRows(newRows);
      setShowHostSelector(false);
      setTimeout(() => setShowItemSelector(true), 100);
    }
  };

  const openItemSelector = (rowIndex: number, colIndex: number) => {
    const cell = rows[rowIndex].cells[colIndex];
    if (!cell.hostId) {
      alert('Сначала выберите хост!');
      return;
    }
    setSelectedCell({ row: rowIndex, col: colIndex });
    setShowItemSelector(true);
  };

  const selectItem = (item: any) => {
    if (selectedCell) {
      const newRows = [...rows];
      newRows[selectedCell.row].cells[selectedCell.col] = {
        ...newRows[selectedCell.row].cells[selectedCell.col],
        itemId: item.itemid,
        itemName: item.name,
      };
      setRows(newRows);
      setShowItemSelector(false);
      setSelectedCell(null);
    }
  };

  const saveMatrix = () => {
    onSave({
      rows: rows.map(row => ({
        id: row.id,
        name: row.name,
        cells: row.cells,
      })),
      columns: columns.map(col => ({
        id: col.id,
        name: col.name,
      })),
      thresholds: config.thresholds || { warn: 0.5, crit: 0 },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-6xl">
        <h3 className="text-3xl font-bold text-white mb-6">Редактор матрицы</h3>

        <div className="flex gap-3 mb-6">
          <button
            onClick={addRow}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-base transition"
          >
            ➕ Добавить строку
          </button>
          <button
            onClick={addColumn}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-base transition"
          >
            ➕ Добавить столбец
          </button>
        </div>

        <div className="overflow-auto mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 bg-slate-700 text-white text-left font-semibold border border-slate-600">
                  Узел сети
                </th>
                {columns.map((col, colIndex) => (
                  <th key={col.id} className="p-3 bg-slate-700 text-white font-semibold border border-slate-600 min-w-[200px]">
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => updateColumnName(colIndex, e.target.value)}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                      placeholder="Название столбца"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id}>
                  <td className="p-3 bg-slate-750 border border-slate-600">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRowName(rowIndex, e.target.value)}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm font-medium"
                      placeholder="Название строки"
                    />
                  </td>
                  {row.cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="p-2 border border-slate-600">
                      <div className="space-y-1">
                        <button
                          onClick={() => openHostSelector(rowIndex, cellIndex)}
                          className={`w-full px-2 py-1.5 rounded text-xs font-medium transition ${
                            cell.hostName
                              ? 'bg-blue-900/50 text-blue-400 border border-blue-600 hover:bg-blue-900'
                              : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                          }`}
                        >
                          🖥️ {cell.hostName || 'Выбрать хост'}
                        </button>
                        
                        <button
                          onClick={() => openItemSelector(rowIndex, cellIndex)}
                          disabled={!cell.hostId}
                          className={`w-full px-2 py-1.5 rounded text-xs font-medium transition ${
                            !cell.hostId
                              ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed opacity-50'
                              : cell.itemName
                              ? 'bg-green-900/50 text-green-400 border border-green-600 hover:bg-green-900'
                              : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                          }`}
                        >
                          📊 {cell.itemName || (cell.hostId ? 'Выбрать метрику' : '—')}
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveMatrix}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl transition"
          >
             Сохранить матрицу
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xl transition"
          >
            Отмена
          </button>
        </div>
      </div>

           {showHostSelector && (
        <HostSelectorModal
          hosts={hosts}
          onSelect={selectHost}
          onClose={() => setShowHostSelector(false)}
        />
      )}

      {showItemSelector && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          onClick={() => setShowItemSelector(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-2xl font-bold text-white mb-4">Выберите метрику</h4>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.itemid}
                  onClick={() => selectItem(item)}
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-left transition"
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-slate-400">Ключ: {item.key_}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  // Компонент модального окна выбора хоста с поиском
function HostSelectorModal({ hosts, onSelect, onClose }: { 
  hosts: any[]; 
  onSelect: (host: any) => void; 
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  
  const filteredHosts = hosts.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-2xl font-bold text-white mb-4">Выберите узел сети</h4>
        
        {/* Поле поиска */}
        <input
          type="text"
          placeholder="🔍 Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg mb-4 focus:outline-none focus:border-blue-500"
          autoFocus
        />
        
        <div className="space-y-2 overflow-y-auto flex-1">
          {filteredHosts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Ничего не найдено
            </div>
          ) : (
            filteredHosts.map((host) => (
              <button
                key={host.hostid}
                onClick={() => onSelect(host)}
                className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-left transition"
              >
                {host.name}
              </button>
            ))
          )}
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
}