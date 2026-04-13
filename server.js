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

    const id=await maxId()+1;
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) throw err;


        const hash = derivedKey.toString('hex');

        connection.query(
            `insert into logins(username,id,hashed,salt,access) values ("${username}",${id},"${hash}","${salt}",${0})`
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
    return maxId[0]["max(acountId)"];
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
        `insert into accounts(acountId,accountType,ownerId) values (${id},"${accountType}",${ownerId})`
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
    if(amount < 0)
        return false;
    if(await verifyAccountAccess(user,toId) && await verifyAccountAccess(user,fromId)&& await verifyBalance(fromId,amount)){
        let transactionId = await maxTransactionId()+1;
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
        return true;
    }
    return false;
}

async function adminTransactions(user,fromId,toId,amount){
    if(user.access=== 0 || amount<0 ){
        return false
    }

    let transactionId = await maxTransactionId()+1;

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
    return balance[0].balance - amount >=0;
}


getUser("boss").then(result => {
    console.log(result);
    getUserAccounts(result).then(result2 => {
        console.log(result2)
    })
    verifyAccountAccess(result,2).then((result3) => {
        console.log(result3 +"account access")
    })
    transfer(result,1,0,15)
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

app.get('/public_key', (req, res) => {
    res.status(200).json(publicKey);
});

app.get("/accounts",(req, res) => {
    const { u, p } = req.query;

    if(!u ||!p)
        return res.status(400).json({ error: 'invalid input' });

    const user = decryptData(urlSafeToBase64(u));
    const pass = decryptData(urlSafeToBase64(p));

    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{

                console.log("accounts of user", getUserAccounts(result));
                res.status(200).json( getUserAccounts(result));
            },
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })
})
app.get("/transactions",(req, res) => {
    const { u, p, Id } = req.query;

    if(!u ||!p || !Id)
        return res.status(400).json({ error: 'invalid input' });

    const user = decryptData(urlSafeToBase64(u));
    const pass = decryptData(urlSafeToBase64(p));
    const accId = decryptData(urlSafeToBase64(Id));

    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{
                verifyAccountAccess(result,accId).then(result2 => {
                    if(result2) {
                        console.log("transaction of account", getTransactions(accId));
                        res.status(200).json(getTransactions(accId));
                    }
                    else{
                        console.log("no account access");
                        res.status(200).json("no account access");
                    }
                })},
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })
})

app.post("/logins",(req, res) => {
    const{u, p} =req.body;
    if(!u || !p)
        return res.status(400).json({ error: 'invalid input' });

    const user = decryptData(u);
    const pass = decryptData(p);
    getUser(user).then(result => {
        if(result){
            console.log("user exists");
            res.status(400).json("exists");
        }
        else
            createUser(user,pass)
        res.status(200).json(result);
        console.log("created user");

    })

})

app.post("/account",(req, res) => {
    const{u, p, accType} =req.body;
    if(!u || !p || !accType)
        return res.status(400).json({ error: 'invalid input' });

    const id = maxAccountId()+1;
    const user = decryptData(u);
    const accountType = decryptData(accType);
    const pass = decryptData(p);
    //id accountType, access
    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{
                createAccounts(id,accountType,result.id).then(result2 => {
                    res.status(201).json("created account");
                    console.log(result2);
                }) },
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })

})

app.post("/deposit",(req, res) => {
    const{u, p, toAcc, amount} =req.body;
    if(!u || !p || !toAcc || !amount)
        return res.status(400).json({ error: 'invalid input' });


    const user = decryptData(u);
    const depositId = decryptData(toAcc);
    const depositAmount = decryptData(amount);
    const pass = decryptData(p);
    //id accountType, access
    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{
                adminTransactions(user,null,depositId,depositAmount).then(result2 => {
                    if(result2){
                        res.status(201).json(result2);
                        console.log("success");
                    }
                    else {
                        console.log("invalid transaction");
                        res.status(403).json("invalid transaction");
                    }
                }) },
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })
})

app.post("/withdraw",(req, res) => {
    const{u, p, fromAcc, amount} =req.body;
    if(!u || !p || !fromAcc || !amount)
        return res.status(400).json({ error: 'invalid input' });


    const user = decryptData(u);
    const withdrawId = decryptData(fromAcc);
    const withdrawAmount = decryptData(amount);
    const pass = decryptData(p);
    //id accountType, access
    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{
                adminTransactions(user,withdrawId,null,withdrawAmount).then(result2 => {
                    if(result2){
                        res.status(201).json(result2);
                        console.log("success");
                    }
                    else {
                        console.log("invalid transaction");
                        res.status(403).json("invalid transaction");
                    }
                }) },
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })
})

app.post("/transfer",(req, res) => {
    const{u, p, fromAcc, toAcc, amount} =req.body;
    if(!u || !p || !fromAcc || !amount||!toAcc)
        return res.status(400).json({ error: 'invalid input' });


    const user = decryptData(u);
    const fromId = decryptData(fromAcc);
    const toId = decryptData(toAcc);
    const transferAmount = decryptData(amount);
    const pass = decryptData(p);
    //id accountType, access
    getUser(user).then(result => {
        verifyPassword(pass,result.salt,result.hash,() =>{
                transfer(user,toId,fromId,transferAmount).then(result2 => {
                    if(result2){
                        res.status(201).json(result2);
                        console.log("success");
                    }
                    else {
                        console.log("invalid transaction");
                        res.status(403).json("invalid transaction");
                    }
                }) },
            () => {
                console.log("PASSWORD INVALID FOR:", user);
                res.status(403).json("password is invalid");
            })
    })
})
getUser("aidan").then(result => {console.log(result)});
getUser("billy bob").then(result => {console.log(result)});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

