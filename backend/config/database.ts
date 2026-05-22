import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const isProduction = env.get('NODE_ENV') === 'production'

const dbConfig = defineConfig({
  connection: 'mysql',
  connections: {
    mysql: {
      client: 'mysql2',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),

        /*
         * Azure Database for MySQL exige une connexion sécurisée.
         * En local, le SSL n'est pas activé afin de garder Docker/MySQL simple.
         */
        ...(isProduction
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
