# Documentation SQL

Ce document reprend les instructions vues depuis le début de l'année en cours et TP de Bloc 1 SQL.

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
