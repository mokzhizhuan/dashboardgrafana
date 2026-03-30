#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  COPY sensor_raw(ts, sensor_name, value)
  FROM '/seed/sensor_raw_seed.csv'
  DELIMITER ','
  CSV HEADER;

  COPY sensor_fft(sensor_name, frequency_hz, amplitude)
  FROM '/seed/sensor_fft_seed.csv'
  DELIMITER ','
  CSV HEADER;
EOSQL