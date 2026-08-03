import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch current assets to match symbols
    const { data: assets, error: assetError } = await supabase
      .from('assets')
      .select('id, symbol, type')
    
    if (assetError) throw assetError
    
    // Map for easy lookup: { 'ANTAM_1GR': 'uuid-1234', ... }
    const assetMap = new Map()
    assets.forEach((a: any) => assetMap.set(a.symbol, a.id))

    const priceUpdates: any[] = []
    
    // 2. Fetch API Eksternal
    // a. Emas (Logam Mulia via iamutaki/logam-mulia-api)
    try {
      const res = await fetch('https://logam-mulia-api.vercel.app/api/antam/latest')
      if (res.ok) {
        const data = await res.json()
        const latestPrices = data.data
        // Mapping specific items based on weight
        const oneGram = latestPrices.find((p: any) => p.weight === 1)
        const fiveGram = latestPrices.find((p: any) => p.weight === 5)
        
        if (oneGram && assetMap.has('ANTAM_1GR')) {
          priceUpdates.push({
            asset_id: assetMap.get('ANTAM_1GR'),
            price: oneGram.exactPrice,
            source: 'logam-mulia-api'
          })
        }
        
        if (fiveGram && assetMap.has('ANTAM_5GR')) {
          priceUpdates.push({
            asset_id: assetMap.get('ANTAM_5GR'),
            price: fiveGram.exactPrice,
            source: 'logam-mulia-api'
          })
        }
      } else {
        console.warn('Failed to fetch from logam-mulia-api:', res.status)
      }
    } catch (e) {
      console.warn('Error fetching logam-mulia-api:', e)
    }

    // b. Reksa Dana & Obligasi (Mock update for now as per instruction)
    const dummyUpdates = [
      { symbol: 'RDPT_MANULIFE', price: 1200 + Math.random() * 5, source: 'mock_reksadana' },
      { symbol: 'RDPU_BNI', price: 1050 + Math.random() * 2, source: 'mock_reksadana' },
      { symbol: 'RDPC_SCHRODER', price: 1500 + Math.random() * 10, source: 'mock_reksadana' },
      { symbol: 'SBR012', price: 1000000, source: 'mock_obligasi' },
      { symbol: 'ORI023', price: 1000000, source: 'mock_obligasi' }
    ]

    for (const mock of dummyUpdates) {
      if (assetMap.has(mock.symbol)) {
        priceUpdates.push({
          asset_id: assetMap.get(mock.symbol),
          price: mock.price,
          source: mock.source
        })
      }
    }

    // 3. Upsert to price_history
    const todayDate = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
    const payload = priceUpdates.map(p => ({
      ...p,
      recorded_at: todayDate
    }))

    let successCount = 0
    let failCount = 0

    // Upsert batch (on conflict do update)
    if (payload.length > 0) {
      const { error: upsertError } = await supabase
        .from('price_history')
        .upsert(payload, { 
          onConflict: 'asset_id, recorded_at'
        })
      
      if (upsertError) {
        console.error('Upsert Error:', upsertError)
        failCount = payload.length
      } else {
        successCount = payload.length
      }
    }

    const result = {
      message: 'Sync completed',
      success_count: successCount,
      fail_count: failCount,
      timestamp: new Date().toISOString()
    }
    
    console.log(JSON.stringify(result))

    return new Response(
      JSON.stringify(result),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    console.error('Fatal Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
