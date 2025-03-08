FROM node:18-alpine

WORKDIR /app

# Install PostgreSQL client
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Build application
RUN npm run build

# Create wait-for-db script
COPY <<EOF /app/wait-for-db.sh
#!/bin/sh
until pg_isready -h trader7-db -p 5432 -U trader7user
do
  echo "Waiting for database..."
  sleep 2
done
EOF

RUN chmod +x /app/wait-for-db.sh

EXPOSE 4000

# Use shell form to run multiple commands
CMD sh -c './wait-for-db.sh && npx prisma migrate deploy && npm start'
