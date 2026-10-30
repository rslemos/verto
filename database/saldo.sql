CREATE TABLE saldo
(
  id          SERIAL PRIMARY KEY,
  id_ativo    INTEGER        NOT NULL REFERENCES ativo (id),
  id_marcacao INTEGER        NOT NULL REFERENCES marcacao (id),
  data        DATE           NOT NULL,
  saldo       NUMERIC(20, 4) NOT NULL -- saldo naquele dia
);

ALTER TABLE saldo OWNER TO rslemos;
