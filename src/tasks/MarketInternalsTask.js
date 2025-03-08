const cron = require('node-cron');
const MarketInternalsService = require('../services/MarketInternalsService');
const MarketMonitor = require('../services/MarketMonitor');
const logger = require('../utils/logger');
const { WebClient } = require('@slack/web-api');
// const { Client } = require('discord.js');
// const { TelegramClient } = require('telegram');

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
// const discordClient = new Client({ intents: ['SendMessages', 'MessageContent'] });
// const telegramClient = new TelegramClient(process.env.TELEGRAM_API_ID, process.env.TELEGRAM_API_HASH, {
//     connectionRetries: 5
// });

class MarketInternalsTask {
    static init() {
        // Update market internals every minute during trading hours
        cron.schedule('* 9-16 * * 1-5', async () => {
            try {
                await this.updateMarketInternals();
            } catch (error) {
                logger.error(`Market internals update failed: ${error.message}`);
            }
        });

        // Update thresholds daily after market close
        cron.schedule('0 17 * * 1-5', async () => {
            try {
                await MarketMonitor.updateMarketInternalsThresholds();
            } catch (error) {
                logger.error(`Market internals threshold update failed: ${error.message}`);
            }
        });
    }

    static async updateMarketInternals() {
        try {
            const data = await this.fetchMarketInternalsData();
            await MarketInternalsService.saveMarketInternals(data);
            
            // Trigger alerts if necessary
            const analysis = await MarketInternalsService.getMarketInternalsAnalysis();
            await this.checkMarketInternalsAlerts(analysis);

        } catch (error) {
            logger.error(`Failed to update market internals: ${error.message}`);
            throw error;
        }
    }

    static async checkMarketInternalsAlerts(analysis) {
        const score = analysis.overallScore;
        const sentiment = analysis.marketSentiment;

        // Alert conditions
        const alertConditions = {
            extremeBullish: score > 80 && sentiment === 'strongly_bullish',
            extremeBearish: score < 20 && sentiment === 'strongly_bearish',
            rapidChange: await this._checkRapidChange(analysis),
            divergence: await this._checkDivergence(analysis)
        };

        if (Object.values(alertConditions).some(condition => condition)) {
            await this._sendMarketInternalsAlert(analysis, alertConditions);
        }
    }

    static async _checkRapidChange(analysis) {
        try {
            const history = await MarketInternalsService.getMarketInternalsHistory('1h');
            if (history.length < 2) return false;

            const previousScore = await MarketInternalsService.calculateMarketInternalsScore(history[history.length - 2]);
            const currentScore = analysis.overallScore;

            return Math.abs(currentScore - previousScore) > 20;
        } catch (error) {
            logger.error(`Failed to check rapid change: ${error.message}`);
            return false;
        }
    }

    static async _checkDivergence(analysis) {
        const { indicators } = analysis;

        // Check for divergence between indicators
        const bullishIndicators = Object.values(indicators).filter(i => i.status === 'bullish').length;
        const bearishIndicators = Object.values(indicators).filter(i => i.status === 'bearish').length;

        return (bullishIndicators >= 2 && bearishIndicators >= 2);
    }

    static async _sendMarketInternalsAlert(analysis, conditions) {
        try {
            const alertPayload = {
                timestamp: new Date(),
                type: 'MARKET_INTERNALS_ALERT',
                score: analysis.overallScore,
                sentiment: analysis.marketSentiment,
                conditions: conditions,
                indicators: analysis.indicators,
                message: this._generateAlertMessage(analysis, conditions)
            };

            // Send to alert channels
            await Promise.all([
                this._sendSlackAlert(alertPayload),
                // this._sendDiscordAlert(alertPayload),
                // this._sendTelegramAlert(alertPayload)
            ]);

        } catch (error) {
            logger.error(`Failed to send market internals alert: ${error.message}`);
        }
    }

    static _generateAlertMessage(analysis, conditions) {
        const messages = [];

        if (conditions.extremeBullish) {
            messages.push('🚀 Extreme Bullish Market Internals');
        }
        if (conditions.extremeBearish) {
            messages.push('🔻 Extreme Bearish Market Internals');
        }
        if (conditions.rapidChange) {
            messages.push('⚠️ Rapid Change in Market Internals');
        }
        if (conditions.divergence) {
            messages.push('↔️ Market Internals Divergence Detected');
        }

        return `
${messages.join('\n')}

Score: ${analysis.overallScore.toFixed(2)}
Sentiment: ${analysis.marketSentiment}

Indicators:
TICK: ${analysis.indicators.tick.value} (${analysis.indicators.tick.status})
ADD: ${analysis.indicators.add.value} (${analysis.indicators.add.status})
TRIN: ${analysis.indicators.trin.value} (${analysis.indicators.trin.status})
VIX: ${analysis.indicators.vix.value} (${analysis.indicators.vix.status})
        `.trim();
    }

    static async fetchMarketInternalsData() {
        // Implementation would depend on your data source
        // This could be an API call to your market data provider
        throw new Error('fetchMarketInternalsData must be implemented');
    }

    static async _sendSlackAlert(alertPayload) {
        try {
            const slackMessage = {
                channel: process.env.SLACK_MARKET_INTERNALS_CHANNEL,
                text: alertPayload.message,
                attachments: [{
                    color: this._getAlertColor(alertPayload.score),
                    fields: [
                        {
                            title: 'Market Internals Score',
                            value: alertPayload.score.toFixed(2),
                            short: true
                        },
                        {
                            title: 'Market Sentiment',
                            value: alertPayload.sentiment,
                            short: true
                        },
                        {
                            title: 'Alert Conditions',
                            value: Object.entries(alertPayload.conditions)
                                .filter(([_, value]) => value)
                                .map(([key]) => key)
                                .join(', '),
                            short: false
                        }
                    ]
                }]
            };

            await slackClient.chat.postMessage(slackMessage);
        } catch (error) {
            logger.error(`Failed to send Slack alert: ${error.message}`);
        }
    }

    static async _sendDiscordAlert(alertPayload) {
        try {
            const discordEmbed = {
                title: '📊 Market Internals Alert',
                description: alertPayload.message,
                color: this._getDiscordColor(alertPayload.score),
                fields: [
                    {
                        name: 'Score',
                        value: alertPayload.score.toFixed(2),
                        inline: true
                    },
                    {
                        name: 'Sentiment',
                        value: alertPayload.sentiment,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            await discordClient.send(process.env.DISCORD_MARKET_INTERNALS_CHANNEL, { embeds: [discordEmbed] });
        } catch (error) {
            logger.error(`Failed to send Discord alert: ${error.message}`);
        }
    }

    static async _sendTelegramAlert(alertPayload) {
        try {
            const message = `
🔔 *Market Internals Alert*

${alertPayload.message}

*Technical Details:*
• Score: \`${alertPayload.score.toFixed(2)}\`
• Sentiment: \`${alertPayload.sentiment}\`
• Time: \`${new Date().toISOString()}\`
            `.trim();

            await telegramClient.sendMessage(process.env.TELEGRAM_MARKET_INTERNALS_CHANNEL, message, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            logger.error(`Failed to send Telegram alert: ${error.message}`);
        }
    }

    static _getAlertColor(score) {
        if (score >= 80) return '#00FF00';      // Strong bullish - Green
        if (score >= 60) return '#90EE90';      // Bullish - Light green
        if (score >= 40) return '#FFD700';      // Neutral - Yellow
        if (score >= 20) return '#FFA07A';      // Bearish - Light red
        return '#FF0000';                       // Strong bearish - Red
    }

    static _getDiscordColor(score) {
        if (score >= 80) return 0x00FF00;       // Strong bullish - Green
        if (score >= 60) return 0x90EE90;       // Bullish - Light green
        if (score >= 40) return 0xFFD700;       // Neutral - Yellow
        if (score >= 20) return 0xFFA07A;       // Bearish - Light red
        return 0xFF0000;                        // Strong bearish - Red
    }
}

module.exports = MarketInternalsTask;