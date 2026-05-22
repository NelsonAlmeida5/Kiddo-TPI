import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbHost = env.get('DB_HOST')
const isAzureMySql = dbHost.includes('mysql.database.azure.com')
const isProduction = env.get('NODE_ENV') === 'production'
const useSsl = isAzureMySql || isProduction

const dbConfig = defineConfig({
  connection: 'mysql',
  connections: {
    mysql: {
      client: 'mysql2',
      connection: {
        host: dbHost,
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),

        /*
         * Azure Database for MySQL exige une connexion sécurisée.
         * En local Docker, SSL reste désactivé.
         */
        ...(useSsl
          ? {
              ssl: {
                minVersion: 'TLSv1.2',
              },
            }
          : {}),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
