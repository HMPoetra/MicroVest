import React from 'react'
import type { AssetGroup } from '@/types'
import { AssetCard } from './AssetCard'

interface AssetGridProps {
  groupedAssets: AssetGroup[]
}

export function AssetGrid({ groupedAssets }: AssetGridProps) {
  if (!groupedAssets || groupedAssets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        Belum ada data aset yang tersedia.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {groupedAssets.map((group) => (
        <section key={group.type}>
          <div className="mb-6 flex items-center gap-3 border-b border-[hsl(var(--border))] pb-3">
            <h2 className="text-xl font-bold text-slate-900">{group.label}</h2>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {group.count} instrumen
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
