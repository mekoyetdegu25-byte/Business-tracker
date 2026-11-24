// js/registry.js

// 🍞 የ Bakery ኮድ ከሌላ ፋይል እያመጣን ነው (በቀጣይ ደረጃ እንሰራዋለን)
import { BakeryModule } from './modules/bakery.js';

// ═══════════════════════════════════════════
// 📦 ሁሉም ዘርፎች እዚህ ይመዘገባሉ
// ═══════════════════════════════════════════
export const MODULES = {
  bakery: BakeryModule,
  
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
