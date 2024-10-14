-- Q4.1 Liste de jeux dont le prix de sortie est < à 50

SELECT
j.LIB_JEU              
FROM jeux j
WHERE j.PRIX_SORTIE < 50 

-- Q4.2 Liste de jeux de Larian Studio

SELECT j.CODE_JEU, j.LIB_JEU
FROM jeux j
WHERE j.lib_developpeur = 'Larian Studio'

-- Q4.3 Liste de jeux après le 1er janvier dont le prix est > 60 €

SELECT j.CODE_JEU, j.LIB_JEU
FROM jeux j
WHERE j.DATE_SORTIE > '2024-01-01' AND j.PRIX_SORTIE > 60 

-- Q4.4 Liste de jeux dont le libellé de jeux contient Star ou Planet

SELECT j.CODE_JEU, j.LIB_JEU
FROM jeux j
WHERE j.lib_jeu LIKE '%Star%' OR j.lib_jeu LIKE '%Planet%'

-- Q4.5 Liste  libellé de jeux et prix développés par Sega avant Jan 2015

SELECT j.LIB_JEU, j.PRIX_SORTIE
FROM jeux j
WHERE j.lib_developpeur = 'Sega' AND j.DATE_SORTIE < '2015-01-01'
