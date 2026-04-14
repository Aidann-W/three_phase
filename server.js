import mysql from "mysql2/promise";
import config from "./config.js";
import express from "express";
import cors from "cors";
import crypto from "crypto";


const app = express();
app.use(cors());
app.use(express.json());


const port = 3000;


const connection = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass,
    port: config.db.port,
    database: config.db.db,
});


const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
});


function decryptData(base64Data) {
    const buffer = Buffer.from(base64Data, "base64");


    return crypto.privateDecrypt(
        {
            key: privateKey,
            oaepHash: "sha256",
        },
        buffer
    ).toString("utf8");
}

function verifyPassword(inputPassword, salt, storedHash) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(inputPassword, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(derivedKey.toString("hex") === storedHash);
        });
    });
}


async function getUser(username) {
    const [rows] = await connection.execute(
        "SELECT * FROM logins WHERE username = ?",
        [username]
    );
    return rows[0] || null;
}


async function createUser(username, password) {
    const salt = crypto.randomBytes(16).toString("hex");


    const hash = await new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, key) => {
            if (err) reject(err);
            resolve(key.toString("hex"));
        });
    });


    await connection.execute(
        "INSERT INTO logins (username, hashed, salt, access) VALUES (?, ?, ?, 0)",
        [username, hash, salt]
    );
}


async function getUserAccounts(user) {
    if (user.access === 1) {
        const [rows] = await connection.execute("SELECT * FROM accounts");
        return rows;
    }


    const [rows] = await connection.execute(
        "SELECT * FROM accounts WHERE ownerId = ?",
        [user.id]
    );


    return rows;
}

async function getTransactions(accountId) {
    const [rows] = await connection.execute(
        "SELECT * FROM transactions WHERE fromAcc = ? OR toAcc = ?",
        [accountId, accountId]
    );
    return rows;
}


async function verifyAccountAccess(user, accountId) {
    if (user.access === 1) return true;


    const [rows] = await connection.execute(
        "SELECT ownerId FROM accounts WHERE acountId = ?",
        [accountId]
    );


    if (!rows[0]) return false;
    return rows[0].ownerId === user.id;


}

async function verifyBalance(accountId, amount) {
    const [rows] = await connection.execute(
        "SELECT balance FROM accounts WHERE acountId = ?",
        [accountId]
    );


    if (!rows[0]) return false;
    return rows[0].balance >= amount;


}


async function transfer(user, fromId, toId, amount) {
    if (amount <= 0) return false;


    if (!(await verifyAccountAccess(user, toId)) || !(await verifyAccountAccess(user, fromId))) return false;
    if (!(await verifyBalance(fromId, amount))) return false;


    const transactionId = await nextTransactionId();


    const [toBalance] = await connection.query(
        "SELECT balance FROM accounts WHERE acountId = ?",
        [toId]
    );
    const [fromBalance] = await connection.query(
        "SELECT balance FROM accounts WHERE acountId = ?",
        [fromId]
    );


    const newToBalance = toBalance[0].balance + amount;
    const newFromBalance = fromBalance[0].balance - amount;


    await connection.query(
        "INSERT INTO transactions (transactionId, amount, fromAcc, toAcc) VALUES (?, ?, ?, ?)",
        [transactionId, amount, fromId, toId]
    );


    await connection.query(
        "UPDATE accounts SET balance = ? WHERE acountId = ?",
        [newToBalance, toId]
    );
    await connection.query(
        "UPDATE accounts SET balance = ? WHERE acountId = ?",
        [newFromBalance, fromId]
    );


    return true;
}


async function adminTransaction(user, fromId, toId, amount) {
    if (user.access !== 1 || amount <= 0) return false;


    const transactionId = await nextTransactionId();


    if (toId) {
        await connection.query(
            "UPDATE accounts SET balance = balance + ? WHERE acountId = ?",
            [amount, toId]
        );
    }


    if (fromId) {
        await connection.query(
            "UPDATE accounts SET balance = balance - ? WHERE acountId = ?",
            [amount, fromId]
        );
    }


    await connection.query(
        "INSERT INTO transactions (transactionId, amount, fromAcc, toAcc) VALUES (?, ?, ?, ?)",
        [transactionId, amount, fromId, toId]
    );


    return true;
}


async function nextTransactionId() {
    const [rows] = await connection.query("SELECT MAX(transactionId) as maxId FROM transactions");
    return (rows[0].maxId || 0) + 1;
}


app.get("/public_key", (req, res) => {
    res.json(publicKey);
});


app.get("/accounts", async (req, res) => {
    try {
        const { u, p } = req.query;


        const user = decryptData(u);
        const pass = decryptData(p);


        const dbUser = await getUser(user);
        if (!dbUser) return res.status(404).json("user not found");


        const valid = await verifyPassword(pass, dbUser.salt, dbUser.hashed);
        if (!valid) return res.status(403).json("invalid password");


        const accounts = await getUserAccounts(dbUser);
        res.json(accounts);
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});


app.get("/transactions", async (req, res) => {
    try {
        const { u, p, Id } = req.query;


        const user = decryptData(u);
        const pass = decryptData(p);
        const accountId = Number(decryptData(Id));


        const dbUser = await getUser(user);
        const valid = await verifyPassword(pass, dbUser.salt, dbUser.hashed);


        if (!valid) return res.status(403).json("invalid password");


        const access = await verifyAccountAccess(dbUser, accountId);
        if (!access) return res.status(403).json("no access");


        const tx = await getTransactions(accountId);
        res.json(tx);
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});


app.post("/logins", async (req, res) => {
    try {
        const { u, p } = req.body;


        const user = decryptData(u);
        const pass = decryptData(p);


        const exists = await getUser(user);
        if (exists) return res.status(400).json("user exists");


        await createUser(user, pass);


        res.json("created");
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});


app.post("/transfer", async (req, res) => {
    try {
        const { u, p, fromAcc, toAcc, amount } = req.body;


        const user = decryptData(u);
        const pass = decryptData(p);
        const from = Number(decryptData(fromAcc));
        const to = Number(decryptData(toAcc));
        const amt = Number(decryptData(amount));


        const dbUser = await getUser(user);
        const valid = await verifyPassword(pass, dbUser.salt, dbUser.hashed);


        if (!valid) return res.status(403).json("invalid password");


        const success = await transfer(dbUser, from, to, amt);


        if (!success) return res.status(400).json("failed");


        res.json("success");
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});


app.post("/deposit", async (req, res) => {
    try {
        const { u, p, toAcc, amount } = req.body;


        const user = decryptData(u);
        const pass = decryptData(p);
        const to = Number(decryptData(toAcc));
        const amt = Number(decryptData(amount));


        const dbUser = await getUser(user);
        const valid = await verifyPassword(pass, dbUser.salt, dbUser.hashed);


        if (!valid) return res.status(403).json("invalid password");


        const success = await adminTransaction(dbUser, null, to, amt);


        if (!success) return res.status(403).json("not allowed");


        res.json("deposit success");
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});

async function maxAccountId(){
    const [maxId,fields] = await connection.query(
        `select max(acountId) from accounts`
    );
    return maxId[0]["max(acountId)"];
}

app.post("/withdraw", async (req, res) => {
    try {
        const { u, p, fromAcc, amount } = req.body;


        const user = decryptData(u);
        const pass = decryptData(p);
        const from = Number(decryptData(fromAcc));
        const amt = Number(decryptData(amount));


        const dbUser = await getUser(user);
        const valid = await verifyPassword(pass, dbUser.salt, dbUser.hashed);


        if (!valid) return res.status(403).json("invalid password");


        const success = await adminTransaction(dbUser, from, null, amt);


        if (!success) return res.status(403).json("not allowed");


        res.json("withdraw success");
    } catch (err) {
        console.error(err);
        res.status(500).json("server error");
    }
});

async function createAccounts(id,accountType,ownerId ){
    id = await maxAccountId()+1;
    await connection.query(
        `insert into accounts(acountId,accountType,ownerId) values (${id},"${accountType}",${ownerId})`
    );
}

app.post("/account", async (req, res) => {
    try {
        const { u, p, accType } = req.body;

        if (!u || !p || !accType) {
            return res.status(400).json({ error: "invalid input" });
        }

        const username = decryptData(u);
        const password = decryptData(p);
        const accountType = decryptData(accType);

        const dbUser = await getUser(username);
        if (!dbUser) return res.status(404).json("user not found");

        const valid = await verifyPassword(password, dbUser.salt, dbUser.hashed);
        if (!valid) return res.status(403).json("invalid password");

        const [rows] = await connection.query(
            "SELECT MAX(acountId) as maxId FROM accounts"
        );

        const newId = (rows[0].maxId || 0) + 1;

        await connection.query(
            "INSERT INTO accounts (acountId, balance, accountType, ownerId) VALUES (?, ?, ?, ?)",
            [newId, 0, accountType, dbUser.id]
        );

        res.status(201).json({ message: "created account" });

    } catch (err) {
        console.error("ACCOUNT ERROR:", err);
        res.status(500).json({ error: "server error" });
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

