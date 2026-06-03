import path from 'path';

export const CONFIG = {
  PORT: 3000,
  TICKERS: [
    'DANGCEM',
    'MTNN',
    'ZENITHBANK',
    'GTCO',
    'ACCESS',
    'UBA',
    'NESTLE',
    'SEPLAT',
    'BUACEMENT',
    'AIRTELAFRI',
    'FBNH',
    'TRANSCORP',
    'OANDO',
    'FIDELITYBK',
    'STERLINGNG'
  ],
  INITIAL_BALANCE: 1000000,
  COMMISSION_RATE: 0.005, // 0.5% slide fee
  DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || 'ngx-research',
  SECRET_KEY: process.env.SECRET_KEY || 'ngx_secret_key_2026_quant',
  DATA_DIR: path.join(process.cwd(), 'data')
};
