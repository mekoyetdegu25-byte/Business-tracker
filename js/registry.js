// js/registry.js

import { BakeryModule } from './modules/bakery.js';
import { LaundryModule } from './modules/laundry.js';
import { DrinksModule } from './modules/drinks.js';
import { HotelModule } from './modules/hotel.js';
import { PensionModule } from './modules/pension.js';
import { RestaurantModule } from './modules/restaurant.js';
import { SupermarketModule } from './modules/supermarket.js';
import { AppointmentsModule } from './modules/appointments.js';
import { RetailModule } from './modules/retail.js';
import { ClothesModule } from './modules/clothes.js';
import { SalonModule } from './modules/salon.js';
import { ElectronicsModule } from './modules/electronics.js';
import { HardwareModule } from './modules/hardware.js';


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
  appointments: AppointmentsModule,
  clothes: ClothesModule,
  salon: SalonModule,
  electronics: ElectronicsModule,
  hardware: HardwareModule,
  
  //retail: RetailModule, 🔜 ወደፊት የሚጨመሩ ዘርፎች
  // retail: RetailModule,
};

// ═══════════════════════════════════════════
// 🎯 የዘርፉን ኮድ መፈለጊያ
// ═══════════════════════════════════════════
export function getModule(businessType) {
  return MODULES[businessType] || null;
}
