-- ============================================================
-- setup_database.sql
-- Projet : Kiddo - TPI
-- Rôle : création complète du schéma de base de données local.
--
-- Ce script :
-- - supprime la base locale db_kiddo si elle existe ;
-- - recrée la base ;
-- - crée les tables principales ;
-- - crée les clés primaires et étrangères ;
-- - crée les contraintes de cohérence ;
-- - crée les index utiles pour les recherches métier.
--
-- Attention :
-- Ce script est prévu pour l'environnement de développement local.
-- Il supprime toutes les données existantes dans db_kiddo.
-- ============================================================


-- ============================================================
-- 1. Recréation de la base de données
-- ============================================================

DROP DATABASE IF EXISTS db_kiddo;

CREATE DATABASE db_kiddo
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE db_kiddo;


-- ============================================================
-- 2. Table t_family
-- ------------------------------------------------------------
-- Représente une famille dans l'application.
--
-- owner_user_id :
-- - identifie la famille personnelle d'un utilisateur ;
-- - peut être NULL lors de la création initiale ;
-- - sera complété après la création de l'utilisateur propriétaire ;
-- - la contrainte FK est ajoutée plus bas avec ALTER TABLE,
--   car t_user n'existe pas encore à ce stade.
--
-- status :
-- - valeurs autorisées : active, archived.
--
-- Remarque :
-- La contrainte UNIQUE sur owner_user_id est ajoutée plus bas.
-- Elle garantit qu'un utilisateur ne possède qu'une seule famille
-- personnelle.
-- ============================================================

CREATE TABLE t_family(
   family_id INT AUTO_INCREMENT,
   owner_user_id INT NULL,
   name VARCHAR(200) NOT NULL,
   status VARCHAR(50) NOT NULL,
   created_at DATETIME NOT NULL,
   updated_at DATETIME NULL,

   PRIMARY KEY(family_id),

   CONSTRAINT chk_family_status
      CHECK (status IN ('active', 'archived'))
);


-- ============================================================
-- 3. Table t_user
-- ------------------------------------------------------------
-- Représente un compte utilisateur.
--
-- Un utilisateur peut être un parent ou un enfant.
--
-- current_family_fk :
-- - représente la famille courante de l'utilisateur ;
-- - est obligatoire car le modèle retenu impose qu'un utilisateur
--   soit toujours rattaché à une seule famille courante ;
-- - une famille peut regrouper plusieurs utilisateurs.
--
-- Flux d'inscription prévu :
-- 1. créer une famille avec owner_user_id = NULL ;
-- 2. créer l'utilisateur avec current_family_fk vers cette famille ;
-- 3. mettre à jour t_family.owner_user_id avec l'id de l'utilisateur.
--
-- role :
-- - valeurs autorisées : parent, child.
--
-- password_hash :
-- - le mot de passe n'est jamais stocké en clair ;
-- - seul le hash du mot de passe est enregistré.
-- ============================================================

CREATE TABLE t_user(
   user_id INT AUTO_INCREMENT,
   username VARCHAR(50) NOT NULL,
   password_hash VARCHAR(255) NOT NULL,
   name VARCHAR(200) NOT NULL,
   role VARCHAR(50) NOT NULL,
   created_at DATETIME NOT NULL,
   updated_at DATETIME NULL,
   current_family_fk INT NOT NULL,

   PRIMARY KEY(user_id),

   UNIQUE(username),

   CONSTRAINT fk_user_current_family
      FOREIGN KEY(current_family_fk)
      REFERENCES t_family(family_id),

   CONSTRAINT chk_user_role
      CHECK (role IN ('parent', 'child'))
);


-- ============================================================
-- 4. Ajout de la relation propriétaire de famille
-- ------------------------------------------------------------
-- Cette contrainte est ajoutée après la création de t_user afin
-- d'éviter une dépendance circulaire au moment de la création
-- des tables.
--
-- owner_user_id :
-- - reste nullable pour permettre la création initiale d'une famille ;
-- - devient renseigné après la création de l'utilisateur propriétaire.
--
-- UNIQUE(owner_user_id) :
-- - garantit qu'un utilisateur ne peut posséder qu'une seule famille
--   personnelle ;
-- - MySQL permet plusieurs valeurs NULL dans une colonne UNIQUE,
--   ce qui autorise plusieurs familles temporairement sans propriétaire.
-- ============================================================

ALTER TABLE t_family
   ADD CONSTRAINT uq_family_owner UNIQUE(owner_user_id),
   ADD CONSTRAINT fk_family_owner
      FOREIGN KEY(owner_user_id)
      REFERENCES t_user(user_id);


-- ============================================================
-- 5. Table t_task
-- ------------------------------------------------------------
-- Représente une tâche ou un devoir à réaliser.
--
-- Une tâche :
-- - appartient à une famille ;
-- - est créée par un utilisateur ;
-- - est assignée à un enfant ;
-- - possède un statut contrôlé.
--
-- assigned_child_fk :
-- - obligatoire car une tâche doit concerner un enfant ;
-- - si l'enfant crée sa propre tâche, elle lui est assignée à lui-même.
--
-- status :
-- - valeurs autorisées : todo, submitted, validated, refused.
--
-- version :
-- - utilisée pour gérer les conflits métier ;
-- - permet de détecter une modification ou validation basée
--   sur une ancienne version de la tâche.
--
-- deleted_at :
-- - permet une suppression logique ;
-- - évite de supprimer physiquement une tâche et de perdre
--   l'historique associé.
-- ============================================================

CREATE TABLE t_task(
   task_id INT AUTO_INCREMENT,
   title VARCHAR(200) NOT NULL,
   description VARCHAR(1000) NULL,
   due_date DATETIME NOT NULL,
   status VARCHAR(50) NOT NULL,
   version INT NOT NULL,
   created_at DATETIME NOT NULL,
   updated_at DATETIME NULL,
   deleted_at DATETIME NULL,
   assigned_child_fk INT NOT NULL,
   created_by_fk INT NOT NULL,
   family_fk INT NOT NULL,

   PRIMARY KEY(task_id),

   CONSTRAINT fk_task_assigned_child
      FOREIGN KEY(assigned_child_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_task_created_by
      FOREIGN KEY(created_by_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_task_family
      FOREIGN KEY(family_fk)
      REFERENCES t_family(family_id),

   CONSTRAINT chk_task_status
      CHECK (status IN ('todo', 'submitted', 'validated', 'refused')),

   CONSTRAINT chk_task_version
      CHECK (version >= 1)
);


-- ============================================================
-- 6. Table t_proof
-- ------------------------------------------------------------
-- Représente une preuve envoyée par un enfant pour une tâche.
--
-- Une preuve peut être :
-- - du texte ;
-- - une photo ;
-- - du texte + une photo.
--
-- proof_type :
-- - valeurs autorisées : text, photo, text_photo.
--
-- status :
-- - valeurs autorisées : pending, validated, refused.
--
-- task_version_at_submit :
-- - mémorise la version de la tâche au moment de l'envoi ;
-- - permet de détecter une preuve liée à une version obsolète.
--
-- decided_by_fk :
-- - NULL tant que la preuve n'a pas été validée ou refusée ;
-- - renseigné lorsque le parent prend une décision.
--
-- decision_comment :
-- - optionnel ;
-- - permet au parent d'expliquer un refus ou une décision.
--
-- chk_proof_content :
-- - empêche la création d'une preuve totalement vide.
-- ============================================================

CREATE TABLE t_proof(
   proof_id INT AUTO_INCREMENT,
   proof_type VARCHAR(50) NOT NULL,
   text_content VARCHAR(1000) NULL,
   photo_path VARCHAR(400) NULL,
   status VARCHAR(50) NOT NULL,
   task_version_at_submit INT NOT NULL,
   decision_comment VARCHAR(1000) NULL,
   submitted_at DATETIME NOT NULL,
   decided_at DATETIME NULL,
   decided_by_fk INT NULL,
   submitted_by_fk INT NOT NULL,
   task_fk INT NOT NULL,

   PRIMARY KEY(proof_id),

   CONSTRAINT fk_proof_decided_by
      FOREIGN KEY(decided_by_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_proof_submitted_by
      FOREIGN KEY(submitted_by_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_proof_task
      FOREIGN KEY(task_fk)
      REFERENCES t_task(task_id),

   CONSTRAINT chk_proof_type
      CHECK (proof_type IN ('text', 'photo', 'text_photo')),

   CONSTRAINT chk_proof_status
      CHECK (status IN ('pending', 'validated', 'refused')),

   CONSTRAINT chk_proof_task_version
      CHECK (task_version_at_submit >= 1),

   CONSTRAINT chk_proof_content
      CHECK (text_content IS NOT NULL OR photo_path IS NOT NULL),

   CONSTRAINT chk_proof_decision_state
      CHECK (
         (
            status = 'pending'
            AND decided_by_fk IS NULL
            AND decided_at IS NULL
         )
         OR
         (
            status IN ('validated', 'refused')
            AND decided_by_fk IS NOT NULL
            AND decided_at IS NOT NULL
         )
      )
);


-- ============================================================
-- 7. Table t_invitation
-- ------------------------------------------------------------
-- Représente une invitation applicative envoyée par un parent.
--
-- L'invitation est gérée dans l'application et en base de données,
-- sans système d'e-mail.
--
-- inviter_fk :
-- - utilisateur qui envoie l'invitation.
--
-- invited_user_fk :
-- - utilisateur qui reçoit l'invitation.
--
-- family_fk :
-- - famille que l'utilisateur est invité à rejoindre.
--
-- status :
-- - valeurs autorisées : pending, accepted, refused, cancelled.
--
-- responded_at :
-- - NULL tant que l'invitation est en attente ;
-- - renseigné lorsque l'invitation est acceptée, refusée ou annulée.
-- ============================================================

CREATE TABLE t_invitation(
   invitation_id INT AUTO_INCREMENT,
   status VARCHAR(50) NOT NULL,
   created_at DATETIME NOT NULL,
   responded_at DATETIME NULL,
   invited_user_fk INT NOT NULL,
   inviter_fk INT NOT NULL,
   family_fk INT NOT NULL,

   PRIMARY KEY(invitation_id),

   CONSTRAINT fk_invitation_invited_user
      FOREIGN KEY(invited_user_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_invitation_inviter
      FOREIGN KEY(inviter_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_invitation_family
      FOREIGN KEY(family_fk)
      REFERENCES t_family(family_id),

   CONSTRAINT chk_invitation_status
      CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled')),

   CONSTRAINT chk_invitation_response
      CHECK (
         (
            status = 'pending'
            AND responded_at IS NULL
         )
         OR
         (
            status IN ('accepted', 'refused', 'cancelled')
            AND responded_at IS NOT NULL
         )
      )
);


-- ============================================================
-- 8. Table associative t_task_access
-- ------------------------------------------------------------
-- Représente les droits d'accès des parents sur les tâches.
--
-- Cette table vient de l'association :
-- USER 0,n --- Accéder --- 0,n TASK
--
-- C'est la seule vraie table associative du modèle.
--
-- parent_fk :
-- - parent concerné par le droit d'accès.
--
-- task_fk :
-- - tâche concernée.
--
-- access_level :
-- - valeurs autorisées : none, read, write.
--
-- La clé primaire composée empêche d'avoir deux lignes de droits
-- pour le même parent et la même tâche.
-- ============================================================

CREATE TABLE t_task_access(
   parent_fk INT NOT NULL,
   task_fk INT NOT NULL,
   access_level VARCHAR(50) NOT NULL,
   created_at DATETIME NOT NULL,
   updated_at DATETIME NULL,

   PRIMARY KEY(parent_fk, task_fk),

   CONSTRAINT fk_task_access_parent
      FOREIGN KEY(parent_fk)
      REFERENCES t_user(user_id),

   CONSTRAINT fk_task_access_task
      FOREIGN KEY(task_fk)
      REFERENCES t_task(task_id),

   CONSTRAINT chk_task_access_level
      CHECK (access_level IN ('none', 'read', 'write'))
);


-- ============================================================
-- 9. Index complémentaires
-- ------------------------------------------------------------
-- Les clés étrangères sont déjà indexées automatiquement par
-- InnoDB si aucun index utilisable n'existe.
--
-- Les index ci-dessous sont donc des index métier composés.
-- Ils correspondent aux recherches fréquentes prévues :
-- - tâches d'une famille par statut ;
-- - tâches d'une famille triées par date d'échéance ;
-- - preuves d'une tâche selon leur statut ;
-- - invitations reçues par un utilisateur selon leur statut.
-- ============================================================

CREATE INDEX idx_task_family_status
   ON t_task(family_fk, status);

CREATE INDEX idx_task_family_due_date
   ON t_task(family_fk, due_date);

CREATE INDEX idx_proof_task_status
   ON t_proof(task_fk, status);

CREATE INDEX idx_invitation_invited_user_status
   ON t_invitation(invited_user_fk, status);


-- ============================================================
-- 10. Choix volontaire : pas de ON DELETE CASCADE
-- ------------------------------------------------------------
-- Les suppressions en cascade ne sont pas utilisées dans ce
-- schéma afin d'éviter la suppression automatique d'informations
-- métier importantes.
--
-- Exemple :
-- - supprimer un utilisateur ne doit pas supprimer automatiquement
--   ses tâches, preuves, invitations ou décisions ;
-- - supprimer une famille ne doit pas supprimer silencieusement
--   les utilisateurs ou les tâches liées.
--
-- Les suppressions importantes seront contrôlées côté backend.
-- Pour les tâches, le champ deleted_at permet une suppression
-- logique sans perte immédiate d'historique.
--
-- Le comportement restrictif par défaut des clés étrangères est
-- donc volontaire.
-- ============================================================


-- ============================================================
-- 11. Remarque sur les valeurs contrôlées
-- ------------------------------------------------------------
-- Les champs de rôle, statut et niveau d'accès sont stockés en
-- VARCHAR(50) pour rester compatibles avec l'outil de modélisation.
--
-- Les contraintes CHECK ci-dessus renforcent la cohérence côté
-- base de données.
--
-- Les mêmes valeurs devront aussi être contrôlées côté backend
-- afin d'afficher des erreurs claires à l'utilisateur et d'éviter
-- les requêtes invalides.
--
-- Valeurs prévues :
--
-- t_user.role :
--   parent, child
--
-- t_family.status :
--   active, archived
--
-- t_invitation.status :
--   pending, accepted, refused, cancelled
--
-- t_task.status :
--   todo, submitted, validated, refused
--
-- t_proof.status :
--   pending, validated, refused
--
-- t_proof.proof_type :
--   text, photo, text_photo
--
-- t_task_access.access_level :
--   none, read, write
-- ============================================================