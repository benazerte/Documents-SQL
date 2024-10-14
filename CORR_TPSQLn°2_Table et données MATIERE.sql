CREATE TABLE matiere (
ANNEE CHAR(1),
SEMESTRE CHAR(1),
# on ne peut pas nommer simplement la colonne OPTION qui est un mot réservé
# on utilise donc les backticks (ALT GR 7) pour le nommer quand même ...
`OPTION` CHAR(4),
CODE_MATIERE CHAR(5),
LIBELLE_MATIERE VARCHAR(70),
NB_HEURES_COURS FLOAT
);matiere

INSERT INTO matieres ( ANNEE, SEMESTRE,`OPTION`,CODE_MATIERE,LIBELLE_MATIERE,NB_HEURES_COURS)
VALUES 
# on peut insérer plusieurs valeurs après l'instruction VALUES
# chaque valeur est séparée par une virgule
('1', '1', 'ENSE','BLOC1','Support et mise à disposition de services informatiques',8) ,
('1', '2', 'SLAM','BLOC2','Conception et développement d\'applications',6),
('1', '2', 'SLAM','BLOC3','Cybersécurité des services informatiques',4) ;


