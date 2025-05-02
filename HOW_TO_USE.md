# Employee Performance Dashboard - User Guide

## Overview

The Employee Performance Dashboard is a web application that allows managers and administrators to track employee performance metrics. This guide will help you install and use the application on a Windows computer.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Starting the Application](#starting-the-application)
4. [Using the Application](#using-the-application)

## Installation

### Step 1: Install Bun

Bun is a JavaScript runtime that powers our application. To install it:

1. Open PowerShell as Administrator (right-click on PowerShell in the Start menu and select "Run as Administrator")
2. Copy and paste this command, then press Enter:

```
powershell -Command "irm bun.sh/install.ps1 | iex"
```

3. Follow the on-screen instructions to complete the installation.
4. After installation, close and reopen PowerShell.

### Step 2: Download the Application

1. Download the application from the provided link (or ask your IT administrator for the files).
2. Extract the ZIP file to a location on your computer (e.g., `C:\EmployeeDashboard`).

### Step 3: Install Dependencies

1. Open PowerShell and navigate to the application folder:

```
cd C:\path\to\EmployeeDashboard
```

2. Install the required dependencies:

```
bun i
```

3. Wait for the installation to complete. This may take a few minutes.

### Step 4: Set Up the Database

1. While still in the application folder, create a file named `.env` with random security credentials by running this PowerShell command:

```
$sessionSecret = -join ((65..90) + (97..122) + (48..57) + (33..47) | Get-Random -Count 16 | ForEach-Object {[char]$_})
$adminPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
$envContent = @"
SESSION_SECRET="$sessionSecret"
ADMIN_PASSWORD="$adminPassword"
"@
$envContent | Out-File -FilePath .env -Encoding utf8
Write-Host "Environment file created with random credentials."
Write-Host "Your admin password is: $adminPassword"
Write-Host "Please save this password in a secure location."
```

This command:
- Generates a random 16-character string for the application's security key
- Generates a random 16-character string for your admin password
- Creates the .env file with these values
- Displays your admin password so you can save it

2. Make note of the admin password that is displayed in the console. You will need this to log in.

3. Run the database setup command:

```
bun run setup
```

4. You should see a message indicating that the database has been successfully set up.

## Starting the Application

1. Open PowerShell and navigate to the application folder:

```
cd C:\path\to\EmployeeDashboard
```

2. Start the application

```
bun run start
```

3. The application will start and display a URL (it will look like `[react-router-serve] http://localhost:3000 (http://192.168.1.100:3000)`).
4. The URL with the numbers is the one you will be able to visit. That's the one you want to give to your people.

## Using the Application

### Logging In

1. When you first open the application, you'll see the login screen.
2. Use these credentials for the admin account:
   - Email: you@example.com
   - Password: (the randomly generated password displayed during setup)

### Dashboard Overview

Once logged in, you'll see the Employee Performance Dashboard:

- The top of the screen shows the application title and user controls.
- The main area displays employee performance data in cards.
- Each employee card shows their current score and, if applicable, controls to increase or decrease scores.
- You can switch between day, week, and month views using the buttons above the employee cards.
- At the bottom, there's a trend chart showing the total performance over time.

### Admin Features

If you're logged in as an admin:

1. **Managing Users**: Click the "Manage Users" button in the top-right corner.
   - View all users in the system
   - Create new user accounts (admin, manager, or employee)
   - Delete user accounts
   - Reset user passwords

### Performance Tracking

1. **Day View**: In the day view, managers or employees can update their own daily scores.
   - Click the "+" button to increase a score
   - Click the "-" button to decrease a score

2. **Week/Month Views**: These views show aggregated data and cannot be directly edited.

### Logging Out

To log out, click the "Logout" button in the top-right corner of the screen.
