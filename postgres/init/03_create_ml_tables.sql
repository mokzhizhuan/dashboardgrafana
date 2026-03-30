\connect ml_test_db;

CREATE TABLE IF NOT EXISTS ml_training_runs (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100),
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

\connect ml_test_db;

CREATE TABLE IF NOT EXISTS ml_prediction_tests (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(255) NOT NULL,
  predicted_label VARCHAR(255) NOT NULL,
  confidence DOUBLE PRECISION,
  rms DOUBLE PRECISION,
  peak DOUBLE PRECISION,
  kurtosis DOUBLE PRECISION,
  skewness DOUBLE PRECISION,
  crest_factor DOUBLE PRECISION,
  fft_peak_freq DOUBLE PRECISION,
  fft_peak_amp DOUBLE PRECISION,
  probabilities_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);