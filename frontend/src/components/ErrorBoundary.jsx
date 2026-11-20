import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 w-full">
          <div
            className="max-w-xl w-full p-6 rounded-2xl border shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface-elevated, #101F3B)',
              borderColor: 'var(--border-medium, #2d466f)',
              color: 'var(--text-primary, #ffffff)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-300 font-mono">
                  Error de Renderizado en la Vista
                </h3>
                <p className="text-xs text-slate-400">
                  {this.props.componentName || 'La sección'} experimentó un problema imprevisto al mostrarse.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div
                className="p-3 rounded-lg text-xs font-mono overflow-x-auto border text-red-200"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Vista</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-600 hover:border-slate-400 text-slate-200 text-xs font-bold transition"
                style={{ backgroundColor: 'var(--bg-surface, #0B1528)' }}
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Recargar Aplicación</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

