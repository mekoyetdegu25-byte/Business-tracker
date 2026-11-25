// js/registry.js

// 🍞 የ Bakery ኮድ ከሌላ ፋይል እያመጣን ነው (በቀጣይ ደረጃ እንሰራዋለን)
import { BakeryModule } from './modules/bakery.js';
import { LaundryModule } from './modules/laundry.js';
import { DrinksModule } from './modules/drinks.js';
import { HotelModule } from './modules/hotel.js';

// ═══════════════════════════════════════════
// 📦 ሁሉም ዘርፎች እዚህ ይመዘገባሉ
// ═══════════════════════════════════════════
export const MODULES = {
  bakery: BakeryModule,
  laundry: LaundryModule,
  drinks: DrinksModule,
  hotel: HotelModule,
  // 🔜 ወደፊት የሚጨመሩ ዘርፎች (አሁን በ Comment ላይ ናቸው)
  // laundry: LaundryModule,
  // hotel: HotelModule,
  // restaurant: RestaurantModule,
  // supermarket: SupermarketModule,
  // retail: RetailModule,
  // drinks: DrinksModule,
  // pension: PensionModule
};

// ═══════════════════════════════════════════
// 🎯 የዘርፉን ኮድ መፈለጊያ
// ═══════════════════════════════════════════
export function getModule(businessType) {
  return MODULES[businessType] || null;
}
