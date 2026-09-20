'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { usernameToAuthEmail } from '@/lib/domain'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'update'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
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
    const username = String(form.get('username') ?? '')
    const password = String(form.get('password') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')
    const db = createClient()
    if (!db) return setError('Configure o Supabase para habilitar o login.')
    if (mode === 'update') {
      if (password.length < 6) return setError('Use uma senha com pelo menos 6 caracteres.')
      if (password !== confirmation) return setError('As senhas não coincidem.')
      const { error: updateError } = await db.auth.updateUser({ password })
      if (updateError) setError(updateError.message); else { setMessage('Senha atualizada.'); setMode('login'); event.currentTarget.reset() }
      return
    }
    const email = usernameToAuthEmail(username)
    if (!email) return setError('Use um nome de usuário com 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.')
    const { error: loginError } = await db.auth.signInWithPassword({ email, password })
    if (loginError) setError('Usuário ou senha inválidos.'); else router.push('/')
  }

  const title = mode === 'login' ? 'Que bom ter você aqui.' : 'Crie uma nova senha.'
  const subtitle = mode === 'login' ? 'Entre para organizar o seu ateliê com calma.' : 'Escolha uma senha segura para continuar.'
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-back"><ArrowLeft size={16}/> Voltar</Link><div className="auth-symbol"><LockKeyhole size={21}/></div><p className="eyebrow">Linha & Laço</p><h1>{title}</h1><p>{subtitle}</p><form onSubmit={submit}>{mode === 'login' && <label>Usuário<input name="username" required autoComplete="username" autoCapitalize="none" placeholder="Ex.: marli"/></label>}<label>Senha<input name="password" type="password" required autoComplete={mode === 'update' ? 'new-password' : 'current-password'} placeholder="Sua senha"/></label>{mode === 'update' && <label>Confirmar senha<input name="confirmation" type="password" required autoComplete="new-password" placeholder="Repita sua senha"/></label>}{error && <p className="auth-error">{error}</p>}{message && <p className="auth-message">{message}</p>}<button className="primary-button">{mode === 'login' ? 'Entrar' : 'Atualizar senha'}</button></form></section></main>
}
