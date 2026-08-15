-- Adds two account kinds to match the Accounts tab design (Cash/E-Wallet/Bank/Credit/Other).
ALTER TYPE "AccountKind" ADD VALUE 'CREDIT';
ALTER TYPE "AccountKind" ADD VALUE 'OTHER';
