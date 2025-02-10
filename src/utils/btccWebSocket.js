const WebSocket = require("ws");

const ws = new WebSocket("wss://kapi1.btloginc.com:9082");

ws.on("open", () => {
    console.log("✅ Connected to BTCC WebSocket");
    ws.send(
        JSON.stringify({
            action: "ReqSubcri",
            symbols: ["BTC/USDT"], // Add relevant symbols
            deep: "BTC/USDT",
        })
    );
});

ws.on("message", (data) => {
    const message = JSON.parse(data);
    if (message.action === "tickinfo") {
        console.log("📊 Live Market Data:", message.data);
    }
});

ws.on("error", (err) => console.error("❌ WebSocket Error:", err));

ws.on("close", () => {
    console.log("❌ WebSocket Disconnected. Reconnecting...");
    setTimeout(() => connectToBTCC(), 5000);
});

module.exports = ws;
