import mysql from 'mysql2/promise';
import config from './config.js';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";

const app = express();
app.use(cors({
    methods: ['GET', 'POST'] // Specify allowed methods
}));
app.use(bodyParser.json());
const port = 3000;

const connection = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass,
    port: config.db.port,
    database: config.db.db,
});




async function getUser(username) {
    const [results,fields] = await connection.query(
        `select * from logins where username = "${username}"`
    );
    if(results.length > 0) return results[0];
    else return false
}

function verifyPassword(inputPassword, storedSalt, storedHash, actionOnSuccess, actionOnFail) {
    crypto.scrypt(inputPassword, storedSalt, 64, (err, derivedKey) => {
        if (err) throw err;


        const inputHash = derivedKey.toString('hex');


        // Compare the newly generated hash with the one stored in the database
        if(storedHash === inputHash) {
            actionOnSuccess();
        } else
            actionOnFail();
    });
}

async function createUser(username, password) {
    const salt = crypto.randomBytes(16).toString('hex');


    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) throw err;


        const hash = derivedKey.toString('hex');

        connection.query(
            `insert into logins(username,id,hashed,salt,access) values ("${username}",${maxId+1},"${hash}","${salt}",${0})`
        );
    } )

}

const urlSafeToBase64 = (urlSafeStr) => {
    // Add padding back for standard Base64 if needed
    let standardB64 = urlSafeStr.replace(/-/g, '+').replace(/_/g, '/');
    while (standardB64.length % 4) {
        standardB64 += '=';
    }
    return standardB64;
};


const decryptData = (base64Data) => {
    // 1. Convert from encoded string to a buffer
    const buffer = Buffer.from(base64Data, 'base64');


    // 2. Explicitly define padding and hash to match the Web Crypto API
    return crypto.privateDecrypt(
        {
            key: privateKey, // Your 2048-bit key from generateKeys()
            oaepHash: "sha256", // MUST BE THIS to match client's "SHA-256"
        },
        buffer
    ).toString("utf8");
};

async function getTransactions(accountNumber){
    if(accountNumber >-1) {
        const [transactions, fields] = await connection.query(
            `select * from transactions
 where fromAcc = ${accountNumber} or toAcc = ${accountNumber}`
        );
        return transactions;
    }
    else return false
}

async function getUserAccounts(user) {

    if(user.access=== 1 ){
        const [allAccounts,fields] = await connection.query(
            `select * from accounts`
        );
        return allAccounts;
    }
    else if(user.access=== 0){
        let ownersId = user.id;
        const [personalAccounts,fields] = await connection.query(
            `select * from accounts where ownerId ="${ownersId}"`
        );
        return personalAccounts;
    }
        else return false
}

async function maxId(){
    const [maxId,fields] = await connection.query(
        `select max(id) from logins`
    );
    return maxId[0]["max(id)"];
}

async function maxAccountId(){
    const [maxId,fields] = await connection.query(
        `select max(acountId) from accounts`
    );
    return maxId[0]["max(acountId"];
}
async function maxTransactionId(){
    const [maxId,fields] = await connection.query(
        `select max(transactionId) from transactions`
    );
    return maxId[0]["max(transactionId)"];
}

async function createAccounts(id,accountType,ownerId ){
    id = await maxAccountId()+1;
   await connection.query(
        `insert into accounts(acountId,accountType,ownerId) values (${id},"${accountType},${ownerId}")`
    );
}

async function verifyAccountAccess(user,accountId){
    if(user.access ===1)
        return true;
    else {

        const [account, fields1] = await connection.query(
            `Select ownerId from accounts where acountId =${accountId}`
        );
        if(account[0].ownerId === user.id){
            return true
        }
    }
    return false

}
//transfer between two owned accounts

async function transfer(user,toId,fromId,amount){
if(await verifyAccountAccess(user,toId) && await verifyAccountAccess(user,fromId)&& await verifyBalance(fromId,amount)){
    let transactionId = await maxTransactionId();
    const [balance,fields1] = await connection.query(
        `Select balance from accounts where acountId =${toId}`
    );
    const [fromBalance,fields] = await connection.query(
        `Select balance from accounts where acountId =${fromId}`
    );
   let newBalance = balance[0].balance + amount;
   let newFromBalance = fromBalance[0].balance - amount;
    await connection.query(
        `insert into transactions(transactionId,amount,fromAcc,toAcc) values (${transactionId},${amount},${fromId},${toId})`
    );
    await connection.query(
        `update accounts set balance = ${newBalance} where acountId=${toId}`
    );
    await connection.query(
        `update accounts set balance = ${newFromBalance} where acountId=${fromId}`
    );
}
else console.log("not authorized or no balance");
}

async function adminTransactions(user,fromId,toId,amount){
    if(user.access=== 0 ){
        return false
    }

    let transactionId = await maxTransactionId();

    if(fromId === null){
        //deposit
        const [balance,fields1] = await connection.query(
            `Select balance from accounts where acountId =${toId}`
        );
        let newBalance = balance[0].balance + amount;
        await connection.query(
            `insert into transactions(transactionId,amount,fromAcc,toAcc) values (${transactionId},${amount},${fromId},${toId})`
        );
        await connection.query(
            `update accounts set balance = ${newBalance} where acountId=${toId}`
        );
    }
    if(toId === null){
        //withdraw
        const [fromBalance,fields] = await connection.query(
            `Select balance from accounts where acountId =${fromId}`
        );
        let newFromBalance = fromBalance[0].balance - amount;

        await connection.query(
            `insert into transactions(transactionId,amount,fromAcc,toAcc) values (${transactionId},${amount},${fromId},${toId})`
        );
        await connection.query(
            `update accounts set balance = ${newFromBalance} where acountId=${fromId}`
        );
    }
}

async function verifyBalance(acountId,amount){
    const [balance,fields1] = await connection.query(
        `Select balance from accounts where acountId =${acountId}`
    );
    return balance[0].balance - amount >0;
}


getUser("boss").then(result => {
    console.log(result);
    getUserAccounts(result).then(result2 => {
        console.log(result2)
    })
verifyAccountAccess(result,0).then((result3) => {
    console.log(result3 +"account access")
})
});


getTransactions(1).then(result3 => {console.log(result3)});

const generateKeys = () => {
    const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048, // Recommended key size for security
        publicKeyEncoding: {
            type: 'spki', // Recommended for public keys
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8', // Recommended for private keys
            format: 'pem',
        },
    });
    console.log('Private Key:', keys.privateKey);
    console.log('Public Key:', keys.publicKey);
    return keys;
}
let {publicKey, privateKey} = generateKeys();

app.get("/accounts",(req, res) => {

})
app.get("/transactions",(req, res) => {

})

app.post("/logins",(req, res) => {

})

app.post("/account",(req, res) => {

})

app.post("/deposit",(req, res) => {

})

app.post("/withdraw",(req, res) => {

})

app.post("/transfer",(req, res) => {

})
getUser("aidan").then(result => {console.log(result)});
getUser("billy bob").then(result => {console.log(result)});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

