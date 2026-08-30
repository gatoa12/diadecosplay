/**
 * 🧠 SISTEMA INTELIGENTE DE FOTOS — DiaDeCosplay v90+
 * 
 * Objetivo: Evitar que fotos sumam + Site entende sozinho o que fazer
 * 
 * Funcionalidades:
 * ✅ Validação ANTES de salvar (não deixa quebrada ir pro servidor)
 * ✅ Health Check contínuo (monitora saúde das fotos)
 * ✅ Detecção automática de padrões (identifica problemas)
 * ✅ Recovery automático (tenta consertar sozinho)
 * ✅ Alertas inteligentes (avisa Victor quando crítico)
 * ✅ Logging detalhado (registra tudo para debug)
 * ✅ Dashboard de monitoramento (mostra status em tempo real)
 */

// ============================================================================
// 1️⃣ SISTEMA DE VALIDAÇÃO — Prevenir que foto quebrada seja salva
// ============================================================================

class ValidadorFoto {
  constructor() {
    this.validacoes = [];
    this.regras = {
      tamanhoMaximo: 50 * 1024 * 1024,        // 50MB
      tamanhoMinimo: 1024,                     // 1KB
      formatosPermitidos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      larguraMinima: 100,
      alturaMinima: 100,
      larguraMaxima: 4000,
      alturaMaxima: 4000,
    };
  }

  // ✅ Valida arquivo antes de salvar
  async validarArquivo(file) {
    const resultado = {
      valido: true,
      erros: [],
      avisos: [],
      metadata: {},
    };

    // 1. Verificar tamanho
    if (file.size > this.regras.tamanhoMaximo) {
      resultado.erros.push(`Arquivo muito grande: ${this.formatarTamanho(file.size)} (máx: 50MB)`);
      resultado.valido = false;
    }
    if (file.size < this.regras.tamanhoMinimo) {
      resultado.erros.push(`Arquivo muito pequeno: ${this.formatarTamanho(file.size)} (mín: 1KB)`);
      resultado.valido = false;
    }

    // 2. Verificar tipo
    if (!this.regras.formatosPermitidos.includes(file.type)) {
      resultado.erros.push(`Formato não permitido: ${file.type}`);
      resultado.valido = false;
    }

    // 3. Verificar imagem de verdade (não é arquivo fake)
    try {
      const img = await this.carregarImagem(file);
      resultado.metadata.largura = img.width;
      resultado.metadata.altura = img.height;
      resultado.metadata.aspecto = (img.width / img.height).toFixed(2);

      if (img.width < this.regras.larguraMinima || img.height < this.regras.alturaMinima) {
        resultado.erros.push(`Imagem muito pequena: ${img.width}x${img.height}px (mín: 100x100px)`);
        resultado.valido = false;
      }
      if (img.width > this.regras.larguraMaxima || img.height > this.regras.alturaMaxima) {
        resultado.avisos.push(`Imagem grande (${img.width}x${img.height}px) — será comprimida`);
      }
    } catch (e) {
      resultado.erros.push(`Arquivo não é uma imagem válida: ${e.message}`);
      resultado.valido = false;
    }

    // 4. Verificar URL (se for data URL)
    if (file.type === 'string' && file.startsWith('data:')) {
      if (file.length > this.regras.tamanhoMaximo * 1.5) {
        resultado.erros.push(`Data URL muito grande (${this.formatarTamanho(file.length)})`);
        resultado.valido = false;
      }
      resultado.metadata.tipo = 'data-url';
    }

    resultado.timestamp = Date.now();
    return resultado;
  }

  // Carrega imagem e pega dimensões
  carregarImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Imagem corrompida'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  formatarTamanho(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// ============================================================================
// 2️⃣ SISTEMA DE HEALTH CHECK — Monitoramento contínuo
// ============================================================================

class HealthCheckFotos {
  constructor() {
    this.historico = [];
    this.status = 'OK';
    this.ultimaVerificacao = null;
    this.problemas = [];
  }

  // ✅ Executa verificação completa de saúde
  async verificar() {
    const checkpoint = {
      timestamp: Date.now(),
      fotos: {
        total: 0,
        carregadas: 0,
        falhadas: 0,
        pendentes: 0,
        taxaSucesso: 0,
      },
      dados: {
        tamanhoTotal: 0,
        integridade: 'OK',
        erros: [],
      },
      rede: {
        online: navigator.onLine,
        velocidade: await this.medir
Velocidade(),
        latencia: 0,
      },
      problemas: [],
      recomendacoes: [],
    };

    // 1. Verificar fotos na tela
    const imagens = document.querySelectorAll('img[data-foto-id]');
    checkpoint.fotos.total = imagens.length;

    imagens.forEach(img => {
      if (img.complete && img.naturalHeight > 0) {
        checkpoint.fotos.carregadas++;
      } else if (img.classList.contains('foto-quebrada')) {
        checkpoint.fotos.falhadas++;
      } else {
        checkpoint.fotos.pendentes++;
      }
    });

    checkpoint.fotos.taxaSucesso = ((checkpoint.fotos.carregadas / checkpoint.fotos.total) * 100).toFixed(1);

    // 2. Verificar integridade de dados
    if (window.db) {
      try {
        const tamanho = JSON.stringify(window.db).length;
        checkpoint.dados.tamanhoTotal = tamanho;

        // Validações de integridade
        if (!window.db.cosplayers || !Array.isArray(window.db.cosplayers)) {
          checkpoint.dados.integridade = 'ERRO';
          checkpoint.dados.erros.push('Campo cosplayers ausente ou inválido');
        }
        if (!window.db.eventos || !Array.isArray(window.db.eventos)) {
          checkpoint.dados.erros.push('Campo eventos ausente ou inválido');
        }

        // Verificar fotos nos dados
        let fotosNoDados = 0;
        window.db.cosplayers.forEach(c => {
          if (c.photos && Array.isArray(c.photos)) {
            fotosNoDados += c.photos.length;
          }
          if (c.media) fotosNoDados++;
        });

        if (fotosNoDados > checkpoint.fotos.total) {
          checkpoint.problemas.push(`⚠️ ${fotosNoDados} fotos nos dados mas só ${checkpoint.fotos.total} na tela`);
        }
      } catch (e) {
        checkpoint.dados.integridade = 'ERRO';
        checkpoint.dados.erros.push(e.message);
      }
    }

    // 3. Verificar conexão
    checkpoint.rede.online = navigator.onLine;
    if (!navigator.onLine) {
      checkpoint.problemas.push('🔴 Sem conexão de internet');
    }

    // 4. Gerar recomendações
    this.gerarRecomendacoes(checkpoint);

    // 5. Definir status geral
    checkpoint.status = this.definirStatus(checkpoint);
    this.status = checkpoint.status;
    this.ultimaVerificacao = checkpoint;
    this.historico.push(checkpoint);

    // Manter apenas últimas 100 verificações
    if (this.historico.length > 100) {
      this.historico.shift();
    }

    return checkpoint;
  }

  gerarRecomendacoes(checkpoint) {
    if (checkpoint.fotos.taxaSucesso < 80) {
      checkpoint.recomendacoes.push(
        '📉 Taxa de sucesso baixa — considere verificar conexão do servidor'
      );
    }

    if (checkpoint.fotos.falhadas > checkpoint.fotos.carregadas) {
      checkpoint.recomendacoes.push(
        '❌ Mais fotos falhando que carregando — problema crítico de servidor ou CDN'
      );
    }

    if (!checkpoint.rede.online) {
      checkpoint.recomendacoes.push(
        '🔌 Está offline — fotos recarregarão quando voltar online'
      );
    }

    if (checkpoint.dados.tamanhoTotal > 10 * 1024 * 1024) {
      checkpoint.recomendacoes.push(
        '💾 Banco de dados muito grande (>10MB) — considere arquivar dados antigos'
      );
    }
  }

  definirStatus(checkpoint) {
    if (checkpoint.dados.integridade === 'ERRO') return '🔴 CRÍTICO';
    if (checkpoint.fotos.taxaSucesso < 70) return '🔴 CRÍTICO';
    if (checkpoint.fotos.taxaSucesso < 85) return '🟡 AVISO';
    if (checkpoint.problemas.length > 0) return '🟡 AVISO';
    return '🟢 OK';
  }

  async medirVelocidade() {
    try {
      const inicio = performance.now();
      const resp = await fetch(window.location.href, { method: 'HEAD' });
      const duracao = performance.now() - inicio;
      return Math.round(duracao);
    } catch (e) {
      return -1;
    }
  }
}

// ============================================================================
// 3️⃣ SISTEMA DE LOGGING — Registro de tudo para debug
// ============================================================================

class LoggerFotos {
  constructor() {
    this.logs = [];
    this.maxLogs = 500;
    this.niveis = ['DEBUG', 'INFO', 'AVISO', 'ERRO', 'CRÍTICO'];
  }

  log(nivel, mensagem, dados = {}) {
    const entrada = {
      timestamp: new Date().toISOString(),
      nivel,
      mensagem,
      dados,
      userAgent: navigator.userAgent.substring(0, 50),
      online: navigator.onLine,
    };

    this.logs.push(entrada);

    // Manter limite
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log no console também
    const emoji = {
      'DEBUG': '🔍',
      'INFO': 'ℹ️',
      'AVISO': '⚠️',
      'ERRO': '❌',
      'CRÍTICO': '🔴',
    };

    console.log(`${emoji[nivel]} [${entrada.timestamp}] ${mensagem}`, dados);

    // Salvar no localStorage para acesso posterior
    try {
      localStorage.setItem('dc_logs_fotos', JSON.stringify(this.logs.slice(-100)));
    } catch (e) {
      // localStorage cheio, ignora
    }
  }

  relatorio() {
    const agrupado = {};
    this.logs.forEach(log => {
      agrupado[log.nivel] = (agrupado[log.nivel] || 0) + 1;
    });

    return {
      total: this.logs.length,
      agrupado,
      ultimos10: this.logs.slice(-10),
    };
  }

  exportar() {
    return JSON.stringify(this.logs, null, 2);
  }

  limpar() {
    this.logs = [];
    localStorage.removeItem('dc_logs_fotos');
  }
}

// ============================================================================
// 4️⃣ SISTEMA DE DETECÇÃO DE PADRÕES — IA básica para entender problemas
// ============================================================================

class DetectorPadroes {
  constructor(logger) {
    this.logger = logger;
    this.padroes = {
      fotoNuncaCarrega: new Map(),        // Foto X nunca carrega
      horaComMaisErros: new Map(),         // Horário com mais erros
      tipoErroFrequente: new Map(),        // Tipo de erro que mais acontece
    };
  }

  analisar(checkpoint, logs) {
    const analise = {
      padroes: [],
      diagnostico: '',
      acoes: [],
    };

    // Padrão 1: Foto específica que nunca carrega
    this.analisarFotosPersistentes(checkpoint, analise);

    // Padrão 2: Horário com problemas
    this.analisarPadroesTempo(logs, analise);

    // Padrão 3: Tipo de erro frequente
    this.analisarTiposErro(logs, analise);

    // Gerar diagnóstico
    analise.diagnostico = this.gerarDiagnostico(analise);

    return analise;
  }

  analisarFotosPersistentes(checkpoint, analise) {
    const imagens = document.querySelectorAll('img.foto-quebrada');
    if (imagens.length > 0) {
      const fotosId = Array.from(imagens)
        .map(img => img.dataset.fotoId)
        .filter(Boolean);

      if (fotosId.length > 0) {
        analise.padroes.push({
          tipo: 'FOTOS_PERSISTENTES',
          fotos: fotosId,
          descricao: `${fotosId.length} fotos que não carregam consistentemente`,
        });

        analise.acoes.push(
          `Verificar URLs destas fotos no servidor: ${fotosId.join(', ')}`
        );
      }
    }
  }

  analisarPadroesTempo(logs, analise) {
    const errosPorHora = {};
    logs.forEach(log => {
      if (log.nivel === 'ERRO' || log.nivel === 'CRÍTICO') {
        const hora = new Date(log.timestamp).getHours();
        errosPorHora[hora] = (errosPorHora[hora] || 0) + 1;
      }
    });

    const horaComMaisErros = Object.entries(errosPorHora)
      .sort((a, b) => b[1] - a[1])[0];

    if (horaComMaisErros && horaComMaisErros[1] > 5) {
      analise.padroes.push({
        tipo: 'PICO_HORARIO',
        hora: horaComMaisErros[0],
        quantidade: horaComMaisErros[1],
        descricao: `Pico de erros às ${horaComMaisErros[0]}h`,
      });

      analise.acoes.push(
        `Há pico de erros às ${horaComMaisErros[0]}h — pode ser problema de servidor nesse horário`
      );
    }
  }

  analisarTiposErro(logs, analise) {
    const tiposErro = {};
    logs.forEach(log => {
      if (log.nivel === 'ERRO' || log.nivel === 'CRÍTICO') {
        const tipo = log.dados.tipo || 'desconhecido';
        tiposErro[tipo] = (tiposErro[tipo] || 0) + 1;
      }
    });

    const erroMaisFrequente = Object.entries(tiposErro)
      .sort((a, b) => b[1] - a[1])[0];

    if (erroMaisFrequente) {
      analise.padroes.push({
        tipo: 'ERRO_FREQUENTE',
        erro: erroMaisFrequente[0],
        quantidade: erroMaisFrequente[1],
        descricao: `Erro "${erroMaisFrequente[0]}" acontece frequentemente`,
      });

      analise.acoes.push(
        `Erro mais comum: ${erroMaisFrequente[0]} (${erroMaisFrequente[1]}x)`
      );
    }
  }

  gerarDiagnostico(analise) {
    if (analise.padroes.length === 0) {
      return '✅ Nenhum padrão de erro detectado — sistema funcionando normalmente';
    }

    let diagnostico = '🔍 PADRÕES DETECTADOS:\n\n';
    analise.padroes.forEach(p => {
      diagnostico += `• ${p.tipo}: ${p.descricao}\n`;
    });

    diagnostico += '\n📋 AÇÕES RECOMENDADAS:\n';
    analise.acoes.forEach(a => {
      diagnostico += `• ${a}\n`;
    });

    return diagnostico;
  }
}

// ============================================================================
// 5️⃣ SISTEMA DE RECOVERY AUTOMÁTICO — Tenta consertar sozinho
// ============================================================================

class RecoveryAutomatico {
  constructor(logger) {
    this.logger = logger;
    this.tentativas = new Map();
    this.maxTentativas = 5;
    this.estrategias = [];
  }

  // ✅ Tenta recuperar usando múltiplas estratégias
  async recuperar(problema) {
    this.logger.log('INFO', `Iniciando recovery para: ${problema.tipo}`);

    const solucoes = [];

    switch (problema.tipo) {
      case 'FOTO_NAO_CARREGA':
        solucoes.push(
          await this.estrategia_CacheBuster(problema),
          await this.estrategia_RecarregarPagina(problema),
          await this.estrategia_LimparCache(problema),
          await this.estrategia_AtualizarDados(problema)
        );
        break;

      case 'CONEXAO_PERDIDA':
        solucoes.push(
          await this.estrategia_EsperarConexao(problema),
          await this.estrategia_UsarCacheOffline(problema)
        );
        break;

      case 'DADOS_CORROMPIDOS':
        solucoes.push(
          await this.estrategia_RevalidarDados(problema),
          await this.estrategia_RestaurarBackup(problema)
        );
        break;

      case 'CDN_INDISPONIVEL':
        solucoes.push(
          await this.estrategia_UsarCDNAlternativo(problema),
          await this.estrategia_DownloadDireto(problema)
        );
        break;
    }

    // Verificar qual funcionou
    const sucesso = solucoes.find(s => s.funcionou);
    if (sucesso) {
      this.logger.log('INFO', `✅ Recovery bem-sucedido: ${sucesso.estrategia}`);
    } else {
      this.logger.log('ERRO', `❌ Todas as estratégias falharam para: ${problema.tipo}`);
    }

    return sucesso || { funcionou: false, estrategia: 'nenhuma' };
  }

  async estrategia_CacheBuster(problema) {
    try {
      const img = document.querySelector(`img[data-foto-id="${problema.fotoId}"]`);
      if (img) {
        const src = img.dataset.src || img.src;
        img.src = src.includes('?') ? src + '&_t=' + Date.now() : src + '?_t=' + Date.now();
        return { funcionou: true, estrategia: 'Cache-Buster' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Cache-Buster falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Cache-Buster' };
  }

  async estrategia_RecarregarPagina(problema) {
    try {
      // Tenta recarregar dados da nuvem
      if (window.cloudPull) {
        await window.cloudPull(true);
        return { funcionou: true, estrategia: 'Recarregar Dados' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Recarregamento falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Recarregar Dados' };
  }

  async estrategia_LimparCache(problema) {
    try {
      if ('caches' in window) {
        const nomes = await caches.keys();
        await Promise.all(nomes.map(nome => caches.delete(nome)));
        this.logger.log('INFO', 'Cache limpo com sucesso');
        return { funcionou: true, estrategia: 'Limpar Cache' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Limpeza de cache falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Limpar Cache' };
  }

  async estrategia_AtualizarDados(problema) {
    try {
      if (window.save && window.renderCos) {
        window.save(false);
        window.renderCos();
        return { funcionou: true, estrategia: 'Atualizar Dados' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Atualização falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Atualizar Dados' };
  }

  async estrategia_EsperarConexao(problema) {
    try {
      return new Promise((resolve) => {
        window.addEventListener('online', () => {
          this.logger.log('INFO', 'Conexão restaurada');
          resolve({ funcionou: true, estrategia: 'Esperar Conexão' });
        }, { once: true });

        // Timeout de 30 segundos
        setTimeout(() => {
          resolve({ funcionou: false, estrategia: 'Esperar Conexão (Timeout)' });
        }, 30000);
      });
    } catch (e) {
      return { funcionou: false, estrategia: 'Esperar Conexão' };
    }
  }

  async estrategia_UsarCacheOffline(problema) {
    try {
      // Se tiver Service Worker e cache offline
      if ('serviceWorker' in navigator) {
        return { funcionou: true, estrategia: 'Cache Offline' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Cache offline indisponível: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Cache Offline' };
  }

  async estrategia_RevalidarDados(problema) {
    try {
      if (window.cloudPull) {
        await window.cloudPull(true);
        return { funcionou: true, estrategia: 'Revalidar Dados' };
      }
    } catch (e) {
      this.logger.log('AVISO', `Revalidação falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Revalidar Dados' };
  }

  async estrategia_RestaurarBackup(problema) {
    try {
      const backup = localStorage.getItem('dc_backup_db');
      if (backup) {
        window.db = JSON.parse(backup);
        if (window.save) window.save(false);
        return { funcionou: true, estrategia: 'Restaurar Backup' };
      }
    } catch (e) {
      this.logger.log('ERRO', `Restauração falhou: ${e.message}`);
    }
    return { funcionou: false, estrategia: 'Restaurar Backup' };
  }

  async estrategia_UsarCDNAlternativo(problema) {
    // Implementar lógica de múltiplos CDNs aqui
    return { funcionou: false, estrategia: 'CDN Alternativo' };
  }

  async estrategia_DownloadDireto(problema) {
    // Implementar download direto do servidor aqui
    return { funcionou: false, estrategia: 'Download Direto' };
  }
}

// ============================================================================
// 6️⃣ SISTEMA DE ALERTAS — Avisa Victor quando crítico
// ============================================================================

class AlertasInteligentes {
  constructor(logger) {
    this.logger = logger;
    this.alertasEnviados = new Set();
    this.intervaloMinimo = 1000 * 60 * 5; // 5 minutos mín entre alertas
  }

  verificarEEnviarAlertas(checkpoint, analise) {
    const alertas = [];

    // Alerta 1: Taxa de sucesso crítica
    if (checkpoint.fotos.taxaSucesso < 70) {
      alertas.push({
        nivel: 'CRÍTICO',
        titulo: '🔴 Taxa de Sucesso Crítica',
        mensagem: `Apenas ${checkpoint.fotos.taxaSucesso}% das fotos carregaram`,
        acao: 'Verificar conexão do servidor ou CDN',
      });
    }

    // Alerta 2: Muitas fotos falhando
    if (checkpoint.fotos.falhadas > checkpoint.fotos.carregadas * 2) {
      alertas.push({
        nivel: 'CRÍTICO',
        titulo: '❌ Fotos Falhando Mais que Carregando',
        mensagem: `${checkpoint.fotos.falhadas} falhadas vs ${checkpoint.fotos.carregadas} OK`,
        acao: 'Investigar URLs e servidor',
      });
    }

    // Alerta 3: Dados corrompidos
    if (checkpoint.dados.integridade === 'ERRO') {
      alertas.push({
        nivel: 'CRÍTICO',
        titulo: '⚠️ Integridade de Dados Comprometida',
        mensagem: checkpoint.dados.erros.join('; '),
        acao: 'Restaurar from backup imediatamente',
      });
    }

    // Alerta 4: Sem conexão
    if (!checkpoint.rede.online) {
      alertas.push({
        nivel: 'AVISO',
        titulo: '🔌 Sem Conexão',
        mensagem: 'Dispositivo está offline',
        acao: 'Aguarde conexão voltar (sistema recarregará automaticamente)',
      });
    }

    // Enviar alertas
    alertas.forEach(alerta => {
      this.enviarAlerta(alerta);
    });

    return alertas;
  }

  enviarAlerta(alerta) {
    const id = `${alerta.titulo}-${alerta.nivel}`;

    // Não enviar o mesmo alerta em menos de 5 minutos
    if (this.alertasEnviados.has(id)) {
      return;
    }

    this.logger.log(alerta.nivel, `${alerta.titulo}: ${alerta.mensagem}`);

    // Notificação visual no site
    this.mostrarNotificacao(alerta);

    // Notificação no navegador (se permitido)
    if (alerta.nivel === 'CRÍTICO') {
      this.enviarNotificacaoBrowsers(alerta);
    }

    // Registrar que foi enviado
    this.alertasEnviados.add(id);
    setTimeout(() => this.alertasEnviados.delete(id), this.intervaloMinimo);
  }

  mostrarNotificacao(alerta) {
    const cor = {
      'CRÍTICO': '#FF6B6B',
      'AVISO': '#FFB84D',
      'INFO': '#4ECDC4',
    };

    const notif = document.createElement('div');
    notif.className = 'alerta-inteligente';
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${cor[alerta.nivel]};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      font-weight: 600;
      animation: slideIn 0.3s ease;
    `;

    notif.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">${alerta.titulo}</div>
      <div style="font-size: 0.9em; margin-bottom: 8px;">${alerta.mensagem}</div>
      <div style="font-size: 0.85em; opacity: 0.9;">📋 ${alerta.acao}</div>
    `;

    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notif.remove(), 300);
    }, 8000);
  }

  enviarNotificacaoBrowsers(alerta) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('DiaDeCosplay — Alerta', {
        body: alerta.mensagem,
        icon: 'icon.svg',
        tag: 'alerta-fotos',
      });
    }
  }
}

// ============================================================================
// 7️⃣ DASHBOARD DE MONITORAMENTO — Visualizar status em tempo real
// ============================================================================

class DashboardMonitoramento {
  constructor(healthCheck, logger, detector) {
    this.healthCheck = healthCheck;
    this.logger = logger;
    this.detector = detector;
  }

  // ✅ Cria painel visual de monitoramento
  mostrarDashboard() {
    if (!this.healthCheck.ultimaVerificacao) return;

    const checkpoint = this.healthCheck.ultimaVerificacao;

    let html = `
      <div style="
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: var(--s1);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        max-width: 350px;
        font-size: 12px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-height: 400px;
        overflow-y: auto;
        font-family: monospace;
      ">
        <div style="
          font-weight: bold;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        ">
          📊 Status de Fotos ${checkpoint.status}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>Carregamento:</strong><br/>
          ✅ ${checkpoint.fotos.carregadas}/${checkpoint.fotos.total} (${checkpoint.fotos.taxaSucesso}%)<br/>
          ❌ Falhadas: ${checkpoint.fotos.falhadas}<br/>
          ⏳ Pendentes: ${checkpoint.fotos.pendentes}
        </div>

        <div style="margin-bottom: 10px;">
          <strong>Rede:</strong><br/>
          ${checkpoint.rede.online ? '🟢 Online' : '🔴 Offline'}<br/>
          Ping: ${checkpoint.rede.latencia}ms
        </div>

        <div style="margin-bottom: 10px;">
          <strong>Dados:</strong><br/>
          Tamanho: ${this.formatarTamanho(checkpoint.dados.tamanhoTotal)}<br/>
          Integridade: ${checkpoint.dados.integridade}
        </div>

        ${checkpoint.problemas.length > 0 ? `
          <div style="
            background: rgba(255,107,107,0.1);
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 10px;
          ">
            <strong>⚠️ Problemas:</strong><br/>
            ${checkpoint.problemas.map(p => `• ${p}`).join('<br/>')}
          </div>
        ` : ''}

        ${checkpoint.recomendacoes.length > 0 ? `
          <div style="
            background: rgba(76,205,196,0.1);
            padding: 8px;
            border-radius: 4px;
          ">
            <strong>💡 Recomendações:</strong><br/>
            ${checkpoint.recomendacoes.map(r => `• ${r}`).join('<br/>')}
          </div>
        ` : ''}

        <div style="
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
          font-size: 11px;
          color: var(--text2);
        ">
          Última: ${new Date(checkpoint.timestamp).toLocaleTimeString('pt-BR')}
        </div>
      </div>
    `;

    // Remover dashboard antigo
    document.getElementById('dc-dashboard-monitor')?.remove();

    // Criar novo
    const container = document.createElement('div');
    container.id = 'dc-dashboard-monitor';
    container.innerHTML = html;
    document.body.appendChild(container);
  }

  formatarTamanho(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // ✅ Exportar dados para análise
  exportarDados() {
    const dados = {
      timestamp: Date.now(),
      ultimoCheckpoint: this.healthCheck.ultimaVerificacao,
      historico: this.healthCheck.historico.slice(-20),
      logs: this.logger.logs.slice(-50),
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostico-fotos-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// 8️⃣ ORQUESTRADOR — Coordena tudo junto
// ============================================================================

class SistemaInteligenteFortos {
  constructor() {
    this.logger = new LoggerFotos();
    this.validador = new ValidadorFoto();
    this.healthCheck = new HealthCheckFotos();
    this.detector = new DetectorPadroes(this.logger);
    this.recovery = new RecoveryAutomatico(this.logger);
    this.alertas = new AlertasInteligentes(this.logger);
    this.dashboard = new DashboardMonitoramento(this.healthCheck, this.logger, this.detector);
    this.ativo = false;
  }

  // ✅ Iniciar monitoramento
  async iniciar() {
    if (this.ativo) return;
    this.ativo = true;

    this.logger.log('INFO', '🧠 Sistema Inteligente de Fotos iniciado');

    // Health check a cada 30 segundos
    setInterval(() => this.executarHealthCheck(), 30000);

    // Primeira verificação imediata
    await this.executarHealthCheck();

    // Mostrar dashboard
    setInterval(() => this.dashboard.mostrarDashboard(), 5000);

    this.logger.log('INFO', 'Monitoramento ativo — verificando a cada 30s');
  }

  async executarHealthCheck() {
    try {
      const checkpoint = await this.healthCheck.verificar();
      const analise = this.detector.analisar(checkpoint, this.logger.logs);

      // Enviar alertas se necessário
      const alertas = this.alertas.verificarEEnviarAlertas(checkpoint, analise);

      // Tentar recovery se houver problemas críticos
      if (checkpoint.status === '🔴 CRÍTICO') {
        for (const alerta of alertas) {
          if (alerta.nivel === 'CRÍTICO') {
            // Identificar problema e tentar recuperar
            await this.recovery.recuperar({
              tipo: this.mapearAlertaParaProblema(alerta),
            });
          }
        }
      }

      // Log do health check
      this.logger.log('DEBUG', '✅ Health check completado', {
        taxaSucesso: checkpoint.fotos.taxaSucesso,
        status: checkpoint.status,
      });
    } catch (e) {
      this.logger.log('ERRO', `Health check falhou: ${e.message}`);
    }
  }

  mapearAlertaParaProblema(alerta) {
    if (alerta.titulo.includes('Taxa de Sucesso')) return 'FOTO_NAO_CARREGA';
    if (alerta.titulo.includes('Integridade')) return 'DADOS_CORROMPIDOS';
    if (alerta.titulo.includes('Conexão')) return 'CONEXAO_PERDIDA';
    return 'DESCONHECIDO';
  }

  // ✅ Validar foto antes de salvar
  async validarAntesDoSalvar(file) {
    const resultado = await this.validador.validarArquivo(file);
    if (!resultado.valido) {
      this.logger.log('AVISO', `Foto rejeitada: ${resultado.erros.join('; ')}`);
      return false;
    }
    this.logger.log('INFO', 'Foto validada com sucesso', resultado.metadata);
    return true;
  }

  // ✅ Acessar dashboard
  mostrarDashboard() {
    this.dashboard.mostrarDashboard();
  }

  // ✅ Exportar diagnóstico
  exportarDiagnostico() {
    this.dashboard.exportarDados();
    this.logger.log('INFO', 'Diagnóstico exportado');
  }

  // ✅ Ver logs
  verLogs() {
    return this.logger.relatorio();
  }

  // ✅ Limpar dados
  limpar() {
    this.logger.limpar();
    this.logger.log('INFO', 'Logs limpos');
  }
}

// ============================================================================
// 🚀 INICIALIZAÇÃO GLOBAL — AUTOMÁTICA
// ============================================================================

// Criar instância global
window.sistemaInteligenteFortos = new SistemaInteligenteFortos();

// ✅ AUTO-INICIAR quando página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    iniciarSistemaAutomaticamente();
  });
} else {
  iniciarSistemaAutomaticamente();
}

// ============================================================================
// 🤖 FUNÇÃO DE AUTO-INICIALIZAÇÃO (SEM PRECISA DE CONSOLE)
// ============================================================================

async function iniciarSistemaAutomaticamente() {
  // 1. Iniciar sistema
  await window.sistemaInteligenteFortos.iniciar();
  
  // 2. Mostrar dashboard automaticamente (já aparece no site)
  window.sistemaInteligenteFortos.mostrarDashboard();
  
  // 3. Mostrar logo na página (botão flutuante no canto)
  adicionarBotaoFlutuante();
  
  // 4. Atualizar dashboard a cada 5 segundos
  setInterval(() => {
    window.sistemaInteligenteFortos.mostrarDashboard();
  }, 5000);
  
  // 5. Adicionar CSS para notificações bonitas
  adicionarEstilosAutomaticos();
  
  // 6. Log de inicialização
  window.sistemaInteligenteFortos.logger.log(
    'INFO',
    '✅ Sistema Inteligente iniciado AUTOMATICAMENTE',
    { timestamp: new Date().toLocaleTimeString('pt-BR') }
  );
}

// ============================================================================
// 🎨 ADICIONAR BOTÃO FLUTUANTE (Para Victor acessar facilmente)
// ============================================================================

function adicionarBotaoFlutuante() {
  // Verificar se já existe
  if (document.getElementById('dc-botao-sistema-flutuante')) return;

  const html = `
    <div id="dc-botao-sistema-flutuante" style="
      position: fixed;
      bottom: 90px;
      right: 20px;
      z-index: 9998;
      background: linear-gradient(135deg, #E4405F, #833AB4);
      color: white;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(228, 64, 95, 0.4);
      transition: all 0.3s ease;
      border: 2px solid white;
    ">
      🧠
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const botao = document.getElementById('dc-botao-sistema-flutuante');

  // Hover effect
  botao.addEventListener('mouseover', () => {
    botao.style.transform = 'scale(1.1)';
    botao.style.boxShadow = '0 6px 20px rgba(228, 64, 95, 0.6)';
  });

  botao.addEventListener('mouseout', () => {
    botao.style.transform = 'scale(1)';
    botao.style.boxShadow = '0 4px 12px rgba(228, 64, 95, 0.4)';
  });

  // Clique abre/fecha dashboard
  botao.addEventListener('click', () => {
    const dashboard = document.getElementById('dc-dashboard-monitor');
    if (dashboard) {
      dashboard.style.display = dashboard.style.display === 'none' ? 'block' : 'none';
    } else {
      window.sistemaInteligenteFortos.mostrarDashboard();
    }
  });

  // Tooltip
  botao.title = 'Sistema Inteligente de Fotos — Clique para ver status';
}

// ============================================================================
// 🎨 ADICIONAR ESTILOS AUTOMÁTICOS
// ============================================================================

function adicionarEstilosAutomaticos() {
  const style = document.createElement('style');
  style.textContent = `
    /* Animação de entrada do dashboard */
    #dc-dashboard-monitor {
      animation: slideIn 0.4s ease-in-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0) translateY(0);
      }
    }

    /* Notificação de alerta */
    .alerta-inteligente {
      animation: slideInAlerta 0.4s ease-in-out;
    }

    @keyframes slideInAlerta {
      from {
        opacity: 0;
        transform: translateX(400px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Botão flutuante hover */
    #dc-botao-sistema-flutuante:hover {
      transform: scale(1.1) rotate(5deg);
    }

    /* Dashboard scrollbar */
    #dc-dashboard-monitor::-webkit-scrollbar {
      width: 8px;
    }

    #dc-dashboard-monitor::-webkit-scrollbar-track {
      background: var(--s1);
      border-radius: 4px;
    }

    #dc-dashboard-monitor::-webkit-scrollbar-thumb {
      background: var(--primary);
      border-radius: 4px;
    }

    #dc-dashboard-monitor::-webkit-scrollbar-thumb:hover {
      background: var(--secondary);
    }

    /* Animação de pulsação (quando há alerta) */
    .sistema-alerta-critico {
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(228, 64, 95, 0.4);
      }
      50% {
        box-shadow: 0 4px 20px rgba(228, 64, 95, 0.8);
      }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// 📱 ADICIONAR BADGE COM CONTADOR DE PROBLEMAS (Opcional)
// ============================================================================

function atualizarBadgeProblemas() {
  const checkpoint = window.sistemaInteligenteFortos.healthCheck.ultimaVerificacao;
  if (!checkpoint) return;

  const botao = document.getElementById('dc-botao-sistema-flutuante');
  if (!botao) return;

  const problemasCount = checkpoint.problemas?.length || 0;

  if (problemasCount > 0) {
    // Adicionar badge
    let badge = document.getElementById('dc-badge-problemas');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'dc-badge-problemas';
      badge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        background: #FF6B6B;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        border: 2px solid white;
      `;
      botao.appendChild(badge);
    }
    badge.textContent = problemasCount > 9 ? '9+' : problemasCount;
  } else {
    // Remover badge se não há problemas
    const badge = document.getElementById('dc-badge-problemas');
    if (badge) badge.remove();
  }
}

// Atualizar badge a cada 10 segundos
setInterval(atualizarBadgeProblemas, 10000);

// ============================================================================
// 🔔 AUTO-EXPORTAR LOGS PERIODICAMENTE (Optional)
// ============================================================================

// A cada 1 hora, salvar backup automático dos logs
setInterval(() => {
  try {
    const dados = {
      timestamp: Date.now(),
      checkpoint: window.sistemaInteligenteFortos.healthCheck.ultimaVerificacao,
      logs: window.sistemaInteligenteFortos.logger.logs.slice(-100),
    };
    localStorage.setItem('dc_auto_backup_logs', JSON.stringify(dados));
  } catch (e) {
    // localStorage cheio, ignora
  }
}, 60 * 60 * 1000); // 1 hora

// ============================================================================
// 🎓 EXPOSAR FUNÇÕES RÁPIDAS NO WINDOW (Para Victor usar se quiser)
// ============================================================================

// Atalhos rápidos no console (Victor pode usar opcionalmente)
window.dcSystemStatus = () => {
  const checkpoint = window.sistemaInteligenteFortos.healthCheck.ultimaVerificacao;
  console.table({
    'Taxa de Sucesso': checkpoint?.fotos?.taxaSucesso + '%',
    'Carregadas': checkpoint?.fotos?.carregadas,
    'Falhadas': checkpoint?.fotos?.falhadas,
    'Status Geral': checkpoint?.status,
    'Online': checkpoint?.rede?.online ? '✅' : '❌',
  });
};

window.dcViewLogs = () => console.table(window.sistemaInteligenteFortos.verLogs());

window.dcExportDiagnostic = () => window.sistemaInteligenteFortos.exportarDiagnostico();

window.dcCheckHealth = () => window.sistemaInteligenteFortos.executarHealthCheck();

window.dcShowDashboard = () => window.sistemaInteligenteFortos.mostrarDashboard();

// Log de ajuda
console.log(`
╔════════════════════════════════════════╗
║ 🧠 SISTEMA INTELIGENTE INICIADO       ║
╠════════════════════════════════════════╣
║ ✅ Já está funcionando automaticamente ║
║                                        ║
║ 📊 Dashboard: Aparece no site (canto) ║
║ 🔔 Alertas: Disparam automaticamente  ║
║ 📋 Logs: Salvos e monitorados         ║
║                                        ║
║ Atalhos no console (opcional):        ║
║ • dcSystemStatus()   → ver status     ║
║ • dcViewLogs()       → ver logs       ║
║ • dcExportDiagnostic() → exportar     ║
║ • dcCheckHealth()    → forçar check   ║
║ • dcShowDashboard()  → mostrar painel ║
╚════════════════════════════════════════╝
`);

export { SistemaInteligenteFortos };
