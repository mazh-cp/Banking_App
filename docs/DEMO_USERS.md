# Demo Users and Details (Simulation Reference)

Use these accounts for local demo and testing. All use domain **@finguard.demo**. Created by `pnpm run db:seed` (Prisma).

---

## Login credentials and SSN last 4 (validation)

| Name | Email | Password | Role | Last 4 (validation) |
|------|-------|----------|------|----------------------|
| Alice Johnson | alice.johnson@finguard.demo | Nx7#mKp2Lq | customer | **4521** |
| Bob Smith | bob.smith@finguard.demo | Qw9$vBn4Yr | customer | **4522** |
| Carol Williams | carol.williams@finguard.demo | Rt2!cXj6Ht | customer | **4523** |
| Admin User | admin@finguard.demo | Ad5@fGu8!dm | admin | **4529** |
| ReadOnly Viewer | readonly.viewer@finguard.demo | Ro3#vIe7Wq | readonly | **4530** |
| Adams Smith | adams.smith@finguard.demo | As1!mS9Kp | customer | **4531** |
| Alisha Khan | alisha.khan@finguard.demo | Ak4$nHj2Lm | customer | **4532** |
| Sherry Goldberg | sherry.goldberg@finguard.demo | Sg6#bGd8Rt | customer | **4533** |
| David Warner | david.warner@finguard.demo | Dw0!rWn3Yp | customer | **4534** |

**Validation:** In chat, when prompted for identity verification, enter the **Last 4** digits above for that user.

---

## User details (for admin chat / simulation)

| Name | Email | Role | Notes |
|------|-------|------|--------|
| Alice Johnson | alice.johnson@finguard.demo | customer | Checking, Savings, Credit; credit card application (approved). |
| Bob Smith | bob.smith@finguard.demo | customer | Checking, Savings, Credit; mortgage application (pending). |
| Carol Williams | carol.williams@finguard.demo | customer | Single checking ****1111, $5,400. |
| Admin User | admin@finguard.demo | admin | Admin → Settings; Admin System Context in chat. |
| ReadOnly Viewer | readonly.viewer@finguard.demo | readonly | Single checking ****2222, $1,000. |
| Adams Smith | adams.smith@finguard.demo | customer | Checking, Savings, Credit; payroll, transfers, credit payment. |
| Alisha Khan | alisha.khan@finguard.demo | customer | Checking, Savings; transfers, check deposit, bill pay. |
| Sherry Goldberg | sherry.goldberg@finguard.demo | customer | Checking, Credit; payroll, credit payment, POS. |
| David Warner | david.warner@finguard.demo | customer | Checking, Savings; wire deposit, insurance payment, ATM. |

---

## Account summary (Prisma seed)

- **Alice**: checking ****9012 ($12,543.67), savings ****9013 ($8,920), credit ****9014 (-$1,200).
- **Bob**: checking ****9015 ($45,670.22), savings ****1001 ($3,200.50), credit ****1002 (-$450).
- **Carol**: checking ****1111 ($5,400).
- **ReadOnly**: checking ****2222 ($1,000).
- **Adams Smith**: checking ****1111 ($18,750), savings ****2222 ($10,200), credit ****3333 (-$890).
- **Alisha Khan**: checking ****1111 ($6,320.50), savings ****2222 ($15,500).
- **Sherry Goldberg**: checking ****1111 ($9,240.75), credit ****2222 (-$320).
- **David Warner**: checking ****1111 ($22,100), savings ****2222 ($45,000).

---

## Transactions (new users)

- **Adams Smith**: Monthly savings transfer, payroll deposit, credit card payment, ATM withdrawal.
- **Alisha Khan**: Transfer to savings, check deposit, online bill pay.
- **Sherry Goldberg**: Credit card payment, payroll deposit, POS purchase.
- **David Warner**: Savings transfer, wire transfer deposit, insurance payment, ATM withdrawal.

---

## SQLite demo mode (`USE_DEMO_FINANCE_DATA=true`)

When using the **demo finance pipeline** with SQLite, ensure `users.csv` uses the same **@finguard.demo** emails so session user email matches and dashboard/chat use SQLite data.

---

## Quick copy-paste (login)

```
alice.johnson@finguard.demo      / Nx7#mKp2Lq
bob.smith@finguard.demo          / Qw9$vBn4Yr
carol.williams@finguard.demo     / Rt2!cXj6Ht
admin@finguard.demo              / Ad5@fGu8!dm
readonly.viewer@finguard.demo    / Ro3#vIe7Wq
adams.smith@finguard.demo        / As1!mS9Kp
alisha.khan@finguard.demo        / Ak4$nHj2Lm
sherry.goldberg@finguard.demo    / Sg6#bGd8Rt
david.warner@finguard.demo       / Dw0!rWn3Yp
```

## Last 4 for validation (copy-paste)

```
Alice:  4521   Bob:    4522   Carol:  4523   Admin:  4529   ReadOnly: 4530
Adams:  4531   Alisha: 4532   Sherry: 4533   David:  4534
```
