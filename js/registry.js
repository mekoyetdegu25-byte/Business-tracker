// js/registry.js

import { BakeryModule } from './modules/bakery.js';
import { LaundryModule } from './modules/laundry.js';
import { DrinksModule } from './modules/drinks.js';
import { HotelModule } from './modules/hotel.js';
import { PensionModule } from './modules/pension.js';
import { RestaurantModule } from './modules/restaurant.js';
import { SupermarketModule } from './modules/supermarket.js';

// ═══════════════════════════════════════════
// 📦 ሁሉም ዘርፎች እዚህ ይመዘገባሉ
// ═══════════════════════════════════════════
export const MODULES = {
  bakery: BakeryModule,
  laundry: LaundryModule,
  drinks: DrinksModule,
  hotel: HotelModule,
  pension: PensionModule,
  restaurant: RestaurantModule,
  supermarket: SupermarketModule,
  // 🔜 ወደፊት የሚጨመሩ ዘርፎች
  // supermarket: SupermarketModule,
  // retail: RetailModule,
};

// ═══════════════════════════════════════════
// 🎯 የዘርፉን ኮድ መፈለጊያ
// ═══════════════════════════════════════════
export function getModule(businessType) {
  return MODULES[businessType] || null;
}
