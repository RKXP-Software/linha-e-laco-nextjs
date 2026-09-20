'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, BookOpenText, CalendarDays, Check, ChevronRight, CircleDollarSign,
  ClipboardList, FileText, LayoutDashboard, Menu, PackagePlus, Plus, Settings,
  UserPlus, Users, X,
} from 'lucide-react'
import { calculateMaterialCost, calculateSuggestedPrice, money, nextOrderStatus, statusLabels, type OrderStatus } from '@/lib/domain'
import { createClient } from '@/lib/supabase'

type Customer = { id: string; name: string; phone?: string | null; email?: string | null; notes?: string | null }
type Product = { id: string; name: string; kind: 'service' | 'garment'; base_price: number; estimated_days: number; active: boolean; material_cost?: number; labor_cost?: number; overhead_cost?: number; production_cost?: number; price_table_id?: string | null }
type PriceTable = { id: string; name: string; markup_percentage: number; active: boolean }
type OrderItem = { name_snapshot: string; quantity: number; unit_price: number }
type Order = { id: string; number: string; status: OrderStatus; promised_for?: string | null; notes?: string | null; client_id: string; clients?: { name: string } | null; order_items?: OrderItem[] }
type Note = { id: string; title?: string | null; text?: string | null; content?: { html?: string } | null; updated_at?: string | null }
type RawOrder = Omit<Order, 'clients'> & { clients?: { name: string } | Array<{ name: string }> | null }
type WorkspaceData = { customers: Customer[]; products: Product[]; orders: Order[]; notes: Note[]; priceTables: PriceTable[] }
type View = 'dashboard' | 'customers' | 'orders' | 'products' | 'notes' | 'schedule' | 'finance' | 'reports' | 'settings'
type Composer = 'customer' | 'order' | 'product' | 'priceTable' | null

const initialData: WorkspaceData = {
  customers: [], products: [], orders: [], notes: [], priceTables: [],
}

function cachedWorkspaceData(): WorkspaceData {
  if (typeof window === 'undefined') return initialData
  try {
    const cached = JSON.parse(window.localStorage.getItem('linha-e-laco-workspace') ?? '{}') as Partial<WorkspaceData>
    return { ...initialData, ...cached, priceTables: cached.priceTables ?? [] }
  } catch { return initialData }
}

const nav: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'products', label: 'Produtos', icon: PackagePlus },
  { id: 'notes', label: 'Anotações', icon: BookOpenText },
  { id: 'schedule', label: 'Agenda', icon: CalendarDays },
  { id: 'finance', label: 'Financeiro', icon: CircleDollarSign },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'settings', label: 'Configurações', icon: Settings },
]

function plainText(value?: string | null) {
  return (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function statusClass(status: OrderStatus) { return `status status-${status}` }

export function Workspace() {
  const [view, setView] = useState<View>('dashboard')
  const [composer, setComposer] = useState<Composer>(null)
  const [openNav, setOpenNav] = useState(false)
  const [data, setData] = useState<WorkspaceData>(cachedWorkspaceData)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const db = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    if (!db || !navigator.onLine) return
    setError('')
    const [customers, products, orders, notes, priceTables] = await Promise.all([
      db.from('clients').select('id,name,phone,email,notes').order('created_at', { ascending: false }),
      db.from('catalog_items').select('id,name,kind,base_price,estimated_days,active,material_cost,labor_cost,overhead_cost,production_cost,price_table_id').order('created_at', { ascending: false }),
      db.from('orders').select('id,number,status,promised_for,notes,client_id,clients(name),order_items(name_snapshot,quantity,unit_price)').order('created_at', { ascending: false }),
      db.from('notes').select('id,title,text,content,updated_at').order('updated_at', { ascending: false }),
      db.from('price_tables').select('id,name,markup_percentage,active').order('name'),
    ])
    const failure = [customers, products, orders, notes, priceTables].find((result) => result.error)?.error
    if (failure) setError(failure.message)
    else {
      const loadedOrders = (orders.data ?? []) as unknown as RawOrder[]
      setData({ customers: customers.data ?? [], products: products.data ?? [], orders: loadedOrders.map(({ clients, ...order }) => ({ ...order, clients: Array.isArray(clients) ? clients[0] ?? null : clients })), notes: notes.data ?? [], priceTables: priceTables.data ?? [] })
    }
  }, [db])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => { window.localStorage.setItem('linha-e-laco-workspace', JSON.stringify(data)) }, [data])

  const metrics = useMemo(() => {
    const active = data.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status))
    const sales = data.orders.filter((order) => order.status !== 'cancelled').reduce((total, order) => total + (order.order_items ?? []).reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0), 0)
    const quotes = data.orders.filter((order) => order.status === 'quoted').length
    const upcoming = [...active].sort((a, b) => (a.promised_for ?? '9999').localeCompare(b.promised_for ?? '9999'))
    return { active: active.length, sales, quotes, upcoming }
  }, [data.orders])

  const complete = (message: string) => { setNotice(message); setError(''); setTimeout(() => setNotice(''), 3500) }

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customer = { name: String(form.get('name') ?? ''), phone: String(form.get('phone') ?? ''), email: String(form.get('email') ?? ''), notes: String(form.get('notes') ?? '') }
    if (db && navigator.onLine) {
      const { error: insertError } = await db.from('clients').insert(customer)
      if (insertError) return setError(insertError.message)
      await load()
    } else setData((current) => ({ ...current, customers: [{ id: crypto.randomUUID(), ...customer }, ...current.customers] }))
    event.currentTarget.reset(); setComposer(null); complete('Cliente cadastrado com sucesso.')
  }

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const materials = form.getAll('materialName').map((name, index) => ({ material_name: String(name).trim(), quantity: Number(form.getAll('materialQuantity')[index] ?? 0), unit: String(form.getAll('materialUnit')[index] ?? 'un'), unit_cost: Number(form.getAll('materialUnitCost')[index] ?? 0) })).filter((material) => material.material_name && material.quantity > 0)
    const materialCost = calculateMaterialCost(materials.map((material) => ({ quantity: material.quantity, unitCost: material.unit_cost })))
    const laborCost = Number(form.get('laborCost') ?? 0)
    const overheadCost = Number(form.get('overheadCost') ?? 0)
    const markup = Number(form.get('markup') ?? 0)
    const productionCost = materialCost + laborCost + overheadCost
    const product = { kind: String(form.get('kind')) as 'service' | 'garment', name: String(form.get('name') ?? ''), base_price: calculateSuggestedPrice(productionCost, markup), estimated_days: Number(form.get('days') ?? 0), description: String(form.get('description') ?? ''), active: true, material_cost: materialCost, labor_cost: laborCost, overhead_cost: overheadCost, production_cost: productionCost, price_table_id: String(form.get('priceTableId') ?? '') || null }
    const details = product.kind === 'service' ? { service_detail: { unit: 'unidade' }, garment_detail: null } : { service_detail: null, garment_detail: { garment_type: 'confecção' } }
    if (db && navigator.onLine) {
      const { data: saved, error: insertError } = await db.from('catalog_items').insert({ ...product, ...details }).select('id').single()
      if (insertError) return setError(insertError.message)
      if (materials.length) { const { error: materialsError } = await db.from('product_materials').insert(materials.map((material) => ({ ...material, catalog_item_id: saved.id }))); if (materialsError) return setError(materialsError.message) }
      if (product.price_table_id) { const { error: priceError } = await db.from('product_price_entries').upsert({ price_table_id: product.price_table_id, catalog_item_id: saved.id, production_cost_snapshot: productionCost, sale_price: product.base_price }, { onConflict: 'price_table_id,catalog_item_id' }); if (priceError) return setError(priceError.message) }
      await load()
    } else setData((current) => ({ ...current, products: [{ id: crypto.randomUUID(), ...product }, ...current.products] }))
    event.currentTarget.reset(); setComposer(null); complete('Produto salvo com custo de produção e preço sugerido.')
  }

  const savePriceTable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const table = { name: String(form.get('name') ?? ''), markup_percentage: Number(form.get('markup') ?? 0), active: true }
    if (db && navigator.onLine) { const { error: insertError } = await db.from('price_tables').insert(table); if (insertError) return setError(insertError.message); await load() }
    else setData((current) => ({ ...current, priceTables: [{ id: crypto.randomUUID(), ...table }, ...current.priceTables] }))
    event.currentTarget.reset(); setComposer(null); complete('Tabela de preços criada.')
  }
  const saveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customerId = String(form.get('customer') ?? '')
    const product = data.products.find((item) => item.id === String(form.get('product') ?? ''))
    const quantity = Number(form.get('quantity') ?? 1)
    if (!customerId || !product) return setError('Selecione um cliente e um produto.')
    const order = { number: `LL-${String(Date.now()).slice(-6)}`, client_id: customerId, status: 'quoted' as OrderStatus, promised_for: String(form.get('promisedFor') ?? '') || null, notes: String(form.get('notes') ?? '') }
    const item = { catalog_item_id: product.id, name_snapshot: product.name, kind: product.kind, quantity, unit_price: product.base_price }
    if (db && navigator.onLine) {
      const { data: saved, error: orderError } = await db.from('orders').insert(order).select('id').single()
      if (orderError) return setError(orderError.message)
      const { error: itemError } = await db.from('order_items').insert({ ...item, order_id: saved.id })
      if (itemError) return setError(itemError.message)
      await db.from('order_status_history').insert({ order_id: saved.id, status: 'quoted' })
      await load()
    } else {
      const customer = data.customers.find((item) => item.id === customerId)
      setData((current) => ({ ...current, orders: [{ ...order, id: crypto.randomUUID(), clients: customer ? { name: customer.name } : null, order_items: [item] }, ...current.orders] }))
    }
    event.currentTarget.reset(); setComposer(null); complete('Orçamento criado e pronto para acompanhar.')
  }

  const advance = async (order: Order) => {
    const status = nextOrderStatus(order.status)
    if (!status) return
    if (db && navigator.onLine) {
      const { error: updateError } = await db.from('orders').update({ status }).eq('id', order.id)
      if (updateError) return setError(updateError.message)
      await db.from('order_status_history').insert({ order_id: order.id, status })
      await load()
    } else setData((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? { ...item, status } : item) }))
    complete(`Pedido movido para ${statusLabels[status]}.`)
  }

  const saveNote = async (title: string, html: string) => {
    if (!title.trim() || !plainText(html)) return setError('Dê um título e escreva uma anotação antes de salvar.')
    const note = { title, text: plainText(html), content: { html } }
    if (db && navigator.onLine) {
      const { error: insertError } = await db.from('notes').insert(note)
      if (insertError) return setError(insertError.message)
      await load()
    } else setData((current) => ({ ...current, notes: [{ id: crypto.randomUUID(), ...note, updated_at: new Date().toISOString() }, ...current.notes] }))
    complete('Anotação salva.')
  }

  return <div className="app-frame">
    <aside className={openNav ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">L</span><span>Linha <i>&</i> Laço</span><button className="mobile-close" onClick={() => setOpenNav(false)} aria-label="Fechar menu"><X size={19}/></button></div>
      <div className="profile"><div className="avatar">LL</div><div><strong>Meu ateliê</strong><small>gestão diária</small></div></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(id); setOpenNav(false) }}><Icon size={18}/>{label}</button>)}</nav>
      <p className="sidebar-footer">feito para o seu ritmo</p>
    </aside>
    <div className="content-area">
      <header className="topbar"><button className="menu-button" onClick={() => setOpenNav(true)} aria-label="Abrir menu"><Menu size={22}/></button><div><p className="eyebrow">Linha & Laço</p><h1>{nav.find((item) => item.id === view)?.label}</h1></div><button className="soft-button" onClick={load}>Atualizar dados</button></header>
      {notice && <p className="notice"><Check size={17}/>{notice}</p>}{error && <p className="error">{error}</p>}
      <main>
        {view === 'dashboard' && <Dashboard metrics={metrics} orders={data.orders} onCompose={setComposer} onAdvance={advance}/>}
        {view === 'customers' && <Customers customers={data.customers} onCompose={() => setComposer('customer')}/>}
        {view === 'orders' && <Orders orders={data.orders} onCompose={() => setComposer('order')} onAdvance={advance}/>}
        {view === 'products' && <Products products={data.products} priceTables={data.priceTables} onCompose={setComposer}/>}
        {view === 'notes' && <Notes notes={data.notes} onSave={saveNote}/>}
        {view === 'schedule' && <Schedule orders={metrics.upcoming}/>}
        {view === 'finance' && <Finance orders={data.orders}/>}
        {view === 'reports' && <Reports data={data}/>}
        {view === 'settings' && <SettingsPanel/>}
      </main>
    </div>
    <div className="quick-actions"><button onClick={() => setComposer('customer')} title="Novo cliente"><UserPlus size={20}/></button><button onClick={() => setComposer('order')} title="Novo pedido"><Plus size={23}/></button></div>
    {composer && <Composer type={composer} customers={data.customers} products={data.products} priceTables={data.priceTables} onClose={() => setComposer(null)} onCustomer={saveCustomer} onProduct={saveProduct} onOrder={saveOrder} onPriceTable={savePriceTable}/>}
  </div>
}

function Dashboard({ metrics, orders, onCompose, onAdvance }: { metrics: { active: number; sales: number; quotes: number; upcoming: Order[] }; orders: Order[]; onCompose: (value: Composer) => void; onAdvance: (order: Order) => void }) {
  return <><section className="hero"><div><p className="eyebrow">Seu ateliê, em harmonia</p><h2>Bom trabalho começa com espaço para criar.</h2><p>Acompanhe o que pede atenção e deixe o operacional no seu devido lugar.</p></div><button className="primary-button" onClick={() => onCompose('order')}><Plus size={18}/>Novo pedido</button></section><section className="metric-grid"><Metric label="Vendas em aberto" value={money.format(metrics.sales)} hint="soma dos pedidos ativos"/><Metric label="Pedidos ativos" value={String(metrics.active)} hint="em andamento agora"/><Metric label="Orçamentos" value={String(metrics.quotes)} hint="aguardando aprovação"/><Metric label="Clientes" value={String(new Set(orders.map((order) => order.client_id)).size)} hint="com pedidos registrados"/></section><section className="split-grid"><article className="panel"><div className="panel-title"><div><p className="eyebrow">Acompanhamento</p><h2>Próximos trabalhos</h2></div><button className="text-button" onClick={() => onCompose('order')}>Ver todos <ChevronRight size={16}/></button></div><OrderList orders={metrics.upcoming.slice(0, 5)} onAdvance={onAdvance}/></article><article className="panel accent-panel"><p className="eyebrow">Comece por aqui</p><h2>Cadastre a próxima pessoa que você vai atender.</h2><p>Uma ficha bem cuidada torna cada novo pedido mais leve.</p><button className="ghost-light" onClick={() => onCompose('customer')}><UserPlus size={18}/>Novo cliente</button></article></section></>
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article> }
function Customers({ customers, onCompose }: { customers: Customer[]; onCompose: () => void }) { return <section className="panel full"><div className="panel-title"><div><p className="eyebrow">Relacionamentos</p><h2>Clientes</h2></div><button className="primary-button small" onClick={onCompose}><UserPlus size={17}/>Novo cliente</button></div>{customers.length ? <div className="simple-table">{customers.map((customer) => <div key={customer.id}><span className="initial">{customer.name.slice(0, 1)}</span><div><strong>{customer.name}</strong><small>{customer.phone || customer.email || 'Sem contato informado'}</small></div><small>{customer.notes || 'Sem observações'}</small></div>)}</div> : <Empty icon={<Users size={24}/>} title="Sua base de clientes começa aqui" text="Cadastre quem faz parte da sua história." action="Cadastrar cliente" onAction={onCompose}/>}</section> }
function Orders({ orders, onCompose, onAdvance }: { orders: Order[]; onCompose: () => void; onAdvance: (order: Order) => void }) { return <section className="panel full"><div className="panel-title"><div><p className="eyebrow">Operação</p><h2>Pedidos</h2></div><button className="primary-button small" onClick={onCompose}><Plus size={17}/>Novo pedido</button></div><OrderList orders={orders} onAdvance={onAdvance}/></section> }
function OrderList({ orders, onAdvance }: { orders: Order[]; onAdvance: (order: Order) => void }) { return orders.length ? <div className="order-list">{orders.map((order) => { const total = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0); const next = nextOrderStatus(order.status); return <div className="order-row" key={order.id}><div><strong>{order.number} <span>·</span> {order.clients?.name ?? 'Cliente'}</strong><small>{order.order_items?.map((item) => item.name_snapshot).join(', ') || 'Sem itens'} {order.promised_for ? `· entrega ${new Date(`${order.promised_for}T12:00`).toLocaleDateString('pt-BR')}` : ''}</small></div><div className="order-meta"><strong>{money.format(total)}</strong><span className={statusClass(order.status)}>{statusLabels[order.status]}</span>{next && <button className="next-button" onClick={() => onAdvance(order)}>Avançar</button>}</div></div> })}</div> : <Empty icon={<ClipboardList size={24}/>} title="Nenhum pedido por aqui" text="Crie seu primeiro orçamento e acompanhe cada etapa."/> }
function Products({ products, priceTables, onCompose }: { products: Product[]; priceTables: PriceTable[]; onCompose: (type: Composer) => void }) { return <section className="panel full"><div className="panel-title"><div><p className="eyebrow">Catálogo e formação de preço</p><h2>Produtos e serviços</h2></div><span className="product-actions"><button className="soft-button" onClick={() => onCompose('priceTable')}>Tabela de preços</button><button className="primary-button small" onClick={() => onCompose('product')}><PackagePlus size={17}/>Novo item</button></span></div><div className="price-table-summary"><strong>{priceTables.length ? `${priceTables.length} tabela${priceTables.length > 1 ? 's' : ''} disponível${priceTables.length > 1 ? 'is' : ''}` : 'Nenhuma tabela de preços criada'}</strong><small>{priceTables.length ? priceTables.map((table) => `${table.name} · +${table.markup_percentage}%`).join('  |  ') : 'Crie uma tabela para aplicar margem e manter os preços consistentes.'}</small></div>{products.length ? <div className="cards-grid">{products.map((product) => <article className="product-card" key={product.id}><span className="product-kind">{product.kind === 'service' ? 'Serviço' : 'Confecção'}</span><h3>{product.name}</h3><strong>{money.format(Number(product.base_price))}</strong><small>Custo: {money.format(Number(product.production_cost ?? 0))} · materiais {money.format(Number(product.material_cost ?? 0))}</small><small>{product.estimated_days} dias estimados</small></article>)}</div> : <Empty icon={<PackagePlus size={24}/>} title="Seu catálogo ainda está em branco" text="Inclua materiais, custos e uma margem para formar preços com clareza." action="Adicionar item" onAction={() => onCompose('product')}/>}</section> }function Notes({ notes, onSave }: { notes: Note[]; onSave: (title: string, html: string) => Promise<void> }) { const [title, setTitle] = useState(''); const editor = useRef<HTMLDivElement>(null); const command = (name: string, value?: string) => { editor.current?.focus(); document.execCommand(name, false, value) }; return <section className="notes-layout"><article className="panel note-editor"><div className="panel-title"><div><p className="eyebrow">Caderno do ateliê</p><h2>Anotações</h2></div><button className="primary-button small" onClick={() => onSave(title, editor.current?.innerHTML ?? '')}><FileText size={17}/>Salvar</button></div><input className="note-title" placeholder="Título da anotação" value={title} onChange={(event) => setTitle(event.target.value)}/><div className="editor-toolbar"><button onClick={() => command('bold')}><b>B</b></button><button onClick={() => command('italic')}><i>I</i></button><button onClick={() => command('formatBlock', 'h2')}>Título</button><button onClick={() => command('insertUnorderedList')}>Lista</button><button onClick={() => command('foreColor', '#b85c56')}>Cor</button></div><div ref={editor} className="rich-editor" contentEditable suppressContentEditableWarning data-placeholder="Escreva ideias, medidas, recados ou qualquer detalhe importante..."/></article><aside className="notes-list"><p className="eyebrow">Últimas anotações</p>{notes.length ? notes.map((note) => <article key={note.id}><strong>{note.title || 'Sem título'}</strong><p>{note.text || plainText(note.content?.html)}</p></article>) : <p className="muted">As anotações salvas aparecerão aqui.</p>}</aside></section> }
function Schedule({ orders }: { orders: Order[] }) { return <section className="panel full"><p className="eyebrow">Planejamento</p><h2>Agenda de entregas</h2><div className="timeline">{orders.length ? orders.map((order) => <div key={order.id}><span></span><div><strong>{order.promised_for ? new Date(`${order.promised_for}T12:00`).toLocaleDateString('pt-BR') : 'Data a definir'}</strong><p>{order.number} · {order.clients?.name ?? 'Cliente'} · {statusLabels[order.status]}</p></div></div>) : <Empty icon={<CalendarDays size={24}/>} title="Nenhuma entrega agendada" text="As datas prometidas nos pedidos aparecem automaticamente aqui."/>}</div></section> }
function Finance({ orders }: { orders: Order[] }) { const active = orders.filter((order) => order.status !== 'cancelled'); const total = active.reduce((sum, order) => sum + (order.order_items ?? []).reduce((subtotal, item) => subtotal + Number(item.quantity) * Number(item.unit_price), 0), 0); return <section className="split-grid"><article className="panel"><p className="eyebrow">Resumo financeiro</p><h2>{money.format(total)}</h2><p className="muted">Total registrado em pedidos não cancelados.</p></article><article className="panel"><p className="eyebrow">A receber</p><h2>{active.filter((order) => order.status !== 'delivered').length} pedidos</h2><p className="muted">Registre parcelas e pagamentos no detalhe do pedido na próxima etapa.</p></article></section> }
function Reports({ data }: { data: WorkspaceData }) { const kindCounts = data.products.reduce<Record<string, number>>((acc, product) => ({ ...acc, [product.kind]: (acc[product.kind] ?? 0) + 1 }), {}); return <section className="split-grid"><article className="panel"><p className="eyebrow">Vendas</p><h2>Panorama do ateliê</h2><div className="report-bars"><div><span>Orçamentos</span><b style={{ width: `${Math.max(12, data.orders.filter((order) => order.status === 'quoted').length * 24)}%` }}/></div><div><span>Em produção</span><b style={{ width: `${Math.max(12, data.orders.filter((order) => order.status === 'in_production').length * 24)}%` }}/></div><div><span>Entregues</span><b style={{ width: `${Math.max(12, data.orders.filter((order) => order.status === 'delivered').length * 24)}%` }}/></div></div></article><article className="panel"><p className="eyebrow">Catálogo</p><h2>{kindCounts.service ?? 0} serviços · {kindCounts.garment ?? 0} confecções</h2><p className="muted">Use estes indicadores para decidir o que merece mais destaque no seu catálogo.</p></article></section> }
function SettingsPanel() {
  const [feedback, setFeedback] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(''); setSettingsError('')
    const form = new FormData(event.currentTarget)
    const db = createClient()
    if (!db || !navigator.onLine) return setSettingsError('Configure o Supabase para salvar estas preferências.')
    const { error: saveError } = await db.from('business_settings').upsert({ business_name: String(form.get('businessName') ?? ''), phone: String(form.get('phone') ?? ''), currency_code: String(form.get('currency') ?? 'BRL') }, { onConflict: 'owner_id' })
    if (saveError) setSettingsError(saveError.message); else setFeedback('Configurações atualizadas.')
  }
  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(''); setSettingsError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('newPassword') ?? '')
    const confirmation = String(form.get('confirmPassword') ?? '')
    if (password.length < 8) return setSettingsError('Use uma senha com pelo menos 8 caracteres.')
    if (password !== confirmation) return setSettingsError('As senhas não coincidem.')
    const db = createClient()
    if (!db || !navigator.onLine) return setSettingsError('Configure o Supabase para alterar a senha.')
    const { error: passwordError } = await db.auth.updateUser({ password })
    if (passwordError) setSettingsError(passwordError.message); else { event.currentTarget.reset(); setFeedback('Senha atualizada com sucesso.') }
  }
  return <section className="panel settings"><p className="eyebrow">Seu espaço</p><h2>Configurações</h2><form onSubmit={saveSettings}><label>Nome do ateliê<input name="businessName" defaultValue="Linha & Laço" required/></label><label>Telefone de contato<input name="phone" placeholder="(00) 00000-0000"/></label><label>Moeda<select name="currency" defaultValue="BRL"><option value="BRL">Real brasileiro (R$)</option></select></label><button className="primary-button small">Salvar preferências</button></form><hr/><h3>Segurança</h3><form onSubmit={changePassword}><label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" required/></label><label>Confirmar nova senha<input name="confirmPassword" type="password" autoComplete="new-password" required/></label><button className="soft-button">Alterar senha</button></form>{settingsError && <p className="form-error">{settingsError}</p>}{feedback && <p className="form-success">{feedback}</p>}</section> }function Empty({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action && <button className="primary-button small" onClick={onAction}>{action}</button>}</div> }
function Composer({ type, customers, products, priceTables, onClose, onCustomer, onProduct, onOrder, onPriceTable }: { type: Composer; customers: Customer[]; products: Product[]; priceTables: PriceTable[]; onClose: () => void; onCustomer: (event: FormEvent<HTMLFormElement>) => void; onProduct: (event: FormEvent<HTMLFormElement>) => void; onOrder: (event: FormEvent<HTMLFormElement>) => void; onPriceTable: (event: FormEvent<HTMLFormElement>) => void }) { const titles = { customer: 'Novo cliente', product: 'Novo item', order: 'Novo pedido', priceTable: 'Nova tabela de preços' }; return <div className="modal-backdrop"><section className="composer"><div className="composer-head"><h2>{titles[type!]}</h2><button onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>{type === 'customer' && <form onSubmit={onCustomer}><Field name="name" label="Nome completo" required/><Field name="phone" label="Telefone"/><Field name="email" label="E-mail" type="email"/><label>Observações<textarea name="notes" rows={3}/></label><button className="primary-button">Salvar cliente</button></form>}{type === 'product' && <ProductForm onSubmit={onProduct} priceTables={priceTables}/>} {type === 'priceTable' && <form onSubmit={onPriceTable}><Field name="name" label="Nome da tabela" placeholder="Ex.: Varejo 2026" required/><Field name="markup" label="Margem sobre o custo (%)" type="number" min="0" step="0.01" defaultValue="100" required/><p className="muted">A margem é aplicada sobre materiais, mão de obra e custos indiretos para sugerir o preço de venda.</p><button className="primary-button">Criar tabela</button></form>}{type === 'order' && <form onSubmit={onOrder}><label>Cliente<select name="customer" required><option value="">Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Produto ou serviço<select name="product" required><option value="">Selecione</option>{products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(product.base_price)}</option>)}</select></label><Field name="quantity" label="Quantidade" type="number" min="1" defaultValue="1" required/><Field name="promisedFor" label="Data prevista de entrega" type="date"/><label>Observações<textarea name="notes" rows={3}/></label><button className="primary-button">Criar orçamento</button></form>}</section></div> }
function ProductForm({ onSubmit, priceTables }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; priceTables: PriceTable[] }) { const [materials, setMaterials] = useState([{ id: crypto.randomUUID(), name: '', quantity: '1', unit: 'un', unitCost: '0' }]); const [laborCost, setLaborCost] = useState('0'); const [overheadCost, setOverheadCost] = useState('0'); const [markup, setMarkup] = useState(String(priceTables[0]?.markup_percentage ?? 100)); const materialCost = calculateMaterialCost(materials.map((material) => ({ quantity: Number(material.quantity), unitCost: Number(material.unitCost) }))); const productionCost = materialCost + Number(laborCost) + Number(overheadCost); const suggestedPrice = calculateSuggestedPrice(productionCost, Number(markup)); return <form onSubmit={onSubmit}><label>Tipo<select name="kind"><option value="service">Serviço</option><option value="garment">Confecção</option></select></label><Field name="name" label="Nome" required/><Field name="days" label="Prazo estimado (dias)" type="number" min="0" defaultValue="0" required/><label>Descrição<textarea name="description" rows={2}/></label><fieldset className="materials-fieldset"><legend>Materiais</legend>{materials.map((material, index) => <div className="material-row" key={material.id}><input name="materialName" value={material.name} onChange={(event) => setMaterials((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} placeholder="Material"/><input name="materialQuantity" value={material.quantity} onChange={(event) => setMaterials((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} type="number" min="0" step="0.001" aria-label="Quantidade"/><input name="materialUnit" value={material.unit} onChange={(event) => setMaterials((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unit: event.target.value } : row))} aria-label="Unidade"/><input name="materialUnitCost" value={material.unitCost} onChange={(event) => setMaterials((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row))} type="number" min="0" step="0.01" aria-label="Custo unitário"/>{materials.length > 1 && <button type="button" className="remove-row" onClick={() => setMaterials((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>×</button>}</div>)}<button type="button" className="text-button" onClick={() => setMaterials((rows) => [...rows, { id: crypto.randomUUID(), name: '', quantity: '1', unit: 'un', unitCost: '0' }])}>+ Adicionar material</button></fieldset><div className="cost-grid"><Field name="laborCost" label="Mão de obra" type="number" min="0" step="0.01" value={laborCost} onChange={(event) => setLaborCost(event.target.value)}/><Field name="overheadCost" label="Custos indiretos" type="number" min="0" step="0.01" value={overheadCost} onChange={(event) => setOverheadCost(event.target.value)}/></div><label>Tabela de preços<select name="priceTableId" onChange={(event) => { const table = priceTables.find((item) => item.id === event.target.value); if (table) setMarkup(String(table.markup_percentage)) }}><option value="">Sem tabela</option>{priceTables.filter((table) => table.active).map((table) => <option key={table.id} value={table.id}>{table.name} · +{table.markup_percentage}%</option>)}</select></label><Field name="markup" label="Margem aplicada (%)" type="number" min="0" step="0.01" value={markup} onChange={(event) => setMarkup(event.target.value)}/><div className="price-preview"><span>Custo de produção: <b>{money.format(productionCost)}</b></span><strong>Preço sugerido: {money.format(suggestedPrice)}</strong></div><button className="primary-button">Salvar no catálogo</button></form> }function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label>{label}<input {...props}/></label> }
