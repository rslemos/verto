CREATE TABLE movimento
(
  id       SERIAL PRIMARY KEY,
  ativo_id INTEGER        NOT NULL REFERENCES ativo (id),
  data     DATE           NOT NULL,
  valor    NUMERIC(20, 4) NOT NULL -- positivo para aplicação, negativo para resgate
);

ALTER TABLE movimento OWNER TO rslemos;
