-- 6 le nombre d'emplooyées de l'éditeur Rockstar Games

SELECT d.NB_EMPLOYES
FROM developpeur d
 WHERE d.LIB_EDITEUR = 'Rockstar Games' ;
 
 -- Solution avec ID
 SELECT d.NB_EMPLOYES
FROM developpeur d
 WHERE d.ID_EDITEUR = 'RS' ;