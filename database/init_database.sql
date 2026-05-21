-- ============================================================
-- init_database.sql
-- Projet : Kiddo - TPI
-- Rôle : insertion de données fictives pour les tests locaux.
--
-- Ce script :
-- - vide les données métier existantes ;
-- - conserve la structure de la base ;
-- - insère des familles, utilisateurs, tâches, preuves,
--   invitations et droits d'accès cohérents.
--
-- Attention :
-- Ce script est prévu pour l'environnement de développement local.
-- Tous les utilisateurs de test utilisent le mot de passe :
-- Password123!
-- ============================================================

USE db_kiddo;

-- ============================================================
-- 1. Nettoyage des données existantes
-- ------------------------------------------------------------
-- Les contraintes FK sont désactivées temporairement afin de pouvoir
-- vider les tables dans un ordre simple, notamment à cause des
-- relations circulaires entre t_user et t_family.
--
-- La table auth_access_tokens existe uniquement si la base a été créée
-- via les migrations AdonisJS. Le bloc dynamique permet donc de la vider
-- seulement si elle existe.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

SET @table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'auth_access_tokens'
);

SET @sql = IF(
  @table_exists > 0,
  'TRUNCATE TABLE auth_access_tokens',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

TRUNCATE TABLE t_task_access;
TRUNCATE TABLE t_proof;
TRUNCATE TABLE t_invitation;
TRUNCATE TABLE t_task;
TRUNCATE TABLE t_user;
TRUNCATE TABLE t_family;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 2. Familles
-- ------------------------------------------------------------
-- Les familles sont créées avant les utilisateurs.
-- owner_user_id est renseigné ensuite avec UPDATE afin de respecter
-- la dépendance circulaire entre t_family et t_user.
-- ============================================================

INSERT INTO t_family (
  family_id,
  owner_user_id,
  name,
  status,
  created_at,
  updated_at
) VALUES
  (1, NULL, 'Famille Nelson Almeida', 'active', '2026-05-20 08:00:00', NULL),
  (2, NULL, 'Famille Jeanne Dupont', 'archived', '2026-05-20 08:05:00', '2026-05-20 09:00:00'),
  (3, NULL, 'Famille Lucas Almeida', 'archived', '2026-05-20 08:10:00', '2026-05-20 09:10:00'),
  (4, NULL, 'Famille Emma Almeida', 'archived', '2026-05-20 08:15:00', '2026-05-20 09:15:00'),
  (5, NULL, 'Famille Marie Martin', 'active', '2026-05-20 08:20:00', NULL);


-- ============================================================
-- 3. Utilisateurs
-- ------------------------------------------------------------
-- Mot de passe pour tous les comptes :
-- Password123!
--
-- Les hashes sont au format Argon2id, compatible avec la configuration
-- backend AdonisJS.
-- ============================================================

INSERT INTO t_user (
  user_id,
  username,
  password_hash,
  name,
  role,
  created_at,
  updated_at,
  current_family_fk
) VALUES
  (
    1,
    'nelson',
    '$argon2id$v=19$m=65536,t=3,p=4$dUFzauyHQxvXLfsHRA1xaA$83gwrm/01mQUfC+Q0qI2pFEKeHMHo8QPglroQXjU2/Q',
    'Nelson Almeida',
    'parent',
    '2026-05-20 08:30:00',
    NULL,
    1
  ),
  (
    2,
    'jeanne',
    '$argon2id$v=19$m=65536,t=3,p=4$i1NQqwUtETuOBuovkImpmQ$4PQ+3RXCgaM7MpqpV9XiDNQ5YP4W37gW1ufnQ7PYDkk',
    'Jeanne Dupont',
    'parent',
    '2026-05-20 08:35:00',
    '2026-05-20 09:00:00',
    1
  ),
  (
    3,
    'lucas',
    '$argon2id$v=19$m=65536,t=3,p=4$JShdGt1XbcKATcjQYCflxA$c/lZbnSfWdo4YKAjbFxMSpQxX4AkecABxkitjH4cbAw',
    'Lucas Almeida',
    'child',
    '2026-05-20 08:40:00',
    NULL,
    1
  ),
  (
    4,
    'emma',
    '$argon2id$v=19$m=65536,t=3,p=4$gbPNyK7IPXMGpcF/Tkh9lg$3cBnJfb/8gnnXmKieQ2oTxXh5WZfTmvldU4auXspCpk',
    'Emma Almeida',
    'child',
    '2026-05-20 08:45:00',
    NULL,
    1
  ),
  (
    5,
    'marie',
    '$argon2id$v=19$m=65536,t=3,p=4$aLtOj/H4Pk4UkQFxcrIJsA$SgdWTx0ZRzso4BLcmTcnHVW1NbBLa9rK4+/XAf4z2fA',
    'Marie Martin',
    'parent',
    '2026-05-20 08:50:00',
    NULL,
    5
  );


-- ============================================================
-- 4. Rattachement des propriétaires aux familles personnelles
-- ============================================================

UPDATE t_family SET owner_user_id = 1 WHERE family_id = 1;
UPDATE t_family SET owner_user_id = 2 WHERE family_id = 2;
UPDATE t_family SET owner_user_id = 3 WHERE family_id = 3;
UPDATE t_family SET owner_user_id = 4 WHERE family_id = 4;
UPDATE t_family SET owner_user_id = 5 WHERE family_id = 5;


-- ============================================================
-- 5. Tâches
-- ------------------------------------------------------------
-- Statuts utilisés :
-- todo       : tâche à faire
-- submitted  : preuve envoyée, en attente de décision parent
-- validated  : preuve validée
-- refused    : preuve refusée
--
-- version :
-- - commence à 1 ;
-- - augmente lors des modifications ou décisions importantes.
-- ============================================================

INSERT INTO t_task (
  task_id,
  title,
  description,
  due_date,
  status,
  version,
  created_at,
  updated_at,
  deleted_at,
  assigned_child_fk,
  created_by_fk,
  family_fk
) VALUES
  (
    1,
    'Lire le chapitre 3',
    'Lire le chapitre 3 du livre de français.',
    '2026-05-25 18:00:00',
    'todo',
    1,
    '2026-05-20 09:00:00',
    NULL,
    NULL,
    3,
    1,
    1
  ),
  (
    2,
    'Exercices de mathématiques',
    'Terminer les exercices des pages 12 à 14.',
    '2026-05-24 18:00:00',
    'submitted',
    1,
    '2026-05-20 09:10:00',
    '2026-05-20 10:00:00',
    NULL,
    3,
    1,
    1
  ),
  (
    3,
    'Conjugaison des verbes',
    'Réviser les verbes du premier groupe.',
    '2026-05-23 18:00:00',
    'validated',
    2,
    '2026-05-20 09:20:00',
    '2026-05-20 10:20:00',
    NULL,
    3,
    1,
    1
  ),
  (
    4,
    'Préparer la dictée',
    'Apprendre les mots de vocabulaire pour vendredi.',
    '2026-05-26 18:00:00',
    'refused',
    2,
    '2026-05-20 09:30:00',
    '2026-05-20 10:30:00',
    NULL,
    4,
    2,
    1
  ),
   (
    5,
    'Ranger le bureau',
    'Ranger le bureau avant le week-end.',
    '2026-05-27 18:00:00',
    'todo',
    1,
    '2026-05-20 09:40:00',
    NULL,
    NULL,
    4,
    2,
    1
  ),
  (
    6,
    'Faire le lit',
    'Tâche personnelle créée par Lucas et visible par Nelson.',
    '2026-05-28 18:00:00',
    'todo',
    1,
    '2026-05-20 09:50:00',
    NULL,
    NULL,
    3,
    3,
    1
  ),
  (
    7,
    'Préparer mon sac',
    'Tâche personnelle privée créée par Lucas.',
    '2026-05-29 18:00:00',
    'todo',
    1,
    '2026-05-20 10:00:00',
    NULL,
    NULL,
    3,
    3,
    1
  );


-- ============================================================
-- 6. Droits d'accès aux tâches
-- ------------------------------------------------------------
-- Le parent créateur possède write.
-- Les autres parents peuvent avoir read, write ou none selon la tâche.
-- ============================================================

INSERT INTO t_task_access (
  parent_fk,
  task_fk,
  access_level,
  created_at,
  updated_at
) VALUES
  (1, 1, 'write', '2026-05-20 09:00:00', NULL),
  (2, 1, 'read',  '2026-05-20 09:00:00', NULL),

  (1, 2, 'write', '2026-05-20 09:10:00', NULL),
  (2, 2, 'write', '2026-05-20 09:10:00', NULL),

  (1, 3, 'write', '2026-05-20 09:20:00', NULL),
  (2, 3, 'read',  '2026-05-20 09:20:00', NULL),

  (2, 4, 'write', '2026-05-20 09:30:00', NULL),
  (1, 4, 'read',  '2026-05-20 09:30:00', NULL),

  (2, 5, 'write', '2026-05-20 09:40:00', NULL),
  (1, 5, 'none',  '2026-05-20 09:40:00', NULL),

  -- Tâche personnelle créée par Lucas, visible uniquement par Nelson.
  (1, 6, 'read',  '2026-05-20 09:50:00', NULL);


-- ============================================================
-- 7. Preuves
-- ------------------------------------------------------------
-- Les preuves pending n'ont pas encore de décision.
-- Les preuves validated/refused ont un parent décideur et une date.
-- ============================================================

INSERT INTO t_proof (
  proof_id,
  proof_type,
  text_content,
  photo_path,
  status,
  task_version_at_submit,
  decision_comment,
  submitted_at,
  decided_at,
  decided_by_fk,
  submitted_by_fk,
  task_fk
) VALUES
  (
    1,
    'text_photo',
    'J’ai terminé les exercices.',
    'uploads/proofs/lucas-maths-page.jpg',
    'pending',
    1,
    NULL,
    '2026-05-20 10:00:00',
    NULL,
    NULL,
    3,
    2
  ),
  (
    2,
    'text',
    'J’ai révisé les verbes demandés.',
    NULL,
    'validated',
    1,
    'Travail correct.',
    '2026-05-20 10:10:00',
    '2026-05-20 10:20:00',
    1,
    3,
    3
  ),
  (
    3,
    'photo',
    NULL,
    'uploads/proofs/emma-dictee.jpg',
    'refused',
    1,
    'La photo n’est pas assez lisible.',
    '2026-05-20 10:20:00',
    '2026-05-20 10:30:00',
    2,
    4,
    4
  );


-- ============================================================
-- 8. Invitations
-- ------------------------------------------------------------
-- Ces données couvrent plusieurs états possibles :
-- pending, accepted, refused et cancelled.
-- ============================================================

INSERT INTO t_invitation (
  invitation_id,
  status,
  created_at,
  responded_at,
  invited_user_fk,
  inviter_fk,
  family_fk
) VALUES
  (
    1,
    'accepted',
    '2026-05-20 08:55:00',
    '2026-05-20 09:00:00',
    2,
    1,
    1
  ),
  (
    2,
    'pending',
    '2026-05-20 11:00:00',
    NULL,
    5,
    1,
    1
  ),
  (
    3,
    'refused',
    '2026-05-20 11:10:00',
    '2026-05-20 11:20:00',
    1,
    5,
    5
  ),
  (
    4,
    'cancelled',
    '2026-05-20 11:30:00',
    '2026-05-20 11:35:00',
    4,
    1,
    1
  );


-- ============================================================
-- 9. Vérifications rapides possibles après import
-- ------------------------------------------------------------
-- SELECT user_id, username, role, current_family_fk FROM t_user;
-- SELECT family_id, owner_user_id, name, status FROM t_family;
-- SELECT task_id, title, status, version FROM t_task;
-- SELECT proof_id, status, task_fk FROM t_proof;
-- SELECT invitation_id, status, invited_user_fk, family_fk FROM t_invitation;
-- SELECT * FROM t_task_access;
-- ============================================================