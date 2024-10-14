-- 7.	les codes et libellés des jeux sortis après le 1er janvier 2010 et dont le prix de sortie était entre 40 et 60 euros

SELECT j.CODE_JEU, j.LIB_JEU
FROM JEUX j
WHERE j.DATE_SORTIE > '2010-01-01' AND j.PRIX_SORTIE BETWEEN 40 AND 60 ; 

