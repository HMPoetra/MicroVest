import React from 'react'
import type { Metadata } from 'next'
import type { AssetGroup } from '@/types'
import { AssetPageClient } from '@/components/ui/AssetPageClient'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Data Aset | MicroVest',
  description: 'Pantau harga terkini emas, reksa dana, dan obligasi.',
}

// Fetch langsung dari Supabase (tanpa HTTP loopback) untuk initial SSR
async function getAssetsData(): Promise<AssetGroup[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_asset_prices')
    if (error || !data) return []

    const assetIds = Array.from(new Set<string>(data.map((row: any) => String(row.id))))

    const { data: priceRows } = await supabase
      .from('price_history')
      .select('asset_id, price, recorded_at')
      .in('asset_id', assetIds)
      .order('recorded_at', { ascending: false })

    const priceMap: Record<string, number[]> = {}
    if (priceRows) {
      for (const row of priceRows) {
        if (!priceMap[row.asset_id]) priceMap[row.asset_id] = []
        if (priceMap[row.asset_id].length < 2) {
          priceMap[row.asset_id].push(Number(row.price))
        }
      }
    }

    type AssetType = 'emas' | 'reksadana' | 'obligasi' | 'kripto' | 'saham'

    const typeOrder: Record<AssetType, number> = {
      emas: 1, reksadana: 2, obligasi: 3, kripto: 4, saham: 5,
    }
    const typeLabel: Record<AssetType, string> = {
      emas: 'Emas', reksadana: 'Reksa Dana', obligasi: 'Obligasi', kripto: 'Kripto', saham: 'Saham',
    }

    const grouped: Record<string, AssetGroup> = {}
    for (const row of data as any[]) {
      const prices = priceMap[row.id] ?? []
      const hargaTerkini = prices[0] ?? Number(row.harga_terkini)
      const hargaSebelumnya = prices[1] ?? null
      const persentase_perubahan =
        hargaSebelumnya !== null && hargaSebelumnya > 0 && hargaTerkini !== hargaSebelumnya
          ? ((hargaTerkini - hargaSebelumnya) / hargaSebelumnya) * 100
          : null

      const asset = {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        type: row.type as AssetType,
        unit: row.unit,
        description: '',
        created_at: '',
        harga_terkini: hargaTerkini,
        tanggal_terkini: row.tanggal_terkini,
        harga_sebelumnya: hargaSebelumnya,
        persentase_perubahan,
      }

      if (!grouped[row.type]) {
        grouped[row.type] = {
          type: row.type as AssetType,
          label: typeLabel[row.type as AssetType] || row.type,
          count: 0,
          assets: [],
        }
      }
      grouped[row.type].assets.push(asset)
      grouped[row.type].count += 1
    }

    return Object.values(grouped).sort(
      (a, b) => (typeOrder[a.type as AssetType] || 99) - (typeOrder[b.type as AssetType] || 99)
    )
  } catch {
    return []
  }
}

export default async function DataAsetPage() {
  const initialData = await getAssetsData()

  return <AssetPageClient initialData={initialData} />
}
