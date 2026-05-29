# Kiddo - TPI

Application web réalisée dans le cadre du Travail Pratique Individuel (TPI) CFC Informaticien en développement d'applications.

Kiddo permet à des parents de suivre les devoirs et les tâches de leurs enfants dans un cadre familial. L'application gère deux rôles principaux, parent et enfant, avec des droits différents, une logique de preuve, une validation parentale et des règles de cohérence métier.

## 1. Objectif du projet

L'objectif principal de Kiddo est de permettre à une famille de suivre les devoirs ou tâches des enfants depuis une application web.

Un parent peut créer des tâches pour ses enfants, suivre leur avancement, définir les droits d'accès des autres parents et valider ou refuser une preuve envoyée par un enfant.

Un enfant peut consulter les tâches qui lui sont attribuées, envoyer une preuve textuelle lorsqu'il considère qu'une tâche est terminée, et gérer ses propres tâches personnelles selon les règles prévues.

Le projet prend aussi en compte des situations familiales avec plusieurs parents et plusieurs enfants. Les droits d'accès et les validations sont donc contrôlés côté backend afin d'éviter les actions non autorisées et les états incohérents.

## 2. Fonctionnalités principales

### Parent

- Création et connexion à un compte parent.
- Consultation du dashboard parent.
- Création, consultation, modification et suppression logique de tâches.
- Attribution d'une tâche à un enfant.
- Définition des droits des autres parents sur une tâche :
  - aucun accès ;
  - lecture seule ;
  - modification.
- Consultation d'une preuve envoyée par un enfant.
- Validation ou refus d'une preuve.
- Gestion de la famille :
  - consultation des membres ;
  - création directe d'un compte enfant ;
  - invitation d'un utilisateur existant ;
  - retrait d'un membre lorsque les règles métier le permettent.

### Enfant

- Création et connexion à un compte enfant.
- Consultation des tâches attribuées.
- Envoi d'une preuve textuelle lorsqu'une tâche est terminée.
- Création d'une tâche personnelle.
- Définition de la visibilité d'une tâche personnelle pour les parents.
- Modification ou suppression uniquement des tâches créées par l'enfant, si leur état le permet.
- Consultation et réponse aux invitations reçues.

### Cohérence métier

Le backend empêche les états incohérents, notamment :

- modification d'une tâche après validation ;
- décision contradictoire entre deux parents sur une même preuve ;
- action effectuée par un utilisateur qui n'a pas le bon rôle ;
- action effectuée par un parent sans droit d'accès suffisant ;
- modification ou suppression par un enfant d'une tâche qu'il n'a pas créée.

Les conflits métier importants sont traités avec une réponse HTTP `409 Conflict`.

## 3. Stack technique

| Partie                     | Technologie                              |
| -------------------------- | ---------------------------------------- |
| Frontend                   | Vue.js, Vite, Axios, Pinia               |
| Backend                    | AdonisJS, Node.js, TypeScript            |
| Base de données            | MySQL                                    |
| ORM                        | Lucid ORM                                |
| Authentification           | Access tokens AdonisJS                   |
| Hachage des mots de passe  | Argon2id                                 |
| Tests automatisés          | Japa                                     |
| Tests API manuels          | Bruno                                    |
| Environnement local        | Docker, Docker Compose, phpMyAdmin       |
| CI/CD                      | GitHub Actions                           |
| Déploiement frontend       | Azure Static Web Apps                    |
| Déploiement backend        | Azure App Service                        |
| Base de données production | Azure Database for MySQL Flexible Server |

## 4. Structure du projet

```text
Kiddo-TPI/
├── backend/                 API backend AdonisJS
├── frontend/                Interface web Vue.js / Vite
├── database/                Scripts SQL du projet
│   ├── setup_database.sql   Création du schéma, contraintes, index
│   └── init_database.sql    Données initiales de test
├── docs/                    Documentation et annexes éventuelles
├── .github/
│   └── workflows/           Workflows GitHub Actions
├── docker-compose.yml       Base MySQL locale et phpMyAdmin
└── README.md                Documentation technique du projet
```

## 5. Prérequis

Avant de lancer le projet localement, les outils suivants doivent être installés :

- Git ;
- Node.js 24 ou version compatible avec le projet ;
- npm ;
- Docker Desktop ;
- MySQL Workbench ou phpMyAdmin pour vérifier la base de données ;
- Bruno, optionnel, pour tester manuellement les routes API.

## 6. Installation locale

### 6.1 Cloner le dépôt

```bash
git clone https://github.com/NelsonAlmeida5/Kiddo-TPI.git
cd Kiddo-TPI
```

### 6.2 Installer les dépendances backend

```bash
cd backend
npm ci
```

Créer ensuite le fichier `backend/.env` à partir de `backend/.env.example`, puis renseigner les variables nécessaires.

Exemple de configuration locale :

```env
TZ=UTC
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development

APP_KEY=valeur_generee_pour_le_backend

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kiddo_user
DB_PASSWORD=kiddo_password
DB_DATABASE=db_kiddo
```

Si aucune clé d'application n'est encore disponible, elle peut être générée avec AdonisJS :

```bash
node ace generate:key
```

La valeur obtenue doit être placée dans `APP_KEY`.

### 6.3 Installer les dépendances frontend

Depuis la racine du projet :

```bash
cd frontend
npm ci
```

Créer ensuite le fichier `frontend/.env` avec l'URL de l'API locale :

```env
VITE_API_URL=http://localhost:3333
```

## 7. Base de données locale

La base de données locale est exécutée avec Docker.

Depuis la racine du projet :

```bash
docker compose up -d
```

Le projet utilise une base MySQL locale et phpMyAdmin.

Adresses locales habituelles :

| Service           | URL / port              |
| ----------------- | ----------------------- |
| MySQL             | `localhost:3306`        |
| phpMyAdmin        | `http://localhost:8080` |
| Backend AdonisJS  | `http://localhost:3333` |
| Frontend Vue/Vite | `http://localhost:5173` |

### 7.1 Recréer la base de données

Depuis la racine du projet :

```bash
docker compose exec -T mysql mysql -u root -proot < database/setup_database.sql
docker compose exec -T mysql mysql -u root -proot < database/init_database.sql
```

Le fichier `setup_database.sql` crée la structure finale de la base de données : tables, clés primaires, clés étrangères, contraintes de cohérence et index.

Le fichier `init_database.sql` insère des données de test permettant de vérifier rapidement les parcours principaux de l'application.

## 8. Lancement du projet en local

### 8.1 Lancer le backend

```bash
cd backend
npm run dev
```

Le backend est ensuite disponible sur :

```text
http://localhost:3333
```

### 8.2 Lancer le frontend

Dans un deuxième terminal :

```bash
cd frontend
npm run dev
```

Le frontend est ensuite disponible sur :

```text
http://localhost:5173
```

## 9. Tests

### 9.1 Tests automatisés backend

Les tests automatisés sont réalisés avec Japa côté backend.

Depuis le dossier `backend` :

```bash
npm test
```

Le projet contient :

- 10 tests unitaires sur les règles métier principales ;
- 2 tests d'intégration couvrant des scénarios critiques ;
- des scénarios de conflit retournant `HTTP 409 Conflict`.

Les tests couvrent notamment :

- les rôles parent/enfant ;
- les droits d'accès ;
- les transitions de statut ;
- les données invalides ;
- la modification après validation ;
- les décisions contradictoires entre parents.

### 9.2 Vérifications qualité backend

Depuis le dossier `backend` :

```bash
npm run lint
npm run typecheck
npm run build
```

Ces commandes permettent de vérifier le formatage, la qualité du code, le typage et la capacité du backend à être construit.

### 9.3 Build frontend

Depuis le dossier `frontend` :

```bash
npm run build
```

Cette commande vérifie que l'application Vue/Vite peut être construite pour la production.

## 10. CI/CD

Le projet utilise GitHub Actions pour automatiser les vérifications, les tests, le build et le déploiement.

### 10.1 Workflow CI

Le workflow `ci.yml` vérifie le projet automatiquement.

Il effectue notamment :

- l'installation des dépendances ;
- le démarrage d'une base MySQL temporaire ;
- l'exécution de `setup_database.sql` ;
- l'exécution de `init_database.sql` ;
- l'exécution des tests backend Japa ;
- les vérifications de qualité ;
- le build backend ;
- le build frontend.

Les tests CI n'utilisent pas la base Azure de production. Une base MySQL temporaire est créée uniquement pour le workflow.

### 10.2 Workflow de déploiement backend

Le workflow `backend-cd.yml` déploie le backend sur Azure App Service.

Avant le déploiement, il exécute également les tests automatisés. Si un test échoue, le déploiement est arrêté.

Le workflow utilise le secret GitHub suivant :

```text
AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND
```

Ce secret contient le profil de publication Azure App Service. Il ne doit jamais être écrit dans le code source.

### 10.3 Workflow de déploiement frontend

Le frontend est déployé avec le workflow généré par Azure Static Web Apps.

Le workflow construit l'application Vue/Vite et la publie sur Azure Static Web Apps.

La variable suivante est utilisée pendant le build frontend de production :

```text
VITE_API_URL
```

En production, cette variable doit pointer vers l'URL du backend Azure App Service.

## 11. Déploiement Azure

L'application est déployée sur Microsoft Azure.

| Élément         | Service Azure                            |
| --------------- | ---------------------------------------- |
| Frontend        | Azure Static Web Apps                    |
| Backend         | Azure App Service                        |
| Base de données | Azure Database for MySQL Flexible Server |

URL du frontend de production :

```text
https://thankful-coast-0e6224a03.7.azurestaticapps.net/
```

Le backend Azure App Service et la base Azure Database for MySQL peuvent être arrêtés lorsqu'ils ne sont pas utilisés afin de limiter la consommation des ressources Azure. Avant une démonstration complète, il faut vérifier que les deux services sont démarrés.

### 11.1 Variables d'environnement backend en production

Les variables sensibles ne sont pas stockées dans le dépôt GitHub. Elles sont configurées dans Azure App Service.

Variables principales :

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=info
APP_KEY=<secret>
DB_HOST=<serveur_mysql_azure>
DB_PORT=3306
DB_USER=<utilisateur_mysql_azure>
DB_PASSWORD=<secret>
DB_DATABASE=db_kiddo
```

### 11.2 Variable frontend en production

La variable suivante est configurée dans GitHub Actions ou dans Azure Static Web Apps selon le workflow utilisé :

```text
VITE_API_URL=<url_backend_azure>
```

Cette séparation permet d'utiliser une API locale en développement et l'API Azure en production, sans modifier manuellement le code source.

## 12. Sécurité

Plusieurs mesures de sécurité sont appliquées dans le projet :

- hachage des mots de passe avec Argon2id ;
- authentification par access token ;
- protection des routes sensibles côté backend ;
- validation des entrées utilisateur ;
- contrôle des rôles parent/enfant côté backend ;
- contrôle des droits d'accès aux tâches ;
- utilisation de Lucid ORM et de contraintes SQL pour réduire les risques d'injection SQL et d'incohérence ;
- gestion des erreurs sans exposer d'informations sensibles ;
- stockage des secrets dans `.env`, Azure App Service ou GitHub Secrets ;
- exclusion des fichiers `.env` du dépôt Git ;
- communication sécurisée avec Azure MySQL via TLS en production.

Le frontend masque certaines actions selon le rôle ou le statut d'une tâche, mais les protections réelles restent appliquées côté backend.

## 13. Limite connue

L'upload de preuve photo était prévu dans la conception, mais n'a pas été finalisé dans la version livrée.

La preuve textuelle a été priorisée afin de garantir un parcours complet, stable, testé et déployé :

1. l'enfant soumet une preuve textuelle ;
2. la tâche passe en statut `submitted` ;
3. un parent disposant du droit nécessaire valide ou refuse la preuve ;
4. la tâche et la preuve sont mises à jour de manière cohérente.

La structure de la base de données contient cependant les champs nécessaires pour permettre une évolution future vers les preuves photo.

## 14. Dépannage rapide

### Le frontend ne charge pas les données

Vérifier :

- que le backend est démarré ;
- que la base MySQL est démarrée ;
- que `VITE_API_URL` pointe vers la bonne URL ;
- que les variables backend Azure sont correctes ;
- que CORS autorise l'origine frontend.

### Erreur 404 lors d'un refresh sur une route Vue

Vérifier que le fichier suivant existe :

```text
frontend/public/staticwebapp.config.json
```

Ce fichier doit contenir une règle de `navigationFallback` vers `index.html`.

### Erreur de connexion à Azure MySQL

Vérifier :

- les variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` ;
- les règles réseau du serveur Azure MySQL ;
- la configuration TLS dans le backend ;
- l'état du serveur Azure Database for MySQL.

### Les tests CI échouent

Vérifier :

- que `CI_APP_KEY` existe dans les secrets GitHub ;
- que la base MySQL temporaire démarre correctement dans le workflow ;
- que `setup_database.sql` et `init_database.sql` s'exécutent sans erreur ;
- que les tests passent localement avec `npm test`.

## 15. Commandes utiles

Depuis la racine du projet :

```bash
docker compose up -d
docker compose down
```

Réinitialiser la base locale :

```bash
docker compose exec -T mysql mysql -u root -proot < database/setup_database.sql
docker compose exec -T mysql mysql -u root -proot < database/init_database.sql
```

Backend :

```bash
cd backend
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

Frontend :

```bash
cd frontend
npm ci
npm run dev
npm run build
```

## 16. Auteur

Projet réalisé par Nelson Almeida dans le cadre du TPI CFC Informaticien en développement d'applications.

ETML - 2026.
