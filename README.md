Three Phase

A full-stack banking application built with React, TypeScript, Node.js, Express.js, and MySQL. The application provides account management, authentication, financial transactions, and client/server encryption.

Features
User registration and authentication
RSA-OAEP encrypted client/server communication
Password hashing using salted scrypt
Checking and savings account creation
Account balance management
Deposits and withdrawals
Account-to-account transfers
Transaction history
Account ownership and access control
Administrative transaction functionality
React-based banking dashboard
Architecture
React / TypeScript Frontend
          |
          | HTTP / JSON
          v
Express.js / Node.js Backend
          |
          +---- RSA-OAEP encryption/decryption
          |
          +---- Authentication & authorization
          |
          v
      MySQL Database
          |
          +---- Users
          +---- Accounts
          +---- Transactions
Technology Stack
Frontend
React
TypeScript
Web Crypto API
HTML/CSS
Backend
Node.js
Express.js
JavaScript
Node.js Crypto module
Database
MySQL
mysql2
Security

The application uses public-key cryptography to protect sensitive data transmitted between the frontend and backend.

When the application starts, the server generates a 2048-bit RSA key pair. The public key is exposed through the /public_key endpoint and imported by the frontend using the Web Crypto API.

Client data is encrypted using RSA-OAEP with SHA-256 before being sent to the backend. The server decrypts the data using its private key.

Passwords are not stored directly in the database. During account creation, the server generates a random salt and derives a password hash using Node.js crypto.scrypt. Login attempts derive the password hash again and compare it with the stored value.

Banking Operations
Account Management

Authenticated users can create accounts and view accounts associated with their user ID.

Transfers

Transfers validate:

The authenticated user's credentials
Access to the source account
Access to the destination account
Sufficient funds
A positive transaction amount

Successful transfers create a transaction record and update the balances of both accounts.

Transactions

The application stores transaction records containing:

Transaction ID
Amount
Source account
Destination account

Users can retrieve transaction history for accounts they have permission to access.

API Endpoints
Method	Endpoint	Description
GET	/public_key	Returns the server's RSA public key
GET	/accounts	Retrieves accessible accounts
GET	/transactions	Retrieves account transaction history
POST	/logins	Creates a new user
POST	/account	Creates a new banking account
POST	/transfer	Transfers funds between accounts
POST	/deposit	Performs an administrative deposit
POST	/withdraw	Performs an administrative withdrawal
Running Locally
Prerequisites
Node.js
MySQL
npm
Backend
cd server
npm install

Configure the database connection in the server configuration and start the Express server.

npm start
Frontend
cd client
npm install
npm run dev

The frontend communicates with the Express backend running on port 3000.

What I Learned

This project provided experience with:

Full-stack application architecture
React and TypeScript
REST API development
MySQL database interaction
Client/server networking
Public-key cryptography
Password hashing
Authentication and authorization
Database access control
Asynchronous JavaScript
Financial transaction logic
