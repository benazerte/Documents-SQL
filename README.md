# Documentation SQL

Ce document explique les instructions SQL de base à l'aide d'un exemple de table `clients`.

## Table des matières
1. [Création de la table](#création-de-la-table)
2. [Insertion de données](#insertion-de-données)
3. [Sélection de données](#sélection-de-données)

## Création de la table

Pour créer une table, nous utilisons l'instruction `CREATE TABLE`. Voici comment créer une table appelée `clients` :

```sql
CREATE TABLE clients (
    id INT PRIMARY KEY,
    nom VARCHAR(100),
    age INT,
    ville VARCHAR(100)
);
