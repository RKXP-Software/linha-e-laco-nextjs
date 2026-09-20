'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'reset' | 'update'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(() => typeof window !== 'undefined' && window.location.search.includes('recovery=1') ? 'update' : 'login')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const db = createClient()
    if (!db) return
    const { data: listener } = db.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setMode('update') })
    return () => listener.subscription.unsubscribe()
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')
    const db = createClient()
    if (!db) return setError('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para habilitar o login.')
    if (mode === 'update') {
      if (password.length < 8) return setError('Use uma senha com pelo menos 8 caracteres.')
      if (password !== confirmation) return setError('As senhas não coincidem.')
      const { error: updateError } = await db.auth.updateUser({ password })
      if (updateError) setError(updateError.message); else { setMessage('Senha atualizada. Você já pode entrar.'); setMode('login'); event.currentTarget.reset() }
      return
    }
    if (mode === 'reset') {
      const { error: resetError } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/login?recovery=1` })
      if (resetError) setError(resetError.message); else setMessage('Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.')
      return
    }
    const { error: loginError } = await db.auth.signInWithPassword({ email, password })
    if (loginError) setError(loginError.message); else router.push('/')
  }

  const title = mode === 'login' ? 'Que bom ter você aqui.' : mode === 'reset' ? 'Vamos recuperar seu acesso.' : 'Crie uma nova senha.'
  const subtitle = mode === 'login' ? 'Entre para organizar o seu ateliê com calma.' : mode === 'reset' ? 'Informe seu e-mail e enviaremos um link para criar uma nova senha.' : 'Escolha uma senha segura para continuar.'
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-back"><ArrowLeft size={16}/> Voltar</Link><div className="auth-symbol"><LockKeyhole size={21}/></div><p className="eyebrow">Linha & Laço</p><h1>{title}</h1><p>{subtitle}</p><form onSubmit={submit}>{mode !== 'update' && <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@exemplo.com"/></label>}{mode !== 'reset' && <label>Senha<input name="password" type="password" required autoComplete={mode === 'update' ? 'new-password' : 'current-password'} placeholder="Sua senha"/></label>}{mode === 'update' && <label>Confirmar senha<input name="confirmation" type="password" required autoComplete="new-password" placeholder="Repita sua senha"/></label>}{error && <p className="auth-error">{error}</p>}{message && <p className="auth-message">{message}</p>}<button className="primary-button">{mode === 'login' ? 'Entrar' : mode === 'reset' ? 'Enviar instruções' : 'Atualizar senha'}</button></form>{mode !== 'update' && <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}</button>}</section></main>
}