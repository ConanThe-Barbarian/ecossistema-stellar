import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Resumo {
  empresa: { id: string; nome: string };
  plano: { nome: string; valor_mensalidade: number; dia_vencimento: number } | null;
  situacao_pagamento: 'EM_DIA' | 'EM_DEBITO';
  proxima_fatura: {
    valor: number;
    data_vencimento: string;
    url_fatura: string | null;
  } | null;
  empresa_responsavel_id: string | null;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Inicio() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<Resumo>('/portal/resumo')
      .then(({ data }) => {
        setResumo(data);
        // Guarda para a tela de novo chamado usar
        if (data.empresa_responsavel_id) {
          localStorage.setItem('stellar_empresa_responsavel', data.empresa_responsavel_id);
        }
      })
      .catch(() => setErro('Não foi possível carregar o resumo.'));
  }, []);

  if (erro) return <div className="erro">{erro}</div>;
  if (!resumo) return <p className="muted">Carregando…</p>;

  return (
    <>
      <h1>Olá, {resumo.empresa.nome} 👋</h1>

      <div className="grid grid-3">
        <div className="card">
          <h3>Plano Atual</h3>
          <div className="big">{resumo.plano?.nome ?? '—'}</div>
          {resumo.plano && (
            <p className="muted">
              {brl(resumo.plano.valor_mensalidade)}/mês · vence dia {resumo.plano.dia_vencimento}
            </p>
          )}
        </div>

        <div className="card">
          <h3>Situação</h3>
          <div className="big">
            {resumo.situacao_pagamento === 'EM_DIA' ? (
              <span className="badge ok">EM DIA ✓</span>
            ) : (
              <span className="badge danger">EM DÉBITO</span>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Próxima Fatura</h3>
          {resumo.proxima_fatura ? (
            <>
              <div className="big">{brl(resumo.proxima_fatura.valor)}</div>
              <p className="muted">
                vence em{' '}
                {new Date(resumo.proxima_fatura.data_vencimento).toLocaleDateString('pt-BR')}
              </p>
              {resumo.proxima_fatura.url_fatura && (
                <a
                  className="btn mt"
                  href={resumo.proxima_fatura.url_fatura}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pagar agora
                </a>
              )}
            </>
          ) : (
            <p className="muted">Nenhuma fatura pendente 🎉</p>
          )}
        </div>
      </div>

      <h1 className="mt" style={{ fontSize: '1.2rem', marginTop: '2.5rem' }}>
        Ações rápidas
      </h1>
      <div className="grid grid-3">
        <div className="card">
          <h3>🎓 Treinamento</h3>
          <p className="muted">Gratuito para clientes com ferramentas ativas.</p>
          <button
            className="btn btn-ghost mt"
            onClick={() => navigate('/chamados/novo?tipo=TREINAMENTO')}
          >
            Solicitar
          </button>
        </div>
        <div className="card">
          <h3>🚗 Visita Presencial</h3>
          <p className="muted">Atendimento no local (serviço com custo adicional).</p>
          <button
            className="btn btn-ghost mt"
            onClick={() => navigate('/chamados/novo?tipo=VISITA_PRESENCIAL')}
          >
            Solicitar
          </button>
        </div>
        <div className="card">
          <h3>🎫 Suporte</h3>
          <p className="muted">Abra um chamado para nossa equipe técnica.</p>
          <Link className="btn btn-ghost mt" to="/chamados/novo">
            Abrir chamado
          </Link>
        </div>
      </div>
    </>
  );
}
