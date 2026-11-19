import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Layers,
  CreditCard,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import RecordDetailModal from './RecordDetailModal';

export default function HistoryView({ reconnectTrigger = 0 }) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stats
  const [stats, setStats] = useState(null);

  // Detail Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [page, selectedDocType, startDate, endDate, reconnectTrigger]);

  const fetchRecords = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getRecords({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search: searchTerm,
        doc_type: selectedDocType,
        start_date: startDate,
        end_date: endDate,
      });
      setRecords(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching records:', err);
      setErrorMsg('No se pudo conectar con la base de datos local.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDocType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleDelete = async (id, docNumber) => {
    if (!window.confirm(`¿Está seguro de eliminar el registro del documento ${docNumber}?`)) {
      return;
    }
    try {
      await api.deleteRecord(id);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert('Error al eliminar registro: ' + (err.response?.data?.detail || err.message));
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-4 animate-fade-in text-white">
      
      {/* Top Stats Cards - Chavín Navy, Steel Blue, Turquoise & Petroleum Green */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="card-enterprise bg-[#0B1528] p-4 rounded-xl border border-[#1E3557] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">Total Escaneados</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5 block font-mono">
              {stats?.total_records ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#101F3B] text-cyan-400 border border-[#274468]">
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="card-enterprise bg-[#0B1528] p-4 rounded-xl border border-[#1E3557] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">DNI Peruanos</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-300 mt-0.5 block font-mono">
              {stats?.dni_count ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#101F3B] text-cyan-400 border border-[#274468]">
            <CreditCard className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="card-enterprise bg-[#0B1528] p-4 rounded-xl border border-[#1E3557] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">Carnet Extranjería</span>
            <span className="text-xl sm:text-2xl font-black text-teal-300 mt-0.5 block font-mono">
              {stats?.ce_count ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0A3D44] text-teal-300 border border-teal-500/40">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        <div className="card-enterprise bg-[#0B1528] p-4 rounded-xl border border-[#1E3557] shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-300 block">Escaneados Hoy</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5 block font-mono">
              {stats?.scanned_today ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0A3D44] text-emerald-300 border border-emerald-500/40">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

      </div>

      {/* Error Message Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-200 text-xs sm:text-sm animate-fade-in shadow-md">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => {
              fetchRecords();
              fetchStats();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1.5 transition shrink-0 btn-precision"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar Carga</span>
          </button>
        </div>
      )}

      {/* Search, Filters & Excel Download Bar - High Contrast Chavín */}
      <div className="card-enterprise bg-[#0B1528] p-4 sm:p-5 rounded-2xl border border-[#1E3557] shadow-xl space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por DNI, Nombres, Apellidos o Dirección..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#060D1A] border border-[#1D334E] text-white text-xs placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition btn-precision border border-cyan-300/40"
            >
              Buscar
            </button>
          </form>

          {/* Direct Excel and Backup Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <a
              href={api.getDownloadFullBackupZipUrl()}
              download
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#101F3B] hover:bg-[#162A4F] text-cyan-300 border border-[#274468] text-xs font-bold rounded-xl shadow-xs transition btn-precision"
              title="Descargar copia de seguridad completa con SQLite y Excel"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Respaldo ZIP</span>
            </a>

            <a
              href={api.getExportExcelUrl({
                search: searchTerm,
                doc_type: selectedDocType,
                start_date: startDate,
                end_date: endDate,
              })}
              download
              className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition btn-precision border border-teal-300/40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Descargar Excel</span>
            </a>
          </div>

        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-[#1E3557]">
          
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Tipo de Documento</label>
            <select
              value={selectedDocType}
              onChange={(e) => {
                setSelectedDocType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#060D1A] border border-[#1D334E] text-white text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="">Todos los Tipos</option>
              <option value="DNI">DNI Peruano</option>
              <option value="Carnet de Extranjería">Carnet de Extranjería</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Fecha Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#060D1A] border border-[#1D334E] text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#060D1A] border border-[#1D334E] text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2 px-3 text-xs font-bold text-slate-300 hover:text-white bg-[#101F3B] hover:bg-[#162A4F] rounded-xl border border-[#274468] transition btn-precision"
            >
              Limpiar Filtros
            </button>
          </div>

        </div>

      </div>

      {/* Records Table - Fullscreen Widescreen Responsive Layout */}
      <div className="card-enterprise bg-[#0B1528] rounded-2xl border border-[#1E3557] shadow-xl overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E3557] bg-[#060D1A] text-[11px] font-black uppercase tracking-wider text-slate-300">
                <th className="py-3.5 px-4">Fecha Escaneo</th>
                <th className="py-3.5 px-4">Tipo</th>
                <th className="py-3.5 px-4">N° Documento</th>
                <th className="py-3.5 px-4">Apellidos y Nombres</th>
                <th className="py-3.5 px-4">Sexo</th>
                <th className="py-3.5 px-4">F. Nacimiento</th>
                <th className="py-3.5 px-4">Dirección</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3557] text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                    <span>Cargando registros...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <CreditCard className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="font-bold text-white">No se encontraron registros</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Escanee un nuevo documento para agregarlo al sistema.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isDni = r.doc_type === 'DNI';
                  return (
                    <tr key={r.id} className="hover:bg-[#101F3B]/60 transition">
                      <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                        {r.scan_date ? new Date(r.scan_date).toLocaleString('es-PE') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${
                          isDni
                            ? 'bg-[#101F3B] text-cyan-300 border-cyan-400/40'
                            : 'bg-[#0A3D44] text-teal-200 border-teal-500/40'
                        }`}>
                          {r.doc_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        {r.doc_number}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {r.paternal_surname} {r.maternal_surname} {r.first_names}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {r.sex || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                        {r.birth_date || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-[240px] truncate" title={r.address}>
                        {r.address || '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedRecord(r)}
                            className="p-1.5 rounded-lg bg-[#101F3B] hover:bg-[#162A4F] text-cyan-300 border border-[#274468] transition btn-precision"
                            title="Ver detalles e imágenes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.doc_number)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 transition btn-precision"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-6 py-4 bg-[#060D1A] border-t border-[#1E3557] flex items-center justify-between text-xs text-slate-400">
          <div>
            Mostrando <strong className="text-white">{records.length}</strong> de <strong className="text-white">{total}</strong> registros
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-[#101F3B] border border-[#274468] hover:bg-[#162A4F] text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition btn-precision"
            >
              Anterior
            </button>
            <span className="font-mono font-bold text-cyan-300 px-2">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-[#101F3B] border border-[#274468] hover:bg-[#162A4F] text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition btn-precision"
            >
              Siguiente
            </button>
          </div>
        </div>

      </div>

      {/* Record Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

    </div>
  );
}
