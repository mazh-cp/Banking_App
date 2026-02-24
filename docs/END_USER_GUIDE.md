# FinGuard Bank Simulator – End User Guide

## Signing In

1. Open the app URL (e.g. `http://localhost:5000`).
2. Use **Login** and enter your email and password.
3. After login you are taken to the **Dashboard**.

## Dashboard

- View **account balances** (checking, savings, credit).
- See **recent transactions** and a link to full transaction history.
- Use **Chat** for balance and product questions.

## Secure Chat

- Choose a **persona** (Support, Underwriter, Fraud analyst) and type your question.
- **Security mode** (on by default) screens your messages and the assistant’s replies for safety. Links in replies from unknown domains are shown as plain text with an “Unverified link” label.
- For **balance or transaction** questions you may be asked to **verify** with the last 4 digits of your SSN (simulation). Enter the 4 digits in the chat when prompted.
- **RAG (Use RAG)** uses your approved uploaded documents to answer; enable the checkbox if you have documents on file.

## Files

- Upload documents (PDF, DOC, DOCX, XLS, XLSX, CSV, TXT) under **Files**.
- Uploads are scanned for safety; only approved documents are used in chat when RAG is on.

## Applications

- **Credit card**, **Mortgage**, and **Auto loan** applications are available from the Apply section.
- Read-only accounts cannot submit applications.

## Profile

- Update **preferred name** and **Identity (SSN last 4)** for verification in chat. Data is stored hashed; never share your full SSN.

## Getting Help

- Use in-app Chat for product and account questions. For sensitive data, complete identity verification when prompted.
