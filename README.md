# Integrated and Customizable Institutional Annual Report Portal

A full-stack, role-based web portal for academic institutions and universities to collect, manage, customize, preview, verify, and generate annual departmental reports with downloadable PDF export.

---

## 👥 Supported Roles & Access Matrix

| Feature / Module | Faculty | Head of Department (HOD) | Institutional Admin |
|---|---|---|---|
| **Login & Dashboard** | Personal submissions & status dashboard | Departmental executive dashboard & review alerts | Global institution dashboard |
| **Department Information** | View only | Direct Edit for own department | Edit for all departments |
| **Faculty Information** | ❌ **Forbidden** (Hidden & server-blocked) | Manage own department faculty (Add, Edit, Delete) | Manage all faculty |
| **Student Achievements** | Add & Edit own submissions (`Pending Approval`) | Direct entry (`Approved`) & review faculty submissions | Global entry & approval |
| **Department Activities** | Add & Edit own submissions (`Pending Approval`) | Direct entry (`Approved`) & review faculty submissions | Global entry & approval |
| **Placement Management** | Add individual placement records (`Pending Approval`) | Add/Edit/Delete individual records & live stats | Global entry & stats |
| **Verification & Approvals** | ❌ Cannot approve | Approve or Request Changes with comments | Global approval |
| **Report Customizer & PDF** | View & export | Build & export department report | Global multi-department PDF export |

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite, React Router v7, Vanilla CSS design system)
- **Backend**: Node.js & Express
- **Database**: SQLite (via Node.js built-in `node:sqlite`, zero native compile dependencies)
- **PDF Generation**: PDFKit (custom multi-column tables, headers, footers, and page numbers)
- **Language**: JavaScript (ES6+)

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v20+ recommended, tested on v24)
- **npm** (v10+)

---

### 2. Run the Backend Server

```bash
cd backend
npm install
npm start
```
- Server starts on: **`http://localhost:5000`**
- SQLite database (`annual_report.db`) automatically initializes schema migrations and seeds demo records for Admin, HODs, and Faculty.

---

### 3. Run the Frontend Client

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```
- Client runs on: **`http://localhost:3000`**
- Proxies `/api` requests to backend on port 5000.

---

## 🔑 Demo Credentials

Quick-fill buttons are available directly on the Login screen:

| Role | Email | Password | Department Assigned |
|---|---|---|---|
| **Institutional Admin** | `admin@college.com` | `admin123` | Global Institutional Administration |
| **HOD (CSE)** | `hod_cse@college.com` | `hod123` | Computer Science and Engineering |
| **HOD (IT)** | `hod_it@college.com` | `hod123` | Information Technology |
| **HOD (ECE)** | `hod_ece@college.com` | `hod123` | Electronics and Communication Engineering |
| **Faculty (CSE)** | `faculty@college.com` | `faculty123` | Computer Science and Engineering |
| **Faculty (IT)** | `faculty_it@college.com` | `faculty123` | Information Technology |
| **Faculty (ECE)** | `faculty_ece@college.com` | `faculty123` | Electronics and Communication Engineering |

---

## 🌟 Key Functional Enhancements

### 1. Individual Student Placement Management
- **No manual summary entry**: Placement information is stored as individual student records (`student_name`, `register_no`, `company_name`, `package`, `placement_status`, `offer_details`).
- **Live Automated Calculations**:
  - **Highest Package**: Dynamically computed from placed students' packages.
  - **Number of Companies**: Distinct unique recruiter companies count.
  - **Number of Offers**: Total placed offer records.
  - **Number of Placed Students**: Distinct placed student IDs.
  - **Average Package**: Mean salary computed only from valid placed package values.
  - **Placement Percentage**: `(placed students / eligible students) * 100` based on departmental student counts.
- **Interactive UI**: Live stats cards, filterable data table, and modal dialogs for **Add**, **Edit**, and **Delete** with immediate recalculation.

### 2. Full Edit & Delete Options
- Added complete **Edit** and **Delete** actions across:
  - **Student Achievements**
  - **Faculty Information**
  - **Department Activities**
  - **Placement Records**
- Form pre-filling, input validation, confirmation prompts prior to deletion, and automatic table refreshing.

### 3. Multi-Role Authorization & Security
- Strict backend authorization using `x-user-id` and Bearer tokens:
  - Faculty attempting to access or modify Faculty Information receive `403 Forbidden`.
  - HOD attempting to modify another department's records receives `403 Forbidden`.
  - Self-approval protection prevents users from approving their own entries.

### 4. HOD Verification & Approval Workflow
- Dedicated **Review Submissions (`/approvals`)** module for HODs and Admins.
- Submissions track four status states: `Draft`, `Pending Approval`, `Approved`, `Changes Requested`.
- HOD can **Approve** or **Request Changes** (with required feedback comments).
- Faculty can view feedback comments, edit their submission, and resubmit for verification.
- Only **Approved** records and direct HOD entries are included in the final annual report and PDF.

---

## 🧪 Automated Test Suite

A comprehensive test suite verifies the entire system:

```bash
cd backend
node test_suite.js
```
