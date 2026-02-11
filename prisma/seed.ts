import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { hashLast4 } from '../src/lib/security/ssn-last4';

const prisma = new PrismaClient();

// Random passwords per user (@finguard.demo) – keep in sync with docs/DEMO_USERS.md
const USER_CREDENTIALS = [
  { email: 'alice.johnson@finguard.demo', password: 'Nx7#mKp2Lq', firstName: 'Alice', lastName: 'Johnson', role: 'customer' as const },
  { email: 'bob.smith@finguard.demo', password: 'Qw9$vBn4Yr', firstName: 'Bob', lastName: 'Smith', role: 'customer' as const },
  { email: 'carol.williams@finguard.demo', password: 'Rt2!cXj6Ht', firstName: 'Carol', lastName: 'Williams', role: 'customer' as const },
  { email: 'admin@finguard.demo', password: 'Ad5@fGu8!dm', firstName: 'Admin', lastName: 'User', role: 'admin' as const },
  { email: 'readonly.viewer@finguard.demo', password: 'Ro3#vIe7Wq', firstName: 'ReadOnly', lastName: 'Viewer', role: 'readonly' as const },
  { email: 'adams.smith@finguard.demo', password: 'As1!mS9Kp', firstName: 'Adams', lastName: 'Smith', role: 'customer' as const },
  { email: 'alisha.khan@finguard.demo', password: 'Ak4$nHj2Lm', firstName: 'Alisha', lastName: 'Khan', role: 'customer' as const },
  { email: 'sherry.goldberg@finguard.demo', password: 'Sg6#bGd8Rt', firstName: 'Sherry', lastName: 'Goldberg', role: 'customer' as const },
  { email: 'david.warner@finguard.demo', password: 'Dw0!rWn3Yp', firstName: 'David', lastName: 'Warner', role: 'customer' as const },
];

async function main() {
  const passwordHashes = await Promise.all(USER_CREDENTIALS.map((u) => bcrypt.hash(u.password, 12)));

  const last4Hashes = await Promise.all([
    hashLast4('4521'),
    hashLast4('4522'),
    hashLast4('4523'),
    hashLast4('4529'),
    hashLast4('4530'),
    hashLast4('4531'),
    hashLast4('4532'),
    hashLast4('4533'),
    hashLast4('4534'),
  ]);
  const [aliceSsn, bobSsn, carolSsn, adminSsn, readonlySsn, adamsSsn, alishaSsn, sherrySsn, davidSsn] = last4Hashes;

  const alice = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[0].email },
    update: { passwordHash: passwordHashes[0], ssnLast4Hash: aliceSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[0].email,
      passwordHash: passwordHashes[0],
      firstName: USER_CREDENTIALS[0].firstName,
      lastName: USER_CREDENTIALS[0].lastName,
      role: USER_CREDENTIALS[0].role,
      ssnLast4Hash: aliceSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[1].email },
    update: { passwordHash: passwordHashes[1], ssnLast4Hash: bobSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[1].email,
      passwordHash: passwordHashes[1],
      firstName: USER_CREDENTIALS[1].firstName,
      lastName: USER_CREDENTIALS[1].lastName,
      role: USER_CREDENTIALS[1].role,
      ssnLast4Hash: bobSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[2].email },
    update: { passwordHash: passwordHashes[2], ssnLast4Hash: carolSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[2].email,
      passwordHash: passwordHashes[2],
      firstName: USER_CREDENTIALS[2].firstName,
      lastName: USER_CREDENTIALS[2].lastName,
      role: USER_CREDENTIALS[2].role,
      ssnLast4Hash: carolSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[3].email },
    update: { passwordHash: passwordHashes[3], ssnLast4Hash: adminSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[3].email,
      passwordHash: passwordHashes[3],
      firstName: USER_CREDENTIALS[3].firstName,
      lastName: USER_CREDENTIALS[3].lastName,
      role: USER_CREDENTIALS[3].role,
      ssnLast4Hash: adminSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const readonlyUser = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[4].email },
    update: { passwordHash: passwordHashes[4], ssnLast4Hash: readonlySsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[4].email,
      passwordHash: passwordHashes[4],
      firstName: USER_CREDENTIALS[4].firstName,
      lastName: USER_CREDENTIALS[4].lastName,
      role: USER_CREDENTIALS[4].role,
      ssnLast4Hash: readonlySsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const adams = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[5].email },
    update: { passwordHash: passwordHashes[5], ssnLast4Hash: adamsSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[5].email,
      passwordHash: passwordHashes[5],
      firstName: USER_CREDENTIALS[5].firstName,
      lastName: USER_CREDENTIALS[5].lastName,
      role: USER_CREDENTIALS[5].role,
      ssnLast4Hash: adamsSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const alisha = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[6].email },
    update: { passwordHash: passwordHashes[6], ssnLast4Hash: alishaSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[6].email,
      passwordHash: passwordHashes[6],
      firstName: USER_CREDENTIALS[6].firstName,
      lastName: USER_CREDENTIALS[6].lastName,
      role: USER_CREDENTIALS[6].role,
      ssnLast4Hash: alishaSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const sherry = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[7].email },
    update: { passwordHash: passwordHashes[7], ssnLast4Hash: sherrySsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[7].email,
      passwordHash: passwordHashes[7],
      firstName: USER_CREDENTIALS[7].firstName,
      lastName: USER_CREDENTIALS[7].lastName,
      role: USER_CREDENTIALS[7].role,
      ssnLast4Hash: sherrySsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const david = await prisma.user.upsert({
    where: { email: USER_CREDENTIALS[8].email },
    update: { passwordHash: passwordHashes[8], ssnLast4Hash: davidSsn, ssnLast4SetAt: new Date() },
    create: {
      email: USER_CREDENTIALS[8].email,
      passwordHash: passwordHashes[8],
      firstName: USER_CREDENTIALS[8].firstName,
      lastName: USER_CREDENTIALS[8].lastName,
      role: USER_CREDENTIALS[8].role,
      ssnLast4Hash: davidSsn,
      ssnLast4SetAt: new Date(),
    },
  });

  const accountNumbers = ['4000123456789012', '4000123456789013', '5000123456789014', '6000123456789015', '4000987654321001', '5000987654321002'];
  const types = ['checking', 'savings', 'credit'] as const;
  const balances = [12543.67, 8920.00, -1200.00, 45670.22, 3200.50, -450.00];

  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[0] },
    update: {},
    create: {
      userId: alice.id,
      type: 'checking',
      accountNumber: accountNumbers[0],
      balance: balances[0],
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[1] },
    update: {},
    create: {
      userId: alice.id,
      type: 'savings',
      accountNumber: accountNumbers[1],
      balance: balances[1],
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[2] },
    update: {},
    create: {
      userId: alice.id,
      type: 'credit',
      accountNumber: accountNumbers[2],
      balance: balances[2],
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[3] },
    update: {},
    create: {
      userId: bob.id,
      type: 'checking',
      accountNumber: accountNumbers[3],
      balance: balances[3],
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[4] },
    update: {},
    create: {
      userId: bob.id,
      type: 'savings',
      accountNumber: accountNumbers[4],
      balance: balances[4],
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: accountNumbers[5] },
    update: {},
    create: {
      userId: bob.id,
      type: 'credit',
      accountNumber: accountNumbers[5],
      balance: balances[5],
      currency: 'USD',
      status: 'active',
    },
  });

  const aliceAccounts = await prisma.account.findMany({ where: { userId: alice.id } });
  const bobAccounts = await prisma.account.findMany({ where: { userId: bob.id } });

  const txRefs = ['TXN-' + Date.now() + '-1', 'TXN-' + Date.now() + '-2', 'TXN-' + Date.now() + '-3', 'TXN-' + Date.now() + '-4', 'TXN-' + Date.now() + '-5', 'TXN-' + Date.now() + '-6', 'TXN-' + Date.now() + '-7', 'TXN-' + Date.now() + '-8'];
  const txs = [
    { userId: alice.id, fromId: aliceAccounts[0]?.id, toId: aliceAccounts[1]?.id, type: 'transfer', amount: 500, desc: 'Savings transfer' },
    { userId: alice.id, fromId: null, toId: aliceAccounts[0]?.id, type: 'deposit', amount: 1200, desc: 'Payroll' },
    { userId: alice.id, fromId: aliceAccounts[0]?.id, toId: null, type: 'withdrawal', amount: 150, desc: 'ATM' },
    { userId: bob.id, fromId: bobAccounts[0]?.id, toId: null, type: 'payment', amount: 89.99, desc: 'Utility payment' },
    { userId: bob.id, fromId: null, toId: bobAccounts[0]?.id, type: 'deposit', amount: 2500, desc: 'Check deposit' },
    { userId: alice.id, fromId: aliceAccounts[0]?.id, toId: aliceAccounts[2]?.id, type: 'payment', amount: 300, desc: 'Credit card payment' },
    { userId: bob.id, fromId: bobAccounts[0]?.id, toId: bobAccounts[1]?.id, type: 'transfer', amount: 1000, desc: 'To savings' },
    { userId: alice.id, fromId: aliceAccounts[0]?.id, toId: null, type: 'withdrawal', amount: 60, desc: 'POS purchase' },
  ];

  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    await prisma.transaction.upsert({
      where: { reference: txRefs[i] },
      update: {},
      create: {
        userId: t.userId,
        fromAccountId: t.fromId ?? undefined,
        toAccountId: t.toId ?? undefined,
        type: t.type,
        amount: t.amount,
        description: t.desc,
        reference: txRefs[i],
      },
    });
  }

  const existingApp1 = await prisma.application.findFirst({ where: { userId: alice.id, type: 'credit_card' } });
  if (!existingApp1) {
    await prisma.application.create({
      data: {
        userId: alice.id,
        type: 'credit_card',
        status: 'approved',
        amount: 5000,
        termMonths: null,
        rate: 18.99,
        metadata: { cardType: 'rewards', limit: 5000 },
      },
    });
  }
  const existingApp2 = await prisma.application.findFirst({ where: { userId: bob.id, type: 'mortgage' } });
  if (!existingApp2) {
    await prisma.application.create({
      data: {
        userId: bob.id,
        type: 'mortgage',
        status: 'pending',
        amount: 350000,
        termMonths: 360,
        rate: 6.5,
        metadata: { propertyAddress: '123 Main St' },
      },
    });
  }

  // Give Carol and readonly user some accounts so they have something to view
  await prisma.account.upsert({
    where: { accountNumber: '4000555500011111' },
    update: {},
    create: {
      userId: carol.id,
      type: 'checking',
      accountNumber: '4000555500011111',
      balance: 5400,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '4000555500022222' },
    update: {},
    create: {
      userId: readonlyUser.id,
      type: 'checking',
      accountNumber: '4000555500022222',
      balance: 1000,
      currency: 'USD',
      status: 'active',
    },
  });

  // Adams Smith: checking, savings, credit
  await prisma.account.upsert({
    where: { accountNumber: '4000666600011111' },
    update: {},
    create: {
      userId: adams.id,
      type: 'checking',
      accountNumber: '4000666600011111',
      balance: 18750.0,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '4000666600012222' },
    update: {},
    create: {
      userId: adams.id,
      type: 'savings',
      accountNumber: '4000666600012222',
      balance: 10200.0,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '5000666600013333' },
    update: {},
    create: {
      userId: adams.id,
      type: 'credit',
      accountNumber: '5000666600013333',
      balance: -890.0,
      currency: 'USD',
      status: 'active',
    },
  });

  // Alisha Khan: checking, savings
  await prisma.account.upsert({
    where: { accountNumber: '4000777700011111' },
    update: {},
    create: {
      userId: alisha.id,
      type: 'checking',
      accountNumber: '4000777700011111',
      balance: 6320.5,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '4000777700012222' },
    update: {},
    create: {
      userId: alisha.id,
      type: 'savings',
      accountNumber: '4000777700012222',
      balance: 15500.0,
      currency: 'USD',
      status: 'active',
    },
  });

  // Sherry Goldberg: checking, credit
  await prisma.account.upsert({
    where: { accountNumber: '4000888800011111' },
    update: {},
    create: {
      userId: sherry.id,
      type: 'checking',
      accountNumber: '4000888800011111',
      balance: 9240.75,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '5000888800012222' },
    update: {},
    create: {
      userId: sherry.id,
      type: 'credit',
      accountNumber: '5000888800012222',
      balance: -320.0,
      currency: 'USD',
      status: 'active',
    },
  });

  // David Warner: checking, savings
  await prisma.account.upsert({
    where: { accountNumber: '4000999900011111' },
    update: {},
    create: {
      userId: david.id,
      type: 'checking',
      accountNumber: '4000999900011111',
      balance: 22100.0,
      currency: 'USD',
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: { accountNumber: '4000999900012222' },
    update: {},
    create: {
      userId: david.id,
      type: 'savings',
      accountNumber: '4000999900012222',
      balance: 45000.0,
      currency: 'USD',
      status: 'active',
    },
  });

  const adamsAccounts = await prisma.account.findMany({ where: { userId: adams.id } });
  const alishaAccounts = await prisma.account.findMany({ where: { userId: alisha.id } });
  const sherryAccounts = await prisma.account.findMany({ where: { userId: sherry.id } });
  const davidAccounts = await prisma.account.findMany({ where: { userId: david.id } });

  const ts = Date.now();
  const newTxRefs = [
    `TXN-${ts}-ad1`, `TXN-${ts}-ad2`, `TXN-${ts}-ad3`, `TXN-${ts}-ad4`,
    `TXN-${ts}-ak1`, `TXN-${ts}-ak2`, `TXN-${ts}-ak3`,
    `TXN-${ts}-sg1`, `TXN-${ts}-sg2`, `TXN-${ts}-sg3`,
    `TXN-${ts}-dw1`, `TXN-${ts}-dw2`, `TXN-${ts}-dw3`, `TXN-${ts}-dw4`,
  ];
  const newTxs = [
    { userId: adams.id, fromId: adamsAccounts[0]?.id, toId: adamsAccounts[1]?.id, type: 'transfer', amount: 500, desc: 'Monthly savings' },
    { userId: adams.id, fromId: null, toId: adamsAccounts[0]?.id, type: 'deposit', amount: 3200, desc: 'Payroll direct deposit' },
    { userId: adams.id, fromId: adamsAccounts[0]?.id, toId: adamsAccounts[2]?.id, type: 'payment', amount: 200, desc: 'Credit card payment' },
    { userId: adams.id, fromId: adamsAccounts[0]?.id, toId: null, type: 'withdrawal', amount: 80, desc: 'ATM withdrawal' },
    { userId: alisha.id, fromId: alishaAccounts[0]?.id, toId: alishaAccounts[1]?.id, type: 'transfer', amount: 1000, desc: 'To savings' },
    { userId: alisha.id, fromId: null, toId: alishaAccounts[0]?.id, type: 'deposit', amount: 1850, desc: 'Check deposit' },
    { userId: alisha.id, fromId: alishaAccounts[0]?.id, toId: null, type: 'payment', amount: 125.5, desc: 'Online bill pay' },
    { userId: sherry.id, fromId: sherryAccounts[0]?.id, toId: sherryAccounts[1]?.id, type: 'payment', amount: 150, desc: 'Credit card payment' },
    { userId: sherry.id, fromId: null, toId: sherryAccounts[0]?.id, type: 'deposit', amount: 2400, desc: 'Payroll' },
    { userId: sherry.id, fromId: sherryAccounts[0]?.id, toId: null, type: 'withdrawal', amount: 75, desc: 'POS purchase' },
    { userId: david.id, fromId: davidAccounts[0]?.id, toId: davidAccounts[1]?.id, type: 'transfer', amount: 2000, desc: 'Savings transfer' },
    { userId: david.id, fromId: null, toId: davidAccounts[0]?.id, type: 'deposit', amount: 5500, desc: 'Wire transfer' },
    { userId: david.id, fromId: davidAccounts[0]?.id, toId: null, type: 'payment', amount: 420, desc: 'Insurance payment' },
    { userId: david.id, fromId: davidAccounts[0]?.id, toId: null, type: 'withdrawal', amount: 200, desc: 'ATM' },
  ];
  for (let i = 0; i < newTxs.length; i++) {
    const t = newTxs[i]!;
    await prisma.transaction.upsert({
      where: { reference: newTxRefs[i] },
      update: {},
      create: {
        userId: t.userId,
        fromAccountId: t.fromId ?? undefined,
        toAccountId: t.toId ?? undefined,
        type: t.type,
        amount: t.amount,
        description: t.desc,
        reference: newTxRefs[i]!,
      },
    });
  }

  // Sample audit events for admin dashboards
  await prisma.chatAudit.createMany({
    data: [
      { userId: alice.id, sessionId: alice.id, persona: 'support', role: 'assistant', contentPreview: 'Your balance is available in the dashboard.', riskScore: 0.1, riskLevel: 'LOW', actionTaken: 'allowed', blocked: false, safeRewrite: false, securityMode: true },
      { userId: bob.id, sessionId: bob.id, persona: 'banking', role: 'assistant', contentPreview: 'For mortgage rates, please see our apply page.', riskScore: 0.2, riskLevel: 'LOW', actionTaken: 'allowed', blocked: false, safeRewrite: false, securityMode: true },
    ],
  });

  const last4s = ['4521', '4522', '4523', '4529', '4530', '4531', '4532', '4533', '4534'];
  console.log('Seed complete. Static accounts (see docs/DEMO_USERS.md for last 4):');
  USER_CREDENTIALS.forEach((u, i) => {
    console.log(`  ${u.email.padEnd(32)} / ${u.password.padEnd(12)} (${u.role.padEnd(8)}) last4: ${last4s[i]}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
