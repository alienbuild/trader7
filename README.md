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

## �� Troubleshooting

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

## �� Docker Setup

### PostgreSQL Database
```bash
# Create a Docker network for the application
docker network create trader7-network

# Start PostgreSQL container
docker run -d \
  --name trader7-db \
  --network trader7-network \
  -e POSTGRES_DB=trader7 \
  -e POSTGRES_USER=trader7user \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  postgres:13-alpine

# Verify database is running
docker logs trader7-db
```

### Environment Configuration
Update your `.env` file with the following database connection:
```bash
DATABASE_URL="postgresql://trader7user:yourpassword@trader7-db:5432/trader7"
```

For local development without Docker, use:
```bash
DATABASE_URL="postgresql://trader7user:yourpassword@localhost:5432/trader7"
```

## 📊 TradingView Setup

### Adding the Indicator

1. **Import the Indicator**
   ```
   1. Open TradingView Chart
   2. Click "Pine Editor" at the bottom of the screen
   3. Click "Open" (folder icon)
   4. Copy and paste the content from _contrib/trader7_indicator.pine
   5. Click "Add to Chart"
   ```

2. **Configure Indicator Settings**
   ```
   1. Click the indicator settings (gear icon)
   2. Set your webhook URL: https://your-api-endpoint.com/webhook
   3. Adjust other parameters as needed:
      - Number of Historical Bars (default: 50)
      - ATR Period (default: 14)
      - Volume MA Period (default: 20)
   ```

### Setting Up Alerts

1. **Create New Alert**
   ```
   1. Right-click on the chart
   2. Select "Create Alert"
   3. Choose "trader7_indicator" as the source
   ```

2. **Configure Alert Settings**
   ```
   1. Set Alert name: "Trader7 Signal"
   2. Condition: "trader7_indicator"
   3. Options:
      - Once Per Bar Close
      - Show Popup: Optional
      - Send Email: Optional
      - Play Sound: Optional
   ```

3. **Configure Webhook**
   ```
   1. Enable "Webhook URL"
   2. Use your deployment URL + /webhook
      Example: https://your-domain.com/api/webhook
   3. Set the following JSON payload:
   ```
   ```json
   {
     "symbol": "{{ticker}}",
     "timestamp": "{{time}}",
     "price": {{close}},
     "vector": {
       "type": "{{strategy.order.alert_message}}",
       "direction": "{{strategy.order.action}}",
       "recovered": false
     },
     "technicals": {
       "ema_50": {{plot("EMA50")}},
       "ema_200": {{plot("EMA200")}},
       "ema_800": {{plot("EMA800")}},
       "rsi": {{plot("RSI")}},
       "adr": {{plot("ADR")}}
     },
     "session": {
       "current": "{{session}}",
       "isActive": {{session.ismarket}},
       "range": {
         "high": {{session.high}},
         "low": {{session.low}}
       }
     }
   }
   ```

### Alert Conditions

1. **Long Entry Alert**
   - First green vector candle above 50 EMA
   - Volume spike confirmation
   - RSI not overbought (<70)
   - EMA fan-out confirmation

2. **Short Entry Alert**
   - First red vector candle below 50 EMA
   - Volume spike confirmation
   - RSI not oversold (>30)
   - EMA fan-out confirmation

3. **Exit Alerts**
   - Take Profit hit
   - Stop Loss hit
   - Pattern invalidation

### Testing Alerts

1. **Local Testing**
   ```bash
   # Start your local server
   npm run dev

   # Use curl to test webhook
   curl -X POST http://localhost:4000/api/webhook \
     -H "Content-Type: application/json" \
     -d '{
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
     }'
   ```

## 📈 Supported Markets

### Crypto Markets
- **BTC/USDT**
  - Exchange: BTCC
  - Leverage: Up to 100x
  - Trading Hours: 24/7
  - Min Position Size: 0.001 BTC

- **ETH/USDT**
  - Exchange: BTCC
  - Leverage: Up to 50x
  - Trading Hours: 24/7
  - Min Position Size: 0.01 ETH

### Index Markets
- **NASDAQ (US100)**
  - Exchange: BTCC-I
  - Symbol: NAS100USDT
  - Leverage: Up to 20x
  - Trading Hours: 
    - Regular: Mon-Fri 09:30-16:00 EST
    - Pre-market: 04:00-09:30 EST
    - After-hours: 16:00-20:00 EST
  - Min Position Size: 0.1 lot

## ⚙️ Market-Specific Configurations

### Trading Sessions
```json
{
  "crypto": {
    "trading_hours": "24/7",
    "maintenance_windows": ["Saturday 00:00-02:00 UTC"]
  },
  "nasdaq": {
    "pre_market": {
      "start": "04:00",
      "end": "09:30",
      "timezone": "America/New_York"
    },
    "regular": {
      "start": "09:30",
      "end": "16:00",
      "timezone": "America/New_York"
    },
    "after_hours": {
      "start": "16:00",
      "end": "20:00",
      "timezone": "America/New_York"
    }
  }
}
```

### Risk Parameters
```json
{
  "btc": {
    "max_position_size": "1000 USDT",
    "max_leverage": 100,
    "default_leverage": 10
  },
  "eth": {
    "max_position_size": "500 USDT",
    "max_leverage": 50,
    "default_leverage": 5
  },
  "nasdaq": {
    "max_position_size": "200 USDT",
    "max_leverage": 20,
    "default_leverage": 5,
    "session_rules": {
      "pre_market": {
        "position_size_multiplier": 0.5,
        "leverage_cap": 10
      },
      "after_hours": {
        "position_size_multiplier": 0.5,
        "leverage_cap": 10
      }
    }
  }
}
```
