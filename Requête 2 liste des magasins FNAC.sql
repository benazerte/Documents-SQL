-- 2.	la liste des magasins FNAC (libellé)

-- Solution 1
SELECT m.LIB_MAGASIN
FROM magasin AS m
WHERE m.CODE_chaine = 'FNAC' ;

-- Solution 2
SELECT m.LIB_MAGASIN
FROM magasin AS m
WHERE m.LIB_chaine = 'FNAC';

-- Solution 3
SELECT m.LIB_MAGASIN
FROM magasin AS m
WHERE m.LIB_magasin LIKE 'FNAC%';
