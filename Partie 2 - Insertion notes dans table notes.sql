USE tp1 ;
CREATE TABLE if NOT exists BTS_SIO1 ( semestre VARCHAR (40),
option_ VARCHAR (40),
section VARCHAR (40),
matière VARCHAR (40),
nombre_heures_cours INT) ;

INSERT INTO BTS_SIO1 (semestre ,
option_ ,
section ,
matière ,
nombre_heures_cours) 

VALUES ('semestre_1','SISR','SIO', 'Mathématiques',34) ;
