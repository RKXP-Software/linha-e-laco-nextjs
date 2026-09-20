'use client'

export default function OfflinePage() {
  return <main className="offline-page"><section><p className="eyebrow">Linha & Laço</p><h1>Você está sem conexão.</h1><p>O aplicativo continua instalado. Reconecte-se para atualizar os dados do ateliê.</p><button onClick={() => window.location.reload()}>Tentar novamente</button></section></main>
}
