import React from 'react'
import type { Metadata } from 'next'
import { AssetGrid } from '@/components/ui/AssetGrid'
import type { AssetGroup } from '@/types'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Data Aset | MicroVest',
  description: 'Pantau harga terkini emas, reksa dana, dan obligasi.',
}

async function getAssetsData() {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  
  const res = await fetch(`${protocol}://${host}/api/assets`, {
    cache: 'no-store'
  })

  if (!res.ok) {
    throw new Error('Gagal mengambil data aset')
  }

  const json = await res.json()
  if (json.error) {
    throw new Error(json.error)
  }
  return json.data as AssetGroup[]
}

export default async function DataAsetPage() {
  let groupedAssets: AssetGroup[] = []
  let errorMsg = null
  
  try {
    groupedAssets = await getAssetsData()
  } catch (err: any) {
    errorMsg = err.message
  }

  return (
    <div className="animate-fade-in-up w-full flex-1">
      <div className="mb-8">
        <h1 style={{ fontSize: "1.7rem", fontWeight: 800, color: "hsl(var(--text-primary))", marginBottom: 4 }}>
          Data Aset
        </h1>
        <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem" }}>
          Pantau pergerakan harga instrumen investasi Anda secara real-time yang tersinkronisasi setiap hari.
        </p>
      </div>

      {errorMsg ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
          Error: {errorMsg}
        </div>
      ) : (
        <AssetGrid groupedAssets={groupedAssets} />
      )}
    </div>
  )
}
