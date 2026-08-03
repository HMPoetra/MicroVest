import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { AssetWithPrice } from '@/types'
import { formatIDR } from '@/lib/utils'
import Link from 'next/link'

interface AssetCardProps {
  asset: AssetWithPrice
}

export function AssetCard({ asset }: AssetCardProps) {
  const isUp = asset.persentase_perubahan !== null && asset.persentase_perubahan > 0
  const isDown = asset.persentase_perubahan !== null && asset.persentase_perubahan < 0
  const isFlat = asset.persentase_perubahan === null || asset.persentase_perubahan === 0

  return (
    <div className="card p-6 border border-[hsl(var(--border))] rounded-2xl hover:shadow-md transition-shadow bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">{asset.name}</h3>
          <p className="text-sm font-medium text-slate-500">{asset.symbol}</p>
        </div>
        <div className={`p-2 rounded-lg ${isUp ? 'bg-emerald-50 text-emerald-600' : isDown ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
          {isUp ? <TrendingUp size={20} /> : isDown ? <TrendingDown size={20} /> : <Minus size={20} />}
        </div>
      </div>
      
      <div className="mt-4">
        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Harga Terkini</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">
            {formatIDR(asset.harga_terkini)}
          </span>
          <span className="text-sm font-medium text-slate-500">
            per {asset.unit}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex justify-between items-center">
        <div className="flex items-center gap-2">
          {asset.persentase_perubahan !== null ? (
            <span className={`text-sm font-bold ${isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-slate-500'}`}>
              {isUp ? '+' : ''}{asset.persentase_perubahan.toFixed(2)}%
            </span>
          ) : (
            <span className="text-sm font-bold text-slate-500">0.00%</span>
          )}
          <span className="text-xs text-slate-400 font-medium">dari harga sebelumnya</span>
        </div>
        <Link 
          href={`/aset/${asset.symbol}`} 
          className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
        >
          Lihat Detail →
        </Link>
      </div>
    </div>
  )
}

export function AssetCardSkeleton() {
  return (
    <div className="card p-6 border border-[hsl(var(--border))] rounded-2xl animate-pulse bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="h-6 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-20 bg-slate-200 rounded"></div>
        </div>
        <div className="h-9 w-9 bg-slate-200 rounded-lg"></div>
      </div>
      <div className="mt-6">
        <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
        <div className="h-8 w-40 bg-slate-200 rounded"></div>
      </div>
      <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
      </div>
    </div>
  )
}
