const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Collects historical trade data for AI model training.
async function collectTrainingData() {
    try {
        const response = await axios.get(`${BTCC_API_URL}/v1/user/getTradeReport`, {
            params: { token: process.env.BTCC_API_KEY, sign: process.env.BTCC_API_ENCRYPTION_KEY },
        });

        if (response.data.code === 0) {
            await prisma.tradeHistory.createMany({ data: response.data.list });
            console.log("📊 AI Training Data Collected:", response.data.list);
        }
    } catch (error) {
        console.error("❌ Error collecting training data:", error.message);
    }
}

// Run every 6 hours
setInterval(collectTrainingData, 6 * 60 * 60 * 1000);
