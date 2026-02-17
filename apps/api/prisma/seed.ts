import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Seed Organization for Demo API Key
  const demoApiKey = "demo-api-key";
  const existingOrg = await prisma.organization.findUnique({
    where: { apiKey: demoApiKey },
  });

  if (!existingOrg) {
    console.log("   -> Creating Demo Organization...");
    await prisma.organization.create({
      data: {
        name: "Deed Shield Demo Org",
        adminEmail: "admin@deedshield.io",
        apiKey: demoApiKey,
      },
    });
  } else {
    console.log("   -> Demo Organization already exists.");
  }

  // 2. Seed Default County Records (Cook County)
  // This ensures that the demo files (which might map to certain parcels) verify correctly.
  const parcels = [
    { parcelId: "PARCEL-777", county: "Cook", state: "IL" }, // Matches "Good" file heuristic in Watcher
    { parcelId: "SCAM-101", county: "Cook", state: "IL" }, // Matches "Bad" file heuristic in Watcher
    { parcelId: "12-34-567-000-0000", county: "Cook", state: "IL" }, // Standard format example
  ];

  for (const p of parcels) {
    const exists = await prisma.countyRecord.findUnique({
      where: { parcelId: p.parcelId },
    });

    if (!exists) {
      console.log(`   -> Seeding CountyRecord for ${p.parcelId}...`);
      await prisma.countyRecord.create({
        data: {
          parcelId: p.parcelId,
          county: p.county,
          state: p.state,
          active: true,
        },
      });
    }
  }

  // 3. Seed demo properties for Owner verification match
  const properties = [{ parcelId: "PARCEL-777", currentOwner: "Alice Smith" }];

  for (const prop of properties) {
    const exists = await prisma.property.findUnique({
      where: { parcelId: prop.parcelId },
    });
    if (!exists) {
      console.log(`   -> Seeding Property for ${prop.parcelId}...`);
      await prisma.property.create({
        data: {
          parcelId: prop.parcelId,
          currentOwner: prop.currentOwner,
          lastSaleDate: new Date("2020-01-01"),
        },
      });
    }
  }

  console.log("✅ Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
