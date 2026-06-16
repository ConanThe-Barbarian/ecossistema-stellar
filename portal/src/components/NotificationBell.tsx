import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api';

interface Notif {
  tipo: string;
  nivel: 'info' | 'warn' | 'danger';
  titulo: string;
  descricao: string;
  link: string;
  data: string;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<Notif[]>([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function carregar() {
    api
      .get('/portal/notificacoes')
      .then(({ data }) => setItens(data.itens ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function irPara(link: string) {
    setAberto(false);
    navigate(link);
  }

  return (
    <div className="notif" ref={ref}>
      <button className="notif-btn" onClick={() => setAberto((v) => !v)} aria-label="Notificações">
        <Bell size={18} />
        {itens.length > 0 && <span className="notif-badge">{itens.length}</span>}
      </button>
      {aberto && (
        <div className="notif-drop">
          <div className="notif-head">Notificações</div>
          {itens.length === 0 ? (
            <div className="notif-empty">Tudo em dia ✦</div>
          ) : (
            itens.map((n, i) => (
              <button key={i} className="notif-item" onClick={() => irPara(n.link)}>
                <span className={`notif-dot ${n.nivel}`} />
                <span className="notif-text">
                  <strong>{n.titulo}</strong>
                  <span className="notif-desc">{n.descricao}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
