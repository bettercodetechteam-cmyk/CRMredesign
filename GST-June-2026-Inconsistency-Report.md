# GST / Fee Data Inconsistency Report — June 2026

**Prepared for:** Amol Paritkar  
**Date:** 8 July 2026  
**CRM:** https://crm.zicazimapcmc.com  
**Firebase project:** `zica-zima-crm` (production)  
**Source of truth reviewed:** June 2026 GST export sheet (21 receipt rows)

---

## 1. Purpose

A dry-run was performed to align production Firestore data (`gstRecords`, `fees`, `students`) with the June 2026 GST sheet dates and receipt numbers.

**No changes were written to production.** This report lists what already matches, what would be updated safely, and what must be clarified before any bulk update.

---

## 2. Sheet summary (21 receipts)

| # | Receipt | Student (sheet) | Sheet date | Company |
|---|---------|-----------------|------------|---------|
| 1 | BTC078 | Saieesh Santosh Birje | 05-06-2026 | BETTERCODE |
| 2 | BTC079 | Omkar Devkule | 05-06-2026 | BETTERCODE |
| 3 | BTC080 | Vishal Desai | 09-06-2026 | BETTERCODE |
| 4 | BTC081 | Akash Landge | 11-06-2026 | BETTERCODE |
| 5 | BTC082 | Akash Landge | 11-06-2026 | BETTERCODE |
| 6 | BTC083 | Sanjana Lunkad | 21-06-2026 | BETTERCODE |
| 7 | BTC084 | Sanjana Lunkad | 21-06-2026 | BETTERCODE |
| 8 | BTC085 | Narsmma Pujari | 24-06-2026 | BETTERCODE |
| 9 | BTC086 | Shivam Pawar | 27-06-2026 | BETTERCODE |
| 10 | BTC087 | Rohit Pokharkar | 27-06-2026 | BETTERCODE |
| 11 | BTC088 | Rohit Pokharkar | 27-06-2026 | BETTERCODE |
| 12 | BTC089 | Aavez Maniyar | 27-06-2026 | BETTERCODE |
| 13 | BTC090 | Dhanashree Kalane | 27-06-2026 | BETTERCODE |
| 14 | Z260414003 | Shrushti Jadhav | 03-06-2026 | BETTERCODE |
| 15 | Z260520002 | Pranav Maske | 19-06-2026 | ZICA |
| 16 | Z260525002 | Diksha Dawani | 01-06-2026 | ZICA |
| 17 | Z260525003 | Ashraf Nadaf | 22-06-2026 | ZICA |
| 18 | Z260602001 | Kartik Bhavsar | 13-06-2026 | ZICA |
| 19 | Z260602002 | Kartik Bhavsar | 13-06-2026 | ZICA |
| 20 | Z260603001 | Kuhu Jamgaonkar | 03-06-2026 | ZICA |
| 21 | Z260623001 | Sachidanand Gope | 22-06-2026 | ZICA |

---

## 3. Dry-run results overview

| Status | GST records | Fee records | Student records |
|--------|-------------|-------------|-----------------|
| Already correct | 15 | 13 | 13 |
| Would be updated | 6 | 5 | 6 |
| Missing / not found | 1 | 0 | — |
| **Warnings (need review)** | **4** | — | — |

---

## 4. Records already matching production (no change needed)

These receipts already have the correct date in production GST records:

- BTC080, BTC081, BTC082, BTC083, BTC084, BTC085, BTC086  
- Z260414003, Z260520002, Z260525002, Z260525003  
- Z260602001, Z260602002, Z260603001, Z260623001  

Fee and student `feesPaidDate` for these students also already match (except where noted in Section 6).

---

## 5. Records that would update safely (if names match)

These show a **date change only** and **student name matches** the sheet on the fee record:

| Receipt | Student | GST date now → sheet | Fee `feesPaidDate` now → sheet |
|---------|---------|----------------------|--------------------------------|
| **BTC088** | Rohit Pokharkar | 2026-06-11 → **2026-06-27** | 2026-06-11 → **2026-06-27** |
| **BTC090** | Dhanashree Kalane | 2026-06-17 → **2026-06-27** | 2026-06-17 → **2026-06-27** |

**Amol to confirm:** OK to set Rohit (BTC088) and Dhanashree (BTC090) to **27 June 2026**?

---

## 6. Critical inconsistencies — Amol must confirm before update

### 6.1 BTC078 — Duplicate receipt number (two students)

**Two different GST records in production use receipt `BTC078`:**

| Production student | GST date in CRM | Sheet says |
|--------------------|-----------------|------------|
| Saieesh Santosh Birje | 2026-06-05 ✓ | BTC078, 05-06-2026, Saieesh |
| **Aavez Maniyar** | 2026-05-18 | Sheet does **not** list Aavez on BTC078 |

**Risk if we bulk-update:** Aavez’s GST record would incorrectly be changed to 05-06-2026.

**Questions for Amol:**
1. Who is the correct owner of **BTC078** — Saieesh or Aavez?
2. What is Aavez’s correct receipt number if not BTC078?
3. Should Aavez’s GST record be corrected to a different invoice number?

---

### 6.2 BTC079 — Missing in production

| Sheet | Production |
|-------|------------|
| BTC079, Omkar Devkule, 05-06-2026 | **No GST record found** for BTC079 |

Fee record for Omkar Devkule exists and already shows `feesPaidDate` = 2026-06-05.

**Questions for Amol:**
1. Was GST for BTC079 never created in CRM?
2. Should we create a GST entry for Omkar / BTC079?
3. Or is BTC079 assigned to a different student in CRM?

---

### 6.3 BTC087 — Receipt linked to wrong student in GST

| | Sheet | Production GST |
|---|-------|----------------|
| Receipt | BTC087 | BTC087 |
| Student | **Rohit Pokharkar** | **Sameeksha Meher** |
| Date | 27-06-2026 | 2026-05-15 |

Rohit’s fee record is linked to **BTC088** (Installment 2), not BTC087.  
Sameeksha Meher’s fee record is linked to **BTC087** in production.

**Questions for Amol:**
1. Does **BTC087** belong to Rohit (Initial Payment) or Sameeksha?
2. Was there a receipt renumbering that was not fully applied in CRM?
3. Should GST `partyName` / invoice number be corrected for one of these students?

---

### 6.4 BTC089 — Receipt linked to wrong student in GST

| | Sheet | Production GST |
|---|-------|----------------|
| Receipt | BTC089 | BTC089 |
| Student | **Aavez Maniyar** | **Suradhish Deshmukh** |
| Date | 27-06-2026 | 2026-05-13 |

**Questions for Amol:**
1. Does **BTC089** belong to Aavez or Suradhish?
2. What is Aavez’s correct receipt for Installment 6 (per sheet)?
3. What is Suradhish’s correct receipt number in CRM?

---

## 7. Other fee/student date differences (linked to issues above)

| Student | Fee `feesPaidDate` now | Sheet target | Note |
|---------|------------------------|--------------|------|
| Saieesh Santosh Birje | 2026-06-29 | 2026-06-05 | Fee date newer than sheet; GST for Saieesh on BTC078 already 05-06 |
| Aavez Maniyar (student) | 2026-06-06 | — | Tied to duplicate BTC078 issue |
| Sameeksha Meher | 2026-05-27 | 2026-06-27 | Only if BTC087 ownership confirmed |
| Suradhish Deshmukh | 2026-05-13 | 2026-06-27 | Only if BTC089 ownership confirmed |

---

## 8. Recommended decision checklist for Amol

Please mark each item:

- [ ] **BTC078** — Confirm owner: Saieesh ☐ / Aavez ☐ / Other: _______
- [ ] **BTC079** — Create GST for Omkar? Yes ☐ / No ☐ / Already under different no.: _______
- [ ] **BTC087** — Confirm owner: Rohit ☐ / Sameeksha ☐ / Other: _______
- [ ] **BTC088** — Confirm date **27-06-2026** for Rohit ☐
- [ ] **BTC089** — Confirm owner: Aavez ☐ / Suradhish ☐ / Other: _______
- [ ] **BTC090** — Confirm date **27-06-2026** for Dhanashree ☐
- [ ] All other sheet rows (BTC080–086, Z receipts) — Already OK in CRM ☐

---

## 9. Recommended next steps (after Amol confirms)

1. Fix receipt number ownership in Firebase (`gstRecords` + `fees` receipt fields) for BTC078, BTC087, BTC089.
2. Create or locate GST for **BTC079** (Omkar) if required.
3. Re-run dry-run sync and confirm **zero warnings**.
4. Apply date updates only for confirmed rows.
5. Hard-refresh production CRM and verify GST Invoice + Fee Management.

---

## 10. Technical note (for reference)

- Production database: **`zica-zima-crm`** (not `zica-zima-testing`).
- Updates affect: `gstRecords.date`, `fees.feesPaidDate`, `students.feesPaidDate`.
- Amounts, receipt numbers (except corrections above), and HSN are **not** changed by the sync script.
- Bulk apply was **not run** due to the inconsistencies in Sections 6.1–6.4.

---

*Report generated from dry-run output on 8 July 2026. No production data was modified.*
