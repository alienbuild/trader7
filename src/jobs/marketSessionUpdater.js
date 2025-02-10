const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Updates market session timestamps dynamically to ensure accuracy.
async function updateMarketSessions() {
    const updatedSessions = [
        { sessionName: "London", openTime: 1700, closeTime: 2500 },
        { sessionName: "New York", openTime: 2200, closeTime: 0600 },
        { sessionName: "Tokyo", openTime: 0000, closeTime: 0800 }
    ];

    for (const session of updatedSessions) {
        await prisma.marketSession.upsert({
            where: { sessionName: session.sessionName },
            update: { openTime: session.openTime, closeTime: session.closeTime },
            create: session
        });
    }

    console.log("✅ Market Sessions updated.");
}

// Run every 24 hours
setInterval(updateMarketSessions, 24 * 60 * 60 * 1000);
