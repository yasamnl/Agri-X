// src/app/api/market-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMarketPrices, getPriceHistory } from '@/lib/market-prices';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const commodityId = searchParams.get('commodityId');
    
    // ✅ If commodityId provided, return price history
    if (commodityId) {
      const history = await getPriceHistory(commodityId);
      
      return NextResponse.json({
        success: true,
        data: {
          history,
          commodityId,
        },
      });
    }
    
    // ✅ Otherwise, return all market prices
    const result = await getMarketPrices();
    
    return NextResponse.json({
      success: true,
      data: result.prices,
      cached: result.cached,
      lastUpdate: result.lastUpdate,
      source: result.source,
    });

  } catch (error: any) {
    console.error('❌ Market prices API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Server error' 
      },
      { status: 500 }
    );
  }
}