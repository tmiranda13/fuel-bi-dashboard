import { createContext, useContext, useState, useEffect } from 'react'

const PinnedWidgetsContext = createContext(null)

// Available widgets that can be pinned
export const AVAILABLE_WIDGETS = {
  // Vendas widgets
  'vendas_volume_total': {
    id: 'vendas_volume_total',
    title: 'Volume Total',
    description: 'Card com volume total de vendas',
    sourceTab: 'vendas',
    type: 'card',
    size: 'small'
  },
  'vendas_faturamento': {
    id: 'vendas_faturamento',
    title: 'Faturamento',
    description: 'Card com faturamento total',
    sourceTab: 'vendas',
    type: 'card',
    size: 'small'
  },
  'vendas_lucro_bruto': {
    id: 'vendas_lucro_bruto',
    title: 'Lucro Bruto',
    description: 'Card com lucro bruto',
    sourceTab: 'vendas',
    type: 'card',
    size: 'small'
  },
  'vendas_vmd': {
    id: 'vendas_vmd',
    title: 'Volume Médio Diário',
    description: 'VMD do mês atual',
    sourceTab: 'vendas',
    type: 'card',
    size: 'small'
  },
  'vendas_projecao': {
    id: 'vendas_projecao',
    title: 'Projeção do Mês',
    description: 'Volume projetado para o mês',
    sourceTab: 'vendas',
    type: 'card',
    size: 'small'
  },
  'vendas_mix_gasolina': {
    id: 'vendas_mix_gasolina',
    title: 'Mix de Gasolina',
    description: 'Proporção Comum vs Aditivada',
    sourceTab: 'vendas',
    type: 'chart',
    size: 'medium'
  },
  'vendas_breakdown_produto': {
    id: 'vendas_breakdown_produto',
    title: 'Breakdown por Produto',
    description: 'Gráfico de pizza por produto',
    sourceTab: 'vendas',
    type: 'chart',
    size: 'medium'
  },
  'vendas_evolucao': {
    id: 'vendas_evolucao',
    title: 'Evolução de Volume',
    description: 'Gráfico de linha diário',
    sourceTab: 'vendas',
    type: 'chart',
    size: 'large'
  },
  'vendas_tabela_produtos': {
    id: 'vendas_tabela_produtos',
    title: 'Tabela de Produtos',
    description: 'Desempenho por produto',
    sourceTab: 'vendas',
    type: 'table',
    size: 'large'
  },
  'vendas_pj_resumo': {
    id: 'vendas_pj_resumo',
    title: 'Resumo Clientes PJ',
    description: 'Cards de clientes PJ',
    sourceTab: 'vendas',
    type: 'cards',
    size: 'large'
  },

  // Compras widgets
  'compras_volume_total': {
    id: 'compras_volume_total',
    title: 'Volume Comprado',
    description: 'Volume total de compras',
    sourceTab: 'compras',
    type: 'card',
    size: 'small'
  },
  'compras_custo_total': {
    id: 'compras_custo_total',
    title: 'Custo Total',
    description: 'Custo total de compras',
    sourceTab: 'compras',
    type: 'card',
    size: 'small'
  },
  'compras_custo_medio': {
    id: 'compras_custo_medio',
    title: 'Custo Médio',
    description: 'Custo médio ponderado',
    sourceTab: 'compras',
    type: 'card',
    size: 'small'
  },
  'compras_evolutivo': {
    id: 'compras_evolutivo',
    title: 'Evolutivo de Preços',
    description: 'Gráfico de evolução de preços',
    sourceTab: 'compras',
    type: 'chart',
    size: 'large'
  },

  // Estoque widgets
  'estoque_status': {
    id: 'estoque_status',
    title: 'Status de Estoque',
    description: 'Tabela de níveis de estoque',
    sourceTab: 'estoque',
    type: 'table',
    size: 'large'
  },
  'estoque_alertas': {
    id: 'estoque_alertas',
    title: 'Alertas de Autonomia',
    description: 'Produtos com autonomia baixa (<4 dias)',
    sourceTab: 'estoque',
    type: 'alerts',
    size: 'medium'
  },

  // Vendas2 widgets
  'vendas2_funcionarios': {
    id: 'vendas2_funcionarios',
    title: 'Desempenho Funcionários',
    description: 'Vendas por funcionário',
    sourceTab: 'vendas2',
    type: 'table',
    size: 'large'
  },
  'vendas2_pagamentos': {
    id: 'vendas2_pagamentos',
    title: 'Formas de Pagamento',
    description: 'Breakdown por forma de pagamento',
    sourceTab: 'vendas2',
    type: 'chart',
    size: 'medium'
  },
}

// Default widgets for new users
const DEFAULT_PINNED = [
  'vendas_volume_total',
  'vendas_faturamento',
  'vendas_vmd',
  'vendas_projecao',
  'vendas_mix_gasolina',
  'vendas_breakdown_produto',
]

const STORAGE_KEY = 'home_pinned_widgets'

export const PinnedWidgetsProvider = ({ children }) => {
  const [pinnedWidgets, setPinnedWidgets] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return DEFAULT_PINNED
      }
    }
    return DEFAULT_PINNED
  })

  // Save to localStorage when pinned widgets change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedWidgets))
  }, [pinnedWidgets])

  const pinWidget = (widgetId) => {
    if (!pinnedWidgets.includes(widgetId)) {
      setPinnedWidgets([...pinnedWidgets, widgetId])
    }
  }

  const unpinWidget = (widgetId) => {
    setPinnedWidgets(pinnedWidgets.filter(id => id !== widgetId))
  }

  const isPinned = (widgetId) => {
    return pinnedWidgets.includes(widgetId)
  }

  const togglePin = (widgetId) => {
    if (isPinned(widgetId)) {
      unpinWidget(widgetId)
    } else {
      pinWidget(widgetId)
    }
  }

  const reorderWidgets = (newOrder) => {
    setPinnedWidgets(newOrder)
  }

  const resetToDefault = () => {
    setPinnedWidgets(DEFAULT_PINNED)
  }

  const value = {
    pinnedWidgets,
    pinWidget,
    unpinWidget,
    isPinned,
    togglePin,
    reorderWidgets,
    resetToDefault,
    availableWidgets: AVAILABLE_WIDGETS,
  }

  return (
    <PinnedWidgetsContext.Provider value={value}>
      {children}
    </PinnedWidgetsContext.Provider>
  )
}

export const usePinnedWidgets = () => {
  const context = useContext(PinnedWidgetsContext)
  if (!context) {
    throw new Error('usePinnedWidgets must be used within a PinnedWidgetsProvider')
  }
  return context
}
