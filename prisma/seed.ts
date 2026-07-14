import { PrismaClient, OperatorRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ── Dati venue ───────────────────────────────────────────────────────────────

// Refund blocked windows per venue
// day: 0=Sunday, 1=Monday, ..., 6=Saturday
// Times span midnight: e.g. Fri 22:00 → Sat 06:00 means day=5 (Fri) 22:00-06:00
type RefundWindow = { day: number; startHour: number; startMin: number; endHour: number; endMin: number };

const VENUE_REFUND_WINDOWS: Record<string, RefundWindow[]> = {
  "studios-deco": [
    // Thu–Sun 22:00–06:00
    { day: 4, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Thu
    { day: 5, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Fri
    { day: 6, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Sat
    { day: 0, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }, // Sun
  ],
  "casa-dei-gelsi": [
    { day: 5, startHour: 19, startMin: 0, endHour: 2, endMin: 0 }, // Fri
    { day: 6, startHour: 19, startMin: 0, endHour: 2, endMin: 0 }, // Sat
  ],
  "villa-peggy": [
    { day: 5, startHour: 19, startMin: 0, endHour: 2, endMin: 0 }, // Fri
    { day: 6, startHour: 19, startMin: 0, endHour: 2, endMin: 0 }, // Sat
  ],
};

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

// Prima organizzazione della piattaforma (stesso id fisso usato dalla
// migration organization_layer: l'upsert è idempotente su entrambe le strade)
const ORGANIZATION_ID = "org_pegoraro";
const ORGANIZATION_NAME = "Gruppo Pegoraro";

// Admin di organizzazione di test (ORG_ADMIN: vede solo la propria org)
const ORG_ADMIN_EMAIL = "orgadmin-demo@example.com";
const ORG_ADMIN_NAME = "Org Admin Demo";

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

  // ── Organization ──────────────────────────────────────────────────────────
  const organization = await db.organization.upsert({
    where: { id: ORGANIZATION_ID },
    update: { name: ORGANIZATION_NAME, active: true },
    create: {
      id: ORGANIZATION_ID,
      name: ORGANIZATION_NAME,
      feePercent: 0,
      active: true,
    },
  });

  // ── Venue + PriceTier + Operatori ─────────────────────────────────────────
  for (const venueData of VENUES) {
    const windows = VENUE_REFUND_WINDOWS[venueData.slug] ?? null;

    // Venue
    const venue = await db.venue.upsert({
      where: { slug: venueData.slug },
      update: {
        name: venueData.name,
        organizationId: organization.id,
        active: true,
        refundBlockedWindows: windows ?? undefined,
        refundBlockedTimezone: "Europe/Rome",
      },
      create: {
        name: venueData.name,
        slug: venueData.slug,
        organizationId: organization.id,
        active: true,
        refundBlockedWindows: windows ?? undefined,
        refundBlockedTimezone: "Europe/Rome",
      },
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
    const managerEmail = `manager-${venueData.slug}@example.com`;
    if (existingManager) {
      await db.operator.update({
        where: { id: existingManager.id },
        data: { role: OperatorRole.MANAGER, active: true, email: managerEmail },
      });
    } else {
      await db.operator.create({
        data: {
          venueId: venue.id,
          name: "Manager Demo",
          email: managerEmail,
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
    // Garantisce che il super-admin storico resti admin di piattaforma
    if (existingAdmin.role !== "PLATFORM" || existingAdmin.organizationId !== null) {
      await db.adminUser.update({
        where: { id: existingAdmin.id },
        data: { role: "PLATFORM", organizationId: null },
      });
    }

    // Reset password di emergenza: se SUPER_ADMIN_RESET_PASSWORD è impostata
    // (min 12 caratteri), la password del super-admin viene reimpostata a quel
    // valore. RIMUOVERE la variabile dopo il login, altrimenti ogni deploy la
    // reimposta di nuovo.
    const resetPassword = process.env["SUPER_ADMIN_RESET_PASSWORD"];
    if (resetPassword && resetPassword.length >= 12) {
      await db.adminUser.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash: await bcrypt.hash(resetPassword, 10),
          mustChangePassword: true,
        },
      });
      console.log(
        "\n🔐 Password super-admin REIMPOSTATA dal valore di SUPER_ADMIN_RESET_PASSWORD." +
          "\n   Rimuovi subito la variabile d'ambiente dopo il primo login."
      );
    } else if (resetPassword) {
      console.log(
        "\n⚠️  SUPER_ADMIN_RESET_PASSWORD ignorata: deve avere almeno 12 caratteri."
      );
    }

    console.log(
      `\nℹ️  Super-admin già presente: ${SUPER_ADMIN_EMAIL} (role PLATFORM)`
    );
  } else {
    const tempPassword = generatePassword(16);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.adminUser.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_NAME,
        passwordHash,
        role: "PLATFORM",
        organizationId: null,
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

  // ── Admin di organizzazione (ORG_ADMIN di test) ───────────────────────────
  const existingOrgAdmin = await db.adminUser.findUnique({
    where: { email: ORG_ADMIN_EMAIL },
  });

  if (existingOrgAdmin) {
    if (
      existingOrgAdmin.role !== "ORG_ADMIN" ||
      existingOrgAdmin.organizationId !== organization.id
    ) {
      await db.adminUser.update({
        where: { id: existingOrgAdmin.id },
        data: { role: "ORG_ADMIN", organizationId: organization.id },
      });
    }
    console.log(`ℹ️  Org-admin di test già presente: ${ORG_ADMIN_EMAIL} (password invariata)`);
  } else {
    const orgAdminPassword = generatePassword(16);
    const orgAdminHash = await bcrypt.hash(orgAdminPassword, 10);
    await db.adminUser.create({
      data: {
        email: ORG_ADMIN_EMAIL,
        name: ORG_ADMIN_NAME,
        passwordHash: orgAdminHash,
        role: "ORG_ADMIN",
        organizationId: organization.id,
        totpEnabled: false,
        mustChangePassword: true,
        active: true,
      },
    });
    console.log(`
👤 Org-admin di test creato: ${ORG_ADMIN_EMAIL} (org: ${ORGANIZATION_NAME})
🔐 Password temporanea: ${orgAdminPassword}
   Cambiala al primo login.`);
  }

  if (!adminCreated) {
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
