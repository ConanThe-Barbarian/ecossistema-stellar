import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensagemDeErro } from '../api';

const TIPOS: Record<string, { categoria: string; titulo: string }> = {
  TREINAMENTO: { categoria: 'TREINAMENTO', titulo: 'Solicitação de Treinamento' },
  VISITA_PRESENCIAL: { categoria: 'SERVICO_FISICO', titulo: 'Solicitação de Visita Presencial' },
};

export default function NovoChamado() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tipo = params.get('tipo');
  const preset = tipo ? TIPOS[tipo] : null;

  const [destino, setDestino] = useState<'STELLAR' | 'INTERNO'>('STELLAR');
  const [titulo, setTitulo] = useState(preset?.titulo ?? '');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(preset?.categoria ?? 'SUPORTE');
  const [prioridade, setPrioridade] = useState('MEDIA');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    const empresaResponsavelId =
      destino === 'STELLAR'
        ? localStorage.getItem('stellar_empresa_responsavel')
        : localStorage.getItem('stellar_empresa_id');

    if (!empresaResponsavelId) {
      setErro('Visite a página Início uma vez antes de abrir chamados (carrega os dados da empresa).');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/chamados', {
        titulo,
        descricao,
        categoria,
        prioridade,
        empresa_responsavel_id: empresaResponsavelId,
      });
      navigate('/chamados');
    } catch (err: any) {
      setErro(mensagemDeErro(err, 'Erro ao abrir o chamado'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Novo Chamado</h1>
      <form className="card" style={{ maxWidth: 640 }} onSubmit={enviar}>
        <label htmlFor="destino">Destino do chamado</label>
        <select id="destino" value={destino} onChange={(e) => setDestino(e.target.value as 'STELLAR' | 'INTERNO')}>
          <option value="STELLAR">Para a Stellar (nossa equipe de suporte)</option>
          <option value="INTERNO">Interno (resolver dentro da sua empresa)</option>
        </select>

        <label htmlFor="titulo">Título</label>
        <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />

        <label htmlFor="descricao">Descreva o que está acontecendo</label>
        <textarea
          id="descricao"
          rows={5}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />

        <label htmlFor="categoria">Categoria</label>
        <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="SUPORTE">Suporte</option>
          <option value="SISTEMA">Sistema</option>
          <option value="REDE">Rede</option>
          <option value="TREINAMENTO">Treinamento (gratuito)</option>
          <option value="SERVICO_FISICO">Visita presencial (custo adicional)</option>
        </select>

        <label htmlFor="prioridade">Prioridade</label>
        <select id="prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>

        {destino === 'STELLAR' && categoria === 'SERVICO_FISICO' && (
          <p className="muted mt">
            Atenção: visitas presenciais geram faturamento adicional conforme seu contrato.
          </p>
        )}

        {erro && <div className="erro">{erro}</div>}

        <button className="btn mt" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Abrir chamado'}
        </button>
      </form>
    </>
  );
}
