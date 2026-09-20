import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Linha & Laço',
    short_name: 'Linha & Laço',
    description: 'Gestão delicada para um ateliê em movimento.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf9',
    theme_color: '#b55e58',
    lang: 'pt-BR',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
