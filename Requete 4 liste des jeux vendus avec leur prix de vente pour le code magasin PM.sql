-- 4  liste des jeux vendus avec leur prix de vente
-- pour le code magasin PM

SELECT v.CODE_JEU, v.PRIX_VENTE
FROM ventes v
WHERE v.CODE_MAGASIN = 'PM'

