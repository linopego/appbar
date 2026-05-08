import { PrismaClient, OperatorRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ── Dati venue ───────────────────────────────────────────────────────────────

const VENUES = [
  { name: "La Casa dei Gelsi", slug: "casa-dei-gelsi" },
  { name: "Studios Club – DECÒ", slug: "studios-deco" },
  { name: "Tenuta Villa Peggy's", slug: "villa-peggy" },
] as const;

const PRICE_TIERS = [
  { name: "Acqua", price: "3.00", sortOrder: 10 },
  { name: "Analcolico", price: "5.00", sortOrder: 20 },
  { name: "Birra", price: "6.00", sortOrder: 30 },
  { name: "Red Bull", price: "6.00", sortOrder: 40 },
  { name: "Drink", price: "10.00", sortOrder: 50 },
  { name: "Drink Premium", price: "12.00", sortOrder: 60 },
] as const;

const SUPER_ADMIN_EMAIL = "linopegoraro.dir@gmail.com";
const SUPER_ADMIN_NAME = "Lino Pegoraro";

// ── Utility ───────────────────────────────────────────────────────────────────

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let venueCount = 0;
  let priceTierCount = 0;
  let operatorCount = 0;
  let adminCreated = false;

  const [managerPinHash, baristaaPinHash] = await Promise.all([
    bcrypt.hash("1234", 10),
    bcrypt.hash("5678", 10),
  ]);

  // ── Venue + PriceTier + Operatori ─────────────────────────────────────────
  for (const venueData of VENUES) {
    // Venue
    const venue = await db.venue.upsert({
      where: { slug: venueData.slug },
      update: { name: venueData.name, active: true },
      create: { name: venueData.name, slug: venueData.slug, active: true },
    });
    venueCount++;

    // PriceTier
    for (const tier of PRICE_TIERS) {
      await db.priceTier.upsert({
        where: { venueId_name: { venueId: venue.id, name: tier.name } },
        update: { price: tier.price, sortOrder: tier.sortOrder, active: true },
        create: {
          venueId: venue.id,
          name: tier.name,
          price: tier.price,
          sortOrder: tier.sortOrder,
          active: true,
        },
      });
      priceTierCount++;
    }

    // Operatore MANAGER
    const existingManager = await db.operator.findFirst({
      where: { venueId: venue.id, name: "Manager Demo" },
    });
    if (existingManager) {
      await db.operator.update({
        where: { id: existingManager.id },
        data: { role: OperatorRole.MANAGER, active: true },
      });
    } else {
      await db.operator.create({
        data: {
          venueId: venue.id,
          name: "Manager Demo",
          pinHash: managerPinHash,
          role: OperatorRole.MANAGER,
          active: true,
        },
      });
    }
    operatorCount++;

    // Operatore BARISTA
    const existingBarista = await db.operator.findFirst({
      where: { venueId: venue.id, name: "Barista Demo" },
    });
    if (existingBarista) {
      await db.operator.update({
        where: { id: existingBarista.id },
        data: { role: OperatorRole.BARISTA, active: true },
      });
    } else {
      await db.operator.create({
        data: {
          venueId: venue.id,
          name: "Barista Demo",
          pinHash: baristaaPinHash,
          role: OperatorRole.BARISTA,
          active: true,
        },
      });
    }
    operatorCount++;
  }

  // ── Super-admin ───────────────────────────────────────────────────────────
  const existingAdmin = await db.adminUser.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existingAdmin) {
    // Non sovrascrivere il passwordHash se l'admin esiste già
    console.log(
      `\nℹ️  Super-admin già presente: ${SUPER_ADMIN_EMAIL} (password invariata)`
    );
  } else {
    const tempPassword = generatePassword(16);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.adminUser.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_NAME,
        passwordHash,
        totpEnabled: false,
        mustChangePassword: true,
        active: true,
      },
    });
    adminCreated = true;

    console.log(`
✅ Seed completato:
  - ${venueCount} venue
  - ${priceTierCount} fasce di prezzo (${priceTierCount / venueCount} per venue)
  - ${operatorCount} operatori (${operatorCount / venueCount} per venue)
  - 1 super-admin: ${SUPER_ADMIN_EMAIL}
🔐 Password super-admin temporanea: ${tempPassword}
   Cambiala al primo login.`);
  }

  if (!adminCreated) {
    // Print riepilogo senza mostrare password (già esistente)
    console.log(`
✅ Seed completato:
  - ${venueCount} venue
  - ${priceTierCount} fasce di prezzo (${priceTierCount / venueCount} per venue)
  - ${operatorCount} operatori (${operatorCount / venueCount} per venue)
  - 1 super-admin: ${SUPER_ADMIN_EMAIL}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
