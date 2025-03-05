# Trader7 - Automated Trading System

Trader7 is an advanced automated trading system that implements multiple trading strategies with a focus on technical analysis, market structure, and liquidity analysis. The system integrates TradingView signals with AI-powered analysis (Grok and DeepSeek) for automated trading on the BTCC exchange.

## 🚀 Features

- AI-enhanced trading decisions using Grok and DeepSeek
- TradingView integration for technical analysis
- Multiple trading strategies implementation
- Real-time market data processing
- Advanced risk management system
- Market structure analysis
- Liquidity detection
- Session-based trading
- Automated trade execution
- Performance tracking
- Multi-channel alert system (Slack, Discord, Telegram)

## 📊 Trading Strategies

### 1. Brinks Box Strategy
- **Timeframe**: 15m
- **Description**: Trades based on Brinks Box breakout and first 15m candle close
- **Entry Conditions**:
  - First 15-minute candle closes above/below Brinks range
  - 50 EMA alignment with breakout direction
  - Vector candle confirmation from TradingView
  - AI sentiment validation
- **Exit Conditions**:
  - Stop loss: Below Brinks Low (longs) or above Brinks High (shorts)
  - Take profit: Dynamic based on AI analysis
  - Trailing stop: Implemented based on volatility

### 2. Market Cycle Levels
- **Timeframe**: 1H
- **Description**: Identifies Level 1, 2, 3 market structure phases
- **AI Enhancement**: DeepSeek analysis for cycle confirmation
- **Levels**:
  - Level 1: New low formation, potential reversal
  - Level 2: Mid push continuation
  - Level 3: Peak formation, possible reversal

### 3. Liquidity Sweeps
- **Description**: Detects fakeouts and liquidity grabs
- **AI Integration**: Grok sentiment analysis for sweep validation
- **Features**:
  - AI-enhanced liquidity zone identification
  - Smart stop hunt detection
  - Order flow monitoring

## 🔄 System Flow

1. **Signal Generation**
   ```
   TradingView (Pine Script) → Webhook → Signal Validation
   ```

2. **AI Analysis**
   ```
   Validated Signal → Grok Analysis → DeepSeek Analysis → Trade Decision
   ```

3. **Risk Management**
   ```
   Trade Decision → Risk Validation → Position Sizing → Execution
   ```

4. **Trade Monitoring**
   ```
   Open Position → Performance Tracking → AI-Enhanced Exit Decisions
   ```

## 🛠 Technical Architecture

### Components
- **Signal Source**: TradingView with custom Pine Script indicators
- **API Layer**: Express.js server with GraphQL
- **AI Layer**: Grok and DeepSeek integration
- **Database**: PostgreSQL with Prisma ORM
- **Trading Engine**: Node.js based execution system
- **Risk Manager**: AI-enhanced position and risk calculation
- **Market Monitor**: Real-time market analysis
- **Alert System**: Multi-channel notification system

### Data Flow
```
TradingView → Webhook → AI Analysis → Risk Check → Trade Execution → Monitoring
```

## ⚙️ Configuration

### Environment Variables
Create a `.env` file with the following structure:
```bash
# Node Environment
NODE_ENV=development
PORT=4000

# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/trader7"

# Exchange API Configuration
BTCC_API_URL=https://api.btcc.com
BTCC_API_KEY=your_api_key
BTCC_API_SECRET=your_api_secret

# AI Service Keys
GROK_API_KEY=your_grok_key
DEEPSEEK_API_KEY=your_deepseek_key

# Alert Configuration
SLACK_WEBHOOK_URL=your_slack_webhook
DISCORD_WEBHOOK_URL=your_discord_webhook
TELEGRAM_BOT_TOKEN=your_telegram_token

# Risk Parameters
MAX_POSITION_SIZE=1000
DEFAULT_LEVERAGE=10
RISK_PERCENTAGE=2
MIN_RISK_REWARD_RATIO=2
```

## 📦 Development

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- TradingView Pro account
- BTCC API access
- Grok API access
- DeepSeek API access

### Local Development Setup
```bash
# Install development dependencies
npm install --include=dev

# Run tests
npm test

# Start development server
npm run dev

# Run linter
npm run lint

# Format code
npm run format
```

### Directory Structure
```
trader7/
├── src/
│   ├── api/           # API endpoints
│   ├── services/      # Business logic
│   ├── models/        # Data models
│   ├── jobs/          # Scheduled tasks
│   └── utils/         # Helper functions
├── prisma/            # Database schema and migrations
├── _contrib/          # Trading indicators and strategies
│   ├── indicator/     # PineScript indicators
│   └── strategy/      # Strategy configurations
├── tests/            # Test suites
└── config/           # Configuration files
```

### Testing
```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 🔄 Version Control

### Branch Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: New features
- `hotfix/*`: Emergency fixes
- `release/*`: Release preparation

### Version Naming
- Following semantic versioning (MAJOR.MINOR.PATCH)
- Example: v1.2.3

## 🚀 Deployment

### Production Deployment
```bash
# Build application
npm run build

# Run database migrations
npx prisma migrate deploy

# Start production server
npm run start:prod
```

### Docker Deployment
```bash
# Build Docker image
docker build -t trader7 .

# Run container
docker run -d \
  --name trader7 \
  -p 4000:4000 \
  --env-file .env \
  trader7
```

## 📊 Performance Metrics

### Trading Metrics
- Win Rate
- Risk/Reward Ratio
- Maximum Drawdown
- Sharpe Ratio
- Average Trade Duration

### System Metrics
- Signal Processing Time
- Trade Execution Latency
- AI Analysis Response Time
- System Uptime
- Error Rate

## 🔍 Troubleshooting

### Common Issues
1. **TradingView Webhook Issues**
   - Verify webhook URL
   - Check alert payload format
   - Confirm API key validity

2. **AI Service Connection**
   - Validate API keys
   - Check rate limits
   - Monitor response times

3. **Trade Execution Failures**
   - Verify exchange API status
   - Check account balance
   - Confirm risk parameters

### Debug Mode
```bash
# Enable debug logging
DEBUG=trader7:* npm start

# Monitor real-time logs
tail -f logs/trader7.log
```

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/yourusername/trader7.git

# Install dependencies
cd trader7
npm install

# Setup database
npx prisma migrate dev

# Import TradingView indicators
Copy indicators from _contrib/indicator/ to TradingView

# Start application
npm start
```

## 🚦 Usage

1. **Configure TradingView Indicators**
   - Import Pine Script indicators from `_contrib/indicator/`
   - Set up alerts with the following payload structure:
   ```json
   {
     "symbol": "BTCUSDT",
     "timestamp": "2024-01-01T12:00:00Z",
     "price": 42000,
     "vector": {
       "type": "W_FORMATION",
       "direction": "LONG",
       "recovered": false
     },
     "technicals": {
       "ema_50": 41950,
       "ema_200": 41800,
       "ema_800": 41600,
       "rsi": 55,
       "adr": 1200
     },
     "session": {
       "current": "LONDON",
       "isActive": true,
       "range": {
         "high": 42100,
         "low": 41900
       }
     }
   }
   ```

2. **Configure Environment**
   - Set up all required API keys
   - Configure risk parameters
   - Set trading session times
   - Configure AI service parameters

3. **Initialize Database**
   ```bash
   npx prisma db seed
   ```

4. **Start Trading System**
   ```bash
   npm run start:prod
   ```

5. **Monitor System**
   - Check logs at `logs/trader7.log`
   - Monitor alerts in configured channels
   - Track performance in dashboard

## 📊 Risk Management

- **Position Sizing**
  - Maximum position size: Configurable per strategy
  - Risk per trade: 2% default
  - Leverage limits: Up to 100x
  - Dynamic sizing based on AI analysis

- **Stop Loss**
  - Hard stop loss required for all trades
  - Trailing stops based on volatility
  - AI-enhanced stop loss placement

- **Take Profit**
  - Dynamic based on market conditions
  - Multiple take profit levels
  - Partial position closing

## 🔍 Monitoring

- **Trade Monitoring**
  - Real-time position tracking
  - P&L calculation
  - Risk exposure metrics

- **Performance Analytics**
  - Win rate calculation
  - Risk-adjusted returns
  - Strategy performance breakdown
  - AI prediction accuracy

- **System Health**
  - Service uptime monitoring
  - API rate limit tracking
  - Error rate monitoring
  - Database performance

## 🚨 Alert System

### Channels
- Slack
- Discord
- Telegram

### Alert Types
1. **Trade Alerts**
   - Entry signals
   - Exit signals
   - Position updates
   - P&L reports

2. **Risk Alerts**
   - Exposure warnings
   - Drawdown alerts
   - Leverage warnings
   - Position size limits

3. **System Alerts**
   - Service status
   - Error notifications
   - Rate limit warnings
   - Database alerts

## 📝 Logging

### Transaction Logs
- Trade entries/exits
- Position modifications
- Risk adjustments
- P&L updates

### System Logs
- Error tracking
- Performance metrics
- API calls
- AI analysis results

### Audit Logs
- Configuration changes
- User actions
- System state changes
- Security events

## 🛡 Security

- **API Security**
  - Key encryption
  - Rate limiting
  - IP whitelisting
  - Request signing

- **Access Control**
  - Role-based access
  - Action audit logging
  - Session management
  - 2FA for critical operations

- **Data Security**
  - Database encryption
  - Secure configurations
  - Regular backups
  - Data retention policies

## 🔧 Maintenance

### Regular Tasks
1. Update TradingView indicators
2. Monitor AI service performance
3. Review system logs
4. Backup database
5. Update API keys

### Performance Optimization
1. Review trade execution times
2. Optimize database queries
3. Monitor memory usage
4. Analyze API response times

## 📈 Scaling

- Horizontal scaling capability
- Multi-exchange support ready
- Additional strategy integration
- AI model expansion

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

Trading cryptocurrencies carries significant risks:

- This software is for educational purposes only
- Past performance does not guarantee future results
- Only trade with funds you can afford to lose
- Always conduct your own research and risk assessment
- The creators and contributors are not responsible for any financial losses

## 📞 Support

For support and inquiries:
- GitHub Issues
- Discord Community
- Documentation Wiki
- Email: support@trader7.com

## 🙏 Acknowledgments

- TradingView for signal generation
- Grok and DeepSeek for AI capabilities
- BTCC exchange for execution infrastructure
- Open source community contributors

---

Last updated: 2024
