CREATE TABLE marcacao
(
  id   SERIAL PRIMARY KEY,
  nome TEXT NOT NULL
);

ALTER TABLE marcacao OWNER TO rslemos;

INSERT INTO marcacao(nome)
VALUES ('mercado');
INSERT INTO marcacao(nome)
VALUES ('curva');

