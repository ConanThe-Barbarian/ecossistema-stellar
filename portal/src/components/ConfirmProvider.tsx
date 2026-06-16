import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ConfirmOpts {
  titulo?: string;
  mensagem: string;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
}
interface PromptOpts {
  titulo?: string;
  mensagem: string;
  placeholder?: string;
  tipo?: string;
  confirmar?: string;
}

interface ConfirmApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
}

const Ctx = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirm precisa do ConfirmProvider');
  return c;
}

interface Estado {
  modo: 'confirm' | 'prompt';
  opts: ConfirmOpts & PromptOpts;
  resolve: (v: any) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [valor, setValor] = useState('');

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setEstado({ modo: 'confirm', opts, resolve })),
    [],
  );
  const prompt = useCallback((opts: PromptOpts) => {
    setValor('');
    return new Promise<string | null>((resolve) => setEstado({ modo: 'prompt', opts, resolve }));
  }, []);

  function fechar(resultado: boolean | string | null) {
    estado?.resolve(resultado);
    setEstado(null);
  }

  const cancelarValor = () => (estado?.modo === 'confirm' ? false : null);

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {estado && (
        <div className="modal-overlay" onMouseDown={() => fechar(cancelarValor())}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            {estado.opts.titulo && <h3 className="modal-title">{estado.opts.titulo}</h3>}
            <p className="modal-msg">{estado.opts.mensagem}</p>
            {estado.modo === 'prompt' && (
              <input
                autoFocus
                type={estado.opts.tipo ?? 'text'}
                placeholder={estado.opts.placeholder}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fechar(valor);
                  if (e.key === 'Escape') fechar(null);
                }}
              />
            )}
            <div className="modal-acoes">
              <button className="btn btn-ghost" onClick={() => fechar(cancelarValor())}>
                {estado.opts.cancelar ?? 'Cancelar'}
              </button>
              <button
                className={`btn${estado.opts.perigo ? ' btn-perigo' : ''}`}
                onClick={() => fechar(estado.modo === 'confirm' ? true : valor)}
              >
                {estado.opts.confirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
